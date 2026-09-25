# Module Cadres & Cartels (WEL-875)

> Propriétaire : ce module uniquement. Ne pas confondre avec `docs/ASSETS.md` (partagé, agent
> intégration) ni avec les sections « Hall »/« Infrastructures »/etc. de `docs/assets/catalogue.md`
> (sélection d'un autre module, lue ici pour référence seulement, jamais modifiée).

## Modèles CC0 retenus

**Aucun.** Recherche menée dans les 6 packs Kenney fournis (`assets-packs/kenney_*`, voir
`docs/ASSETS.md`) :

- **Cadre de tableau** : aucun modèle dédié. Confirmé indépendamment par `docs/assets/catalogue.md`
  (section Culture, ligne « Chevalet / cadre de présentation : aucun modèle dédié trouvé dans les 6
  packs ») et par une recherche par mot-clé (`frame`/`picture`/`painting`/`canvas`/`poster`) sur les
  noms de fichiers `.glb` de `kenney_furniture-kit` et `kenney_building-kit` : rien d'exploitable comme
  cadre mural (`chairModernFrameCushion.glb` est une chaise, pas un cadre).
- **Applique / spot de galerie** : un seul candidat, `kenney_furniture-kit/Models/GLTF format/lampWall.glb`
  — une applique murale domestique (abat-jour conique posé à plat contre un mur), pas un spot de
  galerie orientable. Déjà retenue par un autre module de ce chantier pour les murs nus du hall (voir
  `docs/assets/catalogue.md`, section Hall, ligne « Applique (mur) ») : même si l'usage ne se chevauche
  pas (les cadres du présent module sont tous dans les ailes, jamais dans le hall), le gabarit et le
  style (applique de salon, pas de spot orientable façon galerie) ne convenaient de toute façon pas au
  petit spot doré demandé par `docs/DESIGN.md`.

**Décision** : géométrie procédurale pour le cadre (moulure biseautée en plusieurs couches + passe-
partout) et pour le spot mural (bras + vasque inclinée + « ampoule »), comme le prévoit explicitement
la mission (« profil biseauté en plusieurs couches, ou modèle CC0 de cadre s'il en existe un — sinon
géométrie procédurale soignée »). Voir `src/world/frameGeometry.ts`.

## Fichiers du module

| Fichier | Rôle |
|---|---|
| `src/world/PortraitFrame.tsx` | Composant React (un par portrait accroché) : assemble cadre, halo, toile, cartel, bulle. |
| `src/world/frameGeometry.ts` | Géométrie fusionnée du cadre (moulure + passe-partout + spot), partagée par tous les cadres. Pure three.js, testable sans WebGL (`frameGeometry.test.ts`). |
| `src/world/frameCartel.ts` | Dessin du cartel en laiton, 512×128 (texture canvas 2D). Réutilise `cartelOrganizationText`/`fitFontSize` (`src/world/textures.ts`, pures, déjà testées) — jamais réimplémentées. |
| `src/world/frameHalo.ts` | Halo additif du spot : texture dégradé radial + matériaux partagé/« fondable », comme `bubbleTexture.ts`. |
| `src/world/frameGeometry.test.ts` | Tests unitaires (fusion sans exception, emboîtement des couches, pas d'enfoncement dans le mur, positions du halo). |

`assets-src/frames/`, `public/models/frames/` : absents, aucun GLB retenu (voir ci-dessus) — rien à
optimiser via `scripts/optimize-assets.mjs` pour ce module.

## Ce qui a changé (avant → après)

1. **Cadre** : un seul `BoxGeometry` doré uni → 4 couches fusionnées en une seule géométrie (moulure
   extérieure ombrée, couche médiane à la couleur dorée d'origine, fin liseré clair, passe-partout
   crème) + spot mural doré (bras + vasque + « ampoule »). **Une seule géométrie partagée, un seul
   matériau partagé** (sauf cadre en fondu, voir Performance) : le nombre d'appels de dessin par cadre
   pour cette partie reste à **1**, identique à l'ancien cadre à une seule couche, malgré le relief et
   le luminaire ajoutés.
2. **Toile** : légèrement reculée (`PAINTING_RECESS_Z`) derrière la face avant du passe-partout, pour
   un vrai effet de retrait (auparavant à fleur du cadre).
3. **Spot + halo** : petit luminaire doré procédural au-dessus de chaque cadre, avec un halo additif
   discret (dégradé radial chaud, `AdditiveBlending`, opacité 0,5) juste sous la vasque. **+1 appel de
   dessin par cadre visible** (seul ajout au budget de dessin — voir Performance).
4. **Surlignage du cadre proche** : l'ancien surlignage statique (émissif fixe) devient une pulsation
   douce (`0.3 ± 0.12`, ~1 aller-retour/2 s) du matériau de surbrillance **partagé**
   (`FRAME_MATERIAL_HIGHLIGHT`) — sûr malgré le partage car `nearbyPersonId` ne désigne jamais plus
   d'un cadre à la fois (voir le commentaire dans `PortraitFrame.tsx`). Bulle « ! » conservée à
   l'identique (position, texture, comportement).
5. **Cartel** : nouveau dessin 512×128 (contre 256×96), aspect 4/1 (contre ~2,65/1) — plaque à deux
   tons + listel + filet séparateur nom/organisation, police système inchangée (voir « Écarts assumés »
   ci-dessous). Taille physique du cartel ajustée en conséquence (`CARTEL_WIDTH`/`HEIGHT`,
   `PortraitFrame.tsx`) et `CARTEL_GAP` élargi (0,14 → 0,18 m) pour garder un dégagement net sous la
   moulure, désormais bien plus large qu'avant.

## Régression corrigée à la reprise (toiles vides — fond beige uni)

Constat de l'orchestrateur sur captures iPhone, avant reprise : les toiles des cadres étaient vides
(fond beige uni), silhouette et numéro disparus, alors que `docs/assets/frames.md` (version précédente,
écrite par l'équipe interrompue) affirmait les avoir vérifiées visibles. Deux causes distinctes trouvées
et corrigées, toutes deux dans `frameGeometry.ts`/`PortraitFrame.tsx` :

1. **Passe-partout et liseré : pavés pleins sans ouverture, posés devant la toile reculée.** La toile
   (`PAINTING_RECESS_Z` = -0,004) a été reculée par l'équipe précédente pour un « vrai effet de retrait »
   derrière le passe-partout — mais les couches `lip` (liseré clair, face avant z = 0,001) et
   `passepartout` (face avant z = 0,009) sont toutes deux DEVANT ce plan, et étaient chacune un
   `BoxGeometry` plein, plus grand que la toile dans les deux dimensions, sans aucune fenêtre. Elles la
   masquaient donc entièrement (aplat crème uni = couleur du passe-partout, exactement le symptôme
   rapporté). Seule la couche `mid` (face avant z = -0,0095) reste légitimement un pavé plein : elle est
   derrière la toile, occultée naturellement par elle, comme l'ancien cadre à une seule couche.
   **Correctif** : `lip` et `passepartout` sont maintenant construites en ANNEAU (`ringLayer`, 4 lattes
   fusionnées, même geometrie partagée fusionnée qu'avant — aucun appel de dessin supplémentaire) avec
   une ouverture centrale commune (`APERTURE_WIDTH`/`APERTURE_HEIGHT`, `dims.frameWidth`/`frameHeight`
   moins 2×3 cm de recouvrement sur chaque bord, comme un vrai passe-partout qui cache l'arête vive de la
   toile plutôt que de la laisser à nu).
2. **Cadres en fondu (cimaises occultantes, aile Industrialisation) : ordre de rendu transparent instable.**
   Une fois (1) corrigé, l'aile Infrastructures et Culture affichaient déjà la toile correctement, mais
   l'aile Industrialisation (seule aile testée avec cimaise sur les cadres capturés) montrait encore un
   aplat doré uni (couleur de la couche `mid`, pas `passepartout` cette fois). Cause : un cadre accroché
   à une cimaise passe TOUS ses matériaux en `transparent: true` (même à opacité 1, pour pouvoir
   s'estomper, voir `FrameFade`) — three.js trie alors ses mailles par distance caméra plutôt que par le
   depth buffer, et comme la toile/le cartel sont à quelques millimètres de la moulure (même repère
   local), ce tri est instable : la moulure (pavé `mid` inclus) pouvait se dessiner APRÈS la toile et la
   recouvrir. **Correctif** : `renderOrder` explicite sur les 5 mailles du cadre (moulure 0 → toile/cartel
   1 → halo 2 → bulle « ! » 3), qui prime sur la distance dans le tri three.js des objets transparents —
   sans effet sur les cadres opaques (leur ordre reste géré par le depth buffer comme avant).

**Non-régression** : `frameGeometry.test.ts`, section « Ouverture du passe-partout — RÉGRESSION WEL-875 »
— raycast pur (three.js `Raycaster` sur un `Mesh` non ajouté à une scène, sans WebGL) qui échouerait si
la toile redevenait masquée (centre et coins de l'ouverture libres jusqu'au plan de la toile ; le
passe-partout couvre toujours le bord externe de la toile, ouverture strictement plus petite que la
toile). Ce test n'a pas de prise directe sur la cause 2 (ordre de rendu transparent, propre au runtime
WebGL, non reproductible en raycast pur) : sa non-régression repose sur la vérification visuelle
ci-dessous (aile Industrialisation).

## Écarts assumés vs. la mission

- **« Police de l'interface » sur le cartel** : non fait. `textures.ts` (dont je réutilise la logique
  de contenu, jamais le dessin) documente explicitement l'absence de police externe pour les textures
  canvas (« aucune police externe, pas de CDN, conforme à la CSP ») — `frameCartel.ts` suit la même
  règle par cohérence et sécurité (pas de risque de dessiner avec une police pas encore chargée). Le
  gain de lisibilité demandé vient à la place de la résolution (512×128 contre 256×96) et d'une mise en
  page resserrée (filet séparateur, tailles ajustées via `fitFontSize`).
- **Cartel dessiné dans un fichier séparé (`frameCartel.ts`) plutôt que dans `textures.ts`** :
  `textures.ts` n'est pas dans mon périmètre de fichiers pour ce chantier (voir la liste de fichiers de
  l'issue WEL-875). Duplique donc le DESSIN (pas la logique métier, réutilisée via
  `cartelOrganizationText`) entre `textures.ts::drawCartel` (cartel générique, plus utilisé par
  `PortraitFrame.tsx` depuis ce chantier mais toujours exporté — code potentiellement mort côté
  cartel, à vérifier par l'agent intégration) et `frameCartel.ts::drawFrameCartel`. **Demande de
  contrat** (voir `docs/ARCHITECTURE.md`, « Besoin d'un changement de contrat ») : à consolider en un
  seul dessin de cartel le jour où `textures.ts` change de propriétaire, plutôt que de garder deux
  implémentations proches.
- **Halo « toujours discret, jamais un aplat »** : opacité fixée à 0,5 sur une texture dégradé (centre
  0,9 → bord 0), additive — testé visuellement (captures ci-dessous) plutôt que mesuré numériquement
  (pas de canvas 2D disponible en test unitaire jsdom, même contrainte que `textures.ts`, voir
  `docs/TESTS.md`).

## Performance

- **Budget par cadre (avant → après)** : 3 appels de dessin (bord + toile + cartel) → **4** (cadre
  fusionné incl. spot + toile + cartel + halo), **5** si le cadre est le seul actuellement proche du
  joueur (`highlighted`, bulle « ! » en plus — inchangé). Le relief du cadre et le luminaire n'ajoutent
  **aucun** appel supplémentaire (tout fusionné dans `FRAME_GEOMETRY`, un seul matériau partagé) ; seul
  le halo additif en ajoute un.
- **Mesuré** (voir captures et le journal du script de vérification, `renderInfo().calls`) : au spawn
  et au milieu de chaque aile, portrait et paysage — voir la section Vérification visuelle ci-dessous
  pour les chiffres relevés sur cette machine (fortement chargée : plusieurs agents/serveurs en
  parallèle, charge système ~60 au moment des mesures — les temps de chargement observés reflètent
  cette contention, pas une régression de l'app).
- **Aucun matériau partagé modifié par accident** : `FRAME_MATERIAL`/`FRAME_MATERIAL_HIGHLIGHT` et le
  halo partagé (`sharedHaloMaterial()`) ne sont jamais touchés pour un cadre en particulier ; un cadre
  accroché à une cimaise en fondu (`fade`) obtient systématiquement son propre clone (`frameMaterial`,
  `haloMaterial`, comme l'ancien `borderMaterial`) — jamais les objets partagés. La seule mutation d'un
  objet partagé est la pulsation de `FRAME_MATERIAL_HIGHLIGHT.emissiveIntensity` : sûre par
  construction, voir le commentaire dédié dans `PortraitFrame.tsx` (`nearbyPersonId` singulier).
- **Aucune allocation three.js dans `useFrame`** : les nouveaux `useFrame` (pulsation du surlignage,
  fondu du halo) ne font que des affectations numériques sur des objets déjà existants.
- **Textures paresseuses conservées à l'identique** : seuil `PORTRAIT_LOAD_DISTANCE` (14 m,
  `constants.ts`, non modifié) inchangé.
- **Géométries/matériaux partagés** : `FRAME_GEOMETRY`, `PAINTING_GEO`, `CARTEL_GEO`, `BUBBLE_GEO`,
  `HALO_GEOMETRY` sont tous construits une seule fois au chargement du module (jamais par instance).

## Vérification visuelle

> **Note (reprise)** : la conclusion « toile visible » ci-dessous, écrite par l'équipe précédente,
> contredit le constat de l'orchestrateur à la reprise (toiles vides). Conservée telle quelle pour
> l'historique ; voir « Régression corrigée à la reprise » et « Reprise après interruption » plus bas
> pour la cause exacte et la vérification qui la corrige.

Serveur de dev sur le port 5303 (`pnpm exec vite --port 5303 --strictPort`), captures Playwright
headless (Chrome for Testing local, SwiftShader), iPhone 13 portrait + paysage, `?e2e=1`,
`window.__musee.goToPerson(id)` pour se placer devant un portrait de chaque aile (une personne de
chaque aile : infrastructures, industrialisation, culture). Images dans `screens/frames/` :
`iphone-{portrait,landscape}-00-spawn.png` puis `-01-infrastructures.png`/`-02-industrialisation.png`/
`-03-culture.png`. Toutes regardées (`Read`) avant ce rapport : moulure biseautée + passe-partout crème
visibles, spot doré et halo chaud discret au-dessus de chaque cadre, cartel en laiton net et lisible
(« Portrait n°3 », etc.), bulle « ! » conservée au-dessus du cadre proche du joueur.

**`renderInfo().calls` mesuré** (machine très chargée pendant la vérification — plusieurs
serveurs/agents en parallèle, charge système jusqu'à ~60 — les deux passages ci-dessous montrent une
variation liée à cette contention, jamais au-dessus du budget) :

| Vue | Portrait | Paysage |
|---|---|---|
| Spawn (hall) | 84 | 73 |
| Infrastructures (`goToPerson`) | 84 | 70 |
| Industrialisation (`goToPerson`) | 88 | 71 |
| Culture (`goToPerson`) | 18 | 46 |

Max observé : **88** (budget ≤ 150). La valeur basse et variable en Culture (18 puis 46) coïncide avec
des erreurs TypeScript transitoires observées dans `src/world/layout.ts`/`roomGeometry.ts` pendant la
vérification (fichiers d'un autre module de ce même chantier, en cours d'édition en parallèle dans ce
worktree — jamais touchés ici) : très probablement une salle momentanément incomplète côté rendu au
moment précis de la mesure, pas un effet de ce module (les captures de la salle Culture, elles,
montrent la salle et ses cadres intégralement rendus). À revérifier par l'agent intégration une fois
les deux chantiers de ce worktree stabilisés.

### Reprise après interruption — correctif de régression (avant/après, port 5322)

Constat initial (avant correctif), capture déjà présente dans `screens/frames/iphone-portrait-01-
infrastructures.png`/`-02-industrialisation.png` (toutes deux regardées, `Read`) : toile entièrement vide
(fond beige uni), aucune silhouette ni numéro — la régression décrite ci-dessus (« Régression corrigée à
la reprise »). Après correctif, nouvelles captures sur le port de dev de ce module (5322,
`pnpm exec vite --port 5322 --strictPort`), même protocole (Chrome for Testing local,
SwiftShader, iPhone 13 portrait + paysage, `?e2e=1&presenceRoom=e2e-frames`, `goToPerson` sur le premier
portrait de chacune des trois ailes), dans `screens/frames/apres-iphone-{portrait,landscape}-00-spawn.png`
puis `-01-infrastructures.png`/`-02-industrialisation.png`/`-03-culture.png` — toutes regardées (`Read`)
avant ce rapport : toile visible avec silhouette + numéro (« N° 1 », « N° 2 », « N° 3 », etc.) et fond
pastel de l'aile dans les **trois** ailes, y compris Industrialisation (cimaise occultante, seconde cause
ci-dessus) ; cadre mouluré + passe-partout crème + spot doré et halo discret + cartel en laiton lisible +
bulle « ! » sur le cadre proche, conformes à la conception d'origine de ce chantier.

**`renderInfo().calls` mesuré** (après correctif, portrait puis paysage) :

| Vue | Portrait | Paysage |
|---|---|---|
| Infrastructures (`goToPerson`) | 40 | 55 |
| Industrialisation (`goToPerson`) | 92 | 74 |
| Culture (`goToPerson`) | 38 | 53 |

Max observé : **92** (budget ≤ 150) — l'écart avec les mesures précédentes (max 88) est cohérent avec les
4 lattes du passe-partout/liseré (au lieu d'un pavé plein chacun), toujours fusionnées dans la même
géométrie partagée `FRAME_GEOMETRY` : **aucun appel de dessin supplémentaire par cadre** (le budget par
cadre annoncé plus haut, 4/5, reste inchangé — seul le nombre de triangles de cette géométrie partagée
augmente légèrement, sans coût en appels de dessin).
