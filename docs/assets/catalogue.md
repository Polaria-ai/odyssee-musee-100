# Catalogue de sélection — assets 3D CC0 (WEL-870, phase SÉLECTION)

> Ce fichier ne liste que des **candidats retenus après inspection visuelle** (planches-contacts ci-dessous,
> regardées une à une) et vérification poids/matériaux. Aucun fichier n'a été copié dans `assets-src/`,
> aucun GLB optimisé n'a été généré : c'est le travail des phases suivantes (import + intégration), module
> par module, chacune consignant ses propres choix dans `docs/assets/<module>.md` (voir `docs/ASSETS.md`).
> Chemins ci-dessous = fichiers **bruts** dans les packs (`assets-packs/kenney_<pack>/Models/<GLTF|GLB> format/…`),
> à copier tels quels vers `assets-src/<module>/<nom>.glb` puis passés par `optimize-assets.mjs`.

## Méthode

- Planches-contacts construites avec Python + PIL depuis les vignettes isométriques (`Isometric/*_SE.png`,
  packs Furniture/Nature/Space) ou les aperçus simples (`Previews/*.png`, packs Building/Factory 3.0/Holiday
  — pas de dossier `Isometric` sur ces trois-là). Toutes regardées avant de choisir.
- Poids : `ls -l` sur le GLB brut choisi (avant optimisation — la conversion meshopt + WebP réduira encore).
  Tous les candidats retenus ci-dessous pèsent entre 3,4 Ko et 51 Ko bruts : très loin du budget de 400 Ko/fichier.
- Matériaux : `node_modules/.bin/gltf-transform inspect <fichier>`. Deux familles dans ces packs :
  - **Furniture / Nature / Space** : plusieurs matériaux `MeshStandard` à couleur unie, **sans texture**
    (ex. `bench.glb` → 1 matériau `wood` sans texture ; `rock_tallC.glb` → 3 matériaux unis `dirt`/`grass`/
    `_defaultMat` ; `satelliteDish_detailed.glb` → 5 matériaux unis `metal`/`metalDark`/`metalRed`/`dark`/
    `_defaultMat`). Recoloration triviale : cloner chaque matériau au chargement (cache dans `useModel`/le
    module consommateur) et changer `.color`.
  - **Building / Factory 3.0** : **un seul matériau `colormap`** avec une texture-palette partagée
    512×512 (déjà ≤ 512 px, conforme au pipeline), + parfois un second matériau uni (ex. `machine-window.glb` :
    `colormap` texturé + `material-glass` uni pour la vitre). Teinter `.color` sur le matériau texturé
    multiplie toujours la texture (comportement standard `MeshLambertMaterial`/`MeshStandardMaterial`) : ça
    fonctionne, mais le rendu final dépend aussi des tons déjà présents dans `colormap.png` (pas un simple
    blanc uni) — à vérifier visuellement après recoloration, module Infrastructures/Industrialisation.
- Dimensions : approximatives, lues sur les aperçus Kenney (pas de bounding box exacte mesurée ici — à
  confirmer avec `gltf-transform inspect` → `bboxMin`/`bboxMax` au moment de l'import réel).

## Hall

| Rôle | Pack | Chemin GLB (brut) | Dimensions approx. | Pourquoi |
|---|---|---|---|---|
| Banc | Furniture Kit | `Models/GLTF format/bench.glb` | ~1,6 × 0,9 × 0,5 m | Silhouette bois simple à dossier, 1 seul matériau uni `wood` (recoloration triviale vers palette bois `#c8a27a`/`#8c6a4a`), remplace directement le pavé actuel (`BENCH_SEAT_LEN` ≈ 1,6 m déjà cohérent). |
| Banc (variante, autour de l'Arbre) | Furniture Kit | `Models/GLTF format/benchCushionLow.glb` | ~1,6 × 0,7 × 0,45 m | Assise coussinée, plus basse : bon pour le banc circulaire de l'Arbre des 100 (variation visuelle sans rompre le style). |
| Jardinière — grande | Furniture Kit | `Models/GLTF format/pottedPlant.glb` | ~0,5 × 0,7 × 0,5 m | Pot + feuillage arrondi, gabarit proche des 4 jardinières d'angle actuelles (`JARDINIERE_RADIUS`). |
| Jardinière — petite, variante 1 | Furniture Kit | `Models/GLTF format/plantSmall1.glb` | ~0,3 × 0,4 × 0,3 m | Silhouette différente (touffe basse) pour rompre la répétition sur les jardinières secondaires. |
| Jardinière — petite, variante 2 | Furniture Kit | `Models/GLTF format/plantSmall2.glb` | ~0,3 × 0,45 × 0,3 m | Troisième silhouette (plus haute, feuilles retombantes) : 3 variantes couvrent la demande « 2-3 variantes ». |
| Colonne / pilier | Building Kit | `Models/GLB format/column.glb` | ~0,5 × 3,5 × 0,5 m (à vérifier vs `COLUMN_HEIGHT`/`COLUMN_RADIUS`) | Fût + base + chapiteau nets, texture-palette `colormap` 512 px, largement plus lisible que le cylindre peint actuel ; `column-wide.glb` en secours si le rayon doit être plus large. |
| Lampadaire (sol) | Furniture Kit | `Models/GLTF format/lampRoundFloor.glb` | ~0,3 × 1,5 × 0,3 m | Lampadaire debout classique, 1 matériau uni, bon pour flanquer le comptoir ou les allées. |
| Applique (mur) | Furniture Kit | `Models/GLTF format/lampWall.glb` | ~0,25 × 0,3 × 0,15 m | Applique murale simple, pour les murs du hall (actuellement nus). |
| Potelets et cordon | *(aucun modèle dédié trouvé)* | — | — | **Lacune confirmée** dans les 6 packs : pas de « stanchion + corde » façon musée. Meilleur succédané repéré : `kenney_building-kit/Models/GLB format/border-high.glb` (rambarde fine sur deux poteaux, texture-palette, ~1,2 m de long) — approximatif, pas un vrai cordon. Alternative : `kenney_nature-kit/…/fence_simpleLow.glb` (rondins + traverse basse, plus rustique). À trancher en phase d'intégration ; sinon un petit collier procédural (2 cylindres + tore, quelques lignes three.js) reste l'option la plus fidèle. |
| Tapis (allée / accueil) | Furniture Kit | `Models/GLTF format/rugRound.glb` | ~2 × 0,02 × 2 m | Tapis rond à bordure, cohérent avec le tapis doré déjà peint au sol (`RUG_RADIUS`) — utile en petit tapis d'appoint devant le comptoir plutôt qu'en remplacement du sol peint. |
| Table / pupitre d'accueil | Furniture Kit | `Models/GLTF format/sideTable.glb` | ~0,5 × 0,5 × 0,4 m | Petite table d'appoint, bon gabarit pour un pupitre secondaire près du comptoir de Minerve (le comptoir principal reste la géométrie dédiée `counterGeometry`). |
| Livres / décor du comptoir | Furniture Kit | `Models/GLTF format/books.glb` | ~0,25 × 0,1 × 0,2 m | Pile de livres colorée, pose directement sur le plateau du comptoir de Minerve — cohérent avec le carnet qu'elle tient déjà (voir DESIGN.md). |
| Fleurs (jardinières / abords de l'Arbre) | Nature Kit | `Models/GLTF format/flower_redA.glb`, `flower_yellowA.glb`, `flower_purpleA.glb` | ~0,15 × 0,2 × 0,15 m chacune | Trois teintes couvrant les accents de palette (feuille/or/violet culture) ; à semer en petites touffes autour des jardinières et du banc circulaire de l'Arbre — jamais dans les couloirs de vue. |

## Aile Infrastructures (salle des machines)

| Rôle | Pack | Chemin GLB (brut) | Dimensions approx. | Pourquoi |
|---|---|---|---|---|
| Rack / serveur (principal) | Factory Kit 3.0 | `Models/GLB format/machine-window.glb` | ~0,5 × 1 × 0,4 m | Silhouette « armoire à hublot », proche des 3 baies déjà dessinées en boîtes (`wingSignatureDecor`, aile infrastructures) : remplace directement ces boîtes peintes. Matériau `colormap` texturé + `material-glass` uni pour l'écran. |
| Rack / serveur (variante) | Factory Kit 3.0 | `Models/GLB format/machine-fortified.glb` | ~0,5 × 1,1 × 0,45 m | Silhouette plus massive (plaques rivetées) pour casser la répétition entre les 3 baies. |
| Machine compacte | Factory Kit 3.0 | `Models/GLB format/machine-bed.glb` | ~0,6 × 0,5 × 0,4 m | Bloc plus bas, bon pour une machine au sol entre les racks. |
| Antenne | Space Kit | `Models/GLTF format/satelliteDish_detailed.glb` | ~0,6 × 0,6 × 0,5 m | Parabole détaillée, 5 matériaux unis (métal clair/sombre/rouge), aucune texture — recoloration triviale vers l'accent sarcelle. Bon accroche-œil en hauteur (> 1,2 m : à garder hors couloir de vue ou géré par l'occultation, voir contraintes). |
| Écran (sur pied) | Factory Kit 3.0 | `Models/GLB format/screen-panel-small.glb` | ~0,4 × 0,5 × 0,2 m | Écran sur socle, pour un poste de contrôle au sol. |
| Écran (suspendu) | Factory Kit 3.0 | `Models/GLB format/screen-hanging-small.glb` | ~0,4 × 0,3 × 0,1 m | Variante accrochée, pour varier écran-mural vs écran-sol. |
| Câbles / tuyaux (accent) | Factory Kit 3.0 | `Models/GLB format/pipe-large.glb` + `pipe-large-bend.glb` | Ø ~0,15 m, longueur ~1 m | Complète les câbles déjà peints au sol (`strut()` dans `wingSignatureDecor`) par un vrai tuyau en volume le long d'un mur — à utiliser avec parcimonie (poids de dessin). |

## Aile Industrialisation (atelier)

| Rôle | Pack | Chemin GLB (brut) | Dimensions approx. | Pourquoi |
|---|---|---|---|---|
| Tapis roulant | Factory Kit 3.0 | `Models/GLB format/conveyor-bars-high.glb` | ~1 × 0,4 × 1 m (segment) | Rambardes latérales hautes : silhouette la plus lisible en vue isométrique parmi les 7 variantes de convoyeur du pack ; remplace le pavé `beltX` actuel. |
| Caisse — grande | Factory Kit 3.0 | `Models/GLB format/box-large.glb` | ~0,6 × 0,6 × 0,6 m | Caisse cubique nette, 1 matériau `colormap`, facile à empiler près du tapis roulant. |
| Caisse — petite | Factory Kit 3.0 | `Models/GLB format/box-small.glb` | ~0,35 × 0,35 × 0,35 m | Variante d'échelle pour un empilement crédible (grande + petite). |
| Bras robotisé | Factory Kit 3.0 | `Models/GLB format/robot-arm-a.glb` | ~0,4 × 1,3 × 0,4 m | Bras articulé socle + pince, bien plus lisible que les 3 boîtes empilées actuelles (`armX` dans `wingSignatureDecor`) ; hauteur > 1,2 m donc à garder contre le mur du fond, hors couloir de vue. |
| Établi | Furniture Kit | `Models/GLTF format/desk.glb` | ~1,2 × 0,75 × 0,6 m | Table à piètement bois/métal, ton chaud cohérent avec la palette « bois » du musée — sert d'établi une fois recolorée vers l'accent orange de l'aile. |
| Étagère | Furniture Kit | `Models/GLTF format/bookcaseOpen.glb` | ~0,8 × 1,8 × 0,3 m | Étagère ouverte à 4 niveaux, bon support pour poser petites pièces/outils décoratifs (autres GLB à venir ou décor peint). |

## Aile Culture (galerie)

| Rôle | Pack | Chemin GLB (brut) | Dimensions approx. | Pourquoi |
|---|---|---|---|---|
| Banquette (velours) | Furniture Kit | `Models/GLTF format/loungeSofa.glb` | ~1,8 × 0,7 × 0,8 m | Canapé arrondi, silhouette « banquette de galerie » une fois recoloré violet (`palette` aile Culture) ; bien plus qualitatif que le pavé générique. |
| Banquette (compacte) | Furniture Kit | `Models/GLTF format/benchCushion.glb` | ~1,6 × 0,45 × 0,45 m | Alternative plus basse pour un coin lecture, variation d'échelle avec `loungeSofa`. |
| Bibliothèque | Furniture Kit | `Models/GLTF format/bookcaseClosedWide.glb` | ~1,6 × 1,8 × 0,35 m | Grande bibliothèque à portes, bon fond de salle pour la galerie. |
| Bibliothèque (ouverte, complément) | Furniture Kit | `Models/GLTF format/bookcaseOpen.glb` | ~0,8 × 1,8 × 0,3 m | Étagères visibles (contenu à suggérer en décor peint), pour varier avec la bibliothèque fermée. |
| Chevalet / cadre de présentation | *(aucun modèle dédié trouvé)* | — | — | Aucun chevalet dans les 6 packs. Le chevalet actuel de `wingSignatureDecor` (planches + traverses peintes) reste la meilleure option ; pas de remplacement CC0 identifié — à documenter comme choix assumé plutôt qu'oubli. |
| Sculpture / socle — variante 1 | Nature Kit | `Models/GLTF format/rock_tallC.glb` | ~0,3 × 0,9 × 0,3 m | Rocher élancé, silhouette abstraite convaincante en « sculpture » une fois recoloré (violet/or), 3 matériaux unis sans texture. |
| Sculpture / socle — variante 2 | Nature Kit | `Models/GLTF format/rock_tallE.glb` | ~0,3 × 0,85 × 0,3 m | Deuxième silhouette de rocher élancé pour varier une petite rangée de « sculptures ». |

## Divers

| Rôle | Pack | Chemin GLB (brut) | Dimensions approx. | Pourquoi |
|---|---|---|---|---|
| Arbre décoratif (abords de l'Arbre des 100) | Nature Kit | `Models/GLTF format/tree_oak.glb` | ~1,2 × 2,5 × 1,2 m | Canopée arrondie basse-poly, ton cohérent avec `palette.leaf`/`leafDark`. **Ne remplace pas** l'Arbre des 100 lui-même (`docs/DESIGN.md` : « sculpture originale », doit rester un objet fait main pour éviter tout air de modèle générique) — proposé en plantation secondaire flanquant la sculpture existante, pas comme substitut. |
| Élément d'architecture (optionnel) | Building Kit | `Models/GLB format/wall-window-round-detailed.glb` | ~0,6 × 0,9 × 0,15 m | Fenêtre ronde décorative, texture-palette 512 px ; utile seulement si une mission future embellit les murs des ailes — non requis pour ce chantier, listé pour mémoire. |

## Planches de référence (regardées avant sélection)

Toutes dans `screens/catalogue/` :

- `hall-1-bancs-plantes-lampes.png` — bancs, jardinières, lampes, colonnes, potelets/cordon (24 vignettes).
- `hall-2-tapis-comptoir-fleurs.png` — tapis, tables/pupitre, livres, fleurs (22 vignettes).
- `infrastructures.png` — racks, machines, antennes, écrans, câbles (29 vignettes).
- `industrialisation.png` — tapis roulant, caisses, bras robotisé, établis, étagères (30 vignettes).
- `culture.png` — banquettes, bibliothèques, sculptures/rochers (27 vignettes).
- `divers-arbres-architecture.png` — arbres et éléments d'architecture (21 vignettes).

## Non retenu / écarté

- **Holiday Kit** : quasi tout le pack est trop connoté (sapins décorés, guirlandes, rennes, bonhommes de
  neige, cadeaux) — hors ton « musée cosy toute l'année ». Seuls `bench.glb`/`bench-short.glb`, `lantern.glb`
  et les `rocks-*.glb` sont neutres, mais des équivalents plus adaptés existent déjà dans Furniture/Nature
  Kit ci-dessus ; Holiday Kit n'apporte donc rien d'unique à ce stade.
- **Space Kit — `structure.glb`/`structure_closed.glb`/`structure_detailed.glb`** (cages/armatures jaune-
  orange) : silhouette trop clairement « chantier spatial », lisibilité douteuse une fois recolorée ; écarté
  au profit de `machine-window.glb`/`machine-fortified.glb` (Factory Kit) pour les racks.
- **Poly Pizza / Quaternius** : non explorés — les 6 packs Kenney fournis couvraient tous les rôles demandés
  avec une marge suffisante de variantes ; pas de besoin identifié de sortir de ces sources pour cette passe.

## Prochaine étape (hors périmètre de cette phase SÉLECTION)

Chaque module (monde/hall, infrastructures, industrialisation, culture) copie les GLB retenus ci-dessus dans
son propre `assets-src/<module>/`, lance `optimize-assets.mjs`, charge via `useModel`, clone+teinte les
matériaux une fois au chargement, et consigne le résultat dans `docs/assets/<module>.md` — jamais dans ce
fichier ni dans `docs/ASSETS.md` (partagé, à ne modifier que par l'agent intégration).
