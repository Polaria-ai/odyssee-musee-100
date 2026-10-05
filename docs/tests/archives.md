# Tests — Les Archives de 2040 (WEL-885)

Complète `docs/TESTS.md` (stratégie générale, poignée `window.__musee`, locale des specs) : cette
page ne documente que la suite dédiée à la salle des Archives de 2040. Propriétaire : agent QA E2E
— `e2e/archives*.spec.ts` et ce fichier uniquement (n'édite jamais l'application ni `e2e/support/**`).

## Lancer la suite

```
VITE_SUPABASE_URL=https://e2e-stub.supabase.co VITE_SUPABASE_ANON_KEY=e2e-stub-anon-key pnpm build \
  && pnpm exec vite preview --host 127.0.0.1 --port 4373 --strictPort &
E2E_BASE_URL=http://127.0.0.1:4373 pnpm exec playwright test e2e/archives.spec.ts
```

Les deux variables du build sont le faux projet Supabase de la CI (voir « Supabase en E2E » plus bas) ; avec un vrai `.env.local` on peut s'en passer. Sans l'un ni l'autre, « archive publiée pendant la visite » échoue d'emblée sur « le jeu doit lire session_archives au chargement ».

En local sans navigateur Playwright téléchargé :

```
E2E_BASE_URL=http://127.0.0.1:4373 \
PW_CHROMIUM_PATH="$HOME/.agent-browser/browsers/chrome-149.0.7827.54/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
pnpm exec playwright test e2e/archives.spec.ts --workers=2
```

## Fichier

| Fichier | Couvre |
|---|---|
| `e2e/archives.spec.ts` | Porte sud du hall franchie **à pied** au clavier, accueil de l'Archiviste à la première arrivée, retour au hall par la même porte ; les seules vitrines sont `table-ronde-1`, `table-ronde-2` et `table-ronde-3` ; « Ouvrir la vitrine » affiche le thème, l'horaire, les intervenant·es annoncé·es et le message d'attente tant que la transcription n'est pas publiée ; navigation précédente/suivante limitée aux trois tables rondes ; Échap ferme la fiche ; « Parler à l'Archiviste » ouvre son chat IA ; le tampon Archives est obtenu après consultation des trois vitrines ; plan du musée (5 salles), bascule FR/EN, performance, accessibilité et absence d'erreur console ; une transcription publiée pendant la visite apparaît sans rechargement et son texte intégral s'affiche dans la fiche. |

### Supabase en E2E

Le jeu ne lit Supabase que si le build contient `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (`getSupabase()`, `src/data/supabaseClient.ts`, sinon `null` et aucune requête). En CI il n'y a ni `.env.local` ni secret : `playwright.config.ts` passe donc au build E2E un faux projet (`https://e2e-stub.supabase.co`, compatible avec la CSP `connect-src https://*.supabase.co` de `vercel.json`), et `gotoMusee` appelle `stubSupabase` (`e2e/support/supabaseStub.ts`) qui répond à sa place : tables vides en REST (repli sur `/data/people.json` et le programme embarqué, comme avec un projet vide), websocket Realtime fermé (présence en solo), 404 pour tout le reste. Aucun réseau, aucun secret, aucun code applicatif touché.

Les routes d'une page (`page.route`) passent avant celles du contexte : « transcription publiée pendant la visite » surcharge `session_archives` seule. Il vérifie en plus que cette route a bien été sollicitée au chargement, pour échouer avec un message clair si le build n'a pas les variables.

### Locale

Tout le fichier fixe `test.use({ locale: 'fr-FR' })` (comme `dialogue.spec.ts`/`stamps.spec.ts`/`museum-map.spec.ts`) : les textes vérifiés (dialogue de l'Archiviste, fiche d'archive, carnet) sont en français dans le script, et le Chromium de test démarre sinon en anglais (`navigator.language`).

### Aides propres à ce fichier

`e2e/support/museeApi.ts` n'expose pas encore `sessions`/`archivesLayout`/`visitedSessions`/`openSession`/`closeSession` (son type `MuseeGameState` est un sous-ensemble volontairement minimal, voir son en-tête) — hors du scope de cet agent (`e2e/support/**` non modifiable ici). `e2e/archives.spec.ts` définit donc localement :
- `archivesState(page)` : lit un sous-ensemble sérialisable de l'état utile aux Archives (jamais les actions du store, perdues de toute façon à la traversée `page.evaluate` → Node).
- `walkUntilRoom(page, key, room)` / `standBeforeSouthDoor(page, archives)` : marche au clavier (flèche maintenue) jusqu'au changement de salle, depuis un point du hall dans l'axe de la porte.
- `openArchiveViaState(page, sessionId)` / `closeArchiveViaState(page)` : ouvrent/ferment une fiche via `state().openSession()`/`closeSession()`, sans naviguer en 3D — même idée que `openPersonViaState`/`closePersonViaState` côté portraits.
- `enterMuseumWithArchives(page, { greeted })` : `gotoMusee` + `enterMuseum` + `dismissWelcomeDialogue`, marque par défaut les Archives comme déjà découvertes (sinon la première entrée, même par `teleport`, ouvre l'accueil de l'Archiviste qui masque le bouton d'action ; seul le test de l'accueil passe `greeted: false`), puis vérifie que les trois tables rondes et `archivesLayout` sont chargés.

La plupart des tests se téléportent directement au point de vue d'une vitrine (`slot.viewPoint`), au socle de l'Archiviste (`archivist.position`) ou à l'arrivée (`arrival.position`) plutôt que de marcher — la détection de proximité (`useVitrineProximity`, `Archivist.tsx`) ne dépend que de la position du joueur, pas du chemin suivi. Les tests de la porte sud, eux, marchent réellement (plan en croix, WEL-888).

### Découvertes (pas de bug applicatif)

- **4e tampon non stocké** : dérivé de `visitedSessions` (voir `src/features/stamps/stamps.ts::hasArchivesStamp`), jamais de `stamps.archives` dans le store — obtenu après consultation des trois vitrines (`ARCHIVES_STAMP_MIN = 3`).
- **Contenu vérifié dynamiquement** : la suite lit `state().sessions`/`state().archives` en direct, qu'ils viennent de Supabase ou du repli embarqué, et vérifie que seules les trois tables rondes sont exposées dans les Archives. Le programme général reste à 19 séquences pour Rémi et l'affichage de la soirée ; après toute modification de ce programme, régénérer `supabase/seed/evening-sessions.sql` et l'appliquer.

### Bugs applicatifs découverts

Aucun à ce jour sur ce module (voir le rapport de session le plus récent sur l'issue Multica WEL-885 pour l'état exact au moment de la vérification).
