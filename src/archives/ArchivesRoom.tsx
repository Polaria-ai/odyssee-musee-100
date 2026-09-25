// STUB — propriétaire : workflow « Archives de 2040 ».
import type { ArchivesLayout } from '../types'

/** Salle des Archives, vitrines, Porte de 2040 (hall et retour), hologramme de l'Archiviste. Dans le Canvas. */
export function ArchivesRoom({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2]}>
      <planeGeometry args={[b.maxX - b.minX, b.maxZ - b.minZ]} />
      <meshLambertMaterial color={archives.room.floorColor} />
    </mesh>
  )
}
