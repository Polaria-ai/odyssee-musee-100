# Le Musée des 100 — règles agent

Jeu web 3D mobile (Vite + React + react-three-fiber + Supabase) pour L'Odyssée de l'IA 2026.

- Lire `docs/ARCHITECTURE.md` (contrat, propriété des fichiers) et `docs/DESIGN.md` (direction artistique) avant d'écrire.
- Ne modifier que les fichiers de son module. Contrat : `src/types/index.ts`, signatures des exports existants.
- Aucun élément Nintendo (noms, personnages, polices, sons). Aucun vrai nom inventé : tant que la liste n'est pas reçue, uniquement des fiches d'attente `placeholder: true`.
- Mobile d'abord : tactile, 60 i/s, pas d'ombres temps réel, textures ≤ 512 px.
- Avant de rendre la main : `pnpm lint && pnpm typecheck && pnpm test` au vert pour son module.
- Ne jamais committer de secret. `SUPABASE_SERVICE_ROLE_KEY` n'existe que dans l'environnement local des scripts.
