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
  transcription) — fourni séparément, hors de ce dépôt. La captation du son des tables rondes fait
  l'objet de la procédure préparée par Moetez et Baptiste (30/09, fiche transmise à Ségolène le
  02/10) : c'est la seule entrée de cette chaîne qui n'a pas encore été répétée.
- Son prompt système, déjà rempli avec le programme et les intervenant·es :
  `pnpm exec tsx scripts/evening-agent-prompt.ts > prompt-agent.txt` (voir §5).

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
(textes « [Exemple] … », `verified: false`), qui ne sert qu'à tester la chaîne d'import. Il ne
cite que les voix génériques « Public » et « L'Archiviste » : même factice et jamais publiée, une
citation n'est jamais prêtée à une personne réelle.

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
6. **Jamais d'identité déduite.** Une voix que l'enregistrement ne nomme pas clairement ne reçoit
   aucun nom, même si une seule personne est prévue au programme pour la séquence. Une séquence
   sans intervenant·e au programme n'a aucun nom confirmé. Même prudence dans la prose des
   synthèses : l'import ne contrôle que le champ `author`, pas le texte.
7. **Le programme situe, il ne témoigne pas.** Titre et thème d'une séquence servent de repère ;
   une affirmation de la synthèse vient toujours de ce qui a été prononcé.

## 4. Le soir du 6 octobre : feuille de route

Chemin de publication retenu : **Supabase**, par le SQL généré (SQL editor Supabase, ou le
connecteur Supabase de Claude). Il est visible des visiteurs **sans redéploiement**. Il n'y a pas de
clé de service sur le Mac, donc pas de `--push`. Le fichier statique `public/data/evening.json`
n'est qu'un secours (il exige un redéploiement, voir l'étape 8).

Rôles, **à confirmer** : opérateur de la chaîne (Baptiste, avec Claude) ; relecture humaine (un·e
relecteur·rice nommé·e, idéalement côté L'Opinion pour la validation éditoriale) ; captation
(Moetez, procédure du 30/09).

| Quand | Étape | Commande / geste | Durée mesurée le 27/09 |
|---|---|---|---|
| Avant le 6/10 | 0. Programme définitif | Mettre `src/data/eveningProgram.ts` au programme réel (`provisional: false`, intervenant·es de dernière minute ajouté·es à `EVENING_SPEAKERS`), puis `pnpm exec tsx scripts/evening-sessions-sql.ts > supabase/seed/evening-sessions.sql` et exécuter ce SQL (upsert : une séquence retirée du programme se supprime à la main). Sinon, chaque fiche archivée affiche encore « Programme provisoire », et les citations d'un·e intervenant·e absent·e du fichier sont rejetées. | — |
| Fin des tables rondes | 1. Transcription | Selon la procédure de captation (30/09). | non répétée |
| Juste après | 2. Agent | `pnpm exec tsx scripts/evening-agent-prompt.ts > prompt-agent.txt`, puis faire tourner l'agent avec ce prompt et la transcription. Il écrit `sortie-agent.json`. | 3 min pour 1 900 mots ; compter 10 à 15 min pour une vraie soirée |
| | 3. Relecture automatique | `pnpm exec tsx scripts/import-evening.ts --file sortie-agent.json --dry-run` : liste les acceptées et chaque rejet avec sa raison. | 1 s |
| | 4. Aperçu dans le jeu | `pnpm build && pnpm preview` (autre terminal), puis `PW_CHROMIUM_PATH=… pnpm preview:archives --file sortie-agent.json` : captures de la salle et de chaque fiche dans `screens/archives-preview/`, telles que les visiteurs les verront, **sans rien publier**. | 70 s pour 16 archives |
| | 5. **Relecture humaine** | Chaque synthèse et chaque citation, à côté de l'enregistrement et des captures de l'étape 4. On corrige `sortie-agent.json` à la main, puis on reprend à l'étape 3. | ≈ 1 min par séquence (18) |
| | 6. Brouillon en base | `pnpm exec tsx scripts/import-evening.ts --file sortie-agent.json` → exécuter `supabase/seed/evening-archives.sql`. `published = false` : invisible des visiteurs (vérifié le 27/09 en anonyme). | quelques secondes |
| | 7. Publication | `pnpm exec tsx scripts/import-evening.ts --file sortie-agent.json --publish --reviewer "<nom>"` → exécuter le SQL. `--publish` exige `--reviewer` : la base garde le nom (`reviewed_by`). Les visiteurs qui sont dans la salle des Archives voient les vitrines s'allumer en moins d'une minute, sans recharger (`src/archives/useArchivesRefresh.ts`). | quelques secondes |
| Si Supabase est injoignable | 8. Secours statique | Le même import écrit `public/data/evening.json` : commit, `git push`, `vercel deploy --prod --yes` depuis `~/Dev/odyssee-musee-100`. | 1 à 2 min de déploiement |

Une correction après publication (coquille, citation à retirer) : on corrige le fichier, puis on
relance l'étape 7. L'upsert sur `session_id` met à jour sans dupliquer. Une relance **sans**
`--publish` corrige le texte sans jamais dépublier une archive déjà publiée (vérifié le 27/09).

Réseau : les étapes 3 à 6 tournent en local, sans réseau (hors captures). La publication et le
déploiement demandent une connexion ; prévoir un partage de connexion si le Wi-Fi du théâtre
sature. Le jeu borne ses chargements à 4 s : il bascule sur ses replis au lieu de rester bloqué.

## 5. Prompt système prêt à l'emploi

Généré, programme et intervenant·es compris, depuis `src/data/eveningProgram.ts` (source de vérité
du prompt : `scripts/evening-agent-prompt.ts`) :

```
pnpm exec tsx scripts/evening-agent-prompt.ts > prompt-agent.txt
```

On y joint l'enregistrement ou la transcription de la soirée. Le prompt reprend les règles du §3.

## 6. Répétition générale du 27/09 (WEL-907)

Faute de programme du 24/09 lisible, la chaîne a été répétée de bout en bout avec le programme
actuel. Les fichiers sont dans `data/repetition/`, manifestement factices, sans aucun nom réel ;
`scripts/evening-agent-prompt.test.ts` y veille.

- **Transcription factice** (`transcription-factice.md`, 1 856 mots) : voix génériques seulement,
  avec 5 pièges :
  - une séquence inaudible ;
  - une personne hors programme au nom inventé ;
  - un échange coupé et contradictoire ;
  - une citation de l'Archiviste ;
  - une question du public.
- **Agent** (prompt du §5, version d'avant la répétition) : 16 archives sur 18, 7 citations. Les
  5 pièges sont passés : les deux séquences douteuses sont omises, et la personne hors programme
  est citée comme « Public ». La relecture a relevé deux détails tirés du titre ou du thème plutôt
  que de la parole ; d'où les règles 6 et 7 du §3, reprises dans le prompt.
- **Import** : 16 acceptées sur 16, aucun rejet.
- **Base** : 16 brouillons déposés, avec 4 vérifications en anonyme.
  - Aucun brouillon n'est visible, ni en SQL ni par l'API publique qu'utilise le jeu.
  - Une publication anonyme est refusée (401).
  - Le `--publish` réel, exécuté dans une transaction annulée, rend visibles exactement les
    séquences publiées.
  - Une relance en brouillon ne dépublie rien.
- **Nettoyage** : la base est revenue à 18 séquences et 0 archive.
- **Aperçu** : les 16 fiches s'affichent dans le jeu (`sortie-agent.json` de ce dossier).
- **Corrigé** grâce à la répétition :
  - les archives se rafraîchissent pendant la visite ;
  - `reviewed_by` est tracé, et `--publish` exige `--reviewer` ;
  - les chargements statiques ont un délai maximal ;
  - le prompt est généré par un script ;
  - l'exemple du dépôt ne cite plus aucune personne réelle ;
  - les boutons de la fiche tiennent sur une ligne.
- **Reste à répéter** : l'amont (captation → transcription), après la procédure du 30/09, et la
  relecture par la personne qui la fera le soir.
