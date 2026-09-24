/** Caméra qui tourne doucement au-dessus du hall pendant l'écran titre. Propriétaire : intégration. */
import { useFrame } from '@react-three/fiber'
import type { MuseumLayout } from '../types'

export function AttractCamera({ layout }: { layout: MuseumLayout }) {
  const hall = layout.rooms.find((r) => r.id === 'hall') ?? layout.rooms[0]
  const cx = (hall.bounds.minX + hall.bounds.maxX) / 2
  const cz = (hall.bounds.minZ + hall.bounds.maxZ) / 2
  useFrame(({ camera, clock }) => {
    const a = clock.elapsedTime * 0.08
    camera.position.set(cx + Math.sin(a) * 13, 10, cz + Math.cos(a) * 13)
    camera.lookAt(cx, 1.2, cz)
  })
  return null
}
