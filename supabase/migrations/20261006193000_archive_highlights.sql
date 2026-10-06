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
       or (highlight #>> '{title,fr}') !~ '[^[:space:]]'
       or char_length(btrim(highlight #>> '{title,fr}')) not between 1 and 100
       or char_length(highlight #>> '{title,en}') > 100 then
      raise exception 'Highlight titles require FR and EN strings, with a nonempty FR title of at most 100 characters';
    end if;
    if jsonb_typeof(highlight -> 'body') is distinct from 'object'
       or jsonb_typeof(highlight #> '{body,fr}') is distinct from 'string'
       or jsonb_typeof(highlight #> '{body,en}') is distinct from 'string'
       or (highlight #>> '{body,fr}') !~ '[^[:space:]]'
       or char_length(btrim(highlight #>> '{body,fr}')) not between 1 and 800
       or char_length(highlight #>> '{body,en}') > 800 then
      raise exception 'Highlight bodies require FR and EN strings, with a nonempty FR body of at most 800 characters';
    end if;

    source := highlight -> 'source';
    if jsonb_typeof(source) is distinct from 'object'
       or jsonb_typeof(source -> 'excerpt') is distinct from 'string' then
      raise exception 'Each highlight requires a French source excerpt';
    end if;
    excerpt := source ->> 'excerpt';
    if excerpt !~ '[^[:space:]]' or char_length(excerpt) > 2000
       or new.transcript_fr is null or strpos(new.transcript_fr, excerpt) = 0 then
      raise exception 'Highlight excerpts must be exact nonempty passages from the French transcript, at most 2000 characters';
    end if;

    if source ? 'startSec' then
      if jsonb_typeof(source -> 'startSec') is distinct from 'number' then
        raise exception 'Highlight startSec must be a nonnegative number';
      end if;
      if (source ->> 'startSec')::numeric < 0 then
        raise exception 'Highlight startSec must be a nonnegative number';
      end if;
    end if;
    if source ? 'endSec' then
      if jsonb_typeof(source -> 'endSec') is distinct from 'number' then
        raise exception 'Highlight endSec must be a nonnegative number';
      end if;
      if (source ->> 'endSec')::numeric < 0 then
        raise exception 'Highlight endSec must be a nonnegative number';
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
