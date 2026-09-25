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
| `column` | `public/models/props/hall/column.glb` | Building Kit — `column.glb` | ⌀0,50 × H2,40 | hauteur → 4,0 m (`COLUMN_HEIGHT`) | `stone` : `colormap` → crème `#fff8e7` (voir « Bug corrigé — reprise » ci-dessous ; PAS `#c8a27a`) |
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

## Mobilier supplémentaire (reprise de mission, WEL-872/873 — `placements.ts::allPropPlans`)

Le décor `architecture.decorPlacements` ci-dessus restait clairsemé (constat de reprise : hall presque
vide, ailes presque nues) et le contrat `DecorPlacementType` (WEL-874) n'est pas étendu côté
`layout.ts` — hors périmètre de ce module (`src/world/props/**` uniquement). Plutôt que d'attendre,
`placements.ts` calcule son PROPRE mobilier supplémentaire à partir des bounds de salle déjà exposées
(`architecture.rooms`/`architecture.decor`) et vérifie chaque position choisie à la main contre
`layout.colliders`, le couloir de vue des cadres (`layout.frames`), `hallReservedSpots.timePortal` et
les portes du hall (`isClearSpot`, testé par `placements.test.ts` sur 8 répartitions de personnes,
dont des ailes à 1/2/60 personnes — l'ancrage `farWallX`/zone d'entrée ne dépend jamais du nombre de
rangées). Rendu par `RoomProps.tsx` via `allPropPlans` (= `propPlansFromArchitecture` + `extraPropPlans`),
PAS un nouveau `DecorPlacementType`.

| Fichier publié | Pack / modèle d'origine | Rôle | Teinte | Collider (`propColliders`) |
|---|---|---|---|---|
| `hall/planter-small-1.glb` | Furniture Kit — `plantSmall1.glb` | Jardinière basse, à côté de chaque pilier (alterne avec small-2) | `planter` | oui (0,28 m) |
| `hall/planter-small-2.glb` | Furniture Kit — `plantSmall2.glb` | idem, variante | `planter` | oui (0,28 m) |
| `hall/side-table.glb` | Furniture Kit — `sideTable.glb` | Pupitre secondaire, flanc du comptoir de Minerve | `wood` | oui (0,30 m) |
| `hall/books.glb` | Furniture Kit — `books.glb` | Pile de livres, posée sur le pupitre (`mountY` = hauteur du pupitre) | `books` | non (posé, pas au sol) |
| `hall/rug.glb` | Furniture Kit — `rugRound.glb` | Tapis d'appoint devant le comptoir | `rug` | non (plat, ⌀1,6 m) |
| `hall/flower-red.glb` / `flower-yellow.glb` / `flower-purple.glb` | Nature Kit — `flower_*A.glb` | Touches de fleurs au pied des 2 jardinières d'angle côté ouest (3 par jardinière) | `original` (couleur du modèle) | non (décoratif, tige fine) |
| `infra/machine-bed.glb` | Factory Kit 3.0 — `machine-bed.glb` | Machine compacte au sol, flanc du cluster de racks | `teal` | oui (0,55 m) |
| `infra/screen-panel.glb` | Factory Kit 3.0 — `screen-panel-small.glb` | Écran sur pied, autre flanc du cluster | `teal` | oui (0,35 m) |
| `infra/screen-hanging.glb` | Factory Kit 3.0 — `screen-hanging-small.glb` | Écran suspendu, mur du fond (`mountY` 2,5 m) | `teal` | non (monté en hauteur) |
| `infra/antenna.glb` | Space Kit — `satelliteDish_detailed.glb` | Antenne, mur du fond (`mountY` 2,1 m) | `teal` | non (monté en hauteur) |
| `indus/desk.glb` | Furniture Kit — `desk.glb` | Établi, zone d'entrée (avant la 1ère rangée de cadres) | `wood` | oui (0,55 m) |
| `indus/shelf.glb` | Furniture Kit — `bookcaseOpen.glb` | Étagère, à côté de l'établi | `wood` | oui (0,30 m) |
| `indus/box-large.glb` | Factory Kit 3.0 — `box-large.glb` | Caisse, à côté du tapis roulant existant | `orange` | oui (0,45 m) |
| `indus/box-small.glb` | Factory Kit 3.0 — `box-small.glb` | Caisse, empilée sur la grande (`mountY` = sa hauteur) | `orange` | non (posée sur la grande) |
| `culture/sofa.glb` | Furniture Kit — `loungeSofa.glb` | Banquette (velours), plus centrale que les sculptures | `violet` | oui (0,65 m) |
| `culture/bench.glb` | Furniture Kit — `benchCushion.glb` | Banquette compacte, même zone | `violet` | oui (0,35 m) |
| `culture/bookcase-open.glb` | Furniture Kit — `bookcaseOpen.glb` | Bibliothèque ouverte, en complément de la fermée | `violet` | oui (0,30 m) |

**Le banc `hall/bench.glb` (clé `hallBench`) et la jardinière `hall/planter-large.glb` reçoivent aussi
des placements supplémentaires** (2 bancs de plus le long des murs est/ouest ; les 4 grandes jardinières
de coin restent celles d'architecture, inchangées) — pas de nouveau fichier, juste plus d'instances.

⚠️ **`propColliders(architecture, layout)` calcule des boîtes de collision pour les objets solides
ci-dessus mais elles ne sont PAS branchées dans `MuseumLayout.colliders`** (propriété du module
architecture, jamais modifié depuis ce module) : le joueur peut donc actuellement traverser ce mobilier.
**Knowngap pour l'intégration** : appeler `propColliders(...)` et fusionner son résultat dans
`layout.colliders` (ou équivalent), voir `src/world/props/placements.ts`.

## Modèles optimisés mais PAS encore branchés

Copiés dans `assets-src/props/`, optimisés vers `public/models/props/` (mêmes budgets respectés), sans
usage ni côté `architecture.decorPlacements` (WEL-874) ni côté mobilier supplémentaire ci-dessus.
Gardés pour éviter de refaire le travail si le besoin apparaît ; **ne pas supposer qu'ils sont visibles
dans le jeu**.

| Fichier optimisé | Pack / modèle d'origine | Rôle visé (catalogue) |
|---|---|---|
| `hall/bench-tree.glb` | Furniture Kit — `benchCushionLow.glb` | Banc circulaire de l'Arbre des 100 — **resté procédural par choix d'architecture** (« sculpture originale », voir le contrat en tête de `layout.ts`) : ne PAS le brancher sans lever ce choix. |
| `hall/stanchion.glb` | Building Kit — `border-high.glb` | Potelets + cordon devant le comptoir — **déjà couvert procéduralement** par `roomGeometry.ts::velvetRopeGeometry` (module architecture, pas de collider dédié, mais visuellement présent) : ne pas dupliquer sans lever ce choix. |
| `infra/pipe.glb` / `pipe-bend.glb` | Factory Kit 3.0 | Tuyaux (accent mural) — écarté cette session par prudence (risque de chevaucher les câbles déjà peints, `wingSignatureDecor` reste la source procédurale) ; candidat pour une prochaine passe si l'aile Infrastructures a besoin de plus de densité murale. |

Pour brancher un de ces rôles : soit ajouter le `DecorPlacementType` + les positions côté `layout.ts`
(propriété du module architecture, PAS de ce module — demander), soit ajouter un candidat dans
`hallExtras`/`infraExtras`/`indusExtras`/`cultureExtras` (`src/world/props/placements.ts`), vérifié par
`isClearSpot`.

## Non retenu / écarté

Voir `docs/assets/catalogue.md` (Holiday Kit trop connoté, Space Kit `structure*.glb` écarté, Poly
Pizza/Quaternius non explorés — les packs Kenney couvraient tous les rôles avec marge).

## Bug corrigé cette session : colonnes (et tout modèle « grand ») rendues ~6× trop courtes

`geometry.ts::propParts` clonait `mesh.geometry` puis lui appliquait directement `applyMatrix4(mesh.matrixWorld)`.
Les modèles optimisés (`optimize-assets.mjs`, meshopt + `KHR_mesh_quantization`) stockent position/normale en
entiers **normalisés** (Int16 signé, décodés ÷32767 à la lecture) ; le noeud GLTF porte alors une transform de
« déquantification » (translation/échelle du noeud, pour ramener `[-1,1]` à la vraie bbox du modèle — ex.
`column.glb` : translation 1,2 m, échelle ×1,2, remontée dans `mesh.matrixWorld`). Cette transform n'est PAS
censée être réappliquée au buffer normalisé lui-même : `applyMatrix4` réécrit pourtant le résultat dans ce même
buffer (`BufferAttribute.setXYZ`, qui réencode en supposant une entrée déjà dans `[-1,1]`) — une position hors de
cette plage (n'importe quelle vraie coordonnée monde, ex. y = 2,4 m) **boucle silencieusement sur l'espace Int16**
(wrap, jamais d'erreur ni de warning). Constaté au pixel : colonne (`COLUMN_HEIGHT` 4,0 m visé) rendue à ≈0,67 m,
un pavé trapu au lieu d'un pilier élancé — diagnostiqué en comparant `Box3().setFromObject(scene)` (taille
correcte, lit via `getX/Y/Z` qui décode normalement) à la bbox de la géométrie clonée APRÈS `applyMatrix4` (taille
fausse, écrite via `setXYZ` qui réencode). Les autres modèles du module (jardinières, lampadaire…) ont un
décalage de déquantification plus petit — resté par chance dans `[-1,1]` — d'où leur rendu correct malgré le
même bug latent.

**Correctif** : `dequantizeGeometry()` (`geometry.ts`) convertit position/normale en Float32 NON normalisé (copie
via `getComponent`, qui décode correctement) AVANT tout `applyMatrix4`/`translate`/`scale` — no-op sur un
attribut déjà en virgule flottante, donc sans risque pour les modèles déjà corrects. Portée : tout le module
`props` (tous les modèles passent par `propParts`), pas seulement les colonnes — protège aussi contre un futur
modèle plus grand qui retomberait dans le même piège.

## Vérifications faites cette session

- `pnpm exec eslint src/world/props` : 0 erreur.
- `pnpm exec tsc -b --noEmit` (repo entier, autres modules en cours d'écriture en parallèle) : 0 erreur.
- `pnpm exec vitest run src/world/props` : 42/42 tests verts (`placements.test.ts` — regroupement des
  `decorPlacements` sans perte pour 8 répartitions de personnes dont des ailes à 1/2/60 personnes ;
  `mountY` nul au sol / non nul au mur ; TOUS les candidats du mobilier supplémentaire passent
  `isClearSpot` — aucun n'est silencieusement filtré, sur les 8 répartitions ; `propColliders` ne couvre
  que les objets solides ; `allPropPlans` ne perd ni le décor architecture ni les extras).
- Poids : 35 GLB optimisés, 204 Ko au total (`node scripts/optimize-assets.mjs props`) — largement sous
  400 Ko/fichier et 6 Mo au total (`pnpm verify:bundle`, budget partagé avec les autres modules) ;
  aucun nouveau GLB ajouté cette session (uniquement du code de placement + un correctif de rendu).
- `window.__musee.renderInfo().calls` (port 5321, captures Playwright ci-dessous) : spawn hall 91–109,
  chaque aile (milieu + fond) entre 8 et 116 — toujours ≤ 150, portrait ET paysage.
- Vérification visuelle : captures Playwright headless (Chrome for Testing, iPhone 13 portrait +
  paysage, `?e2e=1&presenceRoom=e2e-props`) dans `screens/props/` (hall spawn, comptoir/pupitre, banc
  ouest, pilier/jardinière, milieu et fond de chaque aile) — voir le rapport de mission pour la lecture
  détaillée de chaque capture.

## Bug corrigé — reprise : la colonne restait un pavé sombre uniforme malgré le correctif de déquantification

Le correctif ci-dessus (`dequantizeGeometry`) était réel et nécessaire (hauteur/échelle), mais **ne
corrigeait pas l'aspect visuel** : sur les captures prises APRÈS ce correctif (`screens/props/portrait-04-
hall-pilier-jardiniere.png`, 15:53), la colonne restait un pilier plat et sombre — sans le fût/base/
chapiteau détaillé attendu (`docs/assets/catalogue.md`). Signalé comme `knownGap` (commentaire Multica
WEL-874 : « pavé creux plutôt que le modèle Kenney attendu »), toujours non corrigé au moment de la reprise
car `geometry.ts`/`docs/assets/props.md` n'avaient plus bougé depuis — la vérification visuelle de la
session précédente n'avait pas été poussée jusqu'à relire l'image au pixel.

**Root cause (différente de la déquantification, et propre à ce modèle)** : `column.glb` (Building Kit)
n'a **pas** un matériau `colormap` à couleur unie comme le reste du mobilier Furniture Kit — c'est une
texture-palette 512×512 partagée par tout le pack, où chaque face du modèle pointe (par son UV) vers un
petit texel de couleur qui encode À LA FOIS la teinte ET le relief/l'ombrage du modèle (ex. base/chapiteau
sur un texel quasi blanc ~97 % de luminance, pans d'ombre du fût sur un texel gris-bleu sombre ~33 %) —
confirmé en extrayant le WebP embarqué et en échantillonnant aux UV réels du mesh (`gltf-transform`,
script ad hoc, supprimé après diagnostic). L'ancienne teinte `stone` (`palette.wood`, `#c8a27a`, canal
bleu à 48 %) **multiplie** ce texel (`MeshStandardMaterial.color × baseColorTexture`, PBR standard) : sur
le texel déjà sombre (33 %), le résultat tombe à 33 % × 48 % ≈ 16 % de luminance sur le canal bleu — un
gris-brun quasi noir — et écrase toute variation entre les faces, d'où le rendu perçu comme « pavé
uniforme sans relief ». Les autres modèles Building/Factory Kit du module (racks, convoyeur, bras
robotisé…) n'ont pas ce problème parce que leurs teintes (`teal`/`orange`, canaux plus équilibrés) et/ou
les texels qu'ils sollicitent sur `colormap.png` ne descendent pas aussi bas en luminance.

**Correctif** : `tints.ts::TINTS.stone` teinte désormais vers `palette.cream` (`#fff8e7`, les trois canaux
> 90 %) au lieu de `palette.wood`. Une teinte quasi blanche multiplie le texel sans l'écraser (33 % reste
≈33 %, 97 % reste ≈97 %) : le relief d'origine (base/chapiteau clairs, fût nuancé gris-bleu, ombres
propres) redevient visible, tout en réchauffant légèrement l'ensemble vers le crème du hall — cohérent
avec « pierre chaude » sans sacrifier le contraste. Portée : uniquement la variante `stone`, utilisée
exclusivement par `column` (`grep` vérifié, aucune autre entrée `DECOR_TYPE`/extra ne la référence) — pas
de régression possible sur le reste du mobilier.

Vérifié visuellement (colonnes est/ouest, hall, `screens/props/colonne-correctif/`, portrait + paysage,
`?e2e=1&presenceRoom=e2e-props-colonne`) : les deux colonnes qui encadrent le comptoir de Minerve/la
bannière montrent maintenant un chapiteau plus sombre nettement détaché, une moulure claire sous le
chapiteau, un fût gris-nuancé avec ombrage directionnel visible, et une base claire — plus aucune trace du
pavé noir uniforme. `window.__musee.renderInfo().calls` : 75 (portrait) / 91 (paysage) sur ces vues, resté
≤ 150.
