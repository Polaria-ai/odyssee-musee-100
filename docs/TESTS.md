# Tests — Le Musée des 100

Trois niveaux : unitaires (Vitest), E2E smartphone (Playwright), vérifications CI (lint, types, build, budgets). Cette page explique la stratégie et comment lancer chaque niveau. Propriétaire : agent QA — `e2e/**` et ce fichier.

## 1. Unitaires (Vitest, jsdom)

```
pnpm test          # une passe
pnpm test:watch    # mode watch
```

jsdom n'a pas de WebGL (`HTMLCanvasElement.getContext()` n'est pas implémenté) : les tests unitaires couvrent la logique pure (physique de déplacement, plan du musée, tampons, i18n…) et les composants React qui vivent dans le DOM (HUD, fiches, dialogue, personnalisation…), jamais un `<Canvas>` monté. Le rendu 3D lui-même n'est vérifié qu'en E2E (ci-dessous), à l'œil via les captures d'échec, et indirectement par les tests DOM qui pilotent le state que la scène 3D consomme.

318 tests, 26 fichiers au moment d'écrire ces lignes, un fichier `*.test.ts(x)` par module à côté du code qu'il couvre.

## 2. E2E smartphone (Playwright)

```
pnpm e2e
# ou, en local sans navigateur Playwright téléchargé (voir docs/ARCHITECTURE.md) :
PW_CHROMIUM_PATH="$HOME/.agent-browser/browsers/chrome-149.0.7827.54/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" pnpm e2e
```

`playwright.config.ts` (non modifiable depuis ce module) construit puis sert l'app (`pnpm build && pnpm preview`, port 4173) et lance chaque test sur trois projets : `iphone` (iPhone 13), `android` (Pixel 7), `desktop`. WebGL tourne en logiciel (SwiftShader, `--use-gl=angle --use-angle=swiftshader`) : plus lent qu'un vrai GPU, mais suffisant pour vérifier que la scène se construit et réagit.

### Poignée de test `window.__musee`

Activée par `?e2e=1` (ou en dev), exposée par `src/scene/debugApi.ts` (contrat de l'agent intégration, non modifiable ici) :
- `state()` → l'état zustand complet (écran, langue, avatar, tampons, actions comme `openPerson`/`closeDialogue`…).
- `player` / `input` → position/vitesse du joueur et entrée de déplacement courants (objets mutables, hors React).
- `teleport(x, z, rotY?)` et `goToPerson(personId)` → placent le joueur, y compris face à un portrait donné.

`e2e/support/museeApi.ts` enveloppe cette poignée (types locaux volontairement dupliqués et minimaux : le projet TypeScript des tests, `tsconfig.node.json`, n'a pas la lib DOM que le code applicatif utilise — voir le commentaire en tête de ce fichier) et fournit les parcours communs : `gotoMusee`, `enterMuseum` (titre → personnalisation → jeu), `dismissWelcomeDialogue`, `teleport`/`goToPerson`, `museeState`/`museePlayer`/`museeInput`, `openPersonViaState` (ouvre une fiche sans naviguer en 3D, pour les tests de tampons), `collectConsoleIssues`, `hasHorizontalOverflow`.

### Locale du navigateur

Sans langue déjà choisie, l'app retombe sur `navigator.language` (`initialLang`, `src/state/gameStore.ts`). Le Chromium de test démarre en anglais par défaut (`en-US`) si rien ne le précise : les specs qui vérifient un texte français explicite fixent donc `test.use({ locale: 'fr-FR' })` en tête de fichier (`title-lang`, `customize`, `dialogue`, `portraits`, `persistence`, `stamps`, et le test de sous-titre de `loading`). Les autres (mouvement, paysage, performance, accessibilité, chargement/console) sont indifférents à la langue et ne fixent rien.

### Fichiers de spec

| Fichier | Couvre |
|---|---|
| `smoke.spec.ts` | Parcours minimal titre → personnalisation → jeu (garde-fou rapide). |
| `loading.spec.ts` | Écran titre visible en moins de 10 s ; absence d'erreur console (test séparé, voir bug connu ci-dessous) ; contenu du titre en français. |
| `title-lang.spec.ts` | Bascule FR/EN sur le titre et dans le HUD (textes changent, y compris via `window.__musee.state().lang`). |
| `customize.spec.ts` | Personnalisation (tenue, accessoire, pseudo) → écran de jeu, avatar enregistré dans le state ; sélection visuelle des pastilles (`aria-checked`). |
| `dialogue.spec.ts` | Dialogue d'accueil de Minerve : affichage, avance au tap (machine à écrire), fermeture ; fermeture directe via « Passer ». |
| `movement.spec.ts` | Glissé sur le joystick tactile (`page.mouse` — de vrais événements souris déclenchent les mêmes `PointerEvent` que le tactile, `TouchJoystick.tsx` ne distingue pas le type de pointeur) → la position du joueur change ; tap au sol → déplacement automatique ; flèches du clavier (projet `desktop` uniquement, via `test.skip` conditionnel). |
| `portraits.spec.ts` | `goToPerson` → bouton « Regarder » → fiche avec le nom → suivant/précédent → Échap ferme ; fermeture via ✕. |
| `stamps.spec.ts` | Ouvrir le nombre requis de fiches d'une aile (`openPersonViaState`, qui appelle `state().openPerson()` — équivalent à `goToPerson` + bouton mais sans naviguer en 3D) → toast + tampon ; carnet (`stamps-button` → `stamp-card`, « Obtenu ») ; compteur du HUD à jour. |
| `persistence.spec.ts` | Langue et tampons survivent à un rechargement (`localStorage`, `src/state/persist.ts`) ; l'écran, lui, n'est pas persisté et repart du titre. |
| `landscape.spec.ts` | Viewport 844×390 (paysage) : pas de débordement horizontal (`scrollWidth` vs `clientWidth`), cibles tactiles du HUD ≥ 48 px et dans le viewport, joystick utilisable. |
| `accessibility.spec.ts` | `@axe-core/playwright` sur l'écran titre, la fiche portrait et le carnet de tampons ; échec sur violations `serious`/`critical` uniquement. `test.use({ reducedMotion: 'reduce' })` sur tout le fichier (voir bugs, ci-dessous). |
| `performance.spec.ts` | Mesure indicative du nombre d'images sur 3 s (`requestAnimationFrame`), consignée en annotation de test, sans assertion de seuil (SwiftShader n'est pas représentatif d'un téléphone réel). Lit `renderer.info` s'il est un jour exposé sur `window` ; aujourd'hui absent, donc ignoré sans faire échouer le test. |
| `support/museeApi.ts` | Pas une spec : les aides ci-dessus. |

### Bugs applicatifs découverts

Statut à jour après la vérification finale (issue WEL-863, 2026-09-25) : `pnpm verify` est vert et la suite E2E complète est passée (voir historique de l'issue). Les deux bugs applicatifs d'origine sont corrigés et leurs tests ne sont plus `test.fixme` :

1. ~~`/favicon.ico` manquant (404 en console)~~ — **corrigé** : `public/favicon.ico` ajouté (module intégration). `loading.spec.ts` › *pas d'erreur console au chargement* passe désormais sur ce point.
2. ~~Contraste insuffisant du pied de l'écran titre~~ — **corrigé** : `.ui-title__footer` utilise `--ink` (7.3:1) au lieu de `--ink-soft` (3.69:1) dans `src/ui/ui.css` (module ui). `accessibility.spec.ts` › *écran titre* passe désormais sur ce point.

Une violation de contraste observée une seule fois en cours de mise au point (badge d'aile `.ui-portrait__wing`, ratio 2.52:1) ne s'est jamais reproduite (6/6 vert avant et après un durcissement préventif du module ui sur l'animation d'ouverture de la fiche) : non actée comme bug confirmé, à surveiller si elle réapparaît.

**Flake identifié et corrigé côté test lors de cette vérification finale** — `accessibility.spec.ts` › *écran titre*, une seule reproduction (projet android) sur l'ensemble des repasses de cette session : tous les textes du panneau titre (`.ui-title__eyebrow`, `h1`, `.ui-title__subtitle`, `.ui-title__enter`, `.ui-title__banner`) rapportés en contraste très insuffisant (~1.1–1.2:1) d'un coup. Cause : `.ui-title__panel` apparaît via l'animation d'opacité `ui-title-in` (700 ms, `src/ui/ui.css`) ; `toBeVisible()` de Playwright ne considère que la taille et `display`/`visibility`, pas l'opacité, donc le test peut lancer `AxeBuilder` en plein fondu — texte et fond encore semi-transparents sur le ciel 3D derrière, couleurs quasi identiques. Corrigé en ajoutant `test.use({ reducedMotion: 'reduce' })` en tête du fichier : déclenche `@media (prefers-reduced-motion: reduce)` (`src/styles/global.css`), qui coupe la durée des animations à 0.01 ms — le mécanisme d'accessibilité que `docs/DESIGN.md` prévoit déjà pour ce genre de cas. N'a pas nécessité de modification du module ui (aucune animation retouchée) ; documenté ici plutôt que dans `test.fixme` car corrigé et vert de façon reproductible dans les passages suivants.

**Bug restant, non corrigé ici (infrastructure, pas de code)** — `loading.spec.ts` › *pas d'erreur console au chargement*, toujours `test.fixme`. Avec un `.env.local` renseigné (URL + clé publishable Supabase), `loadPeople()` (`src/data/repository.ts`) tente d'abord `GET /rest/v1/people` avant son repli statique ; le projet Supabase du dépôt n'a pas encore la table `people` (migration `supabase/migrations/20260924120000_people.sql` écrite mais jamais appliquée au projet distant — confirmé par un appel REST direct : `PGRST205`, 404). Le code applicatif gère déjà proprement ce cas (`console.warn`, repli sur `/data/people.json` puis les fiches d'attente) ; le message qui fait échouer le test est le log réseau de bas niveau du navigateur, indépendant du code. Module **supabase** (WEL-854) : appliquer la migration (SQL editor Supabase, pas en mode automatique — cohérent avec les sessions précédentes de ce vault sur les migrations de prod). N'apparaît pas en CI actuelle (pas de `.env.local`, donc pas de tentative Supabase).

## 3. Vérifications CI (`.github/workflows/ci.yml`)

Trois jobs, enchaînés sur chaque PR : `quality` (lint + typecheck + `pnpm test`), `build` (`pnpm build` + `verify:bundle`/`verify:security`/`verify:content`), `e2e` (installe Chromium via `playwright install --with-deps chromium` puis `pnpm e2e`). Le rapport HTML et les traces (`playwright-report/`, `test-results/`) sont archivés 7 jours en cas d'échec.

En local, la même commande (`pnpm e2e`) télécharge/utilise le Chromium géré par Playwright ; `PW_CHROMIUM_PATH` (voir plus haut) permet de pointer vers un Chrome for Testing déjà présent sur la machine si le téléchargement Playwright n'est pas disponible.

## 4. Limites connues

- SwiftShader (rendu logiciel) est nettement plus lent qu'un GPU de téléphone réel : le test de performance est indicatif, pas un budget.
- `renderer.info` (three.js) n'est exposé nulle part sur `window` aujourd'hui : `performance.spec.ts` ne peut pas encore vérifier le nombre d'appels de dessin/triangles ; il se contente du compte d'images.
- Les fiches exposées sont actuellement les 100 fiches d'attente fictives (`src/data/placeholder.ts`) : les tests qui piochent des identifiants de personnes (`state().people`) ne dépendent d'aucun nom réel et resteront valables une fois la vraie liste importée (le contrat `Person`/`ExhibitWingId` ne change pas).
