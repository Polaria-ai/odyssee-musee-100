-- Les Archives de 2040 ne conservent désormais que les transcriptions des trois tables rondes.
-- Le programme complet reste dans evening_sessions pour le chat de Rémi et le reste du jeu.

alter table public.session_archives
  add column if not exists transcript_fr text,
  add column if not exists transcript_en text;

drop trigger if exists session_archives_validate_roundtable_transcript on public.session_archives;

-- Les anciens résumés/citations ne valent pas transcription et ne doivent plus rester publiés.
-- Les lignes sont conservées pour l'historique, mais deviennent invisibles jusqu'à relecture.
update public.session_archives
set published = false, reviewed_by = null
where session_id not in ('table-ronde-1', 'table-ronde-2', 'table-ronde-3')
   or transcript_fr is null
   or char_length(btrim(transcript_fr)) = 0;

-- Les anciennes colonnes restent disponibles pour compatibilité historique, mais ne sont plus
-- obligatoires pour une nouvelle ligne d'archive.
alter table public.session_archives
  alter column summary_fr drop not null,
  alter column summary_fr set default '',
  alter column summary_en drop not null,
  alter column summary_en set default '';

alter table public.session_archives
  drop constraint if exists session_archives_summary_fr_length;

alter table public.session_archives
  drop constraint if exists session_archives_transcript_fr_length,
  drop constraint if exists session_archives_transcript_en_length,
  drop constraint if exists session_archives_published_transcript_required;

alter table public.session_archives
  add constraint session_archives_transcript_fr_length
    check (transcript_fr is null or char_length(btrim(transcript_fr)) between 1 and 40000),
  add constraint session_archives_transcript_en_length
    check (transcript_en is null or char_length(transcript_en) <= 40000),
  add constraint session_archives_published_transcript_required
    check (not published or (transcript_fr is not null and char_length(btrim(transcript_fr)) between 1 and 40000));

create or replace function public.session_archives_validate_roundtable_transcript()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.session_id not in ('table-ronde-1', 'table-ronde-2', 'table-ronde-3') then
    raise exception 'Only the three roundtables can be archived';
  end if;
  if new.published and (new.transcript_fr is null or char_length(btrim(new.transcript_fr)) = 0) then
    raise exception 'A reviewed French transcript is required before publication';
  end if;
  return new;
end;
$$;

drop trigger if exists session_archives_validate_roundtable_transcript on public.session_archives;
create trigger session_archives_validate_roundtable_transcript
  before insert or update on public.session_archives
  for each row
  execute function public.session_archives_validate_roundtable_transcript();
