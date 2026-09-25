# Mobilier & décor 3D — module `props` (WEL-872 hall, WEL-873 ailes)

> Complète `docs/ASSETS.md` (pipeline général, licences) — ce fichier ne documente QUE le module
> `props` (`src/world/props/**`), comme demandé (pas dans `docs/ASSETS.md`, partagé).
> Sélection initiale : `docs/assets/catalogue.md` (WEL-870, phase SÉLECTION). Positions : le module
> architecture (`src/world/layout.ts`, contrat `decorPlacements`, WEL-874) — ce module ne pose des
> modèles qu'aux emplacements qu'il reçoit, il ne recalcule jamais une position.

## Modèles branchés (rendus par `RoomProps.tsx`, un par `DecorPlacementType`)

Tous CC0, Kenney (`~/Dev/odyssee-musee-100-assets/kenney`, téléchargés le 25/09/2026 — voir
`docs/ASSETS.md`). Poids bruts (avant optimisation) entre 2 et 13 Ko : très loin du budget de 400 Ko
par fichier. Gabarit (`fit`) = mise à l'échelle uniforme au chargement (`geometry.ts`, `propParts`),
calculée depuis la bounding box RÉELLE du modèle (`gltf-transform inspect`), pas depuis l'estimation
visuelle du catalogue — voir la colonne « bbox brute ».

| `DecorPlacementType` | Fichier publié | Pack / modèle d'origine | bbox brute (m) | Gabarit visé | Teinte |
|---|---|---|---|---|---|
| `column` | `public/models/props/hall/column.glb` | Building Kit — `column.glb` | ⌀0,50 × H2,40 | hauteur → 4,0 m (`COLUMN_HEIGHT`) | `stone` : `colormap` → bois `#c8a27a` |
| `bench` | `public/models/props/hall/bench.glb` | Furniture Kit — `bench.glb` | 0,40 × H0,47 × 0,20 | hauteur → 0,5 m (`BENCH_HEIGHT`) | `wood` : `wood` → `#c8a27a` |
| `planter` | `public/models/props/hall/planter-large.glb` | Furniture Kit — `pottedPlant.glb` | 0,21 × H0,65 × 0,24 | hauteur → 1,2 m (≈ `JARDINIERE_HEIGHT`) | `planter` : `plant` → feuille `#7bc47f`, `wood`/`woodDark` → bois |
| `wall-lamp` | `public/models/props/hall/lamp-wall.glb` | Furniture Kit — `lampWall.glb` | 0,23 × H0,09 × 0,15 | empreinte → 0,3 m, monté à 2,1 m (`mountY`) | `lamp` : `metal` → bois foncé, `lamp` → or `#e8c872` |
| `floor-lamp` | `public/models/props/hall/lamp-floor.glb` | Furniture Kit — `lampRoundFloor.glb` | 0,15 × H0,86 × 0,18 | hauteur → 1,5 m | `lamp` (idem) |
| `rack-server-primary` | `public/models/props/infra/rack-window.glb` | Factory Kit 3.0 — `machine-window.glb` | — | hauteur → 1,8 m | `teal` : `colormap` → sarcelle `#4fb3a9` ; `material-glass` JAMAIS teinté (voir `geometry.ts`, `NEVER_TINT`) |
| `rack-server-variant` | `public/models/props/infra/rack-fortified.glb` | Factory Kit 3.0 — `machine-fortified.glb` | — | hauteur → 1,8 m | `teal` |
| `conveyor-segment` | `public/models/props/indus/conveyor.glb` | Factory Kit 3.0 — `conveyor-bars-high.glb` | — | hauteur → 0,45 m | `orange` : `colormap` → `#f2a65a` |
| `robot-arm` | `public/models/props/indus/robot-arm.glb` | Factory Kit 3.0 — `robot-arm-a.glb` | — | hauteur → 1,3 m | `orange` |
| `sculpture-primary` | `public/models/props/culture/sculpture-1.glb` | Nature Kit — `rock_tallC.glb` | — | hauteur → 0,9 m | `gold` : `dirt`/`_defaultMat` → or, `grass` → bois foncé |
| `sculpture-variant` | `public/models/props/culture/sculpture-2.glb` | Nature Kit — `rock_tallE.glb` | — | hauteur → 0,85 m | `violet` : `dirt`/`carpet`/`_defaultMat` → violet `#b48cd9`, `wood`/`grass` → bois foncé |
| `bookcase` | `public/models/props/culture/bookcase-closed.glb` | Furniture Kit — `bookcaseClosedWide.glb` | — | hauteur → 1,8 m | `violet` |

Retouches communes à tous : matériaux CLONÉS une seule fois au chargement, mis en cache par
`(modèle, teinte)` (`geometry.ts::propParts`, jamais un matériau partagé modifié en place) ; géométrie
recentrée sur X/Z et reposée au sol (bboxMin.y → 0) avant mise à l'échelle. Répétition (ex. 4 colonnes,
6 appliques) = une seule `<Instances>` (drei) par (modèle × matériau) → 1 appel de dessin par lot, quel
que soit le nombre d'instances (`RoomProps.tsx`).

## Modèles optimisés mais PAS encore branchés

Copiés dans `assets-src/props/`, optimisés vers `public/models/props/` (mêmes budgets respectés), mais
sans `DecorPlacement` correspondant côté `layout.ts` au moment de cette session — le contrat
(`decorPlacements`, WEL-874) ne couvre pas encore ces rôles. Gardés pour éviter de refaire le travail
si le contrat s'étend ; **ne pas supposer qu'ils sont visibles dans le jeu**.

| Fichier optimisé | Pack / modèle d'origine | Rôle visé (catalogue) |
|---|---|---|
| `hall/bench-tree.glb` | Furniture Kit — `benchCushionLow.glb` | Banc circulaire de l'Arbre des 100 — **resté procédural par choix d'architecture** (« sculpture originale », voir le contrat en tête de `layout.ts`) : ne PAS le brancher sans lever ce choix. |
| `hall/planter-small-1.glb` / `planter-small-2.glb` | Furniture Kit — `plantSmall1.glb` / `plantSmall2.glb` | Variantes de jardinière secondaire |
| `hall/rug.glb` | Furniture Kit — `rugRound.glb` | Tapis d'appoint devant le comptoir |
| `hall/side-table.glb` | Furniture Kit — `sideTable.glb` | Pupitre d'accueil |
| `hall/books.glb` | Furniture Kit — `books.glb` | Pile de livres (comptoir) |
| `hall/flower-red.glb` / `flower-yellow.glb` / `flower-purple.glb` | Nature Kit — `flower_redA/yellowA/purpleA.glb` | Fleurs autour des jardinières |
| `hall/stanchion.glb` | Building Kit — `border-high.glb` | Potelets + cordon — **resté procédural par choix d'architecture** (« meilleure option restée procédurale », contrat `layout.ts`) : succédané imparfait (rambarde, pas un vrai cordon), écarté par l'agent architecture lui-même. |
| `infra/machine-bed.glb` | Factory Kit 3.0 — `machine-bed.glb` | Machine compacte au sol |
| `infra/antenna.glb` | Space Kit — `satelliteDish_detailed.glb` | Antenne |
| `infra/screen-panel.glb` / `screen-hanging.glb` | Factory Kit 3.0 | Écrans (sol / suspendu) |
| `infra/pipe.glb` / `pipe-bend.glb` | Factory Kit 3.0 | Tuyaux (accent mural) |
| `indus/box-large.glb` / `box-small.glb` | Factory Kit 3.0 — `box-large.glb` / `box-small.glb` | Caisses près du tapis roulant |
| `indus/desk.glb` | Furniture Kit — `desk.glb` | Établi |
| `indus/shelf.glb` | Furniture Kit — `bookcaseOpen.glb` | Étagère |
| `culture/sofa.glb` | Furniture Kit — `loungeSofa.glb` | Banquette (velours) |
| `culture/bench.glb` | Furniture Kit — `benchCushion.glb` | Banquette compacte |
| `culture/bookcase-open.glb` | Furniture Kit — `bookcaseOpen.glb` | Bibliothèque ouverte (variante) |

Pour brancher un de ces rôles : ajouter le `DecorPlacementType` + les positions côté `layout.ts`
(propriété du module architecture, PAS de ce module — demander), puis une entrée dans
`DECOR_TYPE` (`src/world/props/placements.ts`).

## Non retenu / écarté

Voir `docs/assets/catalogue.md` (Holiday Kit trop connoté, Space Kit `structure*.glb` écarté, Poly
Pizza/Quaternius non explorés — les packs Kenney couvraient tous les rôles avec marge).

## Vérifications faites cette session

- `pnpm exec eslint src/world/props` : 0 erreur.
- `pnpm exec tsc -b --noEmit` (repo entier, autres modules en cours d'écriture en parallèle) : 0 erreur.
- `pnpm exec vitest run src/world/props` : 14/14 tests verts (`placements.test.ts` — regroupement des
  `decorPlacements` sans perte, pour 100 fiches par défaut, 100/0/0, aucune aile peuplée, 1 personne par
  aile ; `mountY` nul au sol / non nul au mur).
- Poids : 35 GLB optimisés, 204 Ko au total (`node scripts/optimize-assets.mjs props`) — largement sous
  400 Ko/fichier et 6 Mo au total (`pnpm verify:bundle`, budget partagé avec les autres modules).
- Vérification visuelle : captures Playwright headless (Chrome for Testing, iPhone 13 portrait +
  paysage, `?e2e=1`) dans `screens/props/` — voir le rapport de mission pour le détail
  (`window.__musee.renderInfo().calls` par vue, limites rencontrées sur cette machine partagée).
