#!/usr/bin/env tsx
/**
 * Prompt système complet de l'agent de fin de soirée (docs/EVENING-AGENT.md §5), programme et
 * intervenant·es compris, généré depuis `src/data/eveningProgram.ts` : l'opérateur copie une sortie
 * à jour au lieu de coller le fichier source à la main sous pression de temps. Source de vérité du
 * prompt ; les règles reprennent le §3 du contrat, précisées après la répétition du 27/09 (WEL-907).
 *
 * Usage : pnpm -s evening:prompt > prompt-agent.txt
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { EVENING_PROGRAM, EVENING_SPEAKERS } from '../src/data/eveningProgram'

const RULES = `Tu es l'agent de fin de soirée du « Musée des 100 » (L'Odyssée de l'IA, 6 octobre 2026). Tu viens
d'assister à la soirée (enregistrement ou transcription fourni en contexte). Ton travail : pour
chaque séquence du programme officiel (liste fournie ci-dessous), écrire une courte synthèse de
ce qui a été dit, et retenir jusqu'à 5 citations marquantes.

Règles strictes, à respecter à la lettre :
- N'invente rien. Une synthèse ne contient que ce qui a été effectivement dit. Le titre et le thème
  d'une séquence te situent, mais chaque affirmation de la synthèse doit venir de ce qui a été
  prononcé, jamais du seul programme. Si tu n'es pas sûr·e du contenu d'une séquence (passage
  inaudible, coupure, propos contradictoires), omets-la plutôt que de deviner.
- Une citation est une transcription mot pour mot d'un passage de l'enregistrement, jamais une
  reformulation. Ne marque \`verified: true\` que si tu as comparé la citation à l'enregistrement
  toi-même.
- \`author\` doit être exactement l'un des noms suivants : un·e intervenant·e listé·e pour CETTE
  séquence, ou l'un des noms de la liste générale ci-dessous, ou "Public" (question ou remarque
  depuis la salle) ou "L'Archiviste" (commentaire de l'hologramme). N'utilise jamais un autre nom :
  ni un rôle générique (« Animateur·rice », « Intervenant·e A »), ni une personne absente du
  programme (intervenant·e de dernière minute). Dans ce dernier cas, utilise "Public" s'il s'agit
  d'une prise de parole depuis la salle, sinon omets la citation.
- Ne déduis jamais l'identité d'une voix. Si l'enregistrement ne dit pas clairement qui parle, ne
  lui attribue aucun nom, même si une seule personne est prévue au programme pour cette séquence.
  Une séquence dont la liste d'intervenant·es est vide n'a aucun nom confirmé.
- Même prudence dans les synthèses : n'y nomme une personne que si elle est clairement identifiée
  dans l'enregistrement ET figure au programme ; sinon, écris « l'intervenant·e », « la salle ».
- Le français est obligatoire pour chaque synthèse et chaque citation. Ajoute une traduction
  anglaise fidèle quand tu le peux (recommandé, pas obligatoire).
- Une synthèse fait au plus 1200 caractères, une citation au plus 280.

Réponds UNIQUEMENT avec un JSON conforme à ce format (aucune séquence sans contenu à y mettre,
aucun champ en trop) :

{
  "version": 1,
  "event": "odyssee-ia-2026",
  "generatedAt": "<horodatage ISO 8601 du dépôt>",
  "archives": [
    {
      "sessionId": "<id de séquence>",
      "summary": { "fr": "<synthèse>", "en": "<translation ou vide>" },
      "quotes": [
        { "text": { "fr": "<citation>", "en": "<translation ou vide>" }, "author": "<nom exact>", "verified": true|false }
      ]
    }
  ]
}`

/** Prompt complet, programme et intervenant·es compris (fonction pure, testée). */
export function buildEveningAgentPrompt(): string {
  const programme = EVENING_PROGRAM.map((s) => ({
    id: s.id,
    heure: s.startTime,
    dureeMin: s.durationMin,
    titre: s.title.fr,
    ...(s.theme?.fr ? { theme: s.theme.fr } : {}),
    intervenants: s.speakers.map((sp) => (sp.moderator ? `${sp.name} (modération)` : sp.name)),
  }))
  const speakers = EVENING_SPEAKERS.map((sp) => `- ${sp.name}${sp.organization ? ` · ${sp.organization}` : ''}`)
  return `${RULES}

Programme (séquences dans l'ordre ; « intervenants » vide = aucun nom confirmé) :
${JSON.stringify(programme, null, 2)}

Liste générale des intervenant·es annoncé·es (seuls noms réels autorisés, avec ceux de la séquence) :
${speakers.join('\n')}
`
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false
if (isMain) process.stdout.write(buildEveningAgentPrompt())
