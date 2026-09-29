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
import { getPeer, getRenderTransform, peerStore, selectVisiblePeers, subscribeRoster } from './peers'
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
  usePopIn(groupRef)

  useFrame(() => {
    const transform = getRenderTransform(getPeer(peerStore, id), Date.now())
    const group = groupRef.current
    if (!transform || !group) return
    group.position.set(transform.x, 0, transform.z)
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

export function RemoteVisitors() {
  const cacheRef = useRef<{ dirty: boolean; ids: string[] }>({ dirty: true, ids: [] })

  const subscribe = useCallback((onStoreChange: () => void) => {
    return subscribeRoster(peerStore, () => {
      cacheRef.current.dirty = true
      onStoreChange()
    })
  }, [])

  const getSnapshot = useCallback(() => {
    const cache = cacheRef.current
    if (cache.dirty) {
      cache.ids = selectVisiblePeers(peerStore, player.x, player.z).map((p) => p.id)
      cache.dirty = false
    }
    return cache.ids
  }, [])

  const visibleIds = useSyncExternalStore(subscribe, getSnapshot)

  return (
    <group>
      {visibleIds.map((id) => (
        <RemotePeerAvatar key={id} id={id} />
      ))}
    </group>
  )
}
