-- Tests réels PostgreSQL 17, après les trois migrations evening/transcripts/highlights.
-- Exécuter avec psql --set ON_ERROR_STOP=1 dans une base CI jetable.
-- Tous les textes TestCI sont fictifs. La transaction est annulée en fin de parcours.
begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'TestCI assertion failed: %', message;
  end if;
end;
$$;

create function pg_temp.highlight(highlight_id text default 'testci-point')
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', highlight_id,
    'title', jsonb_build_object('fr', 'TestCI une idée', 'en', 'TestCI an idea'),
    'body', jsonb_build_object('fr', 'TestCI synthèse du passage.', 'en', 'TestCI summary of the excerpt.'),
    'source', jsonb_build_object('excerpt', 'TestCI première idée.', 'startSec', 10, 'endSec', 12.5)
  );
$$;

-- Les candidats sont appliqués à une ligne existante dont la FK est valide. Un test n'est
-- réussi que si le message du trigger highlights est exactement celui qui est attendu.
create function pg_temp.expect_highlights_rejected(candidate jsonb, expected_message text)
returns void language plpgsql as $$
declare
  observed_message text;
begin
  begin
    update public.session_archives set highlights = candidate
    where session_id = 'table-ronde-1';
  exception when others then
    observed_message := sqlerrm;
  end;
  if observed_message is distinct from expected_message then
    raise exception 'TestCI expected rejection "%", received "%"', expected_message, coalesce(observed_message, 'no error');
  end if;
end;
$$;

insert into public.evening_sessions (
  id, ord, start_time, duration_min, kind, title_fr, title_en, speakers, provisional
) values
  ('table-ronde-1', 1, '18:00', 10, 'table-ronde', 'TestCI première table', 'TestCI first panel', '[]', false),
  ('table-ronde-2', 2, '18:10', 10, 'table-ronde', 'TestCI deuxième table', 'TestCI second panel', '[]', false),
  ('table-ronde-3', 3, '18:20', 10, 'table-ronde', 'TestCI troisième table', 'TestCI third panel', '[]', false);

-- Ancien payload : la colonne absente prend [], sans invalider la transcription publiée.
insert into public.session_archives (session_id, transcript_fr, transcript_en, published)
values ('table-ronde-1', 'TestCI introduction. TestCI première idée. TestCI conclusion.', '', true);

select pg_temp.assert_true(
  (select highlights = '[]'::jsonb and reviewed_by is null from public.session_archives where session_id = 'table-ronde-1'),
  'legacy insert must have empty highlights and no invented reviewer'
);

insert into public.session_archives (session_id, transcript_fr, transcript_en, highlights, published)
values
  ('table-ronde-2', 'TestCI première idée. TestCI deuxième table.', 'TestCI first idea. TestCI second panel.', jsonb_build_array(pg_temp.highlight('testci-panel-two')), true),
  ('table-ronde-3', 'TestCI première idée. TestCI troisième table.', '', jsonb_build_array(pg_temp.highlight('testci-panel-three')), true);

update public.session_archives
set highlights = jsonb_build_array(pg_temp.highlight())
where session_id = 'table-ronde-1';

select pg_temp.assert_true(
  (select count(*) = 3 from public.session_archives where published and jsonb_array_length(highlights) = 1),
  'all three canonical panels accept sourced bilingual highlights'
);
select pg_temp.assert_true(
  (select highlights #>> '{0,source,startSec}' = '10' and highlights #>> '{0,source,endSec}' = '12.5'
   from public.session_archives where session_id = 'table-ronde-1'),
  'fractional audio timestamps are retained'
);

-- Une modification de texte seule ne peut garder l'extrait d'une ancienne transcription.
do $$
declare
  observed_message text;
begin
  begin
    update public.session_archives set transcript_fr = 'TestCI nouvelle transcription sans cet extrait.'
    where session_id = 'table-ronde-1';
  exception when others then
    observed_message := sqlerrm;
  end;
  if observed_message is distinct from 'Highlight excerpts must be exact nonempty passages from the French transcript, at most 2000 characters' then
    raise exception 'TestCI changing only the transcript must reject stale excerpts, received "%"', coalesce(observed_message, 'no error');
  end if;
end;
$$;

-- Le même INSERT ... ON CONFLICT que l'import met à jour texte et bulles atomiquement.
insert into public.session_archives (session_id, transcript_fr, transcript_en, highlights, published, reviewed_by)
values (
  'table-ronde-1', 'TestCI deuxième idée. TestCI contenu corrigé.', '',
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,excerpt}', to_jsonb('TestCI deuxième idée.'::text))),
  true, null
)
on conflict (session_id) do update set
  transcript_fr = excluded.transcript_fr,
  transcript_en = excluded.transcript_en,
  highlights = excluded.highlights,
  published = excluded.published,
  reviewed_by = excluded.reviewed_by;

select pg_temp.assert_true(
  (select transcript_fr = 'TestCI deuxième idée. TestCI contenu corrigé.'
     and highlights #>> '{0,source,excerpt}' = 'TestCI deuxième idée.' and reviewed_by is null
   from public.session_archives where session_id = 'table-ronde-1'),
  'upsert updates transcript and source excerpt together'
);

update public.session_archives
set transcript_fr = 'TestCI introduction. TestCI première idée. TestCI conclusion.',
    highlights = jsonb_build_array(pg_temp.highlight())
where session_id = 'table-ronde-1';

select pg_temp.expect_highlights_rejected(
  jsonb_build_array(pg_temp.highlight(), pg_temp.highlight()),
  'Highlight ids must be unique and kebab-case within each roundtable'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{id}', to_jsonb('TestCI invalid id'::text))),
  'Highlight ids must be unique and kebab-case within each roundtable'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,excerpt}', to_jsonb('TestCI passage absent.'::text))),
  'Highlight excerpts must be exact nonempty passages from the French transcript, at most 2000 characters'
);
select pg_temp.expect_highlights_rejected(
  (select jsonb_agg(pg_temp.highlight('testci-point-' || n::text)) from generate_series(1, 13) as n),
  'At most twelve highlights are allowed per roundtable'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{body,fr}', to_jsonb('TestCI ' || repeat('x', 794)))),
  'Highlight bodies require FR and EN strings, with a nonempty FR body of at most 800 characters'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{title,en}', to_jsonb('TestCI ' || repeat('x', 94)))),
  'Highlight titles require FR and EN strings, with a nonempty FR title of at most 100 characters'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,excerpt}', to_jsonb('TestCI ' || repeat('x', 1994)))),
  'Highlight excerpts must be exact nonempty passages from the French transcript, at most 2000 characters'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,endSec}', '9')),
  'Highlight endSec must not precede startSec'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,startSec}', '-1')),
  'Highlight startSec must be a finite nonnegative number'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,endSec}', '-1')),
  'Highlight endSec must be a finite nonnegative number'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,startSec}', '"10"')),
  'Highlight startSec must be a finite nonnegative number'
);
select pg_temp.expect_highlights_rejected(null, 'Archive highlights must be a JSON array');
select pg_temp.expect_highlights_rejected('null', 'Archive highlights must be a JSON array');
select pg_temp.expect_highlights_rejected('{}', 'Archive highlights must be a JSON array');
select pg_temp.expect_highlights_rejected('[null]', 'Each highlight must have an id');
select pg_temp.expect_highlights_rejected('[{}]', 'Each highlight must have an id');
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{title}', to_jsonb('TestCI malformed title'::text))),
  'Highlight titles require FR and EN strings, with a nonempty FR title of at most 100 characters'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(pg_temp.highlight() #- '{body,en}'),
  'Highlight bodies require FR and EN strings, with a nonempty FR body of at most 800 characters'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(pg_temp.highlight() #- '{source}'), 'Each highlight requires a French source excerpt'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,excerpt}', 'null')),
  'Each highlight requires a French source excerpt'
);

-- Valides : plafond exact de douze, anglais vide, aucun horodatage non disponible.
update public.session_archives
set highlights = (
  select jsonb_agg(pg_temp.highlight('testci-point-' || n::text)) from generate_series(1, 12) as n
)
where session_id = 'table-ronde-1';
select pg_temp.assert_true(
  (select jsonb_array_length(highlights) = 12 from public.session_archives where session_id = 'table-ronde-1'),
  'twelve highlights are accepted'
);
update public.session_archives
set highlights = jsonb_build_array(
  jsonb_set(jsonb_set(pg_temp.highlight() #- '{source,startSec}' #- '{source,endSec}', '{title,en}', '""'), '{body,en}', '""')
)
where session_id = 'table-ronde-1';

-- Régressions Unicode TestCI : les limites sont celles de String.length/Zod (UTF-16),
-- et non char_length. Un emoji non BMP occupe deux unités, un caractère BMP en occupe une.
select pg_temp.assert_true(
  public.archive_text_utf16_length('') = 0
  and public.archive_text_utf16_length('TestCI') = 6
  and public.archive_text_utf16_length(U&'\+01F600') = 2
  and public.archive_text_utf16_length(repeat(U&'\+01F600', 50)) = 100,
  'Unicode length matches JavaScript UTF-16 units'
);
select pg_temp.assert_true(
  public.archive_trim_js(U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    || 'TestCI' || U&'\FEFF\3000\205F\202F\2029\2028\200A\2009\2008\2007\2006\2005\2004\2003\2002\2001\2000\1680\00A0\0020\000D\000C\000B\000A\0009') = 'TestCI'
  and public.archive_trim_js(U&'\0085\200B' || 'TestCI' || U&'\200B\0085') = U&'\0085\200B' || 'TestCI' || U&'\200B\0085',
  'trim removes exactly ECMAScript edge whitespace, preserving NEL and zero-width space'
);

-- Les maxima exacts 100/800/2000 sont acceptés, même avec des espaces Unicode au bord
-- des champs FR (trim avant mesure). L'extrait est conservé brut et présent après trim du texte.
update public.session_archives
set transcript_fr = U&'\00A0\FEFF' || 'TestCI Unicode. ' || repeat(U&'\+01F600', 1001)
    || ' TestCI première idée.' || U&'\2029\3000',
    highlights = jsonb_build_array(jsonb_build_object(
      'id', 'testci-unicode-limit',
      'title', jsonb_build_object(
        'fr', U&'\00A0' || repeat(U&'\+01F600', 50) || U&'\FEFF',
        'en', repeat(U&'\+01F600', 50)
      ),
      'body', jsonb_build_object(
        'fr', U&'\3000' || repeat(U&'\+01F600', 400) || U&'\2029',
        'en', repeat(U&'\+01F600', 400)
      ),
      'source', jsonb_build_object('excerpt', repeat(U&'\+01F600', 1000))
    ))
where session_id = 'table-ronde-1';
select pg_temp.assert_true(
  (select public.archive_text_utf16_length(public.archive_trim_js(highlights #>> '{0,title,fr}')) = 100
     and public.archive_text_utf16_length(highlights #>> '{0,title,en}') = 100
     and public.archive_text_utf16_length(public.archive_trim_js(highlights #>> '{0,body,fr}')) = 800
     and public.archive_text_utf16_length(highlights #>> '{0,body,en}') = 800
     and public.archive_text_utf16_length(highlights #>> '{0,source,excerpt}') = 2000
   from public.session_archives where session_id = 'table-ronde-1'),
  'exact UTF-16 field limits are accepted'
);

select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{title,en}', to_jsonb(repeat(U&'\+01F600', 51)))),
  'Highlight titles require FR and EN strings, with a nonempty FR title of at most 100 characters'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{title,fr}', to_jsonb(U&'\00A0' || repeat(U&'\+01F600', 51) || U&'\FEFF'))),
  'Highlight titles require FR and EN strings, with a nonempty FR title of at most 100 characters'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{body,en}', to_jsonb(repeat(U&'\+01F600', 401)))),
  'Highlight bodies require FR and EN strings, with a nonempty FR body of at most 800 characters'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{body,fr}', to_jsonb(U&'\3000' || repeat(U&'\+01F600', 401) || U&'\2029'))),
  'Highlight bodies require FR and EN strings, with a nonempty FR body of at most 800 characters'
);
-- 1001 emoji existent réellement dans le transcript : le rejet vérifie la taille, pas une absence.
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,excerpt}', to_jsonb(repeat(U&'\+01F600', 1001)))),
  'Highlight excerpts must be exact nonempty passages from the French transcript, at most 2000 characters'
);

-- Rechercher l'extrait dans le transcript après le même trim que Zod. Des bords présents
-- uniquement dans le texte brut ne constituent pas un passage visible dans la fiche du jeu.
update public.session_archives
set transcript_fr = U&'\00A0\FEFF' || 'TestCI première idée.' || U&'\2029\3000',
    highlights = jsonb_build_array(pg_temp.highlight())
where session_id = 'table-ronde-1';
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,excerpt}', to_jsonb(U&'\00A0\FEFF' || 'TestCI première idée.'))),
  'Highlight excerpts must be exact nonempty passages from the French transcript, at most 2000 characters'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,excerpt}', to_jsonb('TestCI première idée.' || U&'\2029\3000'))),
  'Highlight excerpts must be exact nonempty passages from the French transcript, at most 2000 characters'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,excerpt}', to_jsonb(U&'\00A0\FEFF'::text))),
  'Highlight excerpts must be exact nonempty passages from the French transcript, at most 2000 characters'
);
update public.session_archives
set transcript_fr = ' TestCI première idée. ', highlights = jsonb_build_array(pg_temp.highlight())
where session_id = 'table-ronde-1';
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,excerpt}', to_jsonb(' TestCI première idée. '::text))),
  'Highlight excerpts must be exact nonempty passages from the French transcript, at most 2000 characters'
);

-- Les espaces Unicode internes restent dans le transcript et sont citables exactement.
update public.session_archives
set transcript_fr = U&'\FEFF' || 'TestCI première idée.' || U&'\00A0' || 'TestCI suite.' || U&'\3000',
    highlights = jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,excerpt}',
      to_jsonb('TestCI première idée.' || U&'\00A0' || 'TestCI suite.')))
where session_id = 'table-ronde-1';
select pg_temp.assert_true(
  (select strpos(public.archive_trim_js(transcript_fr), highlights #>> '{0,source,excerpt}') > 0
   from public.session_archives where session_id = 'table-ronde-1'),
  'Unicode whitespace inside a source passage is preserved'
);

-- JSONB numeric accepte des nombres que JSON.parse convertit en Infinity. Les horodatages
-- SQL doivent rester bornés à Number.MAX_VALUE, comme z.number().finite() côté client.
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,startSec}', to_jsonb(1e400::numeric))),
  'Highlight startSec must be a finite nonnegative number'
);
select pg_temp.expect_highlights_rejected(
  jsonb_build_array(jsonb_set(pg_temp.highlight(), '{source,endSec}', to_jsonb(1e400::numeric))),
  'Highlight endSec must be a finite nonnegative number'
);
update public.session_archives
set highlights = jsonb_build_array(jsonb_set(
  jsonb_set(pg_temp.highlight(), '{source,startSec}', to_jsonb(1.7976931348623157e308::numeric)),
  '{source,endSec}', to_jsonb(1.7976931348623157e308::numeric)
))
where session_id = 'table-ronde-1';
select pg_temp.assert_true(
  (select (highlights #>> '{0,source,startSec}')::numeric = 1.7976931348623157e308::numeric
     and (highlights #>> '{0,source,endSec}')::numeric = 1.7976931348623157e308::numeric
   from public.session_archives where session_id = 'table-ronde-1'),
  'largest finite JavaScript timestamp is accepted'
);

-- Le propriétaire garde trois lignes; anon doit n'en voir que les deux publiées.
update public.session_archives set published = false where session_id = 'table-ronde-3';
select pg_temp.assert_true(
  (select count(*) = 3 from public.session_archives), 'owner sees published and draft rows'
);
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.session_archives', 'INSERT')
  and not has_table_privilege('anon', 'public.session_archives', 'UPDATE')
  and not has_table_privilege('anon', 'public.session_archives', 'DELETE')
  and not has_table_privilege('authenticated', 'public.session_archives', 'INSERT')
  and not has_table_privilege('authenticated', 'public.session_archives', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.session_archives', 'DELETE'),
  'public roles have no archive write privilege'
);

set local role anon;
do $$
declare
  denied boolean;
begin
  if current_user <> 'anon' then raise exception 'TestCI RLS checks must actually run as anon'; end if;
  if (select count(*) from public.session_archives) <> 2 then
    raise exception 'TestCI anon must see exactly the two published archives';
  end if;
  if exists (select 1 from public.session_archives where not published or session_id = 'table-ronde-3') then
    raise exception 'TestCI anon can see a draft archive';
  end if;
  if not exists (select 1 from public.session_archives where session_id = 'table-ronde-1' and jsonb_array_length(highlights) = 1) then
    raise exception 'TestCI anon cannot read published highlights';
  end if;

  denied := false;
  begin
    insert into public.session_archives (session_id, transcript_fr, published)
    values ('table-ronde-3', 'TestCI unauthorized insert.', true);
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'TestCI anon insert must be denied by permissions'; end if;

  denied := false;
  begin
    update public.session_archives set highlights = '[]' where session_id = 'table-ronde-1';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'TestCI anon update must be denied by permissions'; end if;

  denied := false;
  begin
    delete from public.session_archives where session_id = 'table-ronde-1';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'TestCI anon delete must be denied by permissions'; end if;
end;
$$;
reset role;

select 'TestCI archive highlights SQL checks passed' as result;
rollback;
