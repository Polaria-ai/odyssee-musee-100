// STUB — propriétaire : agent monde.
import type { MuseumLayout, Person } from '../types'

/** Architecture, décor et portraits accrochés. */
export function Museum({ layout }: { layout: MuseumLayout; people: Person[] }) {
  const b = layout.bounds
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2]}>
      <planeGeometry args={[b.maxX - b.minX, b.maxZ - b.minZ]} />
      <meshLambertMaterial color="#d9b48a" />
    </mesh>
  )
}
