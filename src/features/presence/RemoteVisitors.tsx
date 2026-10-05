/**
 * Affiche les autres visiteurs connectés, dans le Canvas : tous jouent Cyril (`AvatarMesh`), qui marche
 * quand ils se déplacent. Pas de pseudo, donc pas d'étiquette au-dessus d'eux.
 *
 * Lit `peers.ts` (hors React) : la liste React des pairs montés ne change qu'à l'arrivée/départ d'un
 * pair (`useSyncExternalStore` sur le roster) ; les positions, elles, sont appliquées à chaque image via
 * des refs directement dans `useFrame`, sans `setState` — donc sans re-rendu React à 60 i/s.
 */
import { useCallback, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { AvatarMesh } from '../../player/AvatarMesh'
import { remoteSpeed } from '../../player/cyrilLocomotion'
import {
  MAX_VISIBLE_PEERS,
  getPeer,
  getRenderTransform,
  peerStore,
  selectVisiblePeers,
  stepToward,
  subscribeRoster,
  type RenderTransform,
} from './peers'
import { player } from '../../state/runtime'

export const POP_MS = 250
const POP_START_SCALE = 0.6
const POP_PEAK_SCALE = 1.05
const POP_END_SCALE = 1
/** Part de la durée consacrée à la montée (0 → pic) ; le reste redescend du pic à la taille finale. */
const POP_OVERSHOOT_FRACTION = 0.7

/**
 * Échelle du groupe d'un pair à `elapsedMs` depuis son apparition : un petit « pop »
 * (0,6 → 1,05 → 1) plutôt qu'un fondu. Fonction pure, testable sans Canvas ni THREE — utilisée par
 * `usePopIn` ci-dessous.
 */
export function popScale(elapsedMs: number, durationMs: number = POP_MS): number {
  if (durationMs <= 0) return POP_END_SCALE
  const t = Math.min(1, Math.max(0, elapsedMs) / durationMs)
  if (t >= 1) return POP_END_SCALE
  if (t < POP_OVERSHOOT_FRACTION) {
    const localT = t / POP_OVERSHOOT_FRACTION
    return POP_START_SCALE + (POP_PEAK_SCALE - POP_START_SCALE) * localT
  }
  const localT = (t - POP_OVERSHOOT_FRACTION) / (1 - POP_OVERSHOOT_FRACTION)
  return POP_PEAK_SCALE + (POP_END_SCALE - POP_PEAK_SCALE) * localT
}

/**
 * Anime l'apparition d'un pair par une mise à l'échelle du groupe (jamais par ses matériaux).
 *
 * `AvatarMesh` partage ses ressources entre toutes ses instances (joueur local compris) : un seul
 * matériau mat pour tous les Cyril, la géométrie, la texture d'ombre et son matériau. Y toucher
 * (`opacity`/`transparent`) a déjà fait clignoter/casser le rendu partagé d'un pair à l'autre.
 * `group.scale` en revanche est une propriété propre à CE groupe (un `THREE.Group` par pair) : la
 * muter n'affecte jamais un autre visiteur. Aucune allocation ici — seul `scale.setScalar` est appelé
 * à chaque image.
 */
function usePopIn(groupRef: RefObject<THREE.Group | null>) {
  const startRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useFrame(() => {
    if (doneRef.current) return
    const group = groupRef.current
    if (!group) return
    if (startRef.current === null) startRef.current = performance.now()
    const elapsed = performance.now() - startRef.current
    group.scale.setScalar(popScale(elapsed))
    if (elapsed >= POP_MS) doneRef.current = true
  })
}

function RemotePeerAvatar({ id }: { id: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const initial = getRenderTransform(getPeer(peerStore, id), Date.now())
  const [moving, setMoving] = useState(initial?.moving ?? false)
  // Un seul objet réutilisé à chaque image : pas d'allocation par pair dans `useFrame`.
  const transformRef = useRef<RenderTransform>({ x: 0, z: 0, rotY: 0, moving: false })
  const placedRef = useRef(false)
  usePopIn(groupRef)

  useFrame((_, delta) => {
    const transform = getRenderTransform(getPeer(peerStore, id), Date.now(), transformRef.current)
    const group = groupRef.current
    if (!transform || !group) return
    if (placedRef.current) {
      // À 1 envoi/s, un blocage réseau livre parfois plusieurs positions d'un coup : on rattrape la cible en courant
      // (vitesse bornée) plutôt que de téléporter le pair. Marche ordinaire : suivi exact.
      stepToward(group.position, transform.x, transform.z, delta)
    } else {
      group.position.x = transform.x
      group.position.z = transform.z
      placedRef.current = true
    }
    group.rotation.y = transform.rotY
    if (transform.moving !== moving) setMoving(transform.moving)
  })

  if (!getPeer(peerStore, id)?.present) return null

  return (
    <group ref={groupRef}>
      <AvatarMesh moving={moving} speed={remoteSpeed(moving)} />
    </group>
  )
}

/** Même ensemble d'ids, quel que soit l'ordre : l'ordre ne change rien au rendu (les clés React sont les ids). */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (const id of b) if (!a.includes(id)) return false
  return true
}

/**
 * Pairs à monter : les `MAX_VISIBLE_PEERS` plus proches du joueur, avec hystérésis sur ceux déjà montés. Renvoie
 * `previous` lui-même si l'ensemble est inchangé (référence stable pour `useSyncExternalStore`).
 */
function pickVisibleIds(previous: string[]): string[] {
  const next = selectVisiblePeers(peerStore, player.x, player.z, MAX_VISIBLE_PEERS, new Set(previous)).map((p) => p.id)
  return sameIds(previous, next) ? previous : next
}

/**
 * Le joueur se déplace : dans une salle de 30, les 8 plus proches changent sans qu'aucun visiteur n'arrive ni ne
 * parte. Le choix est donc réévalué toutes les 0,5 s, et seulement s'il y a plus de pairs que de places (jusqu'à 8
 * visiteurs, tous sont montés et seul le roster peut changer le résultat).
 */
const RESELECT_INTERVAL_S = 0.5

export function RemoteVisitors() {
  const cacheRef = useRef<{ dirty: boolean; ids: string[] }>({ dirty: true, ids: [] })
  const notifyRef = useRef<(() => void) | null>(null)
  const sinceReselectRef = useRef(0)

  const subscribe = useCallback((onStoreChange: () => void) => {
    notifyRef.current = onStoreChange
    const unsubscribe = subscribeRoster(peerStore, () => {
      cacheRef.current.dirty = true
      onStoreChange()
    })
    return () => {
      if (notifyRef.current === onStoreChange) notifyRef.current = null
      unsubscribe()
    }
  }, [])

  const getSnapshot = useCallback(() => {
    const cache = cacheRef.current
    if (cache.dirty) {
      cache.ids = pickVisibleIds(cache.ids)
      cache.dirty = false
    }
    return cache.ids
  }, [])

  const visibleIds = useSyncExternalStore(subscribe, getSnapshot)

  useFrame((_, delta) => {
    sinceReselectRef.current += delta
    if (sinceReselectRef.current < RESELECT_INTERVAL_S) return
    sinceReselectRef.current = 0
    const cache = cacheRef.current
    if (cache.dirty || peerStore.peers.size <= MAX_VISIBLE_PEERS) return // le prochain rendu recalcule, ou rien à départager
    const next = pickVisibleIds(cache.ids)
    if (next === cache.ids) return
    cache.ids = next
    notifyRef.current?.()
  })

  return (
    <group>
      {visibleIds.map((id) => (
        <RemotePeerAvatar key={id} id={id} />
      ))}
    </group>
  )
}
