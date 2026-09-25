# Modèles 3D — Les Archives de 2040

Voir `docs/ASSETS.md` pour les règles générales (licences, pipeline). Cette page consigne les modèles
utilisés par le module « salle 3D et Porte de 2040 » (WEL-881).

## Choix de conception : décor fixe en modèles, vitrines en géométrie procédurale

Les éléments répétés une fois par séquence (socle, capsule, écran de chaque vitrine — jusqu'à 24) sont
des géométries three.js procédurales partagées (`CylinderGeometry`, `IcosahedronGeometry`,
`PlaneGeometry`), comme le reste du jeu (`src/world/PortraitFrame.tsx`, `src/features/stamps/StampStations.tsx`).
Un modèle CC0 (2 à 4 primitives GLB chacun) répété 24 fois dépasserait largement le budget mobile
(≤ 150 appels de dessin **visibles**, voir `docs/DESIGN.md`) : les modèles Kenney sont donc réservés au
décor **fixe** de la salle (podium, anneaux de la Porte de 2040, quelques accents), dont le nombre
d'instances ne dépend jamais du nombre de séquences.

Le Space Kit n'a pas de modèle de flore : les « plantes futuristes » demandées sont remplacées par des
cristaux (`rock_crystals`), plus cohérents avec un pack sans nature.

## Modèles utilisés

| Fichier publié | Pack d'origine | Modèle d'origine | Usage | Retouches |
|---|---|---|---|---|
| `public/models/archives/pipe_ringHighEnd.glb` | Space Kit | `pipe_ringHighEnd.glb` | Anneau de la Porte de 2040 (aller, dans le hall, et retour, dans la salle) | Reteinté (matériau partagé, couleur accent de l'aile Archives), mis à l'échelle pour ≈ 2,6 m |
| `public/models/archives/satelliteDish.glb` | Space Kit | `satelliteDish.glb` | Antennes décoratives (2 exemplaires fixes, entrée de la salle) | Reteintées (couleur `trim`) |
| `public/models/archives/rock_crystals.glb` | Space Kit | `rock_crystals.glb` | Cristaux décoratifs (tiennent lieu de « plantes futuristes », 2 exemplaires fixes) | Reteintés (cyan et or, couleurs d'état des vitrines) |

Sources : `~/Dev/odyssee-musee-100-assets/kenney/kenney_space-kit/Models/GLTF format/` (téléchargé le
25/09/2026, CC0, voir `docs/ASSETS.md`). Copiés bruts dans `assets-src/archives/` (non versionné),
optimisés par `node scripts/optimize-assets.mjs archives` → `public/models/archives/` (meshopt,
textures WebP ≤ 512 px, aucun modèle > 400 Ko — les 3 fichiers optimisés pèsent 19 Ko au total).

Le podium et le dôme initialement prévus pour l'Archiviste (`platform_low.glb`, `hangar_roundGlass.glb`)
ont été retirés : `src/archives/Archivist.tsx` (autre phase de ce même workflow, développée en
parallèle dans ce worktree) construit déjà son propre socle et son hologramme en géométrie procédurale
et détecte elle-même la proximité du joueur — les garder aurait doublonné le rendu ET le calcul de
`store.nearArchivist`. `ArchivesRoom.tsx` monte directement `<Archivist placement={archives.archivist} />`.

Le « reteintage » (`src/archives/room/DecorModel.tsx`) clone la scène chargée (jamais rechargée, voir
`useModel`) et remplace le matériau de chaque maille par un matériau `MeshLambertMaterial` **partagé par
teinte** (créé une seule fois, jamais muté) : les matériaux d'origine du GLB (chargé une fois, mis en
cache par `useGLTF`) ne sont jamais modifiés.

## Éléments procéduraux (pas de modèle)

- Socle, capsule holographique et écran de chaque vitrine (`src/archives/room/Vitrine.tsx`).
- Murs, sol (texture canvas de la frise chronologique), piliers d'angle, côtes de plafond
  (`src/archives/room/RoomShell.tsx`).
- Silhouette holographique de l'Archiviste (aucun modèle de personnage dédié dans ce module — le
  dialogue de l'Archiviste, `src/archives/archivistScript.ts`, appartient à une autre phase).
