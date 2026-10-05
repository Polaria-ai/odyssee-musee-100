# Modèles 3D — Les Archives de 2040

Voir `docs/ASSETS.md` pour les règles générales (licences, pipeline). Cette page consigne les modèles
utilisés par le module « salle 3D » (WEL-881). Depuis le plan en croix (WEL-888, 27/09), la salle est
accrochée au sud du hall et se rejoint à pied : l'anneau de l'ancienne « Porte de 2040 » a été retiré.

## Choix de conception : décor fixe en modèles, vitrines en géométrie procédurale

Les éléments des vitrines des trois tables rondes (socle, capsule, écran) sont des géométries three.js
procédurales partagées (`CylinderGeometry`, `IcosahedronGeometry`, `PlaneGeometry`), comme le reste du
jeu (`src/world/PortraitFrame.tsx`, `src/features/stamps/StampStations.tsx`). Les modèles Kenney sont
réservés au décor **fixe** de la salle (quelques accents), dont le nombre d'instances ne dépend pas des
transcriptions.

Le Space Kit n'a pas de modèle de flore : les « plantes futuristes » demandées sont remplacées par des
cristaux (`rock_crystals`), plus cohérents avec un pack sans nature.

## Modèles utilisés

| Fichier publié | Pack d'origine | Modèle d'origine | Usage | Retouches |
|---|---|---|---|---|
| `public/models/archives/satelliteDish.glb` | Space Kit | `satelliteDish.glb` | Antennes décoratives (2 exemplaires fixes, angles nord, de part et d'autre de la porte) | Reteintées (couleur `trim`) |
| `public/models/archives/rock_crystals.glb` | Space Kit | `rock_crystals.glb` | Cristaux décoratifs (tiennent lieu de « plantes futuristes », 2 exemplaires fixes) | Reteintés (cyan et or, couleurs d'état des vitrines) |

Sources : `~/Dev/odyssee-musee-100-assets/kenney/kenney_space-kit/Models/GLTF format/` (téléchargé le
25/09/2026, CC0, voir `docs/ASSETS.md`). Copiés bruts dans `assets-src/archives/` (non versionné),
optimisés par `node scripts/optimize-assets.mjs archives` → `public/models/archives/` (meshopt,
textures WebP ≤ 512 px, aucun modèle > 400 Ko — les fichiers optimisés pèsent quelques Ko).

Le podium et le dôme initialement prévus pour l'Archiviste (`platform_low.glb`, `hangar_roundGlass.glb`)
ont été retirés : `src/archives/Archivist.tsx` construit son socle et son halo en géométrie procédurale,
charge son personnage depuis `public/models/characters/archiviste.glb` et détecte elle-même la proximité
du joueur. Les garder aurait doublonné le rendu et le calcul de `store.nearArchivist`.
`ArchivesRoom.tsx` monte directement `<Archivist placement={archives.archivist} />`.

Le « reteintage » (`src/archives/room/DecorModel.tsx`) clone la scène chargée (jamais rechargée, voir
`useModel`) et remplace le matériau de chaque maille par un matériau `MeshLambertMaterial` **partagé par
teinte** (créé une seule fois, jamais muté) : les matériaux d'origine du GLB (chargé une fois, mis en
cache par `useGLTF`) ne sont jamais modifiés.

## Éléments procéduraux (pas de modèle)

- Socle, capsule et écran des vitrines des tables rondes (`src/archives/room/Vitrine.tsx`).
- Murs, sol (texture canvas de la frise chronologique), piliers d'angle, côtes de plafond
  (`src/archives/room/RoomShell.tsx`).
- Socle, halo et bulle d'invitation de l'Archiviste (`src/archives/Archivist.tsx`); son personnage 3D
  provient du modèle dédié `public/models/characters/archiviste.glb`.
