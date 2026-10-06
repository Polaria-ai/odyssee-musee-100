# Architecture — Le Musée des 100

Vite + React 19 + TypeScript, **react-three-fiber** (three.js) pour la 3D, **zustand** pour l'état, **zod** pour valider les données, **Supabase** (Postgres + Storage + Realtime) pour la liste des 100 et la présence des visiteurs. Site statique : déployable sur Vercel (`vercel.json`) ou n'importe quel hébergeur.

## Flux

```
main.tsx → App.tsx
  ├─ loadPeople()            data/repository.ts   Supabase → /data/people.json → fiches d'attente
  ├─ buildMuseumLayout()     world/layout.ts      plan pur et déterministe (salles, murs, cadres)
  ├─ <Experience/>           scene/Experience.tsx Canvas unique
  │    ├─ <Museum/>          world/               architecture, décor, portraits
  │    ├─ <StampStations/>   features/stamps/     socles à tampon
  │    ├─ <Remi/>            npc/                 Rémi Godeau, accueil au comptoir (personnage GLB)
  │    ├─ <Player/>          player/              avatar, déplacement, collisions, caméra
  │    └─ <RemoteVisitors/>  features/presence/   autres visiteurs
  └─ surimpressions DOM      ui/, features/avatar, features/stamps, player/TouchJoystick
```

## Deux états

- `src/state/gameStore.ts` (zustand) : état « froid » — écran, langue, avatar, fiche ouverte, visites, tampons, dialogue, toast.
- `src/state/runtime.ts` : état « chaud » mis à jour à chaque image — entrée joystick/clavier (`input`), position du joueur (`player`) et ponts DOM↔Canvas (`bridges.screenToFloor`). Objets mutables, **jamais** dans React.
- Action principale unique : `useGame.getState().interact()` (bouton rond du HUD, Entrée/E) — regarde le portrait proche, sinon parle à Rémi. `Player` alimente `nearbyPersonId`, `nearCurator` et `currentRoom`.

Les ailes latérales (Infrastructures et Culture) ont trois couloirs reliés à l'entrée, par une traversée de 2,4 m entre les deux groupes de portraits et par un passage de 3,6 m devant la face intérieure du mur du fond. `world/layout.ts` découpe chaque cimaise en segments : les mêmes boîtes servent au rendu et aux collisions, et chaque portrait reste attaché à son segment. Pour une seule rangée, les zones du milieu et du fond forment une ouverture continue.

`world/objectColliders.ts` réduit uniquement les boîtes de collision des objets solides : largeur et profondeur divisées par deux autour du même centre. La géométrie visuelle, les murs, les cimaises et les zones d'interaction gardent leurs dimensions. Le plan de base couvre le mobilier du musée et les objets des Archives ; `scene/playerColliders.ts` ajoute les collisions compactes des décors supplémentaires au seul plan reçu par le joueur, afin que le rendu ne supprime pas ces décors lors de leur placement.

## Contrat

`src/types/index.ts` est la source de vérité des types. Les signatures exportées de chaque module (voir les fichiers d'origine marqués `STUB`) sont contractuelles : un module peut tout réécrire à l'intérieur, mais garde ses exports et leurs signatures. Besoin d'un changement de contrat → le signaler dans le rapport, ne pas modifier le fichier d'un autre module.

## Propriété des fichiers (agents)

| Module | Propriétaire | Fichiers |
|---|---|---|
| Intégration | orchestrateur | `src/types/`, `src/state/`, `src/i18n/index.ts`, `src/scene/`, `src/App.tsx`, `src/main.tsx`, `src/styles/`, configs, `.github/`, `docs/ARCHITECTURE.md` |
| Monde | agent `world` | `src/world/**` |
| Joueur | agent `player` | `src/player/**` |
| Rémi (accueil) | agent `npc` | `src/npc/**` |
| Interface | agent `ui` | `src/ui/**` |
| Avatar + tampons | agent `features` | `src/features/avatar/**`, `src/features/stamps/**` |
| Présence | agent `presence` | `src/features/presence/**` |
| Données | agent `data` | `src/data/**`, `supabase/**`, `scripts/import-people.ts`, `scripts/export-local.ts`, `scripts/content-invariants.ts`, `data/`, `docs/IMPORT.md` |
| Audio | agent `audio` | `src/audio/**` |
| QA | agent `qa` | `e2e/**`, `docs/TESTS.md` |

Textes : chaque module a son `strings.ts` (`defineStrings`) — `src/i18n/strings.test.ts` impose FR + EN complets.

## Vérifications

| Commande | Rôle |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ESLint + TypeScript strict |
| `pnpm test` | Vitest (logique pure + composants en jsdom) |
| `pnpm build` | build de production |
| `pnpm verify:bundle` | budget de poids (JS gzip ≤ 650 Ko, entrée ≤ 160 Ko) |
| `pnpm verify:security` | pas de clé serveur dans le bundle, pas de HTML injecté, en-têtes HTTP |
| `pnpm verify:content` | liste des 100 cohérente (ids uniques, textes présents) |
| `pnpm e2e` | Playwright : iPhone, Android, desktop (WebGL SwiftShader) |

En local sans navigateur Playwright : `PW_CHROMIUM_PATH="$HOME/.agent-browser/browsers/chrome-149.0.7827.54/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" pnpm e2e`.

La CI GitHub (`.github/workflows/ci.yml`) enchaîne tout sur chaque PR.

## Rémi · IA et Archiviste · IA (V5)

Le chat avec Rémi passe par une fonction Vercel, `api/remi.ts` : le navigateur poste sur `/api/remi`, la fonction appelle OpenRouter (`deepseek/deepseek-v4.1-flash`) avec `OPENROUTER_API_KEY`, qui ne quitte jamais le serveur. Contrat partagé : `src/features/remiChat/contract.ts`. Interface et buste 3D : `src/features/remiChat/` (chargés à la demande, hors du paquet d'entrée). Détails, garde-fous et coût : `docs/REMI-IA.md`.

La même fonction et le même composant servent l'**Archiviste · IA** (WEL-929) : la requête porte une `persona` (`remi` par défaut, `archiviste`), `PERSONAS` (`personas.ts`) configure le chat de chaque personnage (nom, mention IA, accueil, puces, buste, accent) et le store ouvre l'un ou l'autre (`openChat(persona)` ; `remiChatOpen` vaut « un chat IA est ouvert », `chatPersona` dit lequel). L'Archiviste ne reçoit que les métadonnées des trois tables rondes et leurs transcriptions publiées (`session_archives`, clé `anon`); Rémi conserve le programme complet.

Chaque fiche de table ronde peut aussi afficher des bulles « À retenir » (`SessionArchive.highlights`). Les résumés FR/EN sont des composants DOM, sans objet 3D supplémentaire. Chaque bulle ouvre un extrait français exact de la transcription associée ; les repères dans l'enregistrement sont facultatifs et ne sont affichés que lorsqu'ils ont été fournis. Schémas TypeScript/Zod, importeur et trigger PostgreSQL valident le même contrat (12 bulles maximum, ids uniques, longueurs bornées, extrait présent dans le texte). Les anciennes archives sans bulles restent compatibles. La transcription source de l'enregistrement et sa partition sont conservées dans `data/recording/`, hors du bundle et des fichiers statiques servis au jeu.

## Supabase

Projet `odyssee-musee-100` (`snqwuvqhxaysaygwqkdq`, eu-west-3). Table `people` en lecture publique (lignes publiées), photos dans `public/portraits/` (statique) ou bucket `portraits`. Présence via Realtime (canaux partitionnés, quotas du plan gratuit : voir `src/features/presence/`).

Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clé publishable, côté client). `SUPABASE_SERVICE_ROLE_KEY` uniquement pour les scripts d'import locaux, jamais préfixée `VITE_`.
