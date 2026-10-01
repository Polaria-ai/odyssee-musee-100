# Signature Polaria (`src/features/signature`)

Rappeler sobrement que le jeu est une création Polaria (décision de Baptiste, WEL-922) et cacher un easter egg.

| Fichier | Rôle |
| --- | --- |
| `brand.ts` | URL de polaria.ai, fichier et proportions du logo. Logo : `public/brand/polaria-logo.webp` (480 px de large, 8 Ko), tiré de `polaria-logo-official.png` (3738 × 819) par un simple redimensionnement `sharp` (lanczos3, WebP q92) : couleurs inchangées. |
| `strings.ts` | Textes FR/EN (mention de titre, badge, carte de crédits). La date et « L'Opinion × Polaria » de la carte utilisent des espaces insécables. |
| `TitleSignature.tsx` | « Une création » + logo + lien, et « © 2026 Polaria », sous le pied de l'écran titre (monté par `ui/TitleScreen.tsx`). Une ligne en paysage de téléphone. |
| `Signature.tsx` | Une ligne dans `App.tsx` : badge (`SignatureBadge`, logo 16 px, opacité 0,7, en bas à gauche) + carte (`SignatureCard`). Le badge disparaît quand `isOverlayOpen`. |
| `signatureStore.ts` | État de la carte (zustand). Hors de `gameStore.ts` ; la carte n'entre pas dans `isOverlayOpen`, elle remet l'entrée à zéro et filtre le clavier elle-même. |
| `SignaturePlate.tsx` | Plaque 3D du hall (une ligne dans `scene/Experience.tsx`). `plateLayout.ts` : emplacement, pur. `plateTexture.ts` : texture canvas 512 × 205. |
| `plateTap.ts` / `usePlateTap.ts` | Détection du tap sur la plaque (voir ci-dessous). |

## La plaque et son tap

Mur nord du hall, côté est (x = 8,6, centre à 1,75 m, 1,8 × 0,72 m, face au sud) : la seule paroi du hall qui se lit
de face depuis la caméra fixe, loin du centre, sans rien de haut au sud du joueur.

**Pourquoi pas `onClick` de react-three-fiber :** en jeu, le joystick tactile (`player/TouchJoystick`, z-index 10)
recouvre tout le canvas et capte les gestes ; les événements r3f n'y arrivent jamais, et un `stopPropagation` r3f
n'arrêterait de toute façon pas le tap-pour-marcher du joystick (système d'événements DOM distinct). `usePlateTap`
écoute donc `window` (phase de bulle, donc après le joystick) : un tap court (< 320 ms, < 12 px) dont la cible est le
joystick ou le canvas (jamais un bouton du HUD), projeté avec la caméra courante dans le rectangle de la plaque (agrandi à
44 px minimum), retire la cible de marche (`resetInput`) et ouvre la carte. La carte ignore les clics de fermeture
pendant 350 ms après une ouverture par la plaque : sur Safari iOS, le `click` qui suit le `pointerup` peut viser le fond
qui vient d'apparaître.

Tests : `*.test.ts(x)` à côté du code (le hook est testé avec le vrai `TouchJoystick`), `e2e/signature.spec.ts` (clic réel
sur le canvas à la position projetée par `window.__musee.worldToScreen`).
