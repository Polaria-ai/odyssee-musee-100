// Propriétaire : agent avatar+tampons. Socles à la charte 3D du 29/09/2026 (`charter3d.stamp`, docs/CHARTE-3D.md §4.7).
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, type Group } from 'three'
import type { ExhibitWingId, MuseumLayout, Vec2 } from '../../types'
import { EXHIBIT_WINGS } from '../../types'
import { useGame } from '../../state/gameStore'
import { charter3d, wingThemes } from '../../styles/tokens'

const COLUMN_RADIUS = 0.26
const COLUMN_HEIGHT = 1.0
const STAMP_HANDLE_RADIUS = 0.11
const STAMP_HANDLE_HEIGHT = 0.34
const STAMP_BASE_RADIUS = 0.3
const STAMP_BASE_HEIGHT = 0.14
const STAMP_REST_Y = COLUMN_HEIGHT + 0.16
const SPARK_RING_RADIUS = 0.4
const SPARK_COUNT = 5

// Géométries et matériaux créés une seule fois et partagés entre tous les socles (mobile-first).
const columnGeometry = new CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS * 1.15, COLUMN_HEIGHT, 12)
const handleGeometry = new CylinderGeometry(STAMP_HANDLE_RADIUS, STAMP_HANDLE_RADIUS, STAMP_HANDLE_HEIGHT, 8)
const baseGeometry = new CylinderGeometry(STAMP_BASE_RADIUS, STAMP_BASE_RADIUS, STAMP_BASE_HEIGHT, 16)
const sparkGeometry = new SphereGeometry(0.028, 6, 6)

const { column, handle, idleInk, spark } = charter3d.stamp
const columnMaterial = new MeshLambertMaterial({ color: column })
const handleMaterial = new MeshLambertMaterial({ color: handle })
const idleInkMaterial = new MeshLambertMaterial({ color: idleInk })
const sparkMaterial = new MeshBasicMaterial({ color: spark })

const wingInkMaterials = Object.fromEntries(
  EXHIBIT_WINGS.map((wing) => [wing, new MeshLambertMaterial({ color: wingThemes[wing].accent })]),
) as Record<ExhibitWingId, MeshLambertMaterial>

const sparkOffsets = Array.from({ length: SPARK_COUNT }, (_, i) => {
  const a = (i / SPARK_COUNT) * Math.PI * 2
  return [Math.cos(a) * SPARK_RING_RADIUS, 0.05 * Math.sin(a * 2), Math.sin(a) * SPARK_RING_RADIUS] as const
})

function StampStation({ wing, position }: { wing: ExhibitWingId; position: Vec2 }) {
  const obtained = useGame((s) => Boolean(s.stamps[wing]))
  const groupRef = useRef<Group>(null)
  const stampRef = useRef<Group>(null)
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])

  // Rotation lente + léger flottement du tampon. Aucune allocation : on mute les objets existants.
  useFrame((state, delta) => {
    const group = groupRef.current
    if (group) group.rotation.y += delta * 0.35
    const stamp = stampRef.current
    if (stamp) stamp.position.y = STAMP_REST_Y + Math.sin(state.clock.elapsedTime * 1.6 + phase) * 0.03
  })

  const inkMaterial = obtained ? wingInkMaterials[wing] : idleInkMaterial

  return (
    <group ref={groupRef} position={[position.x, 0, position.z]}>
      <mesh geometry={columnGeometry} material={columnMaterial} position={[0, COLUMN_HEIGHT / 2, 0]} />
      <group ref={stampRef} position={[0, STAMP_REST_Y, 0]}>
        <mesh geometry={handleGeometry} material={handleMaterial} position={[0, STAMP_BASE_HEIGHT + STAMP_HANDLE_HEIGHT / 2, 0]} />
        <mesh geometry={baseGeometry} material={inkMaterial} position={[0, STAMP_BASE_HEIGHT / 2, 0]} />
        {obtained &&
          sparkOffsets.map((offset, i) => (
            <mesh key={i} geometry={sparkGeometry} material={sparkMaterial} position={[offset[0], STAMP_BASE_HEIGHT + offset[1], offset[2]]} />
          ))}
      </group>
    </group>
  )
}

/** Socles à tampon 3D, un par aile (voir `layout.stampStations`). */
export function StampStations({ layout }: { layout: MuseumLayout }) {
  return (
    <>
      {layout.stampStations.map((station) => (
        <StampStation key={station.wing} wing={station.wing} position={station.position} />
      ))}
    </>
  )
}
