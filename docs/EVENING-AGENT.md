# L'agent de fin de soirée — contrat des Archives de 2040

À la fin de « L'Odyssée de l'IA » (6 octobre 2026), un agent relit ce qui a été dit pendant la
soirée et dépose, pour chaque séquence du programme, une synthèse et jusqu'à 5 citations
marquantes. Ce document est son contrat : ce qu'il reçoit, ce qu'il doit produire, les règles à
respecter, et la procédure jusqu'à la mise en ligne.

Comme pour « Les 100 » (fiches d'attente en attendant la vraie liste), la salle des Archives de
2040 est construite d'avance avec des vitrines vides : rien ne s'affiche tant que cet agent n'a
rien déposé et qu'un humain n'a pas relu et publié le résultat.

## 1. Ce que l'agent reçoit

- La liste des séquences du programme : `src/data/eveningProgram.ts` → `EVENING_PROGRAM`
  (id, heure, durée, titre, thème, intervenant·es **déjà attribué·es par séquence**).
- La liste générale des intervenant·es annoncé·es : `EVENING_SPEAKERS` (même fichier).
- De quoi retrouver ce qui a été dit (enregistrement audio/vidéo de la soirée, ou sa
  transcription) — fourni séparément, hors de ce dépôt.

L'agent n'a pas besoin d'inventer les identifiants de séquence : ce sont ceux d'`EVENING_PROGRAM`
(ex. `keynote-ouverture`, `table-ronde-1`, `les100-presentation`…).

## 2. Ce que l'agent produit

Un unique fichier JSON, conforme à `EveningAgentOutputSchema` (`src/data/eveningSchema.ts`) :

```json
{
  "version": 1,
  "event": "odyssee-ia-2026",
  "generatedAt": "2026-10-06T22:50:00+02:00",
  "archives": [
    {
      "sessionId": "keynote-ouverture",
      "summary": { "fr": "…", "en": "…" },
      "quotes": [
        { "text": { "fr": "…", "en": "…" }, "author": "Catherine Vautrin", "verified": true }
      ]
    }
  ]
}
```

- `sessionId` : un id d'`EVENING_PROGRAM`. Une séquence sans rien à en dire peut simplement être
  absente du tableau `archives` — inutile d'y mettre une synthèse vide.
- `summary` : la synthèse de la séquence. `fr` obligatoire (1 à 1200 caractères), `en` recommandé
  (≤ 1200 caractères — une traduction fidèle, pas un résumé différent).
- `quotes` : 0 à 5 citations marquantes. `text.fr` obligatoire (≤ 280 caractères), `text.en`
  recommandé (≤ 280). `author` obligatoire : le nom d'un·e intervenant·e **de cette séquence**
  (voir `EVENING_PROGRAM`), ou de la liste générale (`EVENING_SPEAKERS`), ou l'une des deux voix
  génériques `"Public"` (question posée depuis la salle) et `"L'Archiviste"` (commentaire de
  l'hologramme). Un autre nom fait rejeter la citation à l'import (pas toute l'archive).
  `verified` : `true` seulement si la citation a été vérifiée mot pour mot sur l'enregistrement.

Voir `data/evening-agent-output.example.json` pour un exemple complet — **manifestement factice**
(textes « [Exemple] … », `verified: false`), qui ne sert qu'à tester la chaîne d'import.

## 3. Règles, non négociables

1. **Rien d'inventé.** Une synthèse résume ce qui a été dit, sans ajouter d'opinion, de chiffre ou
   de fait qui n'a pas été prononcé. Une séquence dont on n'est pas sûr : on l'omet, on ne devine
   pas.
2. **Citations mot pour mot.** Une citation est une transcription exacte d'un passage de
   l'enregistrement, jamais une reformulation. `verified: true` engage : ne le mettre que si la
   citation a été effectivement comparée à l'enregistrement.
3. **FR obligatoire, EN recommandé.** L'anglais doit être une traduction fidèle du français, pas
   un texte différent.
4. **`author` exact**, tel qu'il apparaît dans `EVENING_PROGRAM` / `EVENING_SPEAKERS` (voir liste
   ci-dessus) — pas de surnom, pas d'initiales.
5. **Jamais de nom hors programme.** Si une personne a parlé sans être dans `EVENING_SPEAKERS`
   (intervenant·e de dernière minute), ne pas lui attribuer de citation nommée : utiliser
   `"Public"` si c'est pertinent, sinon omettre la citation.

## 4. Procédure, jusqu'à la mise en ligne

1. L'agent écrit son JSON (voir §2) dans un fichier, par ex. `sortie-agent.json`.
2. Relecture automatique, sans rien écrire :
   ```
   pnpm exec tsx scripts/import-evening.ts --file sortie-agent.json --dry-run
   ```
   Le rapport liste les archives acceptées et **chaque rejet avec sa raison** (séquence
   inconnue, citation à l'auteur non reconnu…).
3. **Relecture humaine obligatoire** : un humain relit chaque synthèse et chaque citation à côté
   de l'enregistrement, avant toute publication. Rien ne doit être visible des visiteurs sans
   cette relecture.
4. Import en brouillon (écrit les fichiers, `published = false`, encore invisible des visiteurs) :
   ```
   pnpm exec tsx scripts/import-evening.ts --file sortie-agent.json
   ```
   Écrit `public/data/evening.json` et `supabase/seed/evening-archives.sql`.
5. Une fois la relecture humaine faite, publication :
   ```
   pnpm exec tsx scripts/import-evening.ts --file sortie-agent.json --publish
   ```
   Puis exécuter `supabase/seed/evening-archives.sql` dans le SQL editor Supabase (ou ajouter
   `--push` à la commande ci-dessus si `SUPABASE_SERVICE_ROLE_KEY` et `VITE_SUPABASE_URL` sont
   disponibles dans l'environnement, pour un envoi direct).
6. Déploiement : `public/data/evening.json` fait partie du bundle statique — sa mise à jour ne sera
   visible des visiteurs qu'après un redéploiement du site. Le chemin Supabase (`--push`, ou SQL
   editor) est visible immédiatement, sans redéploiement.

Une nouvelle exécution après une correction (coquille, citation à retirer) met à jour les archives
existantes sans les dupliquer (`upsert` sur `session_id`), et ne dépublie jamais une archive déjà
publiée tant que `--publish` n'est pas explicitement redonné.

## 5. Prompt système prêt à l'emploi

À adapter avec l'enregistrement ou la transcription de la soirée en pièce jointe / contexte.

```
Tu es l'agent de fin de soirée du « Musée des 100 » (L'Odyssée de l'IA, 6 octobre 2026). Tu viens
d'assister à la soirée (enregistrement ou transcription fourni en contexte). Ton travail : pour
chaque séquence du programme officiel (liste fournie ci-dessous), écrire une courte synthèse de
ce qui a été dit, et retenir jusqu'à 5 citations marquantes.

Règles strictes, à respecter à la lettre :
- N'invente rien. Une synthèse ne contient que ce qui a été effectivement dit. Si tu n'es pas
  sûr·e du contenu d'une séquence, omets-la plutôt que de deviner.
- Une citation est une transcription mot pour mot d'un passage de l'enregistrement, jamais une
  reformulation. Ne marque `verified: true` que si tu as comparé la citation à l'enregistrement
  toi-même.
- `author` doit être exactement l'un des noms suivants : un·e intervenant·e listé·e pour CETTE
  séquence, ou l'un des noms de la liste générale ci-dessous, ou "Public" (question du public) ou
  "L'Archiviste" (commentaire de l'hologramme). N'utilise jamais un autre nom.
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
}

Programme et intervenant·es autorisé·es : <coller ici le contenu de EVENING_PROGRAM et
EVENING_SPEAKERS, src/data/eveningProgram.ts>
```
