/**
 * Plaque Polaria du hall (easter egg) : une feuille texturée de 1,8 × 0,72 m accrochée au mur nord, à
 * hauteur des yeux, côté est (voir `plateLayout.ts` pour le choix de l'emplacement). `MeshBasicMaterial`
 * texturé, comme les panneaux de porte et les cartels (`toneMapped: false` : affiché tel que peint, charte 3D
 * §1). Elle s'ouvre au tap — détection par projection plutôt que par `onClick` r3f, voir `usePlateTap.ts`.
 * Aucune allocation dans `useFrame` (il n'y en a pas).
 */
import { useMemo } from 'react'
import { useGame } from '../../state/gameStore'
import { SIGNATURE_PLATE } from './plateLayout'
import { drawSignaturePlate } from './plateTexture'
import { usePlateTap } from './usePlateTap'

export function SignaturePlate() {
  const lang = useGame((s) => s.lang)
  const texture = useMemo(() => drawSignaturePlate(lang), [lang])
  usePlateTap()

  const { position, rotationY, width, height } = SIGNATURE_PLATE
  return (
    <mesh name="signature-plate" position={position} rotation-y={rotationY}>
      <planeGeometry args={[width, height]} />
      {/* `alphaTest` découpe les coins arrondis sans transparence (pas de tri, pas de halo). */}
      <meshBasicMaterial map={texture} toneMapped={false} alphaTest={0.5} />
    </mesh>
  )
}
