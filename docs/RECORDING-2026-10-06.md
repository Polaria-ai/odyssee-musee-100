# Enregistrement de la soirée — 6 octobre 2026

Source : Dictaphone/iCloud, **Nouvel enregistrement 36**, durée affichée **1 h 49 min 57 s**.
La transcription native Apple a été copiée intégralement dans `data/recording/nouvel-enregistrement-36.txt` : 111 162 caractères, SHA-256 `9a7177cab47987a575536d56a026de95a02f6df428595eebabae967744349dc3`.

`data/recording/sequence-map.json` partitionne cette source en 11 séquences, sans perte ni chevauchement. L'ouverture enregistrée commence au milieu d'un échange ; les remerciements de fin sont présents, mais la dernière phrase est interrompue. Aucun texte manquant n'a été inventé. Apple ne fournit pas d'alignement temporel dans cette copie : aucun repère de temps n'a été estimé.

## Intégration dans les Archives

Les trois vitrines restent consacrées aux trois tables rondes. `data/recording/tables-rondes.json` contient leurs textes sources et **22 bulles thématiques** : 7 / 8 / 7. La fin de la troisième table ronde est incluse dans cette source. Les bulles sont des résumés des propos tenus, sans vérification externe de leurs affirmations, accompagnés d'extraits français copiés exactement. Aucune attribution d'orateur n'est ajoutée.

La transcription complète de l'enregistrement reste disponible comme source dans le dépôt ; seules les trois tables rondes et leurs bulles sont servies au jeu dans `public/data/evening.json` et `session_archives`. La demande de publication de Baptiste autorise une mise en ligne sans relecture humaine ; `reviewed_by` reste `NULL`.

```sh
pnpm exec tsx scripts/import-evening.ts --file data/recording/tables-rondes.json --publish --dry-run
pnpm exec tsx scripts/import-evening.ts --file data/recording/tables-rondes.json --publish
```

La migration `20261006193000_archive_highlights.sql` et le SQL généré sont appliqués par l'orchestrateur après validation. L'import remplace les trois textes et leurs bulles de manière atomique et idempotente ; les sources précédentes dans `data/greffier/` restent conservées.
