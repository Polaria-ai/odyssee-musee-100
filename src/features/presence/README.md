# Présence (`src/features/presence`)

Voir les autres visiteurs en direct via Supabase Realtime — dimensionné pour le **plan gratuit**
(≈ 200 connexions simultanées, ≈ 100 messages/s par projet, chaque message diffusé comptant pour
chaque destinataire).

## Dimensionnement

- **Salles** : `musee:v1:room-1` … `room-12`, 8 visiteurs max chacune (`roomSelection.ts`). Un
  client rejoint `room-1`, et à chaque synchronisation de présence, s'il y a plus de 8 membres,
  seuls les **derniers arrivés** (tri déterministe par `joinTs`) quittent et essaient la salle
  suivante. Au-delà de 12 salles (96 personnes) : **mode solo silencieux**, pas d'erreur visible.
- **Positions** : diffusées en broadcast (`self: false`), 2 envois/s max en mouvement, un simple
  battement toutes les 10 s à l'arrêt (`peers.ts` → `shouldSendPosition`). Charge utile minimale
  `{ i, x, z, r, m }`, arrondie à 2 décimales.
- **Budget au pic** (12 salles pleines, tout le monde en mouvement) : 12 × 8 × 2 msg/s émis, soit
  ≈ 192 msg/s *émis* — mais c'est la **diffusion** qui compte pour le quota (chaque message compte
  une fois par destinataire dans sa salle) : au pire, dans une salle pleine, 8 émetteurs × 7
  destinataires × 2/s ≈ 112 « livraisons »/s par salle. C'est pour rester sous la barre que le
  plafond est de 8 personnes par salle, pas plus.
- **Rendu** : au plus 8 visiteurs distants affichés par client (les plus proches ; `MAX_VISIBLE_PEERS`,
  soit la capacité d'une salle), interpolés/extrapolés côté client (`peers.ts` → `getRenderTransform`) —
  aucun message supplémentaire pour ça. Ce sont tous des Cyril (modèle 3D animé, ~12 400 triangles, un
  appel de dessin chacun ; avec le joueur, au plus 9 personnages) : la borne protège le budget mobile.

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

Toute panne retombe en **mode solo silencieux**, sans exception ni boucle agressive :
Supabase non configuré, salle inaccessible, erreur de canal (`CHANNEL_ERROR`), délai dépassé
(`TIMED_OUT`) ou trop de connexions → 3 tentatives avec backoff exponentiel plafonné (1 s, 2 s,
4 s puis abandon), sans jamais bloquer le jeu.

Un pair est retiré du rendu 6 s après son dernier signal (`peers.ts` →
`PEER_SILENCE_TIMEOUT_MS`), mais `usePresence` applique en pratique un délai plus large,
strictement supérieur à 1,6 × le battement au repos (≈ 16 s), pour ne jamais faire clignoter un
visiteur immobile mais toujours connecté — voir `EFFECTIVE_PEER_TIMEOUT_MS` dans
`usePresence.ts` (et son test de cohérence). Le départ normal (fermeture d'onglet propre) passe
par l'événement de présence `leave`, immédiat ; cette expiration par silence n'est qu'un filet de
sécurité pour une connexion morte sans préavis.

**Onglet caché longtemps** : un onglet mis en arrière-plan plus de 30 s (`HIDDEN_LEAVE_MS`) quitte
activement la présence (`untrack` puis désabonnement) plutôt que de rester un visiteur fantôme
figé à sa dernière position pour tout le monde ; il rejoint une salle fraîche dès le retour au
premier plan. En dessous de 30 s (bascule d'app rapide, notification…), rien ne change : la
publication de position reprend simplement tout de suite.

## Le soir de l'événement

Avec « plusieurs centaines » de joueurs simultanés annoncés, le plan gratuit (≈ 200 connexions)
peut être serré si tout le monde joue dans la même fenêtre de quelques minutes. Deux leviers,
à activer **avant** la soirée si on veut de la marge :

1. **Passer le projet Supabase en plan Pro** (~500 msg/s, connexions simultanées bien plus hautes)
   — aucun changement de code nécessaire, seulement le quota qui change.
2. Si besoin d'une marge supplémentaire sans upgrade : réduire `ROOM_CAPACITY` (moins de monde par
   salle, plus de « livraisons » économisées) ou couper la présence (`VITE_PRESENCE=off`) pendant
   les pics et la rallumer une fois le flux stabilisé.

Aucun de ces réglages ne touche au contrat du module (`usePresence(enabled)`,
`<RemoteVisitors/>`) : ce sont des constantes internes à `peers.ts` / `roomSelection.ts` et une
variable d'environnement.
