-- Bulles thématiques sourcées pour les trois vitrines existantes. Chaque bulle accompagne
-- la transcription, sans ajouter de séquence au programme ni de droit d'écriture public.
-- Déploiement séparé par l'orchestrateur : ce fichier ne publie aucun contenu.

alter table public.session_archives
  add column if not exists highlights jsonb not null default '[]'::jsonb;

alter table public.session_archives
  drop constraint if exists session_archives_highlights_array;

alter table public.session_archives
  add constraint session_archives_highlights_array
    check (
      case when jsonb_typeof(highlights) = 'array'
        then jsonb_array_length(highlights) <= 12
        else false
      end
    );

-- JavaScript/Zod compte les unités UTF-16, PostgreSQL les points Unicode. Les caractères
-- hors du BMP comptent donc pour deux unités dans toutes les limites du contrat client.
-- Ces fonctions pures n'accèdent à aucune table ni à aucun état de publication.
create or replace function public.archive_text_utf16_length(value text)
returns integer
language sql immutable strict
set search_path = ''
as $$
  select coalesce(sum(case when ascii(code_point) > 65535 then 2 else 1 end), 0)::integer
  from regexp_split_to_table($1, '') as code_points(code_point)
  where code_point <> '';
$$;

-- Ensemble exact de String.trim() ECMAScript (WhiteSpace + LineTerminator), sans NEL
-- ni espace de largeur nulle. Seuls les bords sont retirés, comme dans le schéma Zod.
create or replace function public.archive_trim_js(value text)
returns text
language sql immutable strict
set search_path = ''
as $$
  select btrim($1, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;

create or replace function public.session_archives_validate_highlights()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  highlight jsonb;
  source jsonb;
  highlight_id text;
  excerpt text;
  seen_ids text[] := array[]::text[];
begin
  if new.highlights is null or jsonb_typeof(new.highlights) <> 'array' then
    raise exception 'Archive highlights must be a JSON array';
  end if;
  if jsonb_array_length(new.highlights) > 12 then
    raise exception 'At most twelve highlights are allowed per roundtable';
  end if;

  for highlight in select value from jsonb_array_elements(new.highlights) loop
    if jsonb_typeof(highlight) <> 'object'
       or jsonb_typeof(highlight -> 'id') is distinct from 'string' then
      raise exception 'Each highlight must have an id';
    end if;
    highlight_id := highlight ->> 'id';
    if highlight_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       or highlight_id = any(seen_ids) then
      raise exception 'Highlight ids must be unique and kebab-case within each roundtable';
    end if;
    seen_ids := array_append(seen_ids, highlight_id);

    if jsonb_typeof(highlight -> 'title') is distinct from 'object'
       or jsonb_typeof(highlight #> '{title,fr}') is distinct from 'string'
       or jsonb_typeof(highlight #> '{title,en}') is distinct from 'string'
       or public.archive_text_utf16_length(public.archive_trim_js(highlight #>> '{title,fr}')) not between 1 and 100
       or public.archive_text_utf16_length(highlight #>> '{title,en}') > 100 then
      raise exception 'Highlight titles require FR and EN strings, with a nonempty FR title of at most 100 characters';
    end if;
    if jsonb_typeof(highlight -> 'body') is distinct from 'object'
       or jsonb_typeof(highlight #> '{body,fr}') is distinct from 'string'
       or jsonb_typeof(highlight #> '{body,en}') is distinct from 'string'
       or public.archive_text_utf16_length(public.archive_trim_js(highlight #>> '{body,fr}')) not between 1 and 800
       or public.archive_text_utf16_length(highlight #>> '{body,en}') > 800 then
      raise exception 'Highlight bodies require FR and EN strings, with a nonempty FR body of at most 800 characters';
    end if;

    source := highlight -> 'source';
    if jsonb_typeof(source) is distinct from 'object'
       or jsonb_typeof(source -> 'excerpt') is distinct from 'string' then
      raise exception 'Each highlight requires a French source excerpt';
    end if;
    excerpt := source ->> 'excerpt';
    if public.archive_trim_js(excerpt) = '' or public.archive_text_utf16_length(excerpt) > 2000
       or new.transcript_fr is null or strpos(public.archive_trim_js(new.transcript_fr), excerpt) = 0 then
      raise exception 'Highlight excerpts must be exact nonempty passages from the French transcript, at most 2000 characters';
    end if;

    if source ? 'startSec' then
      if jsonb_typeof(source -> 'startSec') is distinct from 'number' then
        raise exception 'Highlight startSec must be a finite nonnegative number';
      end if;
      if (source ->> 'startSec')::numeric < 0
         or (source ->> 'startSec')::numeric > 1.7976931348623157e308::numeric then
        raise exception 'Highlight startSec must be a finite nonnegative number';
      end if;
    end if;
    if source ? 'endSec' then
      if jsonb_typeof(source -> 'endSec') is distinct from 'number' then
        raise exception 'Highlight endSec must be a finite nonnegative number';
      end if;
      if (source ->> 'endSec')::numeric < 0
         or (source ->> 'endSec')::numeric > 1.7976931348623157e308::numeric then
        raise exception 'Highlight endSec must be a finite nonnegative number';
      end if;
    end if;
    if source ? 'startSec' and source ? 'endSec'
       and (source ->> 'endSec')::numeric < (source ->> 'startSec')::numeric then
      raise exception 'Highlight endSec must not precede startSec';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists session_archives_validate_highlights on public.session_archives;
create trigger session_archives_validate_highlights
  before insert or update of transcript_fr, highlights on public.session_archives
  for each row
  execute function public.session_archives_validate_highlights();

-- session_archives_select_published et les droits existants restent applicables aux bulles.
-- Aucune attribution ni relecture humaine n'est créée par cette migration.
