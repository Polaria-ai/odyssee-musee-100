// STUB — propriétaire : agent joueur. Réutilisé par la présence et l'écran de personnalisation.
import type { AvatarConfig } from '../types'

export interface AvatarMeshProps {
  config: AvatarConfig
  moving?: boolean
  /** Vitesse en m/s, pour le rythme de la marche. */
  speed?: number
}

/** Petit personnage low-poly, pieds à y = 0, regarde vers +Z. */
export function AvatarMesh({ config }: AvatarMeshProps) {
  return (
    <mesh position={[0, 0.55, 0]}>
      <capsuleGeometry args={[0.3, 0.5, 4, 8]} />
      <meshLambertMaterial color={config.outfitColor} />
    </mesh>
  )
}
