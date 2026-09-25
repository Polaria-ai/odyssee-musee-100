-- Le Musée des 100 — Les Archives de 2040 : programme de la soirée et archives déposées
-- par l'Archiviste. Lecture publique du programme (toutes les séquences, même provisoires) ;
-- lecture publique des archives PUBLIÉES SEULEMENT. AUCUNE écriture côté client (l'import se
-- fait localement avec la clé de service, hors du navigateur, voir docs/EVENING-AGENT.md).
-- Idempotent : peut être rejoué sans erreur. NE PAS APPLIQUER depuis ce module (l'orchestrateur
-- s'en charge).

-- ---------------------------------------------------------------------------
-- evening_sessions : le programme, séquence par séquence.
-- ---------------------------------------------------------------------------

create table if not exists public.evening_sessions (
  id text primary key,
  ord integer not null,
  start_time text not null,
  duration_min integer not null,
  kind text not null,
  title_fr text not null default '',
  title_en text not null default '',
  theme_fr text,
  theme_en text,
  speakers jsonb not null default '[]'::jsonb,
  provisional boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint evening_sessions_id_kebab check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint evening_sessions_ord_positive check (ord >= 1),
  constraint evening_sessions_duration_positive check (duration_min >= 1),
  constraint evening_sessions_start_time_valid check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  constraint evening_sessions_kind_valid check (
    kind in ('ouverture', 'film', 'presentation', 'keynote', 'les100', 'magneto', 'table-ronde', 'face-a-face', 'final', 'cloture')
  ),
  constraint evening_sessions_title_fr_length check (char_length(title_fr) between 1 and 200)
);

create index if not exists evening_sessions_ord_idx on public.evening_sessions (ord);

create or replace function public.evening_sessions_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists evening_sessions_set_updated_at on public.evening_sessions;
create trigger evening_sessions_set_updated_at
  before update on public.evening_sessions
  for each row
  execute function public.evening_sessions_set_updated_at();

alter table public.evening_sessions enable row level security;

-- Le programme est public dans son intégralité, y compris les séquences provisoires : ce n'est
-- pas une information sensible, contrairement aux archives (voir plus bas).
drop policy if exists "evening_sessions_select_all" on public.evening_sessions;
create policy "evening_sessions_select_all"
  on public.evening_sessions
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.evening_sessions from anon, authenticated;
grant select on public.evening_sessions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- session_archives : ce que l'Archiviste a déposé pour une séquence (synthèse + citations).
-- Une ligne par séquence au plus (une vitrine par séquence, voir src/archives/layout.ts).
-- ---------------------------------------------------------------------------

create table if not exists public.session_archives (
  session_id text primary key references public.evening_sessions (id) on delete cascade,
  summary_fr text not null default '',
  summary_en text not null default '',
  quotes jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now(),
  published boolean not null default false,
  reviewed_by text,
  updated_at timestamptz not null default now(),
  constraint session_archives_summary_fr_length check (char_length(summary_fr) between 1 and 1200),
  constraint session_archives_summary_en_length check (char_length(summary_en) <= 1200),
  constraint session_archives_quotes_max check (jsonb_array_length(quotes) <= 5)
);

create or replace function public.session_archives_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists session_archives_set_updated_at on public.session_archives;
create trigger session_archives_set_updated_at
  before update on public.session_archives
  for each row
  execute function public.session_archives_set_updated_at();

alter table public.session_archives enable row level security;

-- Lecture publique des archives PUBLIÉES SEULEMENT : tant qu'une archive n'a pas été relue par
-- un humain (voir docs/EVENING-AGENT.md), elle n'existe pas pour les visiteurs.
drop policy if exists "session_archives_select_published" on public.session_archives;
create policy "session_archives_select_published"
  on public.session_archives
  for select
  to anon, authenticated
  using (published = true);

-- Pas de policy insert/update/delete : RLS refuse toute écriture par défaut. Ceinture-bretelles :
-- on retire aussi les droits d'écriture au niveau table. Seul l'import local (clé de service,
-- `pnpm exec tsx scripts/import-evening.ts --push`) peut écrire.
revoke insert, update, delete on public.session_archives from anon, authenticated;
grant select on public.session_archives to anon, authenticated;
