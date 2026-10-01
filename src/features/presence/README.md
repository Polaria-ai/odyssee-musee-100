# Présence (`src/features/presence`)

Voir les autres visiteurs en direct via Supabase Realtime.

| Fichier | Rôle |
| --- | --- |
| `presenceSession.ts` | Toute la machine d'état (états, sauts de salle, reconnexions, solo, onglet caché). Aucun React ni `window` : importable depuis Node, pilotée en test par un faux client et une fausse horloge. |
| `usePresence.ts` | Câblage React seul : client, joueur (`state/runtime`), visibilité de l'onglet, réglages Vite. Signature inchangée pour `App.tsx`. |
| `realtimeClient.ts` | Adaptateur `RealtimeChannelLike` autour de supabase-js (`unsubscribe()` ne se résout qu'une fois le canal retiré de `client.channels`). |
| `roomSelection.ts` | Noms de salles, tri par ordre d'arrivée, `targetRoomForRank`. |
| `peers.ts` / `protocol.ts` / `RemoteVisitors.tsx` | Registre des pairs, throttle d'envoi, format réseau, rendu. |

## Fonctionnement

Chaque salle est un canal Realtime `musee:v1:room-1` … `room-12` (`ROOM_CAPACITY` = 8 visiteurs, `MAX_ROOMS` = 12,
donc **96 visiteurs en salle au plus** : les suivants jouent en solo, sans erreur visible).

1. **Arrivée étalée, salle d'entrée réglable** : `start()` attend une gigue uniforme de 0 à 2,5 s (état `waiting`),
   puis rejoint `room-1` (défaut : les petits groupes se retrouvent, indispensable pour une démo à quelques personnes),
   ou, avec `VITE_PRESENCE_START=random`, une salle **tirée au hasard dans 1..`maxRooms`**. Démarrer en `room-1` fait
   retraverser les salles pleines une à une à chaque arrivée tardive : le saut direct par rang ne suffit pas seul,
   car une arrivée séquentielle voit toujours le rang 8 dans une salle pleine, soit un saut d'une salle
   (banc de relecture, 200 arrivées sur 60 s : 1 872 jointures depuis `room-1`, 783 avec le tirage aléatoire ; banc du
   dépôt, 40 sessions, capacité 4, 6 salles : 180 contre 57). Contrepartie : les sauts restant **vers l'avant**, un
   joueur tiré en `room-12` déjà pleine passe en solo même si `room-1` a de la place ; c'est sans effet quand le
   musée est saturé (l'événement), et le sondage périodique du solo (point 5) rattrape les places libres en
   régime partiel. `pickStartRoom` (option de session) fixe la salle d'entrée pour les tests ; dans un espace de salles de
   test (`?e2e=1&presenceRoom=…`), `usePresence` entre toujours par `room-1` pour que deux onglets de test se retrouvent.
2. **Abonnement** : à `SUBSCRIBED`, le joueur publie `track({ id, joinTs })`. Si le serveur ne répond pas `ok`, une
   seule nouvelle tentative 1 à 2 s plus tard, puis l'échec est traité comme une erreur de canal.
3. **Saut direct par rang** : à chaque synchronisation de présence, chacun calcule son **rang d'arrivée** dans la
   salle (tri `joinTs` puis `id`, un seul membre par id, le plus petit `joinTs` gagnant). Les 8 premiers restent ;
   le rang `r >= 8` saute **directement** à `salle + floor(r / 8)` (`targetRoomForRank`), au lieu de traverser les
   salles une par une (l'ancien code : 1 872 jointures et 30 000 à 230 000 livraisons de présence pour 200
   arrivées). Le saut est précédé d'une gigue de 150 à 600 ms ; si la décision ne tient plus au dernier sync
   (quelqu'un est parti devant nous), on reste. Jamais de saut en arrière. Cible au-delà de `MAX_ROOMS` : **solo**
   (« musée plein »).
4. **Erreurs** : `CHANNEL_ERROR`, `TIMED_OUT` et un `CLOSED` que nous n'avons pas demandé (le serveur ferme le canal
   après un message système « Too many messages per second » ou une limite de présence) suivent le **même chemin** :
   l'ancien canal est retiré, état `backoff`, délai `min(1 s × 2^(n-1), 15 s) × gigue [0,5 ; 1,5[`, puis on
   rejoint la **même salle**. Jusqu'à 4 reconnexions (délais nominaux 1, 2, 4 puis 8 s), puis **solo**. Le compteur
   d'échecs ne repart de zéro ni à `SUBSCRIBED` seul (un serveur qui accepte le join puis refuse `track` ou referme
   aussitôt relançait sinon le recul à 1 s à chaque cycle, sans fin) : il faut un `track` accepté **et** 30 s sans
   erreur ni fermeture, ou un saut de salle décidé par le rang sur un canal dont le `track` a été accepté.
   `CLOSED` est compté à part (`closedByServer`).
5. **Solo** : le canal est fermé **et la WebSocket aussi** (`RealtimeClientLike.disconnect()`, sans quoi le SDK la garde
   ouverte environ 50 s). Toutes les 3 minutes environ (`soloRetryMs` × gigue 0,75 à 1,25), une nouvelle
   tentative **sonde une seule salle tirée au hasard** : pas de traversée depuis `room-1` (12 jointures par relance
   avant, pour tout le solo) et **aucune position publiée** tant que le rang n'est pas connu ; si la salle est
   pleine, retour immédiat en solo, sans saut plus loin. `soloRetryMs` = 0 pour rester solo. Un seul `console.info`
   au passage en solo, avec la raison.
6. **Envoi de position** : uniquement quand le canal courant est `SUBSCRIBED` **et** `isJoined()`. Jamais de repli
   REST : realtime-js transforme sinon chaque `send` hors canal rejoint en requête `POST /realtime/v1/api/broadcast`
   (2 requêtes/s par joueur en boucle). La boucle s'arrête dès une erreur ou une fermeture.

### Pourquoi la relance d'avant ne marchait pas (corrigé)

`RealtimeClient.channel(topic)` renvoie l'instance **existante** tant qu'elle n'a pas quitté `client.channels` ;
`subscribe()` sur un canal non fermé ne fait rien ; `on('presence')` **lève** sur un canal en cours de jointure ;
et phoenix relance seul un canal en erreur à 1, 2, 5, 10 s sans fin. L'ancien code ne retirait que les canaux déjà
abonnés, donc la relance retombait sur l'instance périmée, lançait une exception dans un minuteur, et laissait un
canal orphelin réessayer à l'infini : joueur figé, invisible. Désormais, tout canal abandonné (même jamais abonné)
est retiré par `unsubscribe()` et sa résolution est attendue avant d'en créer un autre ; les rappels d'un canal
abandonné sont ignorés (génération) ; aucune exception ne remonte des minuteurs ni des rappels.

## Calcul de quota

Les quotas Realtime sont **par projet** et comptent les **émissions ET les livraisons** : un message émis dans une
salle de 8 est reçu par les 7 autres.

- Une salle pleine de 8 visiteurs **tous en mouvement** (2 envois/s chacun) : 8 × 2 = 16 émissions/s, plus
  16 × 7 = 112 livraisons/s, soit **128 événements/s**.
- **12 salles pleines** : 12 × 128 = **1 536 événements/s** (pire cas : 96 visiteurs en salle, tous en mouvement).
  À l'arrêt, un visiteur n'émet qu'un battement toutes les 10 s : la charge réelle est très inférieure.
- Connexions : un visiteur en salle tient une connexion. En solo (ou onglet caché longtemps) la WebSocket est
  fermée dès que le dernier canal est parti ; sans cela le SDK la garde ouverte environ 50 s (2 × heartbeat) et
  200 joueurs arrivés en rafale en tenaient 200 à la fois. Elle est rouverte à la tentative suivante (une
  connexion par relance solo, toutes les 3 minutes). Les onglets supplémentaires ou anciens restés ouverts comptent
  aussi dans les 200 connexions : la marge reste mince.

Limites du plan **Free** vérifiées (moyennes glissantes sur 60 s) : 200 connexions simultanées, 100 événements/s,
100 jointures/s, 20 présences/s, et 5 `track`/`untrack` par client et par canal sur 30 s. Les limites du plan
**Pro** ne sont pas vérifiées ici : à relire sur la page des quotas Realtime de Supabase avant la soirée.

**Mesures réelles du 30/09** (espace de noms isolé, production) : 6, 8 puis 16 robots, jusqu'à ~256 événements/s
pendant 2 minutes, **aucun refus serveur**, latence p50 de 20 ms. Le pire cas de 1 536 événements/s n'a **pas** été
mesuré, et 256 événements/s dépasse déjà la valeur nominale de 100/s du plan Free sans avoir été refusé : la limite
n'est donc pas appliquée de façon brutale à ce niveau, mais rien ne garantit son comportement bien au-delà. Les
leviers sont en fin de fichier.

- **Rendu** : au plus 8 visiteurs distants affichés par client (les plus proches ; `MAX_VISIBLE_PEERS`, soit la
  capacité d'une salle), interpolés/extrapolés côté client (`peers.ts` → `getRenderTransform`) — aucun message
  supplémentaire pour ça. Ce sont tous des Cyril (modèle 3D animé, ~12 400 triangles, un appel de dessin chacun ;
  avec le joueur, au plus 9 personnages) : la borne protège le budget mobile.

## Réglages (variables Vite, optionnelles)

Chacune est bornée ; absente, illisible ou hors bornes, elle est ignorée et la valeur par défaut s'applique
(`usePresence.ts` → `presenceConfigFromEnv`). Documentées sans valeur de clé dans `.env.example`.

| Variable | Bornes | Défaut | Effet |
| --- | --- | --- | --- |
| `VITE_PRESENCE_ROOM_CAPACITY` | 2 à 20 (entier) | 8 | Visiteurs par salle. Moins = moins de livraisons par salle. |
| `VITE_PRESENCE_MAX_ROOMS` | 1 à 50 (entier) | 12 | Nombre de salles ; au-delà, solo. |
| `VITE_PRESENCE_SEND_HZ` | 0,5 à 4 | 2 | Envois de position par seconde en mouvement (`moveSendIntervalMs` = 1000 / Hz). |
| `VITE_PRESENCE_START` | `random` | (absent = `room-1`) | Salle d'entrée tirée au hasard : moins de jointures lors d'une arrivée groupée (soirée), mais joueurs dispersés tant qu'ils sont moins de ~96. Les sondages du solo sont toujours au hasard. |
| `VITE_PRESENCE` | `off` | (absent) | Coupe tout le module. |

Les autres paramètres (gigues, recul, `soloRetryMs`, `hiddenLeaveMs`…) sont dans `DEFAULT_PRESENCE_CONFIG`
(`presenceSession.ts`) et se surchargent par `createPresenceSession({ config })`, par exemple depuis un banc de charge.

## Observer une session

En mode debug (`?e2e=1` ou serveur de dev), `window.__musee.presence()` renvoie les compteurs de la session :
`state`, `room`, `joins`, `hops`, `reconnects`, `closedByServer`, `errors` (par début de message ou statut),
`lastError`, `soloReason`, `sent`, `received`. `onStats` n'est appelé qu'à chaque changement d'état, pas à chaque
message. Hors debug, seul le passage en solo écrit un `console.info`.

## Ce que voient les autres

Tous les visiteurs jouent Cyril (décision du 29/09) : plus de tenue, de couleurs ni de pseudo, donc plus
d'étiquette au-dessus des visiteurs distants. La présence (`presence.track`) ne transporte que
`{ id, joinTs }` ; le broadcast de position, `{ i, x, z, r, m }`. Un visiteur distant qui bouge (`m` = 1)
joue le clip « walk » de Cyril, à la cadence de la marche du joueur (le réseau n'envoie pas la vitesse).

**Compatibilité de lecture** : un client d'une version précédente publie encore un champ `avatar`. Il est
accepté et ignoré (`protocol.ts` → `decodePresence`, jamais lu, jamais rendu), donc ce visiteur reste compté
dans la salle et s'affiche en Cyril. L'inverse ne tient pas : un ancien client rejette les messages du
nouveau format (il exigeait un avatar valide) ; cela ne concerne que des onglets restés ouverts d'avant le
déploiement.

## Flag de désactivation

`VITE_PRESENCE=off` (variable Vite) désactive entièrement le module : `usePresence` ne se connecte
à rien. Utile pour une démo hors ligne ou un test de charge où on ne veut aucun trafic présence.

## Robustesse

Toute panne retombe en **mode solo silencieux**, sans exception ni boucle agressive : Supabase non configuré,
canal refusé, erreur (`CHANNEL_ERROR`), délai dépassé (`TIMED_OUT`), fermeture par le serveur (`CLOSED`) ou trop de
connexions → reconnexions avec recul exponentiel et gigue (voir « Fonctionnement »), puis solo, sans jamais bloquer
le jeu. Les erreurs du SDK ne sont plus jetées : la dernière est gardée dans `lastError` et chaque motif est compté
dans `errors`.

Un pair est retiré du rendu après `peerTimeoutMs` sans signal (16 s : `EFFECTIVE_PEER_TIMEOUT_MS` dans
`presenceSession.ts`, strictement supérieur à 1,6 × le battement au repos, avec son test de cohérence) pour ne
jamais faire clignoter un visiteur immobile mais toujours connecté ; `peers.ts` garde la valeur de base
`PEER_SILENCE_TIMEOUT_MS` (6 s), testée isolément. Le départ normal passe par l'événement de présence `leave`,
immédiat ; cette expiration n'est qu'un filet pour une connexion morte sans préavis.

**Onglet caché longtemps** : un onglet caché plus de 30 s (`hiddenLeaveMs`) quitte activement la présence
(`untrack` puis `unsubscribe`), état `hidden`, plutôt que de rester un visiteur fantôme figé pour tout le monde.
Au retour au premier plan, il rejoint **sa dernière salle** après la gigue de saut (150 à 600 ms, pas la gigue
d'arrivée), en ne sautant que vers l'avant si elle est pleine ; revenant du solo, il sonde une salle au hasard comme
au point 5. La socket est fermée pendant l'absence. (Repartir de `room-1` coûtait en moyenne 6 jointures par retour.) Un onglet **ouvert déjà caché** ne rejoint rien avant son premier passage au premier
plan. En dessous de 30 s, rien ne change : la publication de position reprend tout de suite.

## Le soir de l'événement

Avec « plusieurs centaines » de joueurs simultanés annoncés, seuls 96 peuvent être en salle (les autres jouent en
solo) et le plan gratuit peut rester serré sur les événements/s (voir « Calcul de quota »). Leviers, à activer
**avant** la soirée si on veut de la marge :

1. **Passer le projet Supabase en plan Pro** : aucun changement de code, seul le quota change (valeurs à vérifier
   sur la page des quotas Realtime).
2. Réduire la charge sans upgrade : `VITE_PRESENCE_ROOM_CAPACITY` plus bas (moins de livraisons par salle),
   `VITE_PRESENCE_SEND_HZ` plus bas (1 Hz divise la charge par deux), ou couper la présence (`VITE_PRESENCE=off`)
   pendant les pics.

Aucun de ces réglages ne touche au contrat du module (`usePresence(enabled)`, `<RemoteVisitors/>`).
