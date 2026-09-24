// STUB — propriétaire : agent Minerve.
import type { Placement } from '../types'

/** La chouette conservatrice, derrière son comptoir dans le hall. */
export function Minerve({ placement }: { placement: Placement }) {
  return (
    <mesh position={[placement.position.x, 0.6, placement.position.z]}>
      <sphereGeometry args={[0.5, 12, 12]} />
      <meshLambertMaterial color="#8c6a4a" />
    </mesh>
  )
}
