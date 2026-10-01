# Modèles 3D — sources, licences, pipeline

## Sources autorisées

Uniquement des modèles **CC0** (domaine public), de sources officielles :

| Pack | Source | Licence |
|---|---|---|
| Furniture Kit 2.0 | https://kenney.nl/assets/furniture-kit | CC0 |
| Nature Kit | https://kenney.nl/assets/nature-kit | CC0 |
| Factory Kit 3.0 | https://kenney.nl/assets/factory-kit | CC0 |
| Space Kit | https://kenney.nl/assets/space-kit | CC0 |
| Building Kit | https://kenney.nl/assets/building-kit | CC0 |
| Holiday Kit | https://kenney.nl/assets/holiday-kit | CC0 |

Packs bruts téléchargés le 25/09/2026 dans `~/Dev/odyssee-musee-100-assets/kenney/` (hors Git, 140 Mo décompressés). Quaternius (https://quaternius.com) et Poly Pizza (https://poly.pizza) sont possibles **uniquement** pour des modèles marqués CC0, à consigner ci-dessous. Jamais de CC-BY sans validation, jamais de modèle Nintendo ou « inspiré de » récupéré en ligne.

## Pipeline

1. Copier le GLB brut choisi dans `assets-src/<module>/<nom>.glb` (ignoré par Git).
2. `node scripts/optimize-assets.mjs <module>` → `public/models/<module>/<nom>.glb` (meshopt, textures WebP ≤ 512 px).
3. Charger avec `useModel('/models/<module>/<nom>.glb')` (`src/assets/useModel.ts`), sous `<Suspense>`. Répéter un modèle : cloner la scène ou instancier, jamais recharger.
4. `pnpm verify:bundle` : ≤ 400 Ko par fichier, ≤ 6 Mo pour tous les modèles.

## Modèles utilisés

Seul le module `props` (`src/world/props/**`, WEL-872 hall / WEL-873 ailes) utilise des modèles CC0 des
packs Kenney — détail complet (bbox brute, gabarit visé, poids, vérifications) dans
`docs/assets/props.md`, fusionné ici. Les modules Cadres & Cartels (WEL-875) et Personnages (WEL-876)
n'utilisent **aucun** modèle CC0 : géométrie procédurale (aucun cadre/spot de galerie exploitable trouvé
dans les 6 packs, voir `docs/assets/frames.md`). Personnages : voir la section « Personnages générés »
ci-dessous (Cyril et Rémi, depuis le 29/09 ; l'avatar et Minerve sculptés en three.js sont retirés).

### Branchés via `architecture.decorPlacements` (contrat WEL-874)

| Fichier publié | Pack d'origine | Modèle d'origine | Retouches |
|---|---|---|---|
| `public/models/props/hall/column.glb` | Building Kit | `column.glb` | Hauteur → 4,0 m ; teinte `stone` → crème `#fff8e7` (bug de déquantification + bug de teinte corrigés, voir `docs/assets/props.md`) |
| `public/models/props/hall/bench.glb` | Furniture Kit | `bench.glb` | Hauteur → 0,5 m ; teinte bois `#c8a27a` |
| `public/models/props/hall/planter-large.glb` | Furniture Kit | `pottedPlant.glb` | Hauteur → 1,2 m ; teinte feuille `#7bc47f` / bois |
| `public/models/props/hall/lamp-wall.glb` | Furniture Kit | `lampWall.glb` | Monté à 2,1 m ; teinte bois foncé / or `#e8c872` |
| `public/models/props/hall/lamp-floor.glb` | Furniture Kit | `lampRoundFloor.glb` | Hauteur → 1,5 m ; teinte idem |
| `public/models/props/infra/rack-window.glb` | Factory Kit 3.0 | `machine-window.glb` | Hauteur → 1,8 m ; teinte sarcelle `#4fb3a9` (verre jamais teinté) |
| `public/models/props/infra/rack-fortified.glb` | Factory Kit 3.0 | `machine-fortified.glb` | Hauteur → 1,8 m ; teinte sarcelle |
| `public/models/props/indus/conveyor.glb` | Factory Kit 3.0 | `conveyor-bars-high.glb` | Hauteur → 0,45 m ; teinte orange `#f2a65a` |
| `public/models/props/indus/robot-arm.glb` | Factory Kit 3.0 | `robot-arm-a.glb` | Hauteur → 1,3 m ; teinte orange |
| `public/models/props/culture/sculpture-1.glb` | Nature Kit | `rock_tallC.glb` | Hauteur → 0,9 m ; teinte or |
| `public/models/props/culture/sculpture-2.glb` | Nature Kit | `rock_tallE.glb` | Hauteur → 0,85 m ; teinte violet `#b48cd9` |
| `public/models/props/culture/bookcase-closed.glb` | Furniture Kit | `bookcaseClosedWide.glb` | Hauteur → 1,8 m ; teinte violet |

### Mobilier supplémentaire (reprise de mission, `placements.ts::allPropPlans`, pas de nouveau `DecorPlacementType`)

| Fichier publié | Pack d'origine | Modèle d'origine | Retouches |
|---|---|---|---|
| `public/models/props/hall/planter-small-1.glb` | Furniture Kit | `plantSmall1.glb` | Jardinière basse, à côté de chaque pilier (alterne avec small-2) |
| `public/models/props/hall/planter-small-2.glb` | Furniture Kit | `plantSmall2.glb` | Idem, variante |
| `public/models/props/hall/side-table.glb` | Furniture Kit | `sideTable.glb` | Pupitre secondaire, flanc du comptoir d'accueil |
| `public/models/props/hall/books.glb` | Furniture Kit | `books.glb` | Pile de livres posée sur le pupitre |
| `public/models/props/hall/rug.glb` | Furniture Kit | `rugRound.glb` | Tapis d'appoint devant le comptoir (non solide) |
| `public/models/props/hall/flower-red.glb` / `flower-yellow.glb` / `flower-purple.glb` | Nature Kit | `flower_*A.glb` | Touches de fleurs au pied de 2 jardinières d'angle (non solide) |
| `public/models/props/infra/machine-bed.glb` | Factory Kit 3.0 | `machine-bed.glb` | Machine compacte au sol, flanc du cluster de racks |
| `public/models/props/infra/screen-panel.glb` | Factory Kit 3.0 | `screen-panel-small.glb` | Écran sur pied, autre flanc du cluster |
| `public/models/props/infra/screen-hanging.glb` | Factory Kit 3.0 | `screen-hanging-small.glb` | Écran suspendu, mur du fond (monté à 2,5 m) |
| `public/models/props/infra/antenna.glb` | Space Kit | `satelliteDish_detailed.glb` | Antenne, mur du fond (montée à 2,1 m) |
| `public/models/props/indus/desk.glb` | Furniture Kit | `desk.glb` | Établi, zone d'entrée avant la 1ère rangée de cadres |
| `public/models/props/indus/shelf.glb` | Furniture Kit | `bookcaseOpen.glb` | Étagère, à côté de l'établi |
| `public/models/props/indus/box-large.glb` | Factory Kit 3.0 | `box-large.glb` | Caisse, à côté du tapis roulant existant |
| `public/models/props/indus/box-small.glb` | Factory Kit 3.0 | `box-small.glb` | Caisse empilée sur la grande (non solide) |
| `public/models/props/culture/sofa.glb` | Furniture Kit | `loungeSofa.glb` | Banquette (velours), plus centrale que les sculptures |
| `public/models/props/culture/bench.glb` | Furniture Kit | `benchCushion.glb` | Banquette compacte, même zone |
| `public/models/props/culture/bookcase-open.glb` | Furniture Kit | `bookcaseOpen.glb` | Bibliothèque ouverte, en complément de la fermée |

### Optimisés mais volontairement pas branchés (gardés au cas où, voir `docs/assets/props.md`)

| Fichier publié | Pack d'origine | Modèle d'origine | Raison |
|---|---|---|---|
| `public/models/props/hall/bench-tree.glb` | Furniture Kit | `benchCushionLow.glb` | Banc de l'Arbre des 100 reste une sculpture procédurale (choix d'architecture) |
| `public/models/props/hall/stanchion.glb` | Building Kit | `border-high.glb` | Cordon déjà couvert procéduralement (`roomGeometry.ts::velvetRopeGeometry`) |
| `public/models/props/infra/pipe.glb` / `pipe-bend.glb` | Factory Kit 3.0 | `pipe.glb` / `pipe-bend.glb` | Écartés par prudence (risque de chevaucher les câbles déjà peints) |

35 GLB optimisés au total, 204 Ko (`pnpm verify:bundle` : largement sous 400 Ko/fichier et 6 Mo au total).

## Personnages générés (29/09/2026)

| Fichier publié | Personne | Provenance | Clips | Poids |
|---|---|---|---|---|
| `public/models/characters/cyril.glb` | Cyril de Sousa Cardoso | Photo fournie par Baptiste (accord de la personne) → image en pied Seedream 5 Pro → Meshy 7.1 (12 400 triangles) → squelette Meshy (24 os) | `idle` (Meshy Idle_02), `walk` (Meshy Casual_Walk) | 344 Ko |
| `public/models/characters/remi.glb` | Rémi Godeau | Idem | `idle` (Meshy Idle_02), `wave` (Meshy Big_Wave_Hello) | 368 Ko |

- Générés dans Magnific (projet « Odyssée de l'IA — Musée des 100 »), crédits du compte Premium+ de Baptiste : 12 000 environ au total, dont une première attente (« Idle », agitée, écartée).
- Sources brutes (photos, images en pied, GLB Meshy ~7 Mo par clip) hors Git : `~/Dev/odyssee-musee-100-assets/personnages/`.
- Construction : `node scripts/build-characters.mjs` fusionne les clips d'un personnage en un seul GLB (même squelette), puis optimise (meshopt, texture WebP 1024).
- Texture en ligne : three.js lit les textures intégrées aux GLB par `fetch(blob:…)` (Chrome, Android, Safari ≥ 17). La CSP de `vercel.json` doit donc garder `blob:` dans `connect-src`, sinon les modèles s'affichent en blanc (constaté en production le 29/09). `pnpm verify:security` le vérifie ; `vite preview` sert les en-têtes de Vercel, les E2E locaux tournent sous la même CSP que la production.
- Pas de licence CC0 ici : ce sont les images de deux personnes réelles, utilisées avec leur accord pour ce jeu uniquement.


## Textures de sol (WEL-923)

Quatre matières, une par famille de salle (marbre : hall et Archives ; terrazzo : Infrastructures ; microciment : Industrialisation ; moquette : Culture). Le détail du rendu (UV monde, multiplication de la couleur de la charte, gain, échelles) est dans `docs/CHARTE-3D.md` §4.1.

| Élément | Emplacement |
|---|---|
| Sources Magnific (albédo 1024², normales et rugosité 1000²), neutres et claires | `~/Dev/odyssee-musee-100-assets/sols-v5/magnific/` (hors Git). Copie de travail : `assets-src/floors/` (ignoré par Git, comme `assets-src/`). Fichiers utilisés : `marbre-2`, `terrazzo-2`, `microciment-2`, `moquette-1` (`.png`, `.normal.png`) ; les cartes de rugosité ne servent pas (le sol reste en Lambert). |
| Cartes produites (versionnées) | `public/textures/floors/<matière>-detail.webp` et `<matière>-normal.webp`, 8 fichiers ≤ 512 px, 286 Ko au total |
| Script | `node scripts/build-floor-textures.mjs [--debug dossier]` — lit `assets-src/floors/` (ou `FLOORS_SRC=…`, ou le dossier d'origine), écrit les 8 fichiers, vérifie le budget (450 Ko). `--debug` écrit les mosaïques 2×2 de contrôle du raccord. Sorties déterministes (octet pour octet). |
| Tests | `scripts/build-floor-textures.test.ts` (fichiers, dimensions, moyenne du détail, tuilage, budget, déterminisme si les sources sont présentes), `src/world/floorTextures.test.ts` (cache, repli, libération), `src/world/roomGeometry.test.ts` et `src/archives/room/geometry.test.ts` (UV monde) |

Fabrication : luminance linéaire de l'albédo → raccord tuilable si besoin (fondu avec une copie décalée pour le marbre et le microciment, retrait de la dérive lente pour le terrazzo) → réduction à 512 px → flou léger qui grossit les marques trop fines pour l'écran (terrazzo 1,2 px, moquette 0,7 px) et renfort des marques moyennes (microciment) → aplanissement partiel des grandes taches → normalisation par percentiles → profondeur réglée par matière (`FLOORS` dans le script) → webp qualité 70 à 82 ; normales recentrées (moyenne et ondulations larges retirées, sinon tout le sol serait éclairé de travers), qualité 92 (moquette : 256 px). Les grands flous sont des moyennes glissantes en trois passes (coût constant : la fabrication des 4 matières prend 4 s). Si un réglage change, recopier la moyenne affichée dans `detailMean` de `src/world/floorSpec.ts` (le test échoue sinon) et la taille du motif dans `tileMeters` : voir `docs/CHARTE-3D.md` §4.1 pour la règle d'échelle (motif lisible à 60-80 px par mètre).
