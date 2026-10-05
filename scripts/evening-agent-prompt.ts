#!/usr/bin/env tsx
/**
 * Prompt système de l'agent de transcription (docs/EVENING-AGENT.md), programme et
 * intervenant·es compris, généré depuis `src/data/eveningProgram.ts` : l'opérateur copie une sortie
 * à jour au lieu de coller le fichier source à la main sous pression de temps. Source de vérité du
 * prompt ; les règles reprennent le §3 du contrat, précisées après la répétition du 27/09 (WEL-907).
 *
 * Usage : pnpm -s evening:prompt > prompt-agent.txt
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ARCHIVE_SESSIONS } from '../src/data/eveningProgram'

const RULES = `Tu es l'agent de transcription du « Musée des 100 » (L'Odyssée de l'IA, 6 octobre 2026).
À partir des enregistrements ou transcriptions fournis, tu produis uniquement la transcription
intégrale des trois tables rondes indiquées ci-dessous. N'archive aucune autre partie de la soirée.

Règles strictes, à respecter à la lettre :
- N'invente, ne complète et ne reformule aucun propos. Conserve les mots, les reprises, les
  hésitations et l'ordre des prises de parole; corrige seulement la ponctuation nécessaire à la
  lecture, sans changer le sens.
- Reprends les étiquettes de locuteur de la source. N'identifie jamais une voix par déduction; si
  la source ne l'identifie pas, écris « Voix non identifiée ».
- Pour un passage inaudible, écris « [inaudible] » à l'endroit concerné. Ne supprime pas un passage
  difficile et ne complète pas les mots manquants.
- Le français est obligatoire dans \`transcript.fr\`. \`transcript.en\` contient une traduction
  intégrale fidèle si elle est demandée ou fournie; sinon, utilise une chaîne vide. La version
  anglaise ne remplace jamais la transcription source.
- Chaque version peut contenir au plus 40 000 caractères. Ne tronque jamais une transcription pour
  respecter cette limite : si elle la dépasse, omets cette entrée et signale-le hors du JSON.
- La personne opératrice relit chaque transcription et chaque étiquette avant publication.

Réponds UNIQUEMENT avec un JSON conforme à ce format (aucune séquence sans contenu à y mettre,
aucun champ en trop) :

{
  "version": 2,
  "event": "odyssee-ia-2026",
  "generatedAt": "<horodatage ISO 8601 du dépôt>",
  "archives": [
    {
      "sessionId": "<id d'une table ronde>",
      "transcript": { "fr": "<transcription intégrale>", "en": "<traduction intégrale ou vide>" }
    }
  ]
}`

/** Prompt de transcription avec uniquement les trois tables rondes (fonction pure). */
export function buildEveningAgentPrompt(): string {
  const programme = ARCHIVE_SESSIONS.map((s) => ({
    id: s.id,
    heure: s.startTime,
    dureeMin: s.durationMin,
    titre: s.title.fr,
    ...(s.theme?.fr ? { theme: s.theme.fr } : {}),
    intervenants: s.speakers.map((sp) => (sp.moderator ? `${sp.name} (modération)` : sp.name)),
  }))
  return `${RULES}

Tables rondes à transcrire (dans l'ordre ; le programme sert uniquement à retrouver la séquence) :
${JSON.stringify(programme, null, 2)}
`
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false
if (isMain) process.stdout.write(buildEveningAgentPrompt())
