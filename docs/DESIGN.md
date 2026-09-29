# Direction artistique — Le Musée des 100

> Jeu web 3D pour smartphone, joué à la fin de **L'Odyssée de l'IA** (L'Opinion × Polaria, 6 octobre 2026, Théâtre de la Tour Eiffel).
> Le visiteur se promène dans un musée et découvre **les 100 qui font l'IA en Europe** (étude Oliver Wyman).

## Inspiration, sans copie

L'idéation part du musée d'un jeu de simulation de vie « cosy » : un grand hall chaleureux, une chouette conservatrice qui accueille, des ailes aux ambiances très différentes, des cartels sous chaque pièce exposée, une chasse aux tampons.

**Interdit** : tout élément de propriété de Nintendo — noms (Animal Crossing, Thibou/Blathers, Nook…), personnages, sprites, textures, polices (Fink, Seurat, Humming…), sons, logos, interface à l'identique. On reprend une **sensation**, pas des éléments.

## Ton

Doux, joyeux, lisible, sans cynisme. Le contenu (les 100) est sérieux ; l'écrin est ludique. On tutoie le visiteur en français (« Bienvenue au musée ! »), ton chaleureux en anglais.

## Charte de l'événement (29/09/2026) — s'applique à l'interface ET à toute la 3D

Source : skill « conference-dataviz-odyssee-ia-2026 » de Cyril (charte relevée sur les captations scène 2024-2025). Décision de Baptiste du 29/09, après la répétition : « la charte graphique de l'Odyssée appliquée partout — le fond, les tapis, les murs, tout ». Elle **annule** celle du 26/09 (interface + accents 3D, matières chaudes bois/crème/terre cuite conservées). Table complète « surface → jeton → valeur → raison », modèle de rendu et contrastes : [`CHARTE-3D.md`](./CHARTE-3D.md) ; jetons : `charter3d` dans `src/styles/tokens.ts`.

- **Interface** : fonds sombres uniquement (bleu nuit `#0a1738` / `#050b1e`, jamais de fond clair), texte **blanc pur**, action principale **corail `#e8785c`** (texte bleu nuit dessus pour le contraste), contrepoint **cyan `#57bfd6`**, magenta `#d6248c` réservé à un seul usage. Jetons dans `src/styles/global.css` (noms historiques remappés) et `eventPalette` dans `src/styles/tokens.ts`.
- **Typographie** : Poppins (300 à 600, jamais 700, pas d'interlettrage négatif), JetBrains Mono pour les chiffres (numéros de portrait, heures) et les kickers (capitales espacées + filet corail de 34 px). Vaut aussi pour tout texte peint dans un canvas 3D.
- **Logo** : disque en scanlines + logotype « 2026 : l'Odyssée de l'IA » (« IA » en corail), `src/ui/OdysseeLogo.tsx`, géométrie reprise telle quelle du skill. Motif repris dans la 3D : tapis rond du hall et silhouette des portraits d'attente.
- **Musée 3D — esprit** : une soirée de gala « nuit bleue », lisible, pas un tunnel noir. Trois échelons de bleu : ciel et brouillard `#071336` < sols bleu profond `#113198` < murs `#385fc8` ; les volumes se lisent (mur/sol ≥ 1,6:1, sol/ciel ≥ 1,5:1). Du blanc pour le mobilier clair, les cadres et les plateaux. Plus de bois, de crème, de laiton, de beige ni de terre cuite.
- **Musée 3D — une couleur par aile** (tokens « trois zones » de la charte), portée par des accents lumineux : corniche, bande sur les murs coupés, chemin de tapis, arche, moulure du cadre, silhouette et bandeau des portraits d'attente. Infrastructures **cyan vif `#6de4e5`**, Industrialisation **corail**, Culture **bleu néon `#4d8cff`**, hall **corail**, Archives de 2040 **cyan `#57bfd6`**.
- **Musée 3D — matières** : cadres blancs à moulure d'accent, toiles et cartels bleu nuit à texte blanc, comptoir corail à plateau blanc, arbre aux trois couleurs de zone, colonnes et bancs blanc bleuté, plantes cyan. Le magenta n'a qu'un usage en 3D : l'accès fermé (cordon et plaque « Bientôt »).
- **Rendu** : lumières blanc froid, `<Canvas flat>` (pas de tone mapping : ACES trahit les bleus et le corail), aucune couleur en dur dans un décor.
- Les sections « Palette », « Le musée » (matières bois et laiton) et « Les portraits » (cadre doré, fond pastel) ci-dessous décrivent la V1 (univers crème/bois) et ne valent plus. « Interface » ne vaut que pour la structure des écrans, pas pour ses couleurs. Pour tout décor, `CHARTE-3D.md` fait foi. Les personnages sont décrits plus bas (29/09).

## Palette (voir `src/styles/tokens.ts`)

| Rôle | Couleur |
|---|---|
| Fond / papier | crème `#fff8e7`, `#fdf1d6` |
| Texte | brun encre `#4a3728`, doux `#7a6250` |
| Bois | `#c8a27a`, foncé `#8c6a4a` |
| Action principale | vert feuille `#7bc47f` / `#4f9a5a` |
| Ciel, fond 3D | `#9ed9f0` |
| Or (hall, cadres) | `#e8c872` |
| Aile Infrastructures | sarcelle `#4fb3a9` — salle des machines, pierre bleutée |
| Aile Industrialisation | orange `#f2a65a` — atelier sous verrière, brique |
| Aile Culture | violet `#b48cd9` — galerie d'art, velours |

Polices : **Fredoka** (titres, boutons), **Nunito** (texte). Coins très arrondis (18–28 px), boutons « pilule » avec ombre portée franche vers le bas (effet bouton physique), pas de dégradés criards.

## Le musée (plan)

Unité : 1 m. Caméra fixe en orientation (regarde toujours vers −Z, légèrement plongeante), comme un diorama : le déplacement est relatif à l'écran.

- **Grand hall** (≈ 22 × 18 m) centré sur l'origine. Le joueur apparaît au sud, face au nord. Au centre-nord, le **comptoir d'accueil** où se tient Rémi Godeau. Verrière au plafond suggérée par la lumière, 4 piliers, plantes en pot, bancs, grande bannière « Le Musée des 100 · L'Odyssée de l'IA », mosaïque au sol.
- **Trois portes** (≈ 3,5 m, arche + bannière à la couleur de l'aile) : ouest → Infrastructures, nord → Industrialisation, est → Culture. Les trois ailes suivent les trois tables rondes de la soirée : *De la promesse aux infrastructures*, *De l'invention à l'industrialisation*, *De la réaction au changement de culture*.
- **Plan en croix** (décision du 27/09, WEL-888) : une quatrième porte, au **sud** du hall, juste derrière le point d'apparition, mène à pied aux **Archives de 2040** (≈ 20 × 21 m). Pas de linteau (le mur sud est coupé bas, côté caméra), un seuil lumineux cyan. Dans la salle, rien de haut près de la porte : quand le joueur est dans le hall, la caméra survole la salle. Plus de portail ni de téléportation.
- **Ailes** : longues galeries (≈ 10 m de large), longueur calculée selon le nombre de portraits. Portraits sur les murs latéraux + cimaises centrales double face si nécessaire. Doit accepter n'importe quelle répartition des 100 (y compris 100/0/0).
- **Murs côté caméra coupés** (hauteur ≈ 1 m, effet maquette) pour ne jamais masquer le joueur.
- Un **socle à tampon** à l'entrée de chaque aile.

## Les portraits

Cadre doré en bois, tableau = photo (ou portrait d'attente dessiné : fond pastel de l'aile, silhouette, numéro). **Cartel en laiton** sous le cadre : nom + organisation. Quand le joueur est à portée : le cadre s'illumine légèrement et une petite bulle « ! » flotte au-dessus. Photos chargées **à la demande** (seulement les cadres proches), 512 px max.

## Les personnages (29/09/2026)

Décisions de Baptiste : les deux personnages sont de vraies personnes, qui ont donné leur accord. Ils ont été générés en 3D par Magnific à partir de photos fournies par Baptiste (image en pied Seedream 5 Pro → modèle Meshy 7.1 → squelette et animations Meshy ; voir `docs/ASSETS.md`).

- **Le joueur : Cyril de Sousa Cardoso** (CEO de Polaria), blazer bleu roi, chemise bleu ciel. Tous les visiteurs le jouent : plus aucune personnalisation, on entre directement au musée depuis l'écran titre. Les autres visiteurs croisés en direct sont eux aussi des Cyril, sans pseudo. Animations : attente calme et marche décontractée. Hauteur de jeu 1,7 m.
- **L'accueil : Rémi Godeau** (directeur de la rédaction de L'Opinion) remplace la chouette Minerve au comptoir du hall. Il salue d'un grand geste de la main quand on approche (au plus une fois toutes les 20 s), puis reste en attente. Hauteur 1,8 m, pour dépasser du comptoir. Ses répliques, au vouvoiement, sobres et sans opinion, sont listées dans `docs/TEXTES-REMI.md` : **à faire valider par Rémi Godeau ou L'Opinion avant le 6 octobre**.
- Matériaux mats (Lambert) avec une légère lueur propre : sur les sols bleus de la charte, le blazer de Cyril se confondait sinon avec le décor.
- Pendant un dialogue, la caméra recule d'un cinquième de sa distance : le joueur remonte au-dessus de la boîte de dialogue au lieu de disparaître dessous.

## Interface

- **Titre** : sur la caméra qui tourne au-dessus du hall. « L'Odyssée de l'IA » en petit, « Le Musée des 100 » en grand, sous-titre « Les 100 qui font l'IA en Europe », bouton vert « Entrer au musée », bascule FR/EN, pied « L'Opinion × Polaria · d'après l'étude Oliver Wyman ».
- **HUD** : en haut à gauche, pastille de la salle courante ; en haut à droite, FR/EN, carnet de tampons « 1/3 », visiteurs « 12 ». En bas à gauche, joystick flottant (apparaît sous le pouce). En bas à droite, gros bouton rond « Regarder » quand un portrait est à portée. Tap au sol = déplacement automatique.
- **Fiche portrait** : feuille plein écran qui monte du bas, photo dans un cadre doré, nom, rôle · organisation, drapeau du pays, pastille de l'aile, accroche en gras, histoire, citation dans une bulle, liens, navigation « précédent / suivant » dans l'aile, fermeture ✕ / Échap / glisser vers le bas.
- **Dialogue** : bulle arrondie crème en bas de l'écran, nom de l'orateur dans une étiquette colorée, texte qui s'écrit lettre par lettre, « ▼ » qui clignote, tap pour continuer.
- **Carnet de tampons** : trois cases à l'encre de la couleur de chaque aile ; carte complète → image partageable (Web Share API ou téléchargement).

## Contraintes mobiles (non négociables)

- 60 i/s visés sur un smartphone milieu de gamme de 2023 ; jamais sous 30.
- Géométries fusionnées par salle, matériaux partagés, `MeshLambertMaterial`/`MeshToonMaterial`, pas d'ombres temps réel, brouillard pour borner la distance.
- ≤ 150 appels de dessin visibles ; textures ≤ 512 px ; chargement paresseux des photos.
- Cibles tactiles ≥ 48 px, zones sûres (encoche) respectées, portrait **et** paysage.
- Aucune dépendance au survol souris. Tout est jouable au pouce.
- Accessibilité des surimpressions : `role="dialog"`, focus, Échap, contrastes AA, `prefers-reduced-motion`.
