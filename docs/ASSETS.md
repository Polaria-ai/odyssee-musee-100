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
ci-dessous (Cyril et Rémi depuis le 29/09, l'Archiviste depuis le 01/10 ; l'avatar et Minerve sculptés en three.js sont retirés).

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

## Personnages générés (29/09/2026, l'Archiviste le 01/10/2026)

| Fichier publié | Personne | Provenance | Clips | Poids |
|---|---|---|---|---|
| `public/models/characters/cyril.glb` | Cyril de Sousa Cardoso | Photo fournie par Baptiste (accord de la personne) → image en pied Seedream 5 Pro → Meshy 7.1 (12 400 triangles) → squelette Meshy (24 os) | `idle` (Meshy Idle_02), `walk` (Meshy Casual_Walk) | 343 Ko |
| `public/models/characters/remi.glb` | Rémi Godeau | Idem | `idle` (Meshy Idle_02), `wave` (Meshy Big_Wave_Hello) | 367 Ko |
| `public/models/characters/archiviste.glb` | L'Archiviste de 2040 : personne ENTIÈREMENT GÉNÉRÉE, aucune personne réelle | Référence fournie par Baptiste le 01/10/2026 (image en pied Seedream 5 Pro) → Meshy 7.1 → remaillage Meshy (15 585 triangles) → squelette Meshy (24 os, le même que Cyril et Rémi) | `idle` (Meshy Idle_02), `wave` (Meshy Big_Wave_Hello), `talk` (Meshy Talk_with_Hands_Open) | 388 Ko |

- Générés dans Magnific (projet « Odyssée de l'IA — Musée des 100 »), crédits du compte Premium+ de Baptiste : 12 000 environ au total, dont une première attente (« Idle », agitée, écartée).
- Sources brutes (photos, images en pied, GLB Meshy ~7 Mo par clip) hors Git : `~/Dev/odyssee-musee-100-assets/personnages/`.
- Construction : `node scripts/build-characters.mjs` fusionne les clips d'un personnage en un seul GLB (même squelette), dilate les îlots de l'atlas dans le vide qui les entoure (`scripts/atlas-padding.mjs`, sur la texture 2048 pleine taille, avant sa réduction), puis optimise (meshopt, texture WebP 1024). Sortie déterministe (deux fabrications donnent les mêmes octets) ; seul le vide de la texture change : maillage, UV, squelette et clips sont identiques octet pour octet à ceux d'avant la dilatation (vérifié sur les trois fichiers).
- Les « veines » claires sur les vêtements ne viennent pas de la texture mais de son filtrage à distance : voir « Les veines claires sur les vêtements » plus bas (WEL-930).
- Texture en ligne : three.js lit les textures intégrées aux GLB par `fetch(blob:…)` (Chrome, Android, Safari ≥ 17). La CSP de `vercel.json` doit donc garder `blob:` dans `connect-src`, sinon les modèles s'affichent en blanc (constaté en production le 29/09). `pnpm verify:security` le vérifie ; `vite preview` sert les en-têtes de Vercel, les E2E locaux tournent sous la même CSP que la production.
- Pas de licence CC0 ici : Cyril et Rémi sont les images de deux personnes réelles, utilisées avec leur accord pour ce jeu uniquement. L'Archiviste est une personne entièrement générée (aucune personne réelle, confirmé par Baptiste) : rien à autoriser.
- Sources de l'Archiviste (hors Git, `~/Dev/odyssee-musee-100-assets/personnages/`) : `archiviste-b.png` (image en pied validée), `archiviste-meshy.glb` (Meshy 7.1), `archiviste-remesh.glb` (remaillage), `archiviste-rig.glb` (squelette), `archiviste-idle.glb` / `-wave.glb` / `-talk.glb` (un clip chacun, ~7 Mo, texture 2048²), aperçus `archiviste-meshy-apercu.png` et `archiviste-remesh-apercu.png`.
- Dans le jeu : `src/archives/Archivist.tsx` (salle des Archives de 2040, voir `docs/CHARTE-3D.md` §4.8). Hauteur 1,7 m (comme Cyril). Le fichier (388 Ko) est préchargé avec les deux autres (`src/characters/GlbCharacter.tsx`), donc téléchargé par tous les joueurs au démarrage, qu'ils aillent ou non aux Archives (la salle est montée en permanence). Il n'est dessiné que lorsque l'Archiviste est dans le champ de la caméra (sphère de culling resserrée, `cullMargin` 1,25 : voir `docs/CHARTE-3D.md` §4.8 et §8).

### L'Archiviste : pourquoi sa chaîne de fabrication est plus longue (WEL-928)

`node scripts/build-characters.mjs archiviste` (options : `--debug dossier`, `--out dossier`, `--no-clean`, voir l'en-tête du script). Cyril et Rémi n'ont que la dilatation des îlots (leur texture n'a pas de taches : `passes: 0`) ; l'Archiviste a deux étapes de plus, parce que son GLB sortait à 470 Ko, au-dessus des 400 Ko par fichier de `pnpm verify:bundle` (maillage de 15 585 triangles contre 12 400, et trois clips au lieu de deux), et parce que le remaillage Meshy a abîmé sa texture.

1. **Nettoyage de la texture** (`scripts/clean-texture-stains.mjs`, local et déterministe, sharp). Le remaillage a laissé des amas de texels presque noirs dans les zones anthracite du bas du manteau et du pantalon. L'atlas Meshy est un patchwork d'îlots séparés de noir ; des veines claires courent aussi sur le tissu.
   - Taches : texels neutres nettement plus sombres (< 62 %) que la moyenne locale de leur zone anthracite, dans un îlot UV anthracite, en amas de 4 à 150 texels, remplacés par la couleur des voisins sains du même îlot. 6 tours de détection et de remplissage (chaque tour révèle de nouvelles taches) : 79, 36, 24, 20, 19, 19 amas ; **3 043 texels de taches changés** sur 2048² (0,15 % des texels utilisés). Les amas de plus de 150 texels sont laissés : une première version les remplissait aussi et peignait une étoile grise sur le t-shirt noir de l'Archiviste (qui partage l'îlot du manteau), constatée au rendu et corrigée.
   - Marge des îlots : la couleur de l'îlot le plus proche est étendue de 40 texels dans le vide qui l'entoure (1,83 million de texels de vide changés, 43,7 % de l'atlas : des texels que le maillage n'affiche pas, seuls des texels inutilisés changent). Hypothèse de départ : le filtrage de la texture mélange le noir du vide et les mèches grises voisines au bord des îlots, d'où des veines claires ; la marge devait les atténuer. **Hypothèse infirmée** (WEL-930) : voir la section suivante. Cette marge est maintenant `padIslands` (`scripts/atlas-padding.mjs`), la même fonction pour les trois personnages ; le vêtement n'y a plus de priorité sur les autres îlots (sans effet mesuré).
   - Protection : les îlots rattachés aux os `Head`, `neck`, `head_end`, `headfront`, `LeftHand` et `RightHand` (visage, cheveux, yeux, mains) ne sont jamais modifiés. Le script le contrôle par différence avant/après et lève une erreur si un texel protégé, ou un texel qui n'est ni une tache ni du vide, a changé (**0 texel protégé changé**, confirmé par une mesure indépendante sur des masques UV recalculés : 3 043 texels utilisés changés, 0 dans les îlots protégés, 0 hors taches et vide). Les tests (`scripts/clean-texture-stains.test.ts`) le vérifient sur un atlas synthétique et sur la vraie source.
   - **Effet de la marge sur les veines : nul** (vérification indépendante du 03/10, confirmée par le banc d'essai de WEL-930). Les taches nettement visibles sont rares et peu contrastées au rendu : sur les texels de vêtement, des amas sombres de 6 texels ou plus passent de 53 à 30 ; il reste 2 071 texels sombres isolés sur 762 701 texels anthracite. Les veines claires ne sont pas supprimées par la marge : à nombre de pixels clairs neutres comparés, le bas du corps en trois quarts passe de 1 512 à 1 482 pixels (− 2 %). Le gain réel et mesuré de la marge est un fichier plus léger (WebP : 409 392 → 398 360 octets). Les veines ont une autre cause, corrigée par le biais de LOD de WEL-930 (section suivante).
2. **Allègement du fichier** : images clés des clips fusionnées à 0,003 (écart de rotation < 0,3°, invisible, −28 Ko), maillage allégé à 12 467 triangles (80 % des sommets, erreur maximale 0,5 % de la taille du modèle, −30 Ko ; un maillage allégé se compresse moins bien que son nombre de triangles ne le laisse croire), texture 1024 en WebP qualité 80 comme les deux autres, puis meshopt. Résultat : **388 Ko** (397 224 octets ; texture 88 924 octets, clips 29 Ko, maillage 270 Ko), contre 367 Ko pour Rémi. Sans le nettoyage de la texture, la même chaîne donne 400 Ko (409 392 octets, à 200 octets de la limite) : une marge lisse se compresse mieux qu'un fond noir bordé de franges.


### Les veines claires sur les vêtements : le filtrage de l'atlas, pas sa texture (WEL-930)

**Constat.** En jeu, des veines claires zèbrent le manteau et le pantalon anthracite de l'Archiviste (constat du vérificateur de WEL-928), la veste et le pantalon de Cyril, la veste de Rémi : un réseau de lignes couleur peau ou gris clair le long des coutures. Elles sont visibles à la distance de jeu (un personnage de ~75 px de haut sur un téléphone).

**Cause (mesurée).** L'atlas Meshy de chaque personnage est un patchwork de 1 100 à 2 300 îlots, de 15 à 22 texels de large en moyenne sur la texture livrée (1024²), posés les uns contre les autres sans tenir compte de la couleur. À la distance de la caméra, le GPU lit le niveau 2,2 à 2,7 de la chaîne de mipmaps en médiane (1,6 à 3,5 pour 80 % des pixels) : un texel de ces niveaux couvre 4 à 8 texels de l'atlas, presque la largeur d'un îlot. Il mélange la couleur du vêtement avec celle des îlots **voisins dans l'atlas** (peau, cheveux, chemise), qui ne le sont pas sur le corps. Le contenu des îlots, lui, est propre : rendu sans mipmaps puis réduit, le même personnage est lisse (aucune veine).

**Pistes testées, au banc d'essai** (`dev/atlas-lab.html`, voir plus bas ; part des pixels du personnage éclaircis de plus de 25 niveaux par rapport à l'image lisse, Archiviste de dos puis de trois quarts) :

| Piste | Résultat |
|---|---|
| Rien (état d'avant) | 14,6 % / 19,3 % |
| Dilatation des îlots dans le vide (40 texels, ou tout le vide), avant la réduction | inchangé (± 0,4 point) : Meshy remplit déjà le vide, ce n'est pas lui qui est mélangé |
| Érosion des bords d'îlots (1 à 4 texels) puis dilatation | pas mieux, pire dès 3 texels (les îlots étroits disparaissent) |
| Dépoussiérage des texels clairs isolés des îlots non protégés | inchangé |
| Mipmaps « par îlot » (chaque texel de mipmap reprend l'îlot dominant) | meilleur que l'état d'avant, mais loin du biais ; il faudrait en plus embarquer les mipmaps dans le GLB (budget de l'Archiviste : 12 Ko restants) |
| Plusieurs prises de texture par pixel (4 à 16) | pire : 5,7-6,3 % / 7,0-7,5 % (élargit le filtre, donc le mélange) |
| **Biais de LOD de −2** | **3,9 % / 5,1 %** |
| Biais de −3 | 0,3 à 0,8 point de mieux, scintillement un peu plus fort : non retenu |
| Biais −2 + filtrage dans l'espace gamma (texture non décodée, décodée dans le shader) | encore − 30 % de veines franches, mais une seconde copie de chaque texture sur le GPU (≈ + 16 Mo) ou un changement de la texture partagée avec le buste de Rémi : piste possible, non retenue |
| Recolorer les texels clairs d'un îlot voisin collé à un îlot sombre (essai d'« oracle ») | − 40 % de veines franches, mais l'écart moyen à l'image lisse monte, et cela change la couleur d'îlots : écarté |

**Correction.** `CHARACTER_LOD_BIAS = −2` dans `src/characters/characterRig.ts` : le matériau mat des personnages lit la texture avec un biais de LOD de −2 niveaux (`texture2D(map, uv, −2)`, injecté par `onBeforeCompile` dans les deux lectures, couleur et émissif ; `applyLodBias` le redonne au clone transparent du fondu d'opacité, car `Material.clone()` perd `onBeforeCompile`). Le GPU lit alors le niveau 0 à 1 au lieu de 2 à 3, où les îlots ne se mélangent presque plus. Aucun octet de plus, aucun changement d'UV ni de couleur d'îlot. Le biais ne rend jamais la texture plus floue (il ne fait que choisir un niveau plus fin) ; le buste de Rémi du chat a son propre matériau, sans biais, et n'est pas concerné.

| Part des pixels sombres éclaircis de plus de 25 niveaux | de dos | de trois quarts |
|---|---|---|
| Cyril | 9,0 % → 2,2 % | 14,3 % → 3,7 % |
| Rémi | 12,1 % → 2,8 % | 19,8 % → 5,1 % |
| Archiviste | 14,6 % → 3,9 % | 19,3 % → 5,1 % |

Éclaircissement moyen de ces pixels : de 6-13 niveaux à 2-3,5. Pas de scintillement de plus d'une image à l'autre (écart moyen entre deux images consécutives : 4,32 → 4,22 pour l'Archiviste, 1,92 → 1,76 pour Cyril). Netteté du visage : l'écart à l'image lisse sur la tête baisse à toutes les distances de caméra (Cyril 6,1 → 3,6 à 17 m, 1,3 → 0,5 à 6,3 m ; Rémi 7,9 → 4,1 et 1,6 → 0,6 ; Archiviste 4,8 → 4,0 et 0,8 → 0,6) : le visage n'est pas plus flou (le niveau de mipmap lu est plus fin, jamais plus grossier) et se rapproche de l'image lisse.

**Limite honnête.** Les veines continues disparaissent ; il reste une fine poussière de pixels clairs isolés sur les vêtements sombres (2 à 5 % des pixels sombres, contre 9 à 20 % avant) : repliement du détail fin de l'atlas et coutures où un îlot sombre touche directement un îlot clair, sans vide entre les deux. Les supprimer demande de repacker l'atlas (donc de changer les UV) ou de régénérer le maillage chez Meshy avec de plus grands îlots : hors périmètre de WEL-930.

**Reproduire.** `pnpm exec vite --host 127.0.0.1 --port 4181 --strictPort`, puis `PW_CHROMIUM_PATH=… node dev/measure-atlas.mjs <dossier> --lod` : `dev/atlas-lab.html` rend chaque personnage comme dans le jeu (caméra, lumières, matériau, clip « idle », ratio de pixels 1,75), de dos et de trois quarts, avec puis sans le biais, et le compare à la même image rendue sans mipmaps à 14 px par pixel puis réduite 8× (le rendu qu'un filtrage parfait donnerait). Mesures et captures de WEL-930 : `~/Dev/odyssee-musee-100-assets/v5-captures/atlas/` (`avant/`, `apres/`, planches, `mesures-veines.json`).

## Textures de sol (WEL-923)

Quatre matières, une par famille de salle (marbre : hall et Archives ; terrazzo : Infrastructures ; microciment : Industrialisation ; moquette : Culture). Le détail du rendu (UV monde, multiplication de la couleur de la charte, gain, échelles) est dans `docs/CHARTE-3D.md` §4.1.

| Élément | Emplacement |
|---|---|
| Sources Magnific (albédo 1024², normales et rugosité 1000²), neutres et claires | `~/Dev/odyssee-musee-100-assets/sols-v5/magnific/` (hors Git). Copie de travail : `assets-src/floors/` (ignoré par Git, comme `assets-src/`). Fichiers utilisés : `marbre-2`, `terrazzo-2`, `microciment-2`, `moquette-1` (`.png`, `.normal.png`) ; les cartes de rugosité ne servent pas (le sol reste en Lambert). |
| Cartes produites (versionnées) | `public/textures/floors/<matière>-detail.webp` et `<matière>-normal.webp`, 8 fichiers ≤ 512 px, 286 Ko au total |
| Script | `node scripts/build-floor-textures.mjs [--debug dossier]` — lit `assets-src/floors/` (ou `FLOORS_SRC=…`, ou le dossier d'origine), écrit les 8 fichiers, vérifie le budget (450 Ko). `--debug` écrit les mosaïques 2×2 de contrôle du raccord. Sorties déterministes (octet pour octet). |
| Tests | `scripts/build-floor-textures.test.ts` (fichiers, dimensions, moyenne du détail, tuilage, budget, déterminisme si les sources sont présentes), `src/world/floorTextures.test.ts` (cache, repli, libération), `src/world/roomGeometry.test.ts` et `src/archives/room/geometry.test.ts` (UV monde) |

Fabrication : luminance linéaire de l'albédo → raccord tuilable si besoin (fondu avec une copie décalée pour le marbre et le microciment, retrait de la dérive lente pour le terrazzo) → réduction à 512 px → flou léger qui grossit les marques trop fines pour l'écran (terrazzo 1,2 px, moquette 0,7 px) et renfort des marques moyennes (microciment) → aplanissement partiel des grandes taches → normalisation par percentiles → profondeur réglée par matière (`FLOORS` dans le script) → webp qualité 70 à 82 ; normales recentrées (moyenne et ondulations larges retirées, sinon tout le sol serait éclairé de travers), qualité 92 (moquette : 256 px). Les grands flous sont des moyennes glissantes en trois passes (coût constant : la fabrication des 4 matières prend 4 s). Si un réglage change, recopier la moyenne affichée dans `detailMean` de `src/world/floorSpec.ts` (le test échoue sinon) et la taille du motif dans `tileMeters` : voir `docs/CHARTE-3D.md` §4.1 pour la règle d'échelle (motif lisible à 60-80 px par mètre).
