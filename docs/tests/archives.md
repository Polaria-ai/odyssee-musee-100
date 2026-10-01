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
| `e2e/archives.spec.ts` | Porte sud du hall franchie **à pied** au clavier (`walkUntilRoom`, `currentRoom === 'archives'`, aucun `portal-fade`) ; accueil de l'Archiviste à la première arrivée seulement (`archivesDiscovered`, jamais rejoué) ; retour au hall à pied par la même porte ; vitrine → « Consulter l'archive » → fiche (titre, heure, intervenant·es si annoncé·es, mention « Programme provisoire » sur une séquence encore incomplète, encart « Archive en cours de rédaction » tant qu'aucune archive publiée) ; navigation précédente/suivante (bornée aux extrémités du programme trié par `order`) ; Échap ferme la fiche ; Archiviste → « Parler à l'Archiviste » → dialogue ; carnet (`stamps-button` « n/4 », 4e tampon Archives obtenu après 3 archives consultées, `stamp-card` « Obtenu ») ; plan du musée (5 salles dans le même plan, légende `map-archives` avec `map-archives-count`, plus de `map-portal-marker`) ; bascule FR/EN du bouton d'action et de la fiche ; performance (`renderInfo().calls` ≤ 150 à l'arrivée dans la salle) ; contenu (`archivesLayout.slots.length === sessions.length`, 19 séquences du programme du 24/09, seules `table-ronde-1`, `table-ronde-2` et `face-a-face-2` `provisional`, aucune attribution à Octave Klaba/Maya Noël/Anne Bouverot/Xavier Boilaud, y compris dans d'éventuelles citations déjà publiées) ; accessibilité (`@axe-core/playwright` sur la fiche d'archive, `reducedMotion: 'reduce'`, comme `e2e/accessibility.spec.ts`) ; absence d'erreur console sur le parcours complet ; archive publiée **pendant** la visite (lecture `session_archives` interceptée : vide au chargement, puis une archive « publiée » — entrer dans la salle relance la lecture, `archives` se remplit, le toast « Nouvelles archives » s'affiche et la fiche montre la synthèse, sans recharger la page). |

### Supabase en E2E

Le jeu ne lit Supabase que si le build contient `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (`getSupabase()`, `src/data/supabaseClient.ts`, sinon `null` et aucune requête). En CI il n'y a ni `.env.local` ni secret : `playwright.config.ts` passe donc au build E2E un faux projet (`https://e2e-stub.supabase.co`, compatible avec la CSP `connect-src https://*.supabase.co` de `vercel.json`), et `gotoMusee` appelle `stubSupabase` (`e2e/support/supabaseStub.ts`) qui répond à sa place : tables vides en REST (repli sur `/data/people.json` et le programme embarqué, comme avec un projet vide), websocket Realtime fermé (présence en solo), 404 pour tout le reste. Aucun réseau, aucun secret, aucun code applicatif touché.

Les routes d'une page (`page.route`) passent avant celles du contexte : « archive publiée pendant la visite » surcharge `session_archives` seule. Il vérifie en plus que cette route a bien été sollicitée au chargement, pour échouer avec un message clair si le build n'a pas les variables (avant la correction, le jeu ne lisait jamais Supabase en CI et l'archive n'apparaissait jamais : `archives` restait vide après 10 s).

### Locale

Tout le fichier fixe `test.use({ locale: 'fr-FR' })` (comme `dialogue.spec.ts`/`stamps.spec.ts`/`museum-map.spec.ts`) : les textes vérifiés (dialogue de l'Archiviste, fiche d'archive, carnet) sont en français dans le script, et le Chromium de test démarre sinon en anglais (`navigator.language`).

### Aides propres à ce fichier

`e2e/support/museeApi.ts` n'expose pas encore `sessions`/`archivesLayout`/`visitedSessions`/`openSession`/`closeSession` (son type `MuseeGameState` est un sous-ensemble volontairement minimal, voir son en-tête) — hors du scope de cet agent (`e2e/support/**` non modifiable ici). `e2e/archives.spec.ts` définit donc localement :
- `archivesState(page)` : lit un sous-ensemble sérialisable de l'état utile aux Archives (jamais les actions du store, perdues de toute façon à la traversée `page.evaluate` → Node).
- `walkUntilRoom(page, key, room)` / `standBeforeSouthDoor(page, archives)` : marche au clavier (flèche maintenue) jusqu'au changement de salle, depuis un point du hall dans l'axe de la porte.
- `openArchiveViaState(page, sessionId)` / `closeArchiveViaState(page)` : ouvrent/ferment une fiche via `state().openSession()`/`closeSession()`, sans naviguer en 3D — même idée que `openPersonViaState`/`closePersonViaState` côté portraits.
- `enterMuseumWithArchives(page, { greeted })` : `gotoMusee` + `enterMuseum` + `dismissWelcomeDialogue`, marque par défaut les Archives comme déjà découvertes (sinon la première entrée, même par `teleport`, ouvre l'accueil de l'Archiviste qui masque le bouton d'action ; seul le test de l'accueil passe `greeted: false`), puis vérifie que le programme de la soirée et `archivesLayout` sont chargés (sinon les tests suivants échoueraient sur une cause commune peu lisible).

La plupart des tests se téléportent directement au point de vue d'une vitrine (`slot.viewPoint`), au socle de l'Archiviste (`archivist.position`) ou à l'arrivée (`arrival.position`) plutôt que de marcher — la détection de proximité (`useVitrineProximity`, `Archivist.tsx`) ne dépend que de la position du joueur, pas du chemin suivi. Les tests de la porte sud, eux, marchent réellement (plan en croix, WEL-888).

### Découvertes (pas de bug applicatif)

- **4e tampon non stocké** : dérivé de `visitedSessions` (voir `src/features/stamps/stamps.ts::hasArchivesStamp`), jamais de `stamps.archives` dans le store — obtenu après 3 archives consultées avec un programme de 19 séquences (`ARCHIVES_STAMP_MIN = 3`).
- **Contenu vérifié dynamiquement, jamais recopié depuis `src/data/eveningProgram.ts`** (lecture seule, propriété d'un autre chantier) : la suite lit `state().sessions`/`state().archives` en direct, qu'ils viennent de Supabase (`evening_sessions`/`session_archives`) ou du repli embarqué — les deux sources doivent rester identiques : programme du 24/09, 19 séquences dont 3 `provisional: true`, aucune des quatre personnes interdites. Après toute modification du programme, régénérer `supabase/seed/evening-sessions.sql` et l'appliquer.

### Bugs applicatifs découverts

Aucun à ce jour sur ce module (voir le rapport de session le plus récent sur l'issue Multica WEL-885 pour l'état exact au moment de la vérification).
