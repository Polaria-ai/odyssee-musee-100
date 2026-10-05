# Transcriptions des tables rondes

Les Archives de 2040 du Musée des 100 ne conservent que les transcriptions intégrales des trois tables rondes de L'Odyssée de l'IA. Les autres séquences restent dans le programme général utilisé ailleurs dans le jeu, mais elles n'ont ni vitrine ni entrée d'archive.

La liste canonique est `ARCHIVE_SESSIONS` dans `src/data/eveningProgram.ts` : `table-ronde-1`, `table-ronde-2` et `table-ronde-3`. Le programme complet `EVENING_PROGRAM` continue d'alimenter Rémi et l'affichage général.

## Format de sortie

L'agent génère un JSON au format version 2. Chaque entrée correspond à une seule table ronde :

```json
{
  "version": 2,
  "event": "odyssee-ia-2026",
  "generatedAt": "2026-10-06T22:50:00+02:00",
  "archives": [
    {
      "sessionId": "table-ronde-1",
      "transcript": {
        "fr": "Modération — ...\nIntervenant·e — ...",
        "en": ""
      }
    }
  ]
}
```

- `transcript.fr` est obligatoire et contient la transcription intégrale en français. `transcript.en` est une traduction intégrale facultative; une chaîne vide fait afficher la version française en anglais dans le jeu.
- Chaque version est limitée à 40 000 caractères. Une transcription trop longue doit être signalée, jamais tronquée.
- Les identifiants hors des trois tables rondes sont rejetés à l'import. Les répétitions au même identifiant gardent la première entrée et signalent les doublons.
- L'exemple `data/evening-agent-output.example.json` est entièrement fictif et ne doit jamais être publié.

## Règles de transcription et de publication

1. Reprendre les paroles dans leur ordre, avec leurs étiquettes de locuteur telles que confirmées par la source. Ne jamais déduire une identité à partir d'une voix ou du programme.
2. Ne pas résumer, compléter ni reformuler. Conserver les reprises et hésitations; ajouter seulement la ponctuation nécessaire à la lecture. Marquer un passage inaudible par `[inaudible]`.
3. Garder les passages de salle et de modération s'ils figurent dans la captation. Si une voix n'est pas identifiée, écrire « Voix non identifiée ».
4. Une personne relit la transcription entière et les attributions de locuteur à côté de la captation avant publication.
5. Toute transcription modifiée repasse en brouillon. Une publication exige `--publish` et un nom de relecteur·rice.

## Procédure

1. Générer les instructions et la liste des trois tables rondes :

   ```sh
   pnpm exec tsx scripts/evening-agent-prompt.ts > prompt-agent.txt
   ```

2. Fournir les captations/transcriptions des tables rondes à l'agent avec `prompt-agent.txt`. Enregistrer sa sortie dans `sortie-agent.json`. Ne lui fournir aucune autre séquence comme contenu à archiver.
3. Contrôler la forme et les rejets, sans écrire de fichier :

   ```sh
   pnpm exec tsx scripts/import-evening.ts --file sortie-agent.json --dry-run
   ```

4. Relire les transcriptions intégrales, les identifiants et les noms de locuteur. Corriger le JSON source si nécessaire.
5. Générer le brouillon à relire dans `public/data/evening.json` et `supabase/seed/evening-archives.sql` :

   ```sh
   pnpm exec tsx scripts/import-evening.ts --file sortie-agent.json
   ```

6. Après relecture humaine, régénérer la sortie publiée et appliquer le SQL dans Supabase :

   ```sh
   pnpm exec tsx scripts/import-evening.ts --file sortie-agent.json --publish --reviewer "Nom de la personne"
   ```

   Le fichier SQL produit peut aussi être exécuté dans l'éditeur SQL Supabase. `--push` existe pour l'opération directe avec la clé de service locale; cette procédure ne l'utilise pas.

7. La migration `supabase/migrations/20261005100000_roundtable_transcripts.sql` doit être appliquée avant la première importation de transcriptions. Elle rend les anciens résumés invisibles en les passant en brouillon; elle ne supprime pas leurs lignes. Les séquences non rondes restent dans `evening_sessions` pour le programme général.
8. Si Supabase est indisponible, `public/data/evening.json` sert de repli statique et nécessite un redéploiement du jeu.

Le chargement du jeu, la salle 3D, les vitrines, le carnet de tampons, la fiche et le chat de l'Archiviste ne chargent que les données d'archives des trois identifiants ci-dessus. Les anciennes données et les sorties version 1 (résumés/citations) ne constituent pas des transcriptions et ne sont pas affichées.
