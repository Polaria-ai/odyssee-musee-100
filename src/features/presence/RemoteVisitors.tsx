/**
 * Affiche les autres visiteurs connectés, dans le Canvas. Lit `peers.ts` (hors React) : la liste
 * React des pairs montés ne change qu'à l'arrivée/départ d'un pair (`useSyncExternalStore` sur le
 * roster) ; les positions, elles, sont appliquées à chaque image via des refs directement dans
 * `useFrame`, sans `setState` — donc sans re-rendu React à 60 i/s.
 */
import { useCallback, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { AvatarMesh } from '../../player/AvatarMesh'
import { dims } from '../../styles/tokens'
import { getNameLabelAspect, getNameLabelTexture } from './nameLabel'
import { getPeer, getRenderTransform, peerStore, selectVisiblePeers, subscribeRoster } from './peers'
import { player } from '../../state/runtime'

const LABEL_Y = dims.playerHeight + 0.35
const LABEL_HEIGHT = 0.32
const FADE_MS = 350
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
 * `AvatarMesh` réutilise des matériaux **mis en cache et partagés** par couleur (joueur local,
 * écran de personnalisation, et tous les pairs de même teinte), y compris la texture d'ombre : y
 * toucher (`opacity`/`transparent`, même sur un clone posé sur l'instance rendue) a déjà fait
 * clignoter/casser le rendu partagé d'un pair à l'autre. `group.scale` en revanche est une
 * propriété propre à CE groupe (un `THREE.Group` par pair) : la muter n'affecte jamais un autre
 * avatar. Aucune allocation ici — seul `scale.setScalar` est appelé à chaque image.
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

/**
 * Étiquette de pseudo : son matériau (`spriteMaterial`) est créé une fois par instance de
 * `<sprite>`, jamais partagé (seule la texture, mise en cache par pseudo dans `nameLabel.ts`,
 * l'est) — le fondu peut donc muter `opacity` directement dessus sans risque pour un autre pair.
 */
function NameSprite({ texture }: { texture: THREE.CanvasTexture }) {
  const materialRef = useRef<THREE.SpriteMaterial>(null)
  const startRef = useRef<number | null>(null)
  const aspect = getNameLabelAspect(texture)

  useFrame(() => {
    const material = materialRef.current
    if (!material || material.opacity >= 1) return
    if (startRef.current === null) startRef.current = performance.now()
    const elapsed = performance.now() - startRef.current
    material.opacity = Math.min(1, elapsed / FADE_MS)
  })

  return (
    <sprite position={[0, LABEL_Y, 0]} scale={[LABEL_HEIGHT * aspect, LABEL_HEIGHT, 1]}>
      <spriteMaterial ref={materialRef} map={texture} transparent depthWrite={false} opacity={0} />
    </sprite>
  )
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

  const record = getPeer(peerStore, id)
  if (!record?.avatar) return null
  const label = getNameLabelTexture(record.avatar.name)

  return (
    <group ref={groupRef}>
      <AvatarMesh config={record.avatar} moving={moving} speed={moving ? 1.4 : 0} />
      {label && <NameSprite texture={label} />}
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
