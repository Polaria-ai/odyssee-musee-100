# Charte 3D — Le Musée des 100

> Retour de Baptiste du 29/09/2026 : « la charte graphique de l'Odyssée appliquée partout — le fond, les tapis, les murs, tout ». La décision du 26/09 (interface + accents, matières chaudes bois/crème/terre cuite conservées) est **annulée**.
> Capture de référence de ce qui n'est plus acceptable : cadres dorés, portraits d'attente rose pâle à silhouette bordeaux, bandeau brun « N° 14 », plaques de laiton, cimaise terre cuite, murs beige.

Esprit visé : une soirée de gala « nuit bleue », lisible, pas un tunnel noir. Trois échelons de bleu (ciel < sol < murs), du blanc pour le mobilier et les cadres, et la couleur de chaque aile portée par des accents lumineux (corniche, tapis, bannière, moulure du cadre).

Les jetons vivent dans `src/styles/tokens.ts` (`charter3d`). **Aucune couleur en dur dans un décor** : tout module 3D importe `charter3d`. Garde-fous : `src/styles/charter3d.test.ts` (palette fermée, dérivations, contrastes AA, hiérarchie de luminance).

## 1. Modèle de rendu (à connaître avant de choisir une couleur)

Les valeurs de ce document sont des **albédos** (ce qu'on passe à `Color`, aux couleurs par sommet et aux canvas). La couleur affichée d'un matériau `MeshLambert` est :

`affiché = sRGB( linéaire(albédo) × E / π )`, avec `E` = lumière d'hémisphère (mélange ciel/sol selon la normale) + lumière directionnelle × max(0, N·L).

Le modèle (lumières et ACES d'avant, formule ci-dessus puis ACES) reproduit à ±1/255 les pixels mesurés sur `screens/cross/iphone-04` et `-05` (chemins de tapis, mur d'aile) : il est fiable, et on en retire l'ACES. Les textures `MeshBasicMaterial` (`toneMapped: false` : bannière, panneaux, toiles, cartels, écrans) s'affichent **telles que peintes**.

**`<Canvas flat>` est obligatoire.** R3F applique sinon ACES Filmic, qui trahit la charte : sous ces lumières le bleu `#1d49c1` s'afficherait `#003ec3`, le cyan vif `#6de4e5` délavé en `#9dd7d7` et le corail `#e8785c` en `#e28664`. Sans tone mapping, la charte est ce qu'on voit, au gain de lumière près :

| Face | Gain R / G / B (lumières de `charter3d.scene`) |
|---|---|
| Dessus (sols, dessus de murs coupés) | 0,94 / 0,94 / 0,96 |
| Face sud, vue par la caméra (murs, cadres, façades) | 0,83 / 0,84 / 0,94 |
| Flanc est/ouest éclairé (murs latéraux des Archives, de l'aile nord) | 0,60 / 0,62 / 0,74 |
| Flanc ombré | 0,43 / 0,46 / 0,60 |

Les ombres tirent vers le bleu (gain bleu plus haut) au lieu de griser : c'est voulu, le musée est « de nuit ».

**Sols texturés (WEL-923).** Les sols portent une matière (§4.1) : la carte de détail MULTIPLIE la couleur de sommet, donc `affiché = sRGB( linéaire(albédo) × détail × gain × E / π )`. Le gain du matériau vaut `1 / moyenne du détail` : la couleur MOYENNE d'un sol reste exactement celle de la charte (les gains du tableau ci-dessus restent vrais), seul le motif s'en écarte, vers le haut (≤ + 35 % pour la moquette, le sommet de ses boucles) et vers le bas. Le sol reste en `MeshLambertMaterial` à couleurs de sommet, avec une carte de normales en plus.

## 2. Jetons de base

| Jeton (`charter3d.base.*`) | Valeur | Origine | Rôle |
|---|---|---|---|
| `ciel` | `#071336` | `eventPalette.bleuNuit` | fond de scène, brouillard |
| `nuit` | `#0a1738` | fond des panneaux de l'interface (`--cream`) | toiles, cartels, panneaux, plaques |
| `nuitProfond` | `#050b1e` | `--on-accent` | plinthes, texte posé sur un aplat d'accent |
| `bleu` | `#1d49c1` | charte | lambris, comptoir, bordure de moquette |
| `bleuProfond` | `#113198` | charte | sols |
| `bleuTrait` | `#2d4fb0` | `--wood` de l'interface | trait de mobilier |
| `blanc` | `#ffffff` | charte (texte blanc pur) | cadres, plateaux, liserés, barres du logo |
| `brume` | `#eaf1ff` | blanc + 12 % de bleu néon | matières claires : colonnes, socles, corps de bancs, tronc |
| `mur` | `#385fc8` | bleu + 12 % de blanc | murs de toutes les salles |
| `corail` | `#e8785c` | charte | accent hall et Industrialisation, action |
| `corailProfond` | `#b04a33` | charte | bordure de petit tapis |
| `cyan` | `#57bfd6` | charte | accent des Archives, plantes, contrepoint |
| `cyanVif` | `#6de4e5` | charte, zone Infrastructures | accent Infrastructures |
| `bleuNeon` | `#4d8cff` | charte, zone Culture | accent Culture |
| `magenta` | `#d6248c` | charte (`alarm`) | **un seul usage : accès fermé** (barrière et plaque « Bientôt ») |
| `attente` | `#5a6a98` | `PENDING_COLOR` du carnet | encre d'un tampon non obtenu |

Teintes dérivées de sol (mélanges sRGB, vérifiés par le test) : hall `#1539a6` (bleu profond + 35 % de bleu), Infrastructures `#1c46a1` (+ 12 % de cyan vif), Industrialisation `#2b3a91` (+ 12 % de corail), Culture `#1437a2` (bleu profond + 25 % de bleu), bord des Archives `#0d2363` (+ 55 % de nuit), briques `#2b54c5` (mur + 50 % de bleu).

## 3. Ciel, brouillard, lumières

| Surface | Jeton | Valeur | Raison |
|---|---|---|---|
| Fond de scène | `scene.background` | `#071336` | le ciel de la charte ; c'est aussi la couleur du fond de l'interface |
| Brouillard | `scene.fog` | `#071336`, 28 → 70 m | les lointains fondent dans la nuit bleue, jamais dans un gris |
| Hémisphère | `scene.hemisphere` | ciel `#f4f7ff`, sol `#b4c0f0`, intensité 2,0 | blanc froid ; le rebond bleuté colore les ombres en bleu |
| Directionnelle | `scene.directional` | `#fffaf2`, 1,75, position (5, 11, 12) | clé légèrement chaude côté caméra : les faces vues de face gardent 83 % de leur valeur |
| Rayons de la verrière (hall) | `scene.rays` | `#cfe0ff`, opacité matériau 0,07, additif | blanc froid ; le jaune `#fff6d8` d'avant jurait avec les bleus |
| Tone mapping | `scene.flat` | `true` (`<Canvas flat>`) | voir §1 |

Les couleurs de lumière sont des lumières (blanc froid), pas des matières : elles ne passent pas le contrôle de palette du test.

## 4. Surface → jeton → valeur → raison

Les chemins sont relatifs à `charter3d`. « Rendu » = valeur affichée sous les lumières du §3.

### 4.1 Sols

| Surface | Jeton | Valeur | Raison |
|---|---|---|---|
| Hall, planche A des chevrons | `rooms.hall.floor` | `#113198` | bleu profond de la charte ; rendu `#102f95`, 1,6:1 sur le ciel |
| Hall, planche B | `rooms.hall.floorAlt` | `#1539a6` | même famille, un cran plus clair : les chevrons se lisent sans effet zèbre |
| Infrastructures, damier A / B (cellule 1,4 m) | `rooms.infrastructures.floor` / `floorAlt` | `#113198` / `#1c46a1` | B légèrement teinté de cyan vif : la salle des machines sent la donnée |
| Industrialisation, damier A / B (cellule 1,6 m) | `rooms.industrialisation.floor` / `floorAlt` | `#113198` / `#2b3a91` | B légèrement teinté de corail : l'atelier est plus chaud, sans quitter le bleu |
| Culture, moquette / bordure (1,0 m) | `rooms.culture.floor` / `floorAlt` | `#1437a2` / `#1d49c1` | moquette plus saturée, bordure au bleu de la charte |
| Archives, fond de la frise | `archives.floor.base` | `#113198` | même sol que le reste du musée ; le chemin cyan fait l'identité |
| Archives, bords (vignette) | `archives.floor.vignetteEdge` | `rgba(5,11,30,0.45)` | profondeur douce vers `nuitProfond`, jamais un fond noir |
| Câbles, aile Infrastructures | `cables.main` (r = 0,05), `cables.thin` (r = 0,04) | `#6de4e5`, `#ffffff` | lignes de données sur le sol bleu ; l'ancien brun `inkSoft` disparaît |

`SOFTEN_CHECKER` passe à 0 : les tons A/B sont déjà rapprochés, le lissage supplémentaire effacerait le motif.

#### Matières des sols (WEL-923)

**Règle : la texture multiplie la couleur de la charte, elle ne la remplace jamais.** Les couleurs de sommet du tableau ci-dessus (chevrons, damiers, moquette et bordure) restent les couleurs de référence, au même endroit et au même ton franc ; la matière (veines, éclats, grain, fibres) vient d'une carte de détail en niveaux de gris, de moyenne ramenée à 1 par le gain du matériau (§1), et d'une carte de normales. Aucune couleur n'est peinte dans une texture de sol. Sources neutres et claires (Magnific), fabriquées par `scripts/build-floor-textures.mjs` (voir `docs/ASSETS.md`).

| Salle | Matière | Motif (UV monde) | Détail : valeurs, moyenne, gain | `normalScale` | Fichiers |
|---|---|---|---|---|---|
| Hall | marbre blanc à fines veines (sur les chevrons `floor` / `floorAlt`) | 2,5 m | 0,52 à 1, moyenne 0,906, × 1,10 | 0,35 | `marble-*.webp`, 45 Ko |
| Archives | marbre (même carte que le hall), la frise peinte reste en `map` | 2,5 m | idem | 0,35 | idem |
| Infrastructures | terrazzo à éclats (sur le damier 1,4 m) | 6,0 m | 0,38 à 1, moyenne 0,817, × 1,22 | 0,8 | `terrazzo-*.webp`, 72 Ko |
| Industrialisation | microciment taloché (sur le damier 1,6 m) | 5,0 m | 0,34 à 1, moyenne 0,740, × 1,35 | 0,6 (relief de la source × 1,5) | `microcement-*.webp`, 71 Ko |
| Culture | moquette bouclée (sur la moquette et sa bordure) | 7,0 m | 0,38 à 1, moyenne 0,741, × 1,35 | 0,8 | `carpet-*.webp`, 98 Ko |

Total des 8 fichiers : 286 Ko (budget 450 Ko). « Motif » = côté, en mètres, de la carte de 512 px répétée.

- **Règle de l'échelle : la carte se lit à la densité d'écran du jeu, pas à celle de la matière réelle.** La caméra plonge à 48° et montre ≈ 11 m de sol sur un téléphone, rendu à dpr 1,75 : 60 à 80 px par mètre (50 en haut de l'image). Une maille de moquette de 4 cm, un éclat de terrazzo de 1 cm ou un grain de 2 cm tombent alors sous le pixel : les mipmaps les moyennent et le sol redevient un aplat, quelle que soit la profondeur de la carte. La première version de ces sols (motifs de 2,8 à 4 m pour la moquette, le terrazzo et le microciment) était exactement dans ce cas : coefficient de variation de la luminance de la moquette mesuré sur capture 0,070 → 0,075, soit indiscernable de l'aplat. Les motifs sont donc posés à une taille de jeu : une maille de moquette de ≈ 10 cm (7 m pour 72 mailles), des éclats de terrazzo de ≈ 6 cm (la source est grossie par un flou de 1,2 px suivi d'une renormalisation, qui épaissit les éclats sans perdre leur contraste), des nuages et des coups de platoir de microciment de 20 à 80 cm (les marques de 6 à 60 cm sont renforcées dans la carte, `boostMid`, car ce sont celles que l'écran restitue ; les taches de plus d'un mètre sont aplanies à 80 %, sans quoi la luminance moyenne d'un coin de sol s'écarte de la charte de plus de 1,5 % selon l'endroit où l'on regarde). Le texel de la carte (512 px sur 5 à 7 m = 73 à 100 texels par mètre) est ainsi voisin du pixel d'écran : pas de moiré, pas de flou.
- **Contraste : vérifiable sur capture et sur fichier.** Mesuré sur des crops de sol pur d'iPhone 13 (Chrome for Testing, SwiftShader), au même cadrage avec et sans textures : moquette, `phone-culture-centre`, coefficient de variation de la luminance 0,070 → 0,124 (0,069 → 0,123 sur un autre crop), contraste local (passe-haut de 8 px) 0,010 → 0,091, luminance moyenne − 0,5 % ; terrazzo, contraste local 0,029 → 0,077 (× 2,6), moyenne + 0,3 / − 0,1 % ; microciment, 0,021 → 0,047 (× 2,3), moyenne − 0,8 / − 0,6 %. Côté fichier, `screenContrast` (script de fabrication) rééchantillonne la carte à 80 et 55 px/m : les tests exigent au moins 0,05 (marbre, dont les veines fines sont des lignes isolées), 0,09 (terrazzo), 0,11 (microciment) et 0,11 (moquette) à 80 px/m ; les valeurs réelles sont 0,062 (marbre), 0,114 (terrazzo), 0,132 (microciment) et 0,169 (moquette) ; avant ce réglage : 0,058 / 0,052 / 0,052 / 0,047.
- **Profondeur des creux.** Les valeurs de la carte vont de 0,34-0,52 à 1 (au lieu de 0,82 à 1 envisagé au départ : à 0,82 le marbre et le terrazzo redevenaient des aplats à la distance du jeu). Le garde-fou n'est plus la profondeur mais la lisibilité : les creux les plus sombres restent à ≥ 1,15:1 du ciel (test `scripts/build-floor-textures.test.ts`), jamais un trou noir (carte > 0,3), et la couleur moyenne ne bouge pas (< 1 % sur la couleur de la charte, pour chaque sol).
- **Cartes tuilables, sans marche.** Les sources ne sont pas toutes parfaitement tuilables : le marbre et le microciment sont raccordés par un fondu avec une copie décalée d'une demi-tuile (`seamless`), le terrazzo par le retrait de sa dérive lente (le haut de la source est plus clair que le bas : `flattenOpen`, sans bouclage). Un test compare la moyenne de bandes de 24 px aux bords opposés (< 4 %) en plus du rapport de raccord, et `--debug` écrit les mosaïques 2×2 de contrôle. Le motif de microciment reste reconnaissable d'une répétition à l'autre (coups de platoir), sans couture.
- **Le marbre du hall remplace la lecture des chevrons, par choix.** Les couleurs de sommet gardent les deux planches des chevrons (`floor` / `floorAlt`, §4.1) : la charte les cite toujours, et leurs tons restent ceux du tableau. Mais les veines du marbre, plus contrastées que l'écart entre les deux planches, prennent le dessus à l'œil ; les chevrons ne se devinent plus qu'en rehaussant le contraste d'une capture. Assumé : le hall gagne une matière lisible, sans quitter les deux bleus de la charte.
- **UV en coordonnées monde** (`x / motif`, `z / motif`, `src/world/floorSpec.ts`) pour toutes les géométries de sol (parquet du hall, damiers, moquette, plan des Archives) : deux quads voisins, ou deux salles de même matière, lisent la matière au même endroit, sans raccord. `RepeatWrapping`, mipmaps, anisotropie 4 sur écran tactile (8 ailleurs, plafonnée au matériel).
- **Reste net, sans matière** : disque-logo du hall, chemins colorés et leurs liserés blancs. Ils restent dans la géométrie de la salle (matériau uni, arêtes franches) et se posent sur le marbre.
- **Reflet du marbre : essayé, écarté.** Un `MeshPhongMaterial` (brillance 14, spéculaire `#6a7090`) sur le marbre du hall ne se distingue pas du Lambert sur les captures (la lumière directionnelle est fixe et la caméra ne voit jamais son reflet) ; on garde Lambert, qui porte le modèle de couleur de la charte.
- **Coût de rendu** (mesuré aux mêmes lieux, avant / après, `renderer.info`) : même nombre de triangles ; + 1 à + 3 appels de dessin (le sol de chaque salle visible est une géométrie à part : hall 115 → 117, aile Infrastructures 55 → 57, Industrialisation 111 → 112, Culture 55 → 57 sur iPhone 13) ; + 8 textures de 512 px (4 matières × 2 cartes). Le maximum reste très en dessous du budget de 150 appels. Le test E2E `performance.spec.ts` passe.
- **Chargement.** Cartes chargées une fois par matière (cache compté), sans bloquer l'entrée : le sol est d'abord uni (l'ancien rendu), la matière apparaît quand les cartes sont là (pendant l'écran-titre, le musée est déjà monté). Une carte qui échoue laisse le sol uni, sans erreur. Libération au démontage.

### 4.2 Murs et architecture (identiques dans toutes les salles, l'accent change)

| Surface | Jeton | Valeur | Raison |
|---|---|---|---|
| Murs pleins | `rooms.*.wall` | `#385fc8` | rendu de face `#3357c3` : 1,8:1 sur le sol (Culture 1,6:1) et 2,9:1 sur le ciel |
| Briques de l'Industrialisation | `wall` / `wallAlt` | `#385fc8` / `#2b54c5` | le motif de briques reste, en deux bleus rapprochés |
| Lambris (0,95 m) | `rooms.*.wainscot` | `#1d49c1` | bleu de la charte, plus sombre que le mur : le bas des murs s'ancre |
| Listel (0,04 m, en haut du lambris) | `rooms.*.listel` | `#ffffff` | filet blanc net (6,9:1 sur le lambris) qui sépare lambris et mur |
| Plinthe (0,16 m), murs et cimaises | `rooms.*.plinth` | `#050b1e` | ombre portée franche au pied des murs |
| Corniche (0,16 m) | `rooms.*.cornice` (= `wingThemes.*.trim`) | accent de la salle | ligne lumineuse qui découpe le mur sur le ciel (5,0 à 10,3:1) et porte la couleur de l'aile |
| Bande sur le dessus des murs coupés (0,06 m) | `rooms.*.cap` | accent de la salle | les murs de 1 m côté caméra deviennent un liseré lumineux ; ≥ 3:1 sur le sol de chaque salle |
| Cimaises | `wall` + `plinth` | `#385fc8`, `#050b1e` | pas de lambris ni de corniche (elles s'estompent) ; le cadre blanc s'y détache à 5,4:1 |
| Linteaux et arches des portes | accent de l'aile | inchangé | déjà à la charte |
| Murs des Archives | `rooms.archives.wall` | `#385fc8` | mêmes murs que le musée, pleine hauteur ; corniche et bande de dessus en `#57bfd6` |
| Seuil de la porte des Archives | `archives.threshold` | `#57bfd6`, émissif 0,55 | seuil lumineux cyan |
| Piliers d'angle des Archives | `archives.pillar` | `#eaf1ff` | même blanc bleuté que les colonnes du hall |
| Panneaux muraux des Archives | `archives.panel` | `#0a1738`, émissif `#57bfd6` × 0,12 | écrans sombres liserés de cyan, plus de plaque crème |

Accents par salle : hall `#e8785c`, Infrastructures `#6de4e5`, Industrialisation `#e8785c`, Culture `#4d8cff`, Archives `#57bfd6`.

### 4.3 Tapis

| Surface | Jeton | Valeur | Raison |
|---|---|---|---|
| Disque central du hall, fond | `hallFloor.rugBacking` | `#0a1738` | fond du logo : le tapis EST le disque en scanlines |
| Disque, barres | `hallFloor.rugBar` | `#ffffff` | 16,8:1 sur le fond ; géométrie de `discBars()` (`src/ui/OdysseeLogo.tsx`) mise à l'échelle de `RUG_RADIUS` |
| Disque, trois barres du logo | `hallFloor.rugBarAccent` | `#e8785c` | corail du logo (5,8:1 sur le fond) |
| Chemins vers les portes | `hallFloor.path.*` | Infra `#6de4e5`, Indus `#e8785c`, Culture `#4d8cff`, Archives `#57bfd6` | un chemin par aile, y compris la nouvelle porte sud ; 3,3 à 7,0:1 sur le sol |
| Liseré de bord des chemins | `hallFloor.pathEdge` | `#ffffff` | arête nette ; à poser en quads (voir §6.1) |
| Petit tapis devant le comptoir (Kenney `rug`) | `props.rug` | champ `#e8785c`, bordure `#b04a33` | corail du hall |

### 4.4 Mobilier et décor

| Surface | Jeton | Valeur | Raison |
|---|---|---|---|
| Colonnes du hall (Kenney `stone`) | `props.stone` | `#eaf1ff` | multiplie la texture-palette : le relief est gardé ; 4,8:1 sur le mur |
| Bancs, tables, bureau, étagère (Kenney `wood`) | `props.wood.body` / `trim` | `#eaf1ff` / `#2d4fb0` | corps clair (9:1 sur le sol), pieds et quincaillerie au bleu trait |
| Jardinières (Kenney `planter`) | `props.planter` | pot `#ffffff`, terre `#0a1738`, plante `#57bfd6` | le vert feuille sort de la charte : plantes en cyan |
| Lampadaires et appliques (Kenney `lamp`) | `props.lamp` | métal `#ffffff`, abat-jour `#e8785c` | abat-jour corail du hall |
| Potelets (Kenney `stanchion`) | `props.stanchion` | `#eaf1ff` | à vérifier à l'œil (texel de la palette Building Kit) |
| Pile de livres | `props.books` | `#4d8cff`, `#ffffff`, `#e8785c`, `#6de4e5` | les trois zones de la charte |
| Fleurs | `props.flowers` | tige `#57bfd6`, rouge `#e8785c`, jaune `#ffffff`, violet `#4d8cff` | plus de rouge/jaune/violet de la boîte à outils |
| Racks, écrans, antenne (Infrastructures) | accent de l'aile | `#6de4e5` | inchangé, 5,0:1 sur le sol de l'aile |
| Convoyeur, bras robot, caisses (Industrialisation) | accent de l'aile | `#e8785c` | inchangé |
| Canapé, banc, bibliothèques (Culture) | `props.culture` | velours `#4d8cff`, bois `#ffffff` | le violet devient bleu néon |
| Sculptures (Culture) | `props.sculpture` | pierre `#ffffff`, socle `#4d8cff` | marbre blanc sur socle néon |
| Comptoir de Minerve, corps | `furniture.counter.body` | `#e8785c` | le seul objet « action » du hall : corail, 3,4:1 sur le sol |
| Comptoir, plateau | `furniture.counter.top` | `#ffffff` | 10,6:1 sur le sol |
| Sonnette | `furniture.counter.bell` | `#0a1738` | sur le plateau blanc, 16,8:1 (l'or disparaît) |
| Potelets du cordon | `furniture.rope.post` | `#ffffff` | |
| Cordon devant le comptoir | `furniture.rope.cord` | `#e8785c` | remplace le bordeaux `#7a2f3f` |
| Arbre des 100, tronc | `furniture.tree.trunk` | `#eaf1ff` | 13,4:1 sur le tapis |
| Arbre, feuillages | `leafMain` / `leafLeft` / `leafRight` | `#6de4e5` / `#4d8cff` / `#e8785c` | une couleur par zone : l'arbre porte les trois ailes |
| Arbre, cime | `furniture.tree.crown` | `#ffffff` | remplace la boule dorée |
| Banc circulaire de l'arbre | `furniture.tree.bench` | `#ffffff` | |
| Roue dentée (Infrastructures) | `furniture.gearDisc`, dents = accent | `#ffffff`, `#6de4e5` | |
| Chevalet (Culture) | `furniture.easel` | pieds `#ffffff`, toile `#4d8cff` | |
| Banc des Archives | `archives.bench` | `#eaf1ff` | |
| Pupitre des Archives | `archives.lectern` | `#0a1738` | porte le panneau d'entrée |
| Cristaux des Archives | `archives.crystals` | `#6de4e5`, `#e8785c` | |
| Antennes des Archives | `archives.antenna` | `#4d8cff` | |

### 4.5 Signalétique

| Surface | Jeton | Valeur | Raison |
|---|---|---|---|
| Bannière du hall : fond, filet, titre, sous-titre | `signage.banner` | `#071336`, `#e8785c`, `#ffffff`, `#e8785c` | déjà conforme ; sous-titre en kicker (capitales espacées + filet corail) |
| Panneau de porte d'aile : fond, libellé | `signage.wingPanel` | `#0a1738`, `#ffffff` | l'ancien aplat d'accent portait un texte blanc à 1,4:1 (cyan vif) : fond nuit, contour 5 px + pictogramme + flèche à l'accent |
| Plaque « Bientôt » : fond, contour, texte | `signage.comingSoon` | `#0a1738`, `#d6248c`, `#ffffff` | **unique usage du magenta**, avec le cordon ci-dessous |
| Cordon de l'aile fermée | `furniture.rope.cordClosed` | `#d6248c` | même signal : accès fermé |
| Plaque « Minerve · Conservatrice » | `signage.plate` | fond `#0a1738`, contour `#e8785c`, nom `#ffffff`, fonction `rgba(255,255,255,0.78)` | remplace le laiton |

### 4.6 Cadres, toiles, cartels

| Surface | Jeton | Valeur | Raison |
|---|---|---|---|
| Cadre, moulure extérieure (large de 5 cm) | `frame.outer` | `#ffffff` | remplace le bois doré ; 5,4:1 sur le mur |
| Cadre, moulure médiane (4,5 cm) | accent de l'aile (`rooms.<aile>.accent`) | `#6de4e5` / `#e8785c` / `#4d8cff` | une géométrie de cadre par aile, un seul matériau partagé |
| Cadre, liseré (1 cm) et passe-partout | `frame.lip`, `frame.mat` | `#0a1738` | prolonge la toile sombre, la photo « flotte » |
| Spot mural : platine et bras | `frame.lampArm` | `#0a1738` | |
| Spot mural : vasque, ampoule | `frame.lampShade`, `frame.lens` | `#ffffff` | |
| Halo additif du spot | `frame.halo` | `rgba(234,241,255, 0.9 / 0.35 / 0)` | blanc bleuté, plus le jaune `rgba(255,243,196)` |
| Cadre proche : lueur | `frame.highlightEmissive` | `#e8785c` × 0,32 (pulse ± 0,12) | corail = action ; l'émissif de la matière est aussi à poser sur le matériau des cadres en fondu |
| Bulle « ! » (monde) | `frame.bubble` | fond `#e8785c`, contour `#ffffff`, « ! » `#050b1e` | 6,8:1 ; remplace le vert `palette.leaf` |
| Toile d'attente, fond | `portrait.fill` | `#0a1738` | écran sombre : la silhouette et le bandeau portent l'accent |
| Toile d'attente, silhouette | accent de l'aile | `#6de4e5` / `#e8785c` / `#4d8cff` | tracée en scanlines (barre 6 px tous les 11 px, `portrait.scanline`), clippée sur tête + buste : le disque du logo |
| Toile d'attente, légende | `portrait.kicker` | `rgba(255,255,255,0.72)` | « PORTRAIT À VENIR » en capitales espacées, filet accent de 28 × 3 px au-dessus |
| Toile d'attente, bandeau du numéro | fond = accent de l'aile, texte `portrait.bandText` | `#050b1e` | numéro en JetBrains Mono 500 ; 12,9 / 6,8 / 6,1:1 |
| Toile d'attente, format | `portrait.canvas` | 256 × 315 px | rapport 1,3 / 1,6 du cadre : le texte n'est plus étiré de 23 % |
| Cartel : fond | `cartel.fill` | `#0a1738` | remplace le laiton `#c9a24a` |
| Cartel : filet séparateur et contour | accent de l'aile (`person.wing`) | | l'aile se lit aussi sous le cadre |
| Cartel : nom, organisation | `cartel.name`, `cartel.org` | `#ffffff`, `rgba(255,255,255,0.78)` | 17,6 et 10,9:1 |

### 4.7 Socles à tampon

| Surface | Jeton | Valeur | Raison |
|---|---|---|---|
| Colonne | `stamp.column` | `#eaf1ff` | 8,5:1 sur le sol |
| Poignée | `stamp.handle` | `#ffffff` | |
| Encre non obtenue | `stamp.idleInk` | `#5a6a98` | la teinte « en attente » du carnet (`StampIcon`) |
| Encre obtenue | accent de l'aile | | inchangé |
| Étincelles | `stamp.spark` | `#ffffff` | |

### 4.8 Vitrines et salle des Archives

| Surface | Jeton | Valeur | Raison |
|---|---|---|---|
| Socle de vitrine | `archives.vitrine.socle` (émissif `socleEmissive` × 0,04) | `#eaf1ff` | clair, se lit sur le sol bleu (9,4:1) |
| Socle à portée | `socleHighlight` (émissif `socleHighlightEmissive` × 0,35) | `#ffffff`, `#6de4e5` | |
| Capsule en attente | `capsuleIdle` | `#57bfd6`, émissif 0,5, opacité 0,55 | cyan |
| Capsule archivée | `capsuleArchived` | `#e8785c`, émissif 0,45, opacité 0,75 | corail : l'or disparaît |
| Écran de vitrine, fond | `screenFill` | `rgba(10,23,56,0.92)` | |
| Écran, titre / type / heure | `screenText`, `screenSub`, `screenIdle` ou `screenArchived` | `#ffffff`, `rgba(255,255,255,0.75)`, `#6de4e5` ou `#e8785c` | heure en JetBrains Mono 500 |
| Panneau d'entrée | `archives.sign` | fond `rgba(10,23,56,0.94)`, contour `#57bfd6`, titre `#ffffff`, date `#6de4e5`, mention `#e8785c` | |
| Chemin de la frise | `floor.pathGlow`, `pathLine`, `nodeGlow`, `node` | `rgba(87,191,214,0.28)`, `rgba(109,228,229,0.9)`, `rgba(109,228,229,0.55)`, `#ffffff` | |
| Bulle « ! » des Archives | `archives.bubble` | fond `#57bfd6`, contour `#ffffff`, « ! » `#050b1e` | 9,2:1 |
| Archiviste : buste, tête | `archivist.torso`, `head` | `#57bfd6`, `#ffffff` | |
| Archiviste : anneaux, particules | `archivist.ring`, `particle` | `#6de4e5`, `#ffffff` | plus d'or |
| Archiviste : faisceau, socle, liseré | `archivist.beam`, `plinth`, `plinthRim` | `#57bfd6`, `#eaf1ff`, `#57bfd6` | |
| Archiviste : bulle de dialogue | `archivist.bubbleFill`, `bubbleStroke`, `bubbleDots` | `#0a1738`, `#57bfd6`, `#ffffff` | |

### 4.9 Typographie des canvas

| Élément | Jeton | Valeur |
|---|---|---|
| Mots | `text.display` | Poppins, poids ≤ 600 (`text.maxWeight`) |
| Chiffres (numéros, heures) | `text.mono` | JetBrains Mono, poids ≤ 500 (seuls 400 et 500 sont chargés) |
| Texte sur nuit | `text.onNight`, `onNightSoft` | `#ffffff`, `rgba(255,255,255,0.78)` |
| Texte sur aplat d'accent | `text.onAccent` | `#050b1e` |

Tous les `700` de `system-ui` des canvas passent à 600 (Poppins). Kicker : capitales espacées **dessinées caractère par caractère** (`ctx.letterSpacing` n'est pas universel).

## 5. Contrastes calculés (WCAG, texte peint sur son fond réel)

| Texte | Couleurs | Ratio |
|---|---|---|
| Titre de la bannière | `#ffffff` / `#071336` | 18,2:1 |
| Sous-titre de la bannière | `#e8785c` / `#071336` | 6,3:1 |
| Libellé d'un panneau de porte, « Bientôt », nom du cartel, nom de la plaque | `#ffffff` / `#0a1738` | 17,6:1 |
| Organisation du cartel, fonction de la plaque | `rgba(255,255,255,0.78)` sur `#0a1738` (= `#c9ccd3`) | 10,9:1 |
| Légende de la toile | `rgba(255,255,255,0.72)` sur `#0a1738` (= `#babec7`) | 9,5:1 |
| Numéro sur bandeau | `#050b1e` / `#6de4e5`, `#e8785c`, `#4d8cff` | 12,9 · 6,8 · 6,1:1 |
| « ! » du monde | `#050b1e` / `#e8785c` | 6,8:1 |
| « ! » des Archives | `#050b1e` / `#57bfd6` | 9,2:1 |
| Panneau d'entrée : titre, date, mention (pire cas : fond translucide sur le mur) | `#ffffff`, `#6de4e5`, `#e8785c` sur `#0d1b41` | 16,8 · 11,1 · 5,8:1 |
| Écran de vitrine : titre, heure en attente, heure archivée, type (fond translucide sur la capsule) | | 15,4 · 10,2 · 5,6 · 9,2:1 |
| Éléments graphiques sur la nuit : silhouette, filet, pictogramme, flèche | cyan vif 11,6 · corail 6,1 · bleu néon 5,5 · cyan 8,2 | ≥ 3:1 exigé |
| Contour magenta de « Bientôt » sur la nuit | `#d6248c` / `#0a1738` | 3,8:1 |

Tous les textes ≥ 4,5:1 (AA), tous les éléments graphiques ≥ 3:1. Le test `charter3d.test.ts` les recalcule.

## 6. Hiérarchie de luminance (rendu sous les lumières)

Ciel `#071336` (L 0,008) < sol < mur.

| Salle | Sol (rendu) | Mur de face (rendu) | Mur / sol | Sol / ciel | Corniche (rendu) | Corniche / ciel | Dessus de mur coupé / sol |
|---|---|---|---|---|---|---|---|
| Hall | `#102f95` | `#3357c3` | 1,77 | 1,61 | `#d56f59` | 5,4 | 3,7 |
| Infrastructures | `#102f95` | `#3357c3` | 1,77 | 1,61 | `#64d3df` | 10,3 | 7,0 |
| Industrialisation | `#102f95` | `#3357c3` | 1,77 | 1,61 | `#d56f59` | 5,4 | 3,7 |
| Culture | `#13359f` | `#3357c3` | 1,62 | 1,76 | `#4681f9` | 5,0 | 3,0 |
| Archives | `#102f95` | `#3357c3` | 1,77 | 1,61 | `#4fb1d1` | 7,4 | 5,0 |

Les sols et les murs sont nettement plus clairs que le ciel ; les murs plus clairs que les sols ; les accents plus clairs que les murs. Le test impose sol/ciel ≥ 1,5 et mur/sol ≥ 1,5.

## 7. Ce que chaque module doit changer

Répartition retenue (à réaffecter si l'orchestrateur découpe autrement) : **monde** = `src/world/**` sauf les fichiers ci-dessous, `src/scene/Experience.tsx`, `src/features/stamps/StampStations.tsx` ; **portraits-textures** = `src/world/textures.ts`, `frameCartel.ts`, `frameGeometry.ts`, `frameHalo.ts`, `bubbleTexture.ts`, `PortraitFrame.tsx` et leurs tests ; **archives** = `src/archives/**`. Numéros de ligne du 29/09, avant retouches. Ne pas modifier `src/npc/**`, `src/player/AvatarMesh.tsx`, `src/features/avatar/**`, `src/features/presence/nameLabel.ts` : ils gardent `palette.cream/ink/wood/woodDark/gold/shadow` (gelés dans `tokens.ts`).

### 7.1 Monde

- **`scene/Experience.tsx`** (l. 66-72) : `<Canvas flat …>` ; `<color>` = `scene.background` ; `<fog>` = `scene.fog` ; `<hemisphereLight>` = `scene.hemisphere` ; `<directionalLight>` = `scene.directional` (couleur, intensité, position). Retirer l'import de `palette`.
- **`world/constants.ts`** : `SOFTEN_CHECKER = 0` ; ajouter `LISTEL_HEIGHT = 0.04`, `CAP_HEIGHT = 0.06`.
- **`world/roomGeometry.ts`** :
  - `hallFloor` (l. 208-232) : planche B = `rooms.hall.floorAlt` (fin du `lerp` vers `palette.woodDark`) ; centre = `hallFloor.rugBacking` en `CircleGeometry` (r = `RUG_RADIUS`, y = 0,004) au lieu de la coloration par sommet ; fusionner les barres de `discBars()` (import de `ui/OdysseeLogo`) : échelle `RUG_RADIUS / 44`, `x = (bx + bw/2 − 62)·s`, `z = (by + bh/2 − 50)·s`, boîte de 0,012 m à y = 0,008, blanche sauf les barres `coral` en `rugBarAccent` ; on rogne chaque barre au disque (`x ≥ cx − √(R² − dy²)`) et on ignore les tirets qui fuient à gauche (ils recouvriraient le chemin ouest) ; chemins = quads `PlaneGeometry` de 2,3 m posés à y = 0,006, couleurs `hallFloor.path.*` (remplace les `wingThemes.*.accent` des l. 215-217), plus un chemin vers la porte sud (`archives`), bords blancs de 0,06 m (`pathEdge`). Motif : la coloration par sommet (cellules de 0,34 m) donne des arêtes floues sur la capture.
  - `wingFloor` (l. 283-296) : Infrastructures `checkerFloor(floor, floorAlt, 1.4)` ; Industrialisation `terracottaFloor(floor, floorAlt, 1.6)` ; Culture `moquetteFloor(floor, floorAlt, 1.0)` (la bordure n'est plus `room.accentColor`).
  - `wingSignatureDecor` (l. 335-350) : câbles `cables.main` (r 0,05) et `cables.thin` (r 0,04) ; disque de la roue `furniture.gearDisc` (dents inchangées) ; chevalet `furniture.easel`.
  - `buildRoomGeometry` (l. 371-373) : briques `brickBox(…, room.wallColor, rooms.industrialisation.wallAlt)` ; plinthe `rooms[room.id].plinth` ; murs coupés (`w.cut`) : ajouter une bande `rooms[room.id].cap` (hauteur `CAP_HEIGHT`, empreinte + 0,05) sur le dessus.
  - `wainscotAndCornice` (l. 392-405) : lambris `rooms[id].wainscot` (plus `palette.woodDark`), listel `rooms[id].listel` (hauteur `LISTEL_HEIGHT`, posé sur le lambris, même surplomb), corniche = `wingThemes[id].trim` (inchangé, mais maintenant l'accent).
  - `counterGeometry` (l. 413-424) : `furniture.counter.body / top / bell` ; `treeGeometry` (l. 431-451) : tronc `tree.trunk`, feuillages `leafMain`, `leafLeft`, `leafRight`, cime `crown` ; `treeBenchGeometry` (l. 458) : `tree.bench`.
  - `velvetRopeGeometry` (l. 465-472) : potelets `rope.post`, cordon en paramètre (défaut `rope.cord`, supprimer `ROPE_COLOR`) ; `buildComingSoonBarrierGeometry` passe `rope.cordClosed`.
  - `buildOccluderGeometry` (l. 504) : plinthe `rooms.hall.plinth`.
  - `buildLightRaysGeometry` (l. 549) : `RAY_OPACITY_HINT` = `scene.rays`.
- **`world/Museum.tsx`** (l. 56) : repli `?? '#8c6a4a'` → `charter3d.rooms.hall.wall`. Rien d'autre (les textures viennent des fichiers portraits-textures).
- **`world/props/tints.ts`** : tableau ci-dessous, importé de `charter3d.props`. Retirer tous les `palette.*`.

| Variante | Matériau d'origine → valeur |
|---|---|
| `stone` | `colormap` → `props.stone` |
| `wood` | `wood`, `_defaultMat` → `props.wood.body` ; `woodDark`, `metal` → `props.wood.trim` ; `carpet` → `rooms.hall.accent` |
| `planter` | `plant` → `planter.plant` ; `wood` → `planter.pot` ; `woodDark` → `planter.soil` |
| `lamp` | `metal` → `lamp.metal` ; `lamp` → `lamp.shade` |
| `stanchion` | `colormap` → `props.stanchion` |
| `rug` | `carpet` → `rug.field` ; `carpetDarker` → `rug.border` |
| `books` | `carpetDarker` → `books.a` ; `carpetWhite` → `books.b` ; `plant` → `books.c` ; `metal` → `books.d` |
| `teal`, `orange` | inchangés (accent de l'aile, déjà à la charte) |
| `violet` | `wood`, `grass` → `culture.wood` ; `carpet`, `_defaultMat`, `dirt` → `culture.velvet` |
| `gold` | `dirt`, `_defaultMat` → `sculpture.stone` ; `grass` → `sculpture.base` |
| `original` (fleurs) | `grass` → `flowers.stem` ; `colorRed` → `flowers.red` ; `colorYellow` → `flowers.yellow` ; `colorPurple` → `flowers.purple` (aucun changement de `placements.ts`) |

- **`features/stamps/StampStations.tsx`** (l. 26-29) : colonne `stamp.column`, poignée `stamp.handle`, encre non obtenue `stamp.idleInk`, étincelles `stamp.spark`. `StampIcon.tsx` : rien (déjà à la charte).

### 7.2 Portraits-textures

- **`world/textures.ts`** :
  - `paintPlaceholderPortrait` (l. 65-113) : canvas `portrait.canvas` (256 × 315) ; fond `portrait.fill` ; silhouette (tête + buste) en accent, tracée en scanlines (`ctx.clip()` sur la forme, puis un `fillRect` de `scanline.bar` px tous les `scanline.pitch` px) ; légende « PORTRAIT À VENIR » en capitales espacées (`portrait.kicker`, Poppins 500 13 px) avec un filet accent de 28 × 3 px au-dessus ; bandeau du numéro = accent, hauteur `bandShare` × canvas, texte `portrait.bandText` en JetBrains Mono 500 34 px. Le numéro de fond `palette.ink` (l. 100) disparaît. Supprimer `PLACEHOLDER_*_MIX` et `mixWithWhite` s'ils ne servent plus, ou les garder inertes ; `placeholderSilhouetteColor(accent)` devient l'identité de l'accent.
  - `paintCartel` (l. 156-172), `paintMinervePlate` (l. 363-376) : fonds `cartel.fill` / `signage.plate.fill`, contour ou filet accent, textes `text.onNight` / `onNightSoft`, poids 600 (plus 700), Poppins.
  - `paintBanner` (l. 232-263) : couleurs déjà bonnes ; sous-titre en Poppins 500 et en kicker.
  - `paintWingPanel` (l. 313-333) : fond `signage.wingPanel.fill`, contour 5 px, pictogramme et flèche en `accentColor`, libellé `wingPanel.text` en 600 ; points du pictogramme Culture en `portrait.fill`.
  - `paintComingSoonPanel` (l. 340-357) : `signage.comingSoon` (fond, contour magenta 3 px, texte 600). Retirer `palette.woodDark` / `palette.gold`.
  - Remplacer `import { palette }` par `charter3d`. Toutes les polices via `text.display` / `text.mono`.
- **`world/frameCartel.ts`** (l. 62-108) : fond `cartel.fill`, contour de 3 px et filet séparateur en `wingThemes[person.wing].accent`, nom 600 `cartel.name`, organisation 500 `cartel.org`. Plus de reflet blanc ni de dégradé.
- **`world/frameGeometry.ts`** (l. 29-33, 168-185) : supprimer `GOLD_DEEP/MID/BRIGHT`, `MAT_CREAM` ; moulure extérieure `frame.outer`, médiane = accent de l'aile (paramètre de `buildFrameGeometry(mid = charter3d.rooms.hall.accent)`, plus `FRAME_GEOMETRY_BY_WING`), liseré `frame.lip`, passe-partout `frame.mat`, platine et bras `frame.lampArm`, vasque `frame.lampShade`, `LAMP_LENS = frame.lens`. Garder l'export `FRAME_GEOMETRY` et la signature sans argument (tests existants).
- **`world/frameHalo.ts`** (l. 27-29) : dégradé `frame.halo.core / mid / edge`.
- **`world/bubbleTexture.ts`** (l. 17-22) : `frame.bubble` (fond corail, contour blanc, « ! » `#050b1e`, 600).
- **`world/PortraitFrame.tsx`** : matériau de surbrillance (l. 48) `emissive: frame.highlightEmissive` (plus `GOLD_BRIGHT`) ; matériau des cadres en fondu : même `emissive` ; choisir la géométrie par aile (`FRAME_GEOMETRY_BY_WING[frame.wing]`).
- **`world/textures.test.ts`** : les invariants s'inversent (fond sombre, silhouette claire). Remplacer par : contraste silhouette/fond ≥ 3:1 et bandeau ≥ 4,5:1 pour chaque aile, `fitFontSize` inchangé. Ne pas affaiblir.

### 7.3 Archives

- **`archives/room/RoomShell.tsx`** : `WALL_MATERIAL` = `rooms.archives.wall` ; `PILLAR_MATERIAL` = `archives.pillar` ; `THRESHOLD_MATERIAL` = `archives.threshold` (émissif 0,55) ; `BENCH_MATERIAL` = `archives.bench` ; `WALL_PANEL_MATERIAL` = `archives.panel` (couleur, émissif, 0,12) ; `LECTERN_MATERIAL` = `archives.lectern` ; cristaux `crystals.a` (l. 128) et `crystals.b` (l. 129) ; antennes `archives.antenna` (plus `theme.trim`). Murs : même parure que le hall sur les murs est, ouest, sud et sur `archives.northWall` (plinthe, lambris `wainscot`, listel, corniche `rooms.archives.cornice`, bande `cap` sur le mur sud coupé) — constantes de `world/constants.ts` (`WAINSCOT_HEIGHT`, `CORNICE_HEIGHT`, `CORNICE_TOP_GAP`, `TRIM_PROTRUSION`, `LISTEL_HEIGHT`, `CAP_HEIGHT`), géométrie fusionnée à couleurs par sommet (un appel de dessin). Plus de `palette.*`.
- **`archives/room/Vitrine.tsx`** (l. 29-34) : `archives.vitrine.socle`, `socleEmissive`, `socleHighlight`, `socleHighlightEmissive`, `capsuleIdle`, `capsuleArchived` (émissifs et opacités inchangés).
- **`archives/room/textures.ts`** : clap du film (l. 80) `nuit` au lieu de `wingThemes.archives.wall` ; écran de vitrine (l. 214-238) `screenFill`, `screenIdle`/`screenArchived`, `screenText`, `screenSub`, titre 600, heure en JetBrains Mono 500 ; sol (l. 274-310) `archives.floor.*` (fond `base`, vignette `vignetteEdge`, chemin `pathGlow`/`pathLine`, repères `nodeGlow`/`node`) ; panneau d'entrée (l. 334-352) `archives.sign` (titre 600) ; bulle (l. 365-373) `archives.bubble` (« ! » 600).
- **`archives/Archivist.tsx`** (l. 46-56, 83-96) : buste `archivist.torso`, tête `head`, anneaux `ring`, particules `particle`, faisceau `beam`, socle `plinth`, liseré `plinthRim` ; bulle de dialogue : fond `bubbleFill`, contour `bubbleStroke`, points `bubbleDots` (plus de `palette.gold` ni `palette.cream`). Formes inchangées.
- **`archives/room/DecorModel.tsx`** : rien (la teinte est un paramètre).

## 8. Prérequis transverses

- **Polices dans les canvas.** Poppins et JetBrains Mono viennent de Google Fonts (`index.html`). Un canvas peint avec une police pas encore chargée retombe sur `system-ui` et la texture reste en cache avec ce repli. Avant le premier dessin de texture, attendre `document.fonts.load('600 16px Poppins')` et `document.fonts.load('500 16px "JetBrains Mono"')` (avec un délai maximum, ~1,5 s), par exemple avant de monter `<Museum>`.
- **Budget mobile.** Tout est fusionné : disque du hall, chemins, listel, bandes de dessus = quelques dizaines de boîtes ajoutées à la géométrie de la salle (aucun appel de dessin en plus) ; les cadres restent un maillage par portrait (trois géométries, un matériau partagé) ; aucune ombre temps réel ; textures ≤ 512 px. Exception voulue (WEL-923) : le sol de fond de chaque salle est un maillage à part (une matière = un matériau texturé) : **un appel de dessin de plus par salle visible**, au lieu de zéro. Les Archives gardent leur sol en un seul maillage. Cartes de sol : 8 fichiers webp ≤ 512 px, 383 Ko au total (budget 450 Ko). Mesuré le 01/10 (SwiftShader, `e2e/performance.spec.ts`, projet desktop) : au plus 92 appels de dessin au spawn et au milieu de chaque aile (budget 150), contre ≈ 1 à 3 de moins avant ; la mesure de `renderer.info` varie de ± 15 appels d'une image à l'autre, le surcoût réel est le sol de chaque salle dans le champ.

## 9. Vérifications

- `pnpm exec tsc -b --noEmit` et `pnpm exec vitest run src/styles src/world src/archives src/features/stamps`.
- Plus aucune couleur héritée dans les décors (doit ne rien renvoyer) :
  `grep -rnE "palette\.(cream|ink|wood|woodDark|gold|shadow|leaf|leafDark|paper|inkSoft)|#(c9a24a|3b2a10|8a6a2c|5a441c|e8c872|8c6a4a|c8a27a|fff8e7|fdf1d6|7a2f3f|a97b3d|f6e3ab|fff3c4|fff6d8|7fd6e8)" src/world src/scene src/archives src/features/stamps --include='*.ts' --include='*.tsx' | grep -v '\.test\.'`
- Sols : `pnpm exec vitest run scripts/build-floor-textures.test.ts src/world/floorTextures.test.ts src/world/roomGeometry.test.ts` (fichiers, moyenne du détail, tuilage, budget, UV monde, cache de chargement) ; `node scripts/build-floor-textures.mjs --debug <dossier>` écrit les mosaïques 2×2 de contrôle du raccord.
- À l'œil, sur les captures e2e (`docs/TESTS.md`) : plus de bois, de beige, d'or ni de brun ; le bleu du sol et des murs reste bleu (pas gris, même sous la matière) ; le numéro d'un portrait se lit à la distance de jeu ; le magenta n'apparaît qu'à la barrière d'une aile fermée.

## 10. Hors périmètre de cette charte

Personnages (Minerve, avatar, visiteurs distants et leurs étiquettes) : refaits dans un autre chantier. Interface DOM (`src/ui/**`, `archives.css`, `StampCard.css`) et carte partageable (`shareCard.ts`) : déjà à la charte du 26/09, non concernées.
