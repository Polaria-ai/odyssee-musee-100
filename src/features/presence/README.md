# Présence (`src/features/presence`)

Voir les autres visiteurs en direct via Supabase Realtime.

| Fichier | Rôle |
| --- | --- |
| `presenceSession.ts` | Toute la machine d'état (états, sauts de salle, reconnexions, quota, solo, onglet caché). Aucun React ni `window` : importable depuis Node, pilotée en test par un faux client et une fausse horloge. |
| `usePresence.ts` | Câblage React seul : client, joueur (`state/runtime`), visibilité de l'onglet, réglages Vite. Signature inchangée pour `App.tsx`. |
| `realtimeClient.ts` | Adaptateur `RealtimeChannelLike` autour de supabase-js (`unsubscribe()` ne se résout qu'une fois le canal retiré de `client.channels` ; écoute des messages `system` du serveur). |
| `quota.ts` | Reconnaît un quota dépassé (libellés du serveur et du SDK, cités en commentaire). Fonctions pures. |
| `roomSelection.ts` | Noms de salles, capacité (30) et nombre de salles (8), tri par ordre d'arrivée, `targetRoomForRank`. |
| `peers.ts` / `protocol.ts` / `RemoteVisitors.tsx` | Registre des pairs, throttle d'envoi, interpolation, format réseau, rendu. |
| `testing/fakePhoenixServer.ts` | Faux serveur Realtime (protocole Phoenix) qui fait tourner le VRAI SDK : refus de jointure, plafonds de connexions et de jointures/s, messages système, compteurs. |

## Fonctionnement

Décision du 01/10 : des **« clusters » de 30 joueurs au plus**. Chaque salle est un canal Realtime
`musee:v1:room-1` … `room-8` (`ROOM_CAPACITY` = 30, `MAX_ROOMS` = 8, soit **240 places** pour ~200 joueurs attendus) ;
au-delà, ou si le serveur refuse (quota), le joueur joue en **solo**, sans erreur visible. Supabase reste sur l'offre gratuite.

1. **Arrivée étalée, salle d'entrée réglable** : `start()` attend une gigue uniforme de 0 à 2,5 s (état `waiting`),
   puis rejoint `room-1` (défaut : les petits groupes se retrouvent, indispensable pour une démo à quelques personnes),
   ou, avec `VITE_PRESENCE_START=random`, une salle **tirée au hasard dans 1..`maxRooms`**. Depuis `room-1`, les salles
   se remplissent l'une après l'autre : pour ~200 joueurs, **7 salles occupées au plus** (6 de 30 et une de 20). Au
   hasard, les 8 salles sont occupées (de 18 à 30 dans le banc) et la 8e peut déborder alors qu'il reste de la place
   ailleurs (les sauts ne vont qu'en avant), d'où le défaut. `pickStartRoom` (option de session) fixe la salle d'entrée
   pour les tests ; dans un espace de salles de test (`?e2e=1&presenceRoom=…`), `usePresence` entre toujours par `room-1`.
2. **Abonnement, puis annonce** : à `SUBSCRIBED`, la session **n'annonce pas encore sa présence**. Elle attend la liste
   des visiteurs de la salle (premier `presence_state` du serveur, au plus 1,5 s) et ne fait `track({ id, joinTs })` que
   si elle y a sa place. Une salle pleine ne reçoit donc ni notre arrivée ni notre départ (voir le chiffrage plus bas).
   Si le serveur ne répond pas `ok`, une seule nouvelle tentative 1 à 2 s plus tard, puis l'échec est traité comme une
   erreur de canal. La position ne part qu'une fois la session annoncée.
3. **Saut direct par rang** : à chaque synchronisation de présence, chacun calcule son **rang d'arrivée** dans la
   salle (tri `joinTs` puis `id`, un seul membre par id, le plus petit `joinTs` gagnant). Les 30 premiers restent ;
   le rang `r >= 30` saute **directement** à `salle + floor(r / 30)` (`targetRoomForRank`), au lieu de traverser les
   salles une par une. Le saut est précédé d'une gigue de 150 à 600 ms ; si la décision ne tient plus au dernier sync
   (quelqu'un est parti devant nous), on reste et on s'annonce. Jamais de saut en arrière. Cible au-delà de `MAX_ROOMS` :
   **solo** (« musée plein »).
4. **Quota dépassé → solo immédiat** (voir « Quota dépassé » ci-dessous).
5. **Autres erreurs** : `CHANNEL_ERROR`, `TIMED_OUT` et un `CLOSED` que nous n'avons pas demandé et dont la cause n'est
   pas un quota suivent le **même chemin** : l'ancien canal est retiré, état `backoff`, délai
   `min(1 s × 2^(n-1), 15 s) × gigue [0,5 ; 1,5[`, puis on rejoint la **même salle**. Jusqu'à 4 reconnexions (délais
   nominaux 1, 2, 4 puis 8 s), puis **solo**. Le compteur d'échecs ne repart de zéro ni à `SUBSCRIBED` seul (un serveur
   qui accepte le join puis refuse `track` ou referme aussitôt relançait sinon le recul à 1 s à chaque cycle, sans fin) :
   il faut un `track` accepté **et** 30 s sans erreur ni fermeture, ou un saut de salle décidé par le rang (le canal a
   répondu). `CLOSED` est compté à part (`closedByServer`).
6. **Solo** : le canal est fermé **et la WebSocket aussi** (`RealtimeClientLike.disconnect()`, sans quoi le SDK la garde
   ouverte environ 50 s). Après `soloRetryMs` (3 min × gigue 0,75 à 1,25), ou `quotaSoloRetryMs` après un quota
   (5 min × gigue 0,75 à 1,25), une nouvelle tentative **sonde une seule salle tirée au hasard** : pas de traversée depuis
   `room-1`, **aucune position publiée et aucune annonce** tant que le rang n'est pas connu ; si la salle est pleine,
   retour immédiat en solo, sans saut plus loin. Le délai à 0 laisse en solo. Un seul `console.info` au passage en solo,
   avec la raison.
7. **Envoi de position** : uniquement quand le canal courant est `SUBSCRIBED` **et** `isJoined()`. Jamais de repli
   REST : realtime-js transforme sinon chaque `send` hors canal rejoint en requête `POST /realtime/v1/api/broadcast`
   (2 requêtes/s par joueur en boucle). La boucle s'arrête dès une erreur ou une fermeture.

### Quota dépassé : solo immédiat (`quota.ts`)

Quand le serveur signale un quota, la session passe **directement** en solo avec `soloReason = 'quota'` (et
`stats().quota` = le type) : pas les 4 reconnexions, qui aggraveraient la saturation. Le canal est retiré sans `untrack`
(le serveur l'a refusé ou le ferme), la WebSocket est fermée, rien n'est publié. La prochaine tentative attend
`quotaSoloRetryMs` = **5 min × gigue 0,75–1,25** (225 à 375 s), ne sonde **qu'une salle**, et si le serveur refuse encore
repart pour un délai long : en 30 minutes de saturation, 9 jointures au plus par joueur (la première, puis une toutes les
225 s au mieux ; banc). Un téléphone déverrouillé pendant ce délai ne le raccourcit pas. Le joueur ne voit aucune erreur ;
le jeu reste jouable seul.

Ce que le SDK émet (relevé dans `node_modules` : `@supabase/realtime-js` 2.117.1, `@supabase/phoenix` 0.4.5) :

- Le SDK **ne contient aucun libellé de quota** ni erreur « limite de débit » dédiée : tout vient du serveur.
- **Jointure refusée** (`phx_reply` en `error`) : `subscribe()` rappelle `CHANNEL_ERROR` avec
  `new Error(Object.values(réponse).join(', '), { cause: réponse })`. Le texte du serveur est donc le `message`.
- **Jointure sans réponse** : `TIMED_OUT`, sans Error. **Fermeture** (`phx_close`) : `CLOSED`, **sans Error**.
  Un `CLOSED` seul ne dit rien de sa cause ; c'est le message `system` qui le précède qui la porte, d'où l'écoute de
  `channel.on('system', …)` (charge utile `{ extension, status, message, channel }`).
- **Coupure de transport** : `CHANNEL_ERROR` « socket closed: 1006 », « channel error: transport failure »… Un navigateur
  ne donne ni statut HTTP (403, 429) ni corps pour une WebSocket refusée : ce chemin n'est **pas** reconnaissable comme
  quota et reste une erreur ordinaire (reconnexions puis solo).

Libellés du serveur (supabase/realtime, `realtime_channel.ex`, branche principale, lus en ligne le 01/10/2026 ; **pas
vérifiés sur la version déployée du projet**) : `too_many_connections` → « Too many connected users » ;
`too_many_channels` → « ChannelRateLimitReached: Too many channels » ; `too_many_joins` → « ClientJoinRateLimitReached:
Too many joins per second » ; message système d'erreur « Too many messages per second » puis fermeture ; présence :
« Too many presence messages per second » puis fermeture, `ClientPresenceRateLimitReached`. `quota.ts` reconnaît aussi
ces libellés en snake_case, un 429 et « rate limit » / « quota ». Les autres erreurs gardent le chemin ordinaire.

### Pourquoi la relance d'avant ne marchait pas (corrigé)

`RealtimeClient.channel(topic)` renvoie l'instance **existante** tant qu'elle n'a pas quitté `client.channels` ;
`subscribe()` sur un canal non fermé ne fait rien ; `on('presence')` **lève** sur un canal en cours de jointure ;
et phoenix relance seul un canal en erreur à 1, 2, 5, 10 s sans fin. L'ancien code ne retirait que les canaux déjà
abonnés, donc la relance retombait sur l'instance périmée, lançait une exception dans un minuteur, et laissait un
canal orphelin réessayer à l'infini : joueur figé, invisible. Désormais, tout canal abandonné (même jamais abonné)
est retiré par `unsubscribe()` et sa résolution est attendue avant d'en créer un autre ; les rappels d'un canal
abandonné sont ignorés (génération) ; aucune exception ne remonte des minuteurs ni des rappels.

## Débit, interpolation et rendu

- **Envoi** : 1 position par seconde en mouvement (`MOVE_SEND_INTERVAL_MS` = 1 000 ms ; tick de 100 ms, donc 1,0 à 1,1 s
  réels), la position d'arrêt tout de suite, puis un battement toutes les 10 s à l'arrêt (`IDLE_HEARTBEAT_MS`, inchangé :
  c'est lui qui rend un immobile visible à un nouvel arrivant, et l'expiration des silencieux en dérive).
- **Affichage retardé de 1,5 s** (`INTERP_DELAY_MS` ; 150 ms à 2 envois/s) : on interpole toujours entre deux paquets
  reçus, sans extrapoler tant que l'intervalle entre deux arrivées reste sous 1,5 s (marge de 400 ms sur 1,1 s). Le
  tampon passe de 2 à 5 échantillons (`MAX_POSITION_BUFFER`) : à 1,5 s de retard, l'instant affiché peut tomber deux
  intervalles en arrière. Réglé pour 1 envoi/s : en dessous de 1 Hz (`VITE_PRESENCE_SEND_HZ`), l'extrapolation joue.
- **Paquet en retard** : extrapolation d'un pair en marche, 500 ms au plus (`EXTRAPOLATE_CAP_MS`), à vitesse bornée
  (6,5 m/s) ; passé ce délai le pair est figé et ne marche plus. Un pair arrêté n'est jamais extrapolé (**arrêt propre** :
  il s'immobilise exactement au point d'arrêt, après avoir marché jusque-là). Un pair qui démarre ne marche pas sur place
  avant son premier échantillon en marche : l'animation de marche suit le début du segment interpolé.
- **Paquets en rafale** (blocage réseau puis livraison d'un coup) : l'avatar rattrape sa cible en courant à 9 m/s au plus
  (`stepToward` ; la course du joueur est à 5,6 m/s), jamais en téléportation ; au-delà de 12 m, replacement direct.
- **Rendu** : au plus **8** visiteurs distants montés (`MAX_VISIBLE_PEERS`), les plus proches du joueur, **réévalués toutes
  les 0,5 s** pendant que le joueur bouge (dans une salle de 30, les plus proches changent sans qu'aucun roster ne bouge),
  avec hystérésis (un pair monté garde sa place tant qu'un autre n'est pas 20 % plus proche). Ce sont tous des Cyril
  (modèle animé, ~12 400 triangles, un appel de dessin chacun ; avec le joueur, au plus 9 personnages) : le coût du
  rendu **ne dépend pas de la taille de la salle**, les 22 autres ne coûtent qu'un échantillon reçu par seconde. Sur
  ordinateur on pourrait monter à 12, mais cela demande de détecter le terminal et n'apporte rien à la soirée : 8 partout.
  Aucune allocation three.js dans `useFrame` (transformation réutilisée, position rattrapée en place).
- **Mémoire** : le registre des pairs est borné (une salle ; `MAX_PEER_RECORDS` = 64 pour les positions d'ids inconnus ;
  5 échantillons par pair au plus), vidé à chaque changement de salle, et les pairs silencieux sont retirés après
  `EFFECTIVE_PEER_TIMEOUT_MS` (16 s). Test : 120 vagues de 30 pairs qui arrivent, bougent et partent ne laissent rien
  derrière elles ; banc de 200 joueurs : au plus 30 pairs par registre.

## Calcul de quota

Les quotas Realtime sont **par projet**. Valeurs documentées (à relire sur la page des quotas avant la soirée) :

| | Free | Pro | Pro sans plafond |
| --- | --- | --- | --- |
| Connexions simultanées | 200 | 500 | 10 000 |
| Messages par seconde | 100 | 500 | 2 500 |
| Jointures par seconde | 100 | non relevé | non relevé |
| Messages de présence par seconde | 20 | non relevé | non relevé |

Moyennes glissantes sur 60 s ; au plan Free s'ajoutent 5 `track`/`untrack` par client et par canal sur 30 s.

### Estimation pour 200 joueurs dans des salles de 30, à 1 envoi/s, la moitié en mouvement

Régime établi : 6 salles de 30 et une de 20 ; 100 joueurs marchent (1 envoi/s), 100 sont immobiles (1 battement / 10 s).

- **Émissions** : 100 × 1 + 100 × 0,1 = **110 par seconde** (200 si tous marchent).
- **Livraisons** : chaque émission est livrée aux autres membres de la salle, 28 en moyenne ((6 × 30 × 29 + 20 × 19) / 200) :
  110 × 28 = **3 080 par seconde** (5 600 si tous marchent).
- Mesuré dans le banc (voir plus bas) : 110 émissions/s, 3 071 livraisons/s, pointe de 3 273 livraisons/s.

Rapport au plafond « messages par seconde » (cas typique, pire cas entre parenthèses) :

| | Free (100/s) | Pro (500/s) | Pro sans plafond (2 500/s) |
| --- | --- | --- | --- |
| Si seules les **émissions** comptent : 110/s (200/s) | 1,1 × (2 ×) | 0,22 × (0,4 ×) | 0,04 × (0,08 ×) |
| Si **émissions + livraisons** comptent : 3 190/s (5 800/s) | 32 × (58 ×) | 6,4 × (11,6 ×) | 1,3 × (2,3 ×) |

Lequel des deux compte pour le **refus** ? Pas vérifié. Indice : le 30/09, 6 puis 8 puis 16 robots en salles de 8 ont
produit jusqu'à ~256 événements/s (émissions **et** livraisons) pendant 2 minutes **sans aucun refus**, alors que le
plafond nominal du plan Free est de 100/s : les livraisons ne semblent pas entrer dans la limite de refus. Si seules les
émissions comptent, le plan Free est **à la limite** (110/s pour 100/s quand la moitié des joueurs marche en continu) ;
`VITE_PRESENCE_SEND_HZ` à 0,5 les divise par deux (mais l'affichage est réglé pour 1 Hz).

Autres quotas, dans le banc de 200 joueurs arrivés sur 60 s :

- **Connexions** : 200 pour 200 joueurs, **exactement le plafond du plan Free** : un onglet de plus ailleurs fait passer un
  joueur en solo.
- **Jointures** : 770 au total (3,85 par joueur ; 7 au plus pour un joueur), pointe de 36 par seconde (quota 100).
  Si tout le monde arrive en 10 s au lieu de 60 s : 727 jointures, **110 tentatives par seconde en pointe**, donc 11 refus
  « jointures/s » et 11 joueurs en solo.
- **Présence** : 200 `track`, **0 `untrack`**, pointe de 9 appels par seconde (quota 20). Avant « ne pas s'annoncer dans
  une salle pleine », le même banc faisait 770 `track` et 570 `untrack` (22 appels par seconde en moyenne, au-dessus de
  20), chacun diffusé aux membres de la salle. En 10 s : 189 `track`, pointe de **23 appels par seconde** (quota 20).

### Au-delà des quotas

- **Plus de 200 connexions** (260 joueurs dans le banc) : le serveur refuse la jointure (« Too many connected users »).
  Les 60 derniers passent en solo **sans erreur**, avec une seule jointure chacun, WebSocket fermée ; les 200 premiers ne
  sont pas dérangés. Ils retentent une seule salle au bout de 3 min 45 s à 6 min 15 s.
- **Plus de messages par seconde que le quota** : le serveur envoie « Too many messages per second » puis ferme le canal.
  Chaque joueur concerné passe en solo (`quota`), puis sonde **une** salle au hasard après 3 min 45 s à 6 min 15 s : une
  vague d'environ 1,3 jointure par seconde, très loin des 100/s. Si le serveur est encore saturé, il repart en solo.
- **Jointures ou présence en rafale** : mêmes chemins (refus de jointure, ou message système puis fermeture).

**Limites de ces chiffres** : ils viennent d'un faux serveur qui rejoue le protocole du vrai (fidèle au SDK, pas au
serveur : latences réseau absentes, comptage exact des quotas non vérifié). Le test de charge réel du 30/09 (16 robots)
n'a pas été refait avec des salles de 30 ; à refaire avant la soirée pour lever le doute sur ce que compte le plafond.

### Banc de charge (`presenceSession.sdk.test.ts`)

Vrai SDK Supabase + `testing/fakePhoenixServer.ts`, configuration de production, PRNG et horloge simulés (chiffres
reproductibles). Plafonds simulés : 200 connexions, 100 jointures par seconde.

| Scénario | Résultat mesuré |
| --- | --- |
| 200 joueurs arrivés sur 60 s, départ en `room-1` | 200 placés, 0 solo ; salles finales 30/30/30/30/30/30/20/0 (**7 salles**, aucune au-dessus de 30) ; pic transitoire par salle 37/38/35/35/35/34/20 ; jamais deux présences pour un même joueur (vérifié toutes les 0,5 s) ; 770 jointures, pic 36/s, 7 au plus par joueur ; 200 `track`, 0 `untrack`, pic 9 appels de présence/s ; aucune reconnexion |
| Idem, régime établi, moitié en marche, 30 s | 110 émissions/s, 3 071 livraisons/s (pointe 3 273/s), aucun POST REST |
| 200 joueurs arrivés sur 10 s | 189 placés, 11 en solo (refus jointures/s) ; 727 jointures, pic 110 tentatives/s ; pic transitoire 45 par salle ; pic 23 appels de présence/s |
| 260 joueurs arrivés sur 60 s | 200 placés, 60 en solo `quota` / `too_many_connections`, 1 jointure chacun, 830 jointures au total, pic de connexions 200 ; aucun nouveau join pendant les 60 s suivantes, aucune erreur visible |
| Même scénario avec tirage aléatoire de la salle d'entrée (mesure ponctuelle, hors test) | 200 jointures (une chacune), 8 salles occupées (27/30/18/27/21/28/20/29), 200 `track` ; mais la 8e salle peut déborder alors qu'il reste de la place ailleurs |

Chaque erreur de quota injectée (jointure refusée par `too_many_connections`, `too_many_joins`, `too_many_channels` ;
message système « Too many messages per second » ou de présence suivi de `phx_close`) mène au solo immédiat avec
`soloReason = 'quota'`, sans reconnexion, sans POST REST, sans nouvelle jointure avant 225 s.

## Réglages (variables Vite, optionnelles)

Chacune est bornée ; absente, illisible ou hors bornes, elle est ignorée et la valeur par défaut s'applique
(`usePresence.ts` → `presenceConfigFromEnv`).

| Variable | Bornes | Défaut | Effet |
| --- | --- | --- | --- |
| `VITE_PRESENCE_ROOM_CAPACITY` | 2 à 40 (entier) | 30 | Visiteurs par salle. Moins = moins de livraisons par salle. |
| `VITE_PRESENCE_MAX_ROOMS` | 1 à 50 (entier) | 8 | Nombre de salles ; au-delà, solo. |
| `VITE_PRESENCE_SEND_HZ` | 0,5 à 4 | 1 | Envois de position par seconde en mouvement (`moveSendIntervalMs` = 1000 / Hz). L'affichage est réglé pour 1 Hz. |
| `VITE_PRESENCE_START` | `random` | (absent = `room-1`) | Salle d'entrée tirée au hasard : moins de jointures lors d'une arrivée groupée, mais 8 salles occupées et joueurs dispersés tant qu'ils sont peu nombreux. Les sondages du solo sont toujours au hasard. |
| `VITE_PRESENCE` | `off` | (absent) | Coupe tout le module. |

Les autres paramètres (gigues, recul, `soloRetryMs`, `quotaSoloRetryMs`, `hiddenLeaveMs`…) sont dans
`DEFAULT_PRESENCE_CONFIG` (`presenceSession.ts`) et se surchargent par `createPresenceSession({ config })`, par exemple
depuis un banc de charge. Le fichier `.env.example` (hors de ce module) documente encore les anciens défauts (8 visiteurs,
12 salles, 2 Hz) et la borne 2..20 : à aligner sur ce tableau.

## Observer une session

En mode debug (`?e2e=1` ou serveur de dev), `window.__musee.presence()` renvoie les compteurs de la session :
`state`, `room`, `joins`, `hops`, `reconnects`, `closedByServer`, `errors` (par début de message ou statut),
`lastError`, `soloReason` (`'quota'` après un quota), `quota` (son type : `too_many_connections`, `too_many_joins`,
`too_many_channels`, `too_many_messages`, `presence_limit`, `rate_limit`, `http_429`), `sent`, `received`. `onStats` n'est
appelé qu'à chaque changement d'état, pas à chaque message. Hors debug, seul le passage en solo écrit un `console.info`.

## Ce que voient les autres

Tous les visiteurs jouent Cyril (décision du 29/09) : plus de tenue, de couleurs ni de pseudo, donc plus
d'étiquette au-dessus des visiteurs distants. La présence (`presence.track`) ne transporte que
`{ id, joinTs }` ; le broadcast de position, `{ i, x, z, r, m }`. Un visiteur distant qui bouge (`m` = 1)
joue le clip « walk » de Cyril, à la cadence de la marche du joueur (le réseau n'envoie pas la vitesse).

**Compatibilité de lecture** : un client d'une version précédente publie encore un champ `avatar`. Il est
accepté et ignoré (`protocol.ts` → `decodePresence`, jamais lu, jamais rendu), donc ce visiteur reste compté
dans la salle et s'affiche en Cyril. L'inverse ne tient pas : un ancien client rejette les messages du
nouveau format (il exigeait un avatar valide) ; cela ne concerne que des onglets restés ouverts d'avant le
déploiement. Un ancien client (salles de 8, 2 envois/s) qui partagerait un canal avec les nouveaux compterait dans le
rang ; ce cas n'existe que pendant un déploiement en cours.

## Flag de désactivation

`VITE_PRESENCE=off` (variable Vite) désactive entièrement le module : `usePresence` ne se connecte
à rien. Utile pour une démo hors ligne ou un test de charge où on ne veut aucun trafic présence.

## Robustesse

Toute panne retombe en **mode solo silencieux**, sans exception ni boucle agressive : Supabase non configuré,
canal refusé, quota dépassé (solo immédiat), erreur (`CHANNEL_ERROR`), délai dépassé (`TIMED_OUT`), fermeture par le
serveur (`CLOSED`) → reconnexions avec recul exponentiel et gigue (voir « Fonctionnement »), puis solo, sans jamais bloquer
le jeu. Les erreurs du SDK ne sont plus jetées : la dernière est gardée dans `lastError` et chaque motif est compté
dans `errors`.

Un pair est retiré du rendu après `peerTimeoutMs` sans signal (16 s : `EFFECTIVE_PEER_TIMEOUT_MS` dans
`presenceSession.ts`, strictement supérieur à 1,6 × le battement au repos, avec son test de cohérence) pour ne
jamais faire clignoter un visiteur immobile mais toujours connecté ; `peers.ts` garde la valeur de base
`PEER_SILENCE_TIMEOUT_MS` (6 s), testée isolément. Ce délai est inchangé à 1 envoi/s : un pair en marche se tait au plus
1,1 s entre deux paquets, bien en deçà ; un pair en marche qui se tait cesse de marcher à l'écran dès que l'extrapolation
est épuisée (2 s après son dernier paquet), bien avant d'être retiré. Il n'est pas raccourci pour les pairs en marche :
un onglet caché moins de 30 s garde son dernier état « en marche » sans rien envoyer et serait retiré à tort. Le départ
normal passe par l'événement de présence `leave`, immédiat ; cette expiration n'est qu'un filet pour une connexion morte
sans préavis.

**Onglet caché longtemps** : un onglet caché plus de 30 s (`hiddenLeaveMs`) quitte activement la présence
(`untrack` puis `unsubscribe`), état `hidden`, plutôt que de rester un visiteur fantôme figé pour tout le monde.
Au retour au premier plan, il rejoint **sa dernière salle** après la gigue de saut (150 à 600 ms, pas la gigue
d'arrivée), en ne sautant que vers l'avant si elle est pleine ; revenant du solo, il sonde une salle au hasard comme
au point 6 de « Fonctionnement » (sauf pendant le délai d'un quota, qu'il respecte). La socket est fermée pendant
l'absence. Un onglet **ouvert déjà caché** ne rejoint rien avant son premier passage au premier plan. En dessous de 30 s,
rien ne change : la publication de position reprend tout de suite.

## Le soir de l'événement

Avec ~200 joueurs, les 8 salles de 30 offrent 240 places mais le plan gratuit plafonne à **200 connexions** (les
suivants jouent seuls, sans erreur) et le plafond de messages par seconde peut être serré (voir « Calcul de quota »).
Leviers, à activer **avant** la soirée si on veut de la marge :

1. **Passer le projet Supabase en plan Pro** : aucun changement de code, seul le quota change (500 connexions,
   500 messages/s ; valeurs à vérifier sur la page des quotas Realtime).
2. Réduire la charge sans upgrade : `VITE_PRESENCE_ROOM_CAPACITY` plus bas (moins de livraisons par salle),
   `VITE_PRESENCE_SEND_HZ` plus bas (0,5 divise les émissions en marche par deux), ou couper la présence
   (`VITE_PRESENCE=off`) pendant les pics.

Aucun de ces réglages ne touche au contrat du module (`usePresence(enabled)`, `<RemoteVisitors/>`).
