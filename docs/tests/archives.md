# Tests — Les Archives de 2040 (WEL-885)

Complète `docs/TESTS.md` (stratégie générale, poignée `window.__musee`, locale des specs) : cette
page ne documente que la suite dédiée à la salle des Archives de 2040. Propriétaire : agent QA E2E
— `e2e/archives*.spec.ts` et ce fichier uniquement (n'édite jamais l'application ni `e2e/support/**`).

## Lancer la suite

```
pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 4373 --strictPort &
E2E_BASE_URL=http://127.0.0.1:4373 pnpm exec playwright test e2e/archives.spec.ts
```

En local sans navigateur Playwright téléchargé :

```
E2E_BASE_URL=http://127.0.0.1:4373 \
PW_CHROMIUM_PATH="$HOME/.agent-browser/browsers/chrome-149.0.7827.54/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
pnpm exec playwright test e2e/archives.spec.ts --workers=2
```

## Fichier

| Fichier | Couvre |
|---|---|
| `e2e/archives.spec.ts` | Porte de 2040 (aller, fondu `portal-fade`, `currentRoom === 'archives'`) ; accueil de l'Archiviste à la première arrivée seulement (`archivesDiscovered`, jamais rejoué) ; retour au hall par la porte de retour ; vitrine → « Consulter l'archive » → fiche (titre, heure, intervenant·es si annoncé·es, mention « Programme provisoire », encart « Archive en cours de rédaction » tant qu'aucune archive publiée) ; navigation précédente/suivante (bornée aux extrémités du programme trié par `order`) ; Échap ferme la fiche ; Archiviste → « Parler à l'Archiviste » → dialogue ; carnet (`stamps-button` « n/4 », 4e tampon Archives obtenu après 3 archives consultées, `stamp-card` « Obtenu ») ; plan du musée (`map-archives`, `map-portal-marker`) ; bascule FR/EN du bouton d'action et de la fiche ; performance (`renderInfo().calls` ≤ 150 à l'arrivée dans la salle) ; contenu (`archivesLayout.slots.length === sessions.length`, 18 séquences, toutes `provisional`, aucune attribution à Octave Klaba/Maya Noël/Anne Bouverot/Xavier Boilaud, y compris dans d'éventuelles citations déjà publiées) ; accessibilité (`@axe-core/playwright` sur la fiche d'archive, `reducedMotion: 'reduce'`, comme `e2e/accessibility.spec.ts`) ; absence d'erreur console sur le parcours complet. |

### Locale

Tout le fichier fixe `test.use({ locale: 'fr-FR' })` (comme `dialogue.spec.ts`/`stamps.spec.ts`/`museum-map.spec.ts`) : les textes vérifiés (dialogue de l'Archiviste, fiche d'archive, carnet) sont en français dans le script, et le Chromium de test démarre sinon en anglais (`navigator.language`).

### Aides propres à ce fichier

`e2e/support/museeApi.ts` n'expose pas encore `sessions`/`archivesLayout`/`visitedSessions`/`openSession`/`closeSession` (son type `MuseeGameState` est un sous-ensemble volontairement minimal, voir son en-tête) — hors du scope de cet agent (`e2e/support/**` non modifiable ici). `e2e/archives.spec.ts` définit donc localement :
- `archivesState(page)` : lit un sous-ensemble sérialisable de l'état utile aux Archives (jamais les actions du store, perdues de toute façon à la traversée `page.evaluate` → Node).
- `openArchiveViaState(page, sessionId)` / `closeArchiveViaState(page)` : ouvrent/ferment une fiche via `state().openSession()`/`closeSession()`, sans naviguer en 3D — même idée que `openPersonViaState`/`closePersonViaState` côté portraits.
- `enterMuseumWithArchives(page)` : `gotoMusee` + `enterMuseum` + `dismissWelcomeDialogue`, puis vérifie que le programme de la soirée et `archivesLayout` sont chargés (sinon les tests suivants échoueraient sur une cause commune peu lisible).

La plupart des tests se téléportent directement au point de vue d'une vitrine (`slot.viewPoint`), au socle de l'Archiviste (`archivist.position`) ou à l'arrivée (`arrival.position`) plutôt que de marcher — la détection de proximité (`useVitrineProximity`, `Archivist.tsx`) ne dépend que de la position du joueur, pas du chemin suivi. Seuls les deux tests de la Porte de 2040 se téléportent aux anneaux (`hallPortal`/`returnPortal`) pour déclencher réellement le passage (`usePortalTriggers`, `src/archives/room/Portal.tsx`).

### Découvertes (pas de bug applicatif)

- **Verrou anti-rebond des anneaux** (`PORTAL_TRIGGER_LOCK_SECONDS = 1.5s`, `src/archives/room/constants.ts`) partagé par les deux anneaux (aller et retour) : après un passage, retraverser trop vite (y compris l'autre anneau) ne redéclenche rien. Le test « accueil de l'Archiviste à la première arrivée seulement » attend 1,8 s avant le second passage par la Porte de 2040.
- **4e tampon non stocké** : dérivé de `visitedSessions` (voir `src/features/stamps/stamps.ts::hasArchivesStamp`), jamais de `stamps.archives` dans le store — obtenu après 3 archives consultées avec un programme de 18 séquences (`ARCHIVES_STAMP_MIN = 3`).
- **Contenu vérifié dynamiquement, jamais recopié depuis `src/data/eveningProgram.ts`** (lecture seule, propriété d'un autre chantier) : la suite lit `state().sessions`/`state().archives` en direct, qu'ils viennent de Supabase (`evening_sessions`/`session_archives`) ou du repli embarqué — les deux sources sont actuellement identiques (18 séquences, toutes `provisional: true`, aucune des quatre personnes interdites).

### Bugs applicatifs découverts

Aucun à ce jour sur ce module (voir le rapport de session le plus récent sur l'issue Multica WEL-885 pour l'état exact au moment de la vérification).
