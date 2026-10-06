-- PostgreSQL CI jetable : rôles publics attendus par les migrations Supabase réelles.
-- Aucun secret, aucune connexion au projet Supabase de production.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated;
