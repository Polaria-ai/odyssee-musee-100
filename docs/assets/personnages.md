# Personnages — Avatar du joueur et Minerve (WEL-876)

> Module distinct des autres sections de `docs/assets/` : **aucun modèle CC0 des packs Kenney n'est
> utilisé ici**. `docs/DESIGN.md` décrit l'avatar et Minerve comme des personnages **originaux**
> (silhouette chibi inédite, chouette gris-lilas distincte du conservateur du jeu d'inspiration) ;
> le mandat de ce chantier (voir consigne WEL-876) est de sculpter des géométries three.js plus
> abouties, pas d'importer un personnage tout fait. Les packs (Furniture/Nature/Factory/Space/
> Building/Holiday) ne contiennent d'ailleurs aucun personnage chibi ni rapace utilisable tel quel.

## Méthode

Même principe que `src/world/roomGeometry.ts` : plutôt que d'empiler des `<mesh>` séparés (un
appel de dessin chacun), les volumes qui partagent un matériau sont **fusionnés une seule fois au
chargement du module** en une unique `BufferGeometry` (`mergeAvatarParts` / `mergeMinerveParts`,
`three/examples/jsm/utils/BufferGeometryUtils.js`). Deux couleurs fixes qui doivent cohabiter dans
une seule géométrie (yeux + reflet, fleur, tabouret bois deux tons) portent leur couleur **par
sommet** (`paintColor`, attribut `color`) sur un matériau `vertexColors: true` — jamais de
géométrie reconstruite par image, jamais dans `useFrame`.

Résultat : le détail visuel augmente (frange modelée, mitaines, chaussures, col/capuche/revers,
reflet dans l'œil, plumage en couches, aigrettes doubles, pattes, tabouret) sans multiplier les
appels de dessin.

## `src/player/AvatarMesh.tsx`

- Tête : plus de segments (22×16 contre 14×12), légère déformation non uniforme au rendu
  (`scale={[1.04, 1, 0.97]}`) pour une silhouette plus « pomme » qu'une sphère nue. Rayon (0,24 m)
  inchangé : `src/features/avatar/preview.ts` mesure la vraie boîte englobante du mesh monté
  (jamais une proportion devinée), donc rien n'était couplé à cette valeur, mais la garder stable
  évite de changer la hauteur du personnage (~1,15 m, `docs/DESIGN.md`) sans raison.
- Cheveux : calotte + 3 mèches de frange + 1 mèche latérale asymétrique, fusionnées en une seule
  géométrie (1 mesh, comme avant).
- Yeux : iris sombre + petit reflet clair par œil, fusionnés en une seule géométrie
  `vertexColors: true` (1 mesh, contre 2 avant, avec le reflet en plus).
- Joues : fusionnées en une seule géométrie (1 mesh, contre 2 avant).
- Bras + mains : la main (mitaine, sphère aplatie) est fusionnée directement avec le bras (1 mesh
  par bras, contre 2 avant) ; l'animation de balancier continue de piloter le groupe entier.
- Pieds : remplacés par une silhouette de chaussure (semelle allongée + petit talon, fusionnées),
  couleur fixe (`palette.ink`) indépendante de la tenue.
- Tenues : chaque tenue est une géométrie fusionnée unique incluant un détail de lisibilité (col
  pour le t-shirt, capuche + cordons pour le sweat, revers pour le costume, nœud pour la robe,
  bouton pour la salopette) — 1 mesh (2 pour costume/salopette, qui gardent un second volume de
  couleur fixe : cravate, bavette+bretelles).
- Accessoires : les volumes multi-parties d'une même couleur sont fusionnés (lunettes, casque
  audio, casquette → 1 mesh chacun) ; la fleur (deux couleurs) est fusionnée en `vertexColors`.

**Budget mesh (≤ 12 par avatar, instancié jusqu'à ~40 fois)** : ombre (1) + tenue (1, ou 2 pour
costume/salopette) + bras (2) + pieds (2) + tête (peau 1 + cheveux 1 + yeux 1 + joues 1 = 4) +
accessoire (0 ou 1) = **10 en configuration par défaut (t-shirt, sans accessoire), 12 dans le pire
cas mesuré (salopette + fleur)**. Vérifié à l'œil via `window.__musee.renderInfo().calls` sur les
captures (voir `screens/player/`, `screens/npc/`).

Contrat inchangé : `AvatarMeshProps` (`config`, `moving`, `speed`), pieds à `y = 0`, regarde `+Z`,
`materialFor`/`colorMaterialCache` partagés par couleur (jamais cloné par instance, jamais muté
après coup — voir `src/features/presence/RemoteVisitors.test.ts`).

## `src/npc/Minerve.tsx`

- Ventre : texture canvas générée une fois au chargement (motif « écailles », arcs crème sur crème,
  `RepeatWrapping`) plutôt qu'une couleur unie — même technique que la bulle « … » déjà présente
  dans ce fichier (`getBubbleMaterial`), appliquée ici au ventre (`getBellyMaterial`).
- Ailes : base arrondie + deux lobes de plumes superposés, fusionnés. **Gauche et droite sont deux
  géométries distinctes** (jamais une échelle négative pour « mirroir ») : inverser un seul axe
  d'échelle retourne le sens des triangles, ce qui aurait rendu l'aile invisible ou mal éclairée
  côté droit avec `MeshLambertMaterial` (face avant uniquement).
- Aigrettes : mèche principale + petite mèche compagne par côté, fusionnées (1 mesh par côté,
  comme avant, plus fournies).
- Yeux : blanc des deux yeux fusionné (1 mesh, contre 2 avant) ; pupilles + petit reflet clair par
  œil fusionnés en `vertexColors` (1 mesh, contre 2 avant, avec le reflet en plus). Formule de
  placement (`eyePokeRatio`, `EYE_POKE_RATIO`, `EYE_X`, `EYE_Z`…) inchangée et toujours exportée :
  `src/npc/faceGeometry.test.ts` (régression « yeux engloutis ») reste vert sans modification —
  seul `EYE_RADIUS` passe de 0,115 à 0,12 (yeux légèrement plus grands), la formule recalculant
  `EYE_Z` automatiquement pour garder le même ratio de 0,75.
- Sourcils : ajout, petites arches fusionnées au-dessus de chaque œil, indépendantes du clignement
  (`eyesRef`) ; une petite translation verticale selon l'humeur du dialogue (`eyebrowsRef`) les
  rend plus expressifs sans toucher à la logique de clignement existante.
- Lunettes : anneaux + pont fusionnés (1 mesh, contre 3 avant).
- Pattes : ajoutées, petites griffes sous le ventre (1 mesh), posées sur le nouveau tabouret.
- Tabouret/perchoir : ajouté, petit meuble en bois deux tons (pieds + assise + rebord, fusionnés,
  `vertexColors`), **sibling statique** du groupe animé (`bodyRef`) — ne se balance jamais avec
  elle. Positionné bas et en retrait (au nord de son propre point, à l'opposé du comptoir/joueur)
  pour limiter le risque de chevauchement avec le comptoir dessiné par le module monde
  (`src/world/roomGeometry.ts`, `counterGeometry`) — **vérifié** en relecture WEL-874/876 (voir
  ci-dessous) : comptoir centré en `z = -3,2` (bord nord à `z = -3,7`), tabouret centré en
  `z = -4,5` (bord sud du siège à `z = -4,2`) → 0,5 m d'écart, aucun chevauchement sur les
  captures.

Comportements et animations existants inchangés : clignement (PRNG déterministe), tête qui suit le
joueur (bornée ±60°), balancier/dandinement selon l'humeur, bulle « … », toutes les humeurs
(`neutral`/`happy`/`surprised`/`thinking`).

## Vérification visuelle

Captures Playwright headless (Chrome for Testing, SwiftShader), iPhone 13 portrait + paysage,
`?e2e=1` : écran de personnalisation (plusieurs combinaisons tenue/accessoire, dont le pire cas
salopette+fleur) et scène de jeu près du spawn et près de Minerve — voir `screens/player/`,
`screens/npc/` et le rapport de session (issue Multica WEL-876).

**Relecture contradictoire WEL-874/876 (25/09/2026)** : comparaison avec `6a94aa7` (`git diff`),
nouvelles captures portrait + paysage (`screens/personnages-relecture/`) — écran « Qui es-tu ? »
(visage, frange, joues, tenues, accessoires bien visibles), spawn, près de Minerve (comptoir/
tabouret sans chevauchement, confirmé). `eslint`/`tsc -b --noEmit`/`vitest` verts sur
`src/player/AvatarMesh.tsx` et `src/npc/Minerve.tsx` (+ tests). Budget mesh avatar vérifié par
lecture de code (10 par défaut, 12 en pire cas salopette+fleur, conforme). 10 avatars distants :
estimé par lecture de `RemoteVisitors.tsx`/`peers.ts` (hors périmètre de ce chantier) — géométries
et matériaux d'`AvatarMesh` partagés au niveau module (jamais recréés par pair), donc coût linéaire
(~13 appels de dessin par pair : 12 mesh + 1 sprite de pseudo), pas de risque d'explosion ; non
mesuré en direct (présence temps réel hors périmètre WEL-876).
