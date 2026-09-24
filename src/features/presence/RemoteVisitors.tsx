/**
 * Affiche les autres visiteurs connectés, dans le Canvas. Lit `peers.ts` (hors React) : la liste
 * React des pairs montés ne change qu'à l'arrivée/départ d'un pair (`useSyncExternalStore` sur le
 * roster) ; les positions, elles, sont appliquées à chaque image via des refs directement dans
 * `useFrame`, sans `setState` — donc sans re-rendu React à 60 i/s.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
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

/**
 * Anime doucement l'opacité des matériaux du groupe à l'apparition (léger fondu).
 *
 * `AvatarMesh` réutilise des matériaux **mis en cache et partagés** par couleur (joueur local,
 * écran de personnalisation, et tous les pairs de même teinte) : on ne doit jamais toucher
 * `opacity`/`transparent` sur l'instance partagée trouvée par `traverse`, sous peine de faire
 * clignoter tous les avatars de la même couleur — y compris le sien — à chaque nouvelle arrivée. On
 * clone donc chaque matériau une fois, avant de l'animer, et on le libère (`dispose`) au démontage.
 */
function useFadeIn(groupRef: RefObject<THREE.Group | null>) {
  const materialsRef = useRef<THREE.Material[] | null>(null)
  const startRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useFrame(() => {
    if (doneRef.current) return
    const group = groupRef.current
    if (!group) return
    if (materialsRef.current === null) {
      const found: THREE.Material[] = []
      const cloneForFade = (mat: THREE.Material): THREE.Material => {
        const clone = mat.clone()
        clone.transparent = true
        clone.opacity = 0
        found.push(clone)
        return clone
      }
      group.traverse((obj) => {
        const candidate = obj as unknown as { isMesh?: boolean; material?: THREE.Material | THREE.Material[] }
        if (!candidate.isMesh || !candidate.material) return
        candidate.material = Array.isArray(candidate.material) ? candidate.material.map(cloneForFade) : cloneForFade(candidate.material)
      })
      materialsRef.current = found
      startRef.current = performance.now()
      if (found.length === 0) doneRef.current = true
      return
    }
    const elapsed = performance.now() - (startRef.current ?? 0)
    const t = Math.min(1, elapsed / FADE_MS)
    for (const mat of materialsRef.current) mat.opacity = t
    if (t >= 1) {
      doneRef.current = true
      for (const mat of materialsRef.current) mat.transparent = false
    }
  })

  useEffect(() => {
    return () => {
      if (materialsRef.current) for (const mat of materialsRef.current) mat.dispose()
    }
  }, [])
}

function NameSprite({ texture }: { texture: THREE.CanvasTexture }) {
  const aspect = getNameLabelAspect(texture)
  return (
    <sprite position={[0, LABEL_Y, 0]} scale={[LABEL_HEIGHT * aspect, LABEL_HEIGHT, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

function RemotePeerAvatar({ id }: { id: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const initial = getRenderTransform(getPeer(peerStore, id), Date.now())
  const [moving, setMoving] = useState(initial?.moving ?? false)
  useFadeIn(groupRef)

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
