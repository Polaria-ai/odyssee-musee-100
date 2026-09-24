/**
 * Architecture, décor et portraits accrochés du musée. Propriétaire : agent monde.
 * Géométrie statique fusionnée par salle (BufferGeometryUtils), matériaux partagés, pas d'ombres
 * temps réel : voir docs/DESIGN.md et docs/ARCHITECTURE.md.
 */
import { useMemo } from 'react'
import { AdditiveBlending, DoubleSide } from 'three'
import type { CanvasTexture } from 'three'
import type { ExhibitWingId, MuseumLayout, Person } from '../types'
import { EXHIBIT_WINGS } from '../types'
import { useGame } from '../state/gameStore'
import { buildMuseumArchitecture } from './layout'
import { buildDoorArchesGeometry, buildFoliageGeometry, buildLightRaysGeometry, buildRoomGeometry } from './roomGeometry'
import { PortraitFrame } from './PortraitFrame'
import { drawBanner, drawWingPanel } from './textures'
import { worldStrings } from './strings'
import { HALL_HALF_DEPTH, HALL_HALF_WIDTH } from './constants'

const HALF_PI = Math.PI / 2

/** Architecture, décor et portraits accrochés. */
export function Museum({ layout, people }: { layout: MuseumLayout; people: Person[] }) {
  const lang = useGame((s) => s.lang)

  const architecture = useMemo(() => buildMuseumArchitecture(people), [people])
  const roomMeshes = useMemo(
    () => architecture.rooms.map(({ room, walls }) => ({ id: room.id, geometry: buildRoomGeometry(room, walls, room.id === 'hall') })),
    [architecture],
  )
  const foliageGeometry = useMemo(() => buildFoliageGeometry(architecture.decor.planters), [architecture])
  const lightRaysGeometry = useMemo(() => buildLightRaysGeometry({ x: 0, z: -1 }), [])
  // Linteau décoratif au-dessus de chaque porte ouverte, à la couleur de l'aile (mission : « arches
  // des portes »). `null` pour une répartition sans aucune aile peuplée.
  const archesGeometry = useMemo(() => buildDoorArchesGeometry(architecture.doorArches), [architecture])

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  // `drawBanner`/`drawWingPanel` mettent leurs textures en cache par langue (voir textures.ts) : pas
  // de dispose() à faire ici, ni de risque de le faire deux fois (le double rendu des effets de
  // React.StrictMode en dev disposerait une texture encore affichée si on le faisait naïvement).
  const bannerTexture = useMemo(() => drawBanner(worldStrings.bannerTitle, worldStrings.bannerSubtitle, lang), [lang])
  const wingPanels = useMemo<Array<{ wing: ExhibitWingId; texture: CanvasTexture }>>(() => {
    const panels: Array<{ wing: ExhibitWingId; texture: CanvasTexture }> = []
    for (const wing of EXHIBIT_WINGS) {
      const room = layout.rooms.find((r) => r.id === wing)
      if (room) panels.push({ wing, texture: drawWingPanel(room.label, room.accentColor, lang) })
    }
    return panels
  }, [layout, lang])

  return (
    <group>
      {roomMeshes.map((r) => (
        <mesh key={r.id} geometry={r.geometry} receiveShadow={false} castShadow={false}>
          <meshLambertMaterial vertexColors />
        </mesh>
      ))}

      <mesh geometry={foliageGeometry}>
        <meshLambertMaterial vertexColors />
      </mesh>

      {/* Rayons de lumière du hall : fins, hauts (près du plafond) et discrets — une suggestion de
          verrière, jamais un aplat qui recouvre la bannière ou le décor (voir roomGeometry.ts). */}
      <mesh geometry={lightRaysGeometry}>
        <meshBasicMaterial vertexColors transparent opacity={0.07} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
      </mesh>

      {archesGeometry && (
        <mesh geometry={archesGeometry}>
          <meshLambertMaterial vertexColors />
        </mesh>
      )}

      {/* Bannière d'accueil, au-dessus du comptoir de Minerve — à l'écart des panneaux de porte. */}
      <mesh position={[0, 3.7, -6.2]}>
        <planeGeometry args={[3.6, 1.1]} />
        <meshBasicMaterial map={bannerTexture} toneMapped={false} transparent />
      </mesh>

      {wingPanels.map(({ wing, texture }) => (
        <mesh key={wing} position={doorPanelPosition(wing)} rotation-y={doorPanelRotation(wing)}>
          <planeGeometry args={[1.9, 0.7]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      ))}

      {layout.frames.map((frame) => {
        const person = peopleById.get(frame.personId)
        return person ? <PortraitFrame key={frame.personId} frame={frame} person={person} /> : null
      })}
    </group>
  )
}

function doorPanelPosition(wing: ExhibitWingId): [number, number, number] {
  switch (wing) {
    case 'infrastructures':
      return [-HALL_HALF_WIDTH + 0.06, 3.3, 0]
    case 'culture':
      return [HALL_HALF_WIDTH - 0.06, 3.3, 0]
    case 'industrialisation':
    default:
      return [0, 3.3, -HALL_HALF_DEPTH + 0.06]
  }
}

function doorPanelRotation(wing: ExhibitWingId): number {
  switch (wing) {
    case 'infrastructures':
      return HALF_PI
    case 'culture':
      return -HALF_PI
    case 'industrialisation':
    default:
      return 0
  }
}
