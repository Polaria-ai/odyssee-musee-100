/**
 * Génère le SQL (upsert idempotent) du programme de la soirée depuis EVENING_PROGRAM, pour
 * peupler la table evening_sessions (requise avant tout dépôt d'archive : clé étrangère).
 * Usage : pnpm exec tsx scripts/evening-sessions-sql.ts > supabase/seed/evening-sessions.sql
 * À rejouer à chaque mise à jour du programme (ex. programme définitif), puis appliquer le SQL.
 * Les séquences absentes du programme sont supprimées de la table (voir la fin du SQL).
 */
import { EVENING_PROGRAM } from '../src/data/eveningProgram'

const q = (v: string | undefined | null) => (v === undefined || v === null ? 'null' : `'${v.replace(/'/g, "''")}'`)
const rows = EVENING_PROGRAM.map(
  (s) =>
    `(${q(s.id)}, ${s.order}, ${q(s.startTime)}, ${s.durationMin}, ${q(s.kind)}, ${q(s.title.fr)}, ${q(s.title.en)}, ${q(s.theme?.fr)}, ${q(s.theme?.en)}, ${q(JSON.stringify(s.speakers))}::jsonb, ${s.provisional})`,
)
console.log(`-- Généré par scripts/evening-sessions-sql.ts — ne pas éditer à la main.
insert into public.evening_sessions (id, ord, start_time, duration_min, kind, title_fr, title_en, theme_fr, theme_en, speakers, provisional) values
${rows.join(',\n')}
on conflict (id) do update set ord = excluded.ord, start_time = excluded.start_time, duration_min = excluded.duration_min, kind = excluded.kind, title_fr = excluded.title_fr, title_en = excluded.title_en, theme_fr = excluded.theme_fr, theme_en = excluded.theme_en, speakers = excluded.speakers, provisional = excluded.provisional;
-- Séquences retirées du programme (ex. « ouverture-agentique » et « au-revoir » au 24/09) : supprimées,
-- sans quoi elles resteraient affichées. Refusé par la clé étrangère si une archive y est rattachée.
delete from public.evening_sessions where id not in (${EVENING_PROGRAM.map((s) => q(s.id)).join(', ')});`)
