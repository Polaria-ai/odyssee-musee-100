-- Le Musée des 100 — table des 100 qui font l'IA en Europe (étude Oliver Wyman).
-- Lecture publique des fiches publiées uniquement ; AUCUNE écriture côté client
-- (l'import se fait localement avec la clé de service, hors du navigateur).
-- Idempotent : peut être rejoué sans erreur.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.people (
  id text primary key,
  ord integer not null,
  name text not null,
  role_fr text not null default '',
  role_en text not null default '',
  organization text not null default '',
  country text not null,
  wing text not null,
  bio_fr text not null default '',
  bio_en text not null default '',
  story_fr text not null default '',
  story_en text not null default '',
  quote_fr text,
  quote_en text,
  photo_url text,
  photo_credit text,
  links jsonb not null default '[]'::jsonb,
  placeholder boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_id_kebab check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint people_ord_positive check (ord >= 1),
  constraint people_name_length check (char_length(name) between 1 and 80),
  constraint people_country_code check (country ~ '^[A-Z]{2}$'),
  constraint people_wing_valid check (wing in ('infrastructures', 'industrialisation', 'culture')),
  constraint people_bio_fr_length check (char_length(bio_fr) <= 220),
  constraint people_photo_url_valid check (
    photo_url is null
    or photo_url ~ '^https://'
    or photo_url ~ '^/portraits/[a-zA-Z0-9._-]+$'
  )
);

create index if not exists people_wing_ord_idx on public.people (wing, ord);

-- `updated_at` automatique à chaque modification.
create or replace function public.people_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists people_set_updated_at on public.people;
create trigger people_set_updated_at
  before update on public.people
  for each row
  execute function public.people_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : lecture publique des fiches publiées, aucune écriture cliente.
-- ---------------------------------------------------------------------------

alter table public.people enable row level security;

drop policy if exists "people_select_published" on public.people;
create policy "people_select_published"
  on public.people
  for select
  to anon, authenticated
  using (published = true);

-- Pas de policy insert/update/delete : RLS refuse toute écriture par défaut.
-- Ceinture-bretelles : on retire aussi les droits d'écriture au niveau table.
revoke insert, update, delete on public.people from anon, authenticated;
grant select on public.people to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Stockage : bucket public « portraits » (photos), lecture publique seulement.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portraits', 'portraits', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Aucune policy SELECT sur storage.objects : un bucket public sert ses fichiers par
-- URL publique sans policy, et une policy SELECT large permettrait de lister le bucket.
drop policy if exists "portraits_public_read" on storage.objects;

-- Pas de policy d'écriture non plus : l'upload se fait avec la clé de service
-- (script d'import), jamais depuis le navigateur.
