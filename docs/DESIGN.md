# Direction artistique — Le Musée des 100

> Jeu web 3D pour smartphone, joué à la fin de **L'Odyssée de l'IA** (L'Opinion × Polaria, 6 octobre 2026, Théâtre de la Tour Eiffel).
> Le visiteur se promène dans un musée et découvre **les 100 qui font l'IA en Europe** (étude Oliver Wyman).

## Inspiration, sans copie

L'idéation part du musée d'un jeu de simulation de vie « cosy » : un grand hall chaleureux, une chouette conservatrice qui accueille, des ailes aux ambiances très différentes, des cartels sous chaque pièce exposée, une chasse aux tampons.

**Interdit** : tout élément de propriété de Nintendo — noms (Animal Crossing, Thibou/Blathers, Nook…), personnages, sprites, textures, polices (Fink, Seurat, Humming…), sons, logos, interface à l'identique. On reprend une **sensation**, pas des éléments.

## Ton

Doux, joyeux, lisible, sans cynisme. Le contenu (les 100) est sérieux ; l'écrin est ludique. On tutoie le visiteur en français (« Bienvenue au musée ! »), ton chaleureux en anglais.

## Charte de l'événement (26/09/2026) — prime sur la palette ci-dessous pour l'interface

Source : skill « conference-dataviz-odyssee-ia-2026 » de Cyril (charte relevée sur les captations scène 2024-2025). Décision de Baptiste : **interface entière + accents 3D** à la charte ; les **matières** du musée (bois, crème, terre cuite) restent chaudes pour garder l'esprit cosy.

- **Interface** : fonds sombres uniquement (bleu nuit `#0a1738` / `#050b1e`, jamais de fond clair), texte **blanc pur**, action principale **corail `#e8785c`** (texte bleu nuit dessus pour le contraste), contrepoint **cyan `#57bfd6`**, magenta `#d6248c` réservé à un seul usage. Jetons dans `src/styles/global.css` (noms historiques remappés) et `eventPalette` dans `src/styles/tokens.ts`.
- **Typographie** : Poppins (300 à 600, jamais 700, pas d'interlettrage négatif), JetBrains Mono pour les chiffres et les kickers (capitales espacées + filet corail de 34 px).
- **Logo** : disque en scanlines + logotype « 2026 : l'Odyssée de l'IA » (« IA » en corail), `src/ui/OdysseeLogo.tsx`, géométrie reprise telle quelle du skill.
- **Musée 3D** : une couleur par aile (tokens « trois zones » de la charte) — Infrastructures **cyan vif `#6de4e5`**, Industrialisation **corail**, Culture **bleu néon `#4d8cff`** ; hall en accent corail (tapis, bannière bleu nuit à liseré corail) ; ciel et brouillard bleu nuit `#071336`.
- Les sections « Palette » et « Interface » ci-dessous décrivent la V1 (univers crème/bois) : elles restent valables pour les matières 3D, pas pour l'interface.

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

- **Grand hall** (≈ 22 × 18 m) centré sur l'origine. Le joueur apparaît au sud, face au nord. Au centre-nord, le **comptoir en bois arrondi de Minerve**. Verrière au plafond suggérée par la lumière, 4 piliers, plantes en pot, bancs, grande bannière « Le Musée des 100 · L'Odyssée de l'IA », mosaïque au sol.
- **Trois portes** (≈ 3,5 m, arche + bannière à la couleur de l'aile) : ouest → Infrastructures, nord → Industrialisation, est → Culture. Les trois ailes suivent les trois tables rondes de la soirée : *De la promesse aux infrastructures*, *De l'invention à l'industrialisation*, *De la réaction au changement de culture*.
- **Ailes** : longues galeries (≈ 10 m de large), longueur calculée selon le nombre de portraits. Portraits sur les murs latéraux + cimaises centrales double face si nécessaire. Doit accepter n'importe quelle répartition des 100 (y compris 100/0/0).
- **Murs côté caméra coupés** (hauteur ≈ 1 m, effet maquette) pour ne jamais masquer le joueur.
- Un **socle à tampon** à l'entrée de chaque aile.

## Les portraits

Cadre doré en bois, tableau = photo (ou portrait d'attente dessiné : fond pastel de l'aile, silhouette, numéro). **Cartel en laiton** sous le cadre : nom + organisation. Quand le joueur est à portée : le cadre s'illumine légèrement et une petite bulle « ! » flotte au-dessus. Photos chargées **à la demande** (seulement les cadres proches), 512 px max.

## Minerve, la chouette conservatrice

Personnage **original** : chouette ronde gris-lilas pâle, grands yeux, **lunettes rondes**, **écharpe dorée** aux couleurs de l'Odyssée, un carnet sous l'aile. Se tient derrière son comptoir, cligne des yeux, se dandine, tourne la tête vers le joueur. Elle accueille, explique le rallye, commente la progression, félicite à chaque tampon. (Distincte du conservateur du jeu d'inspiration : pas de gilet vert, pas de nœud papillon, couleur et silhouette différentes.)

## Le joueur

Petit personnage « chibi » low-poly (≈ 1,15 m) : grosse tête ronde, corps en capsule, petites mains, pieds ronds. Personnalisable : teint, cheveux, tenue (t-shirt, sweat, robe, costume, salopette) et couleur, accessoire (lunettes, béret, casque audio, fleur, casquette). Marche avec un léger rebond, court avec Shift ou joystick à fond. Ombre ronde douce sous les pieds (pas d'ombres temps réel).

## Interface

- **Titre** : sur la caméra qui tourne au-dessus du hall. « L'Odyssée de l'IA » en petit, « Le Musée des 100 » en grand, sous-titre « Les 100 qui font l'IA en Europe », bouton vert « Entrer au musée », bascule FR/EN, pied « L'Opinion × Polaria · d'après l'étude Oliver Wyman ».
- **Personnalisation** : « Qui es-tu ? », pseudo facultatif, pastilles de couleurs, aperçu 3D qui tourne, « C'est parti ! ».
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
