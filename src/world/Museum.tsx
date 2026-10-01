/**
 * Architecture, décor et portraits accrochés du musée. Propriétaire : agent monde.
 * Géométrie statique fusionnée par salle (BufferGeometryUtils), matériaux partagés, pas d'ombres
 * temps réel : voir docs/DESIGN.md et docs/ARCHITECTURE.md.
 */
import { Suspense, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, MeshLambertMaterial } from 'three'
import type { CanvasTexture } from 'three'
import type { ExhibitWingId, MuseumLayout, Person } from '../types'
import { EXHIBIT_WINGS } from '../types'
import { useGame } from '../state/gameStore'
import { player } from '../state/runtime'
import { buildMuseumArchitecture } from './layout'
import { buildComingSoonBarrierGeometry, buildDoorArchesGeometry, buildFloorGeometry, buildLightRaysGeometry, buildOccluderGeometry, buildRoomGeometry } from './roomGeometry'
import { ROOM_FLOOR_KIND } from './floorSpec'
import { useFloorMaterials } from './useFloorMaterial'
import { occludesPlayer, approach } from './occlusion'
import { PortraitFrame, type FrameFade } from './PortraitFrame'
import { RoomProps } from './props/RoomProps'
import { drawBanner, drawComingSoonPanel, drawCuratorPlate, drawWingPanel } from './textures'
import { worldStrings } from './strings'
import { CIMAISE_FADE_OPACITY, CIMAISE_FADE_SECONDS, HALL_HALF_DEPTH, HALL_HALF_WIDTH } from './constants'
import { charter3d } from '../styles/tokens'

const HALF_PI = Math.PI / 2
// Vitesse de fondu (unités d'opacité par seconde) : parcourt tout l'écart (1 → CIMAISE_FADE_OPACITY)
// en environ `CIMAISE_FADE_SECONDS` (voir docs/l'issue occultation).
const FADE_RATE = (1 - CIMAISE_FADE_OPACITY) / CIMAISE_FADE_SECONDS

/** Architecture, décor et portraits accrochés. */
export function Museum({ layout, people }: { layout: MuseumLayout; people: Person[] }) {
  const lang = useGame((s) => s.lang)

  const architecture = useMemo(() => buildMuseumArchitecture(people), [people])
  const roomMeshes = useMemo(
    () => architecture.rooms.map(({ room, walls }) => ({ id: room.id, geometry: buildRoomGeometry(room, walls, room.id === 'hall' ? architecture.decor : undefined) })),
    [architecture],
  )
  // Sols texturés (WEL-923) : une géométrie de sol par salle, un matériau par matière (marbre, terrazzo…),
  // chargé sans bloquer l'entrée (sol uni d'abord, matière dès que les cartes sont là).
  const floorMaterials = useFloorMaterials()
  const floorMeshes = useMemo(
    () =>
      architecture.rooms.flatMap(({ room }) => {
        const geometry = buildFloorGeometry(room)
        return geometry ? [{ id: room.id, kind: ROOM_FLOOR_KIND[room.id], geometry }] : []
      }),
    [architecture],
  )
  const lightRaysGeometry = useMemo(() => buildLightRaysGeometry({ x: 0, z: -1 }), [])
  // Linteau décoratif au-dessus de chaque porte ouverte, à la couleur de l'aile (mission : « arches
  // des portes »). `null` pour une répartition sans aucune aile peuplée.
  const archesGeometry = useMemo(() => buildDoorArchesGeometry(architecture.doorArches), [architecture])

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  // --- Occultation (cimaises) : mesh séparé par cimaise (matériau propre, jamais partagé), fondu
  // vers `CIMAISE_FADE_OPACITY` quand elle se place entre la caméra réelle et le joueur (voir
  // `occlusion.ts`). `fadeStates[i]` est le même objet mutable passé aux `PortraitFrame` accrochés à
  // cette cimaise (prop `fade`) : leur cadre/toile/cartel suivent donc le même fondu sans qu'on ait à
  // mettre à jour deux fois la même valeur, et sans jamais toucher un matériau partagé par d'autres
  // cadres (voir PortraitFrame.tsx).
  const wallColorByWing = useMemo(() => new Map(architecture.rooms.map((r) => [r.room.id, r.room.wallColor])), [architecture])
  const occluderMaterials = useMemo(
    () => architecture.occluders.map(() => new MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, flatShading: true })),
    [architecture],
  )
  const occluderGeometries = useMemo(
    () => architecture.occluders.map((o) => buildOccluderGeometry(o.box, o.height, wallColorByWing.get(o.wing) ?? charter3d.rooms.hall.wall)),
    [architecture, wallColorByWing],
  )
  const fadeStates = useMemo<FrameFade[]>(() => architecture.occluders.map(() => ({ opacity: 1 })), [architecture])
  const fadeByPersonId = useMemo(() => {
    const map = new Map<string, FrameFade>()
    architecture.occluders.forEach((o, i) => {
      for (const personId of o.personIds) map.set(personId, fadeStates[i])
    })
    return map
  }, [architecture, fadeStates])

  useFrame((state, delta) => {
    const cam = state.camera.position
    for (let i = 0; i < architecture.occluders.length; i++) {
      const occ = architecture.occluders[i]
      // `occ` (Occluder) porte déjà `box`/`height` : on le passe tel quel (structurellement compatible
      // avec `OcclusionObstacle`) plutôt que d'allouer un objet littéral à chaque cimaise, chaque image.
      const target = occludesPlayer(occ, player.x, player.z, cam) ? CIMAISE_FADE_OPACITY : 1
      const st = fadeStates[i]
      st.opacity = approach(st.opacity, target, FADE_RATE * delta)
      occluderMaterials[i].opacity = st.opacity
    }
  })

  // `drawBanner`/`drawWingPanel`/`drawComingSoonPanel`/`drawCuratorPlate` mettent leurs textures en
  // cache par langue (voir textures.ts) : pas de dispose() à faire ici, ni de risque de le faire deux
  // fois (le double rendu des effets de React.StrictMode en dev disposerait une texture encore
  // affichée si on le faisait naïvement).
  const bannerTexture = useMemo(() => drawBanner(worldStrings.bannerTitle, worldStrings.bannerSubtitle, lang), [lang])
  const curatorPlateTexture = useMemo(() => drawCuratorPlate(lang), [lang])
  const comingSoonTexture = useMemo(() => drawComingSoonPanel(lang), [lang])
  const wingPanels = useMemo<Array<{ wing: ExhibitWingId; texture: CanvasTexture }>>(() => {
    const panels: Array<{ wing: ExhibitWingId; texture: CanvasTexture }> = []
    for (const wing of EXHIBIT_WINGS) {
      const room = layout.rooms.find((r) => r.id === wing)
      if (room) panels.push({ wing, texture: drawWingPanel(wing, room.label, room.accentColor, lang) })
    }
    return panels
  }, [layout, lang])
  const comingSoonBarriers = useMemo(
    () => architecture.comingSoonWings.map((wing) => ({ wing, geometry: buildComingSoonBarrierGeometry(doorPanelCenter(wing), doorPanelRotation(wing)) })),
    [architecture],
  )

  const curatorPlatePos = useMemo<[number, number, number]>(() => {
    const c = architecture.decor.counter.center
    return [c.x, 0.95 + 0.16, c.z - architecture.decor.counter.halfDepth - 0.02]
  }, [architecture])

  return (
    <group>
      {floorMeshes.map((f) => (
        <mesh key={`sol-${f.id}`} geometry={f.geometry} material={floorMaterials[f.kind]} receiveShadow={false} castShadow={false} />
      ))}

      {roomMeshes.map((r) => (
        <mesh key={r.id} geometry={r.geometry} receiveShadow={false} castShadow={false}>
          <meshLambertMaterial vertexColors flatShading />
        </mesh>
      ))}

      {/* Cimaises occultantes : mesh séparé par cloison, matériau propre (voir plus haut). */}
      {architecture.occluders.map((o, i) => (
        <mesh key={o.id} geometry={occluderGeometries[i]} material={occluderMaterials[i]} />
      ))}

      {/* Rayons de lumière du hall : fins, hauts (près du plafond) et discrets — une suggestion de
          verrière, jamais un aplat qui recouvre la bannière ou le décor (voir roomGeometry.ts). */}
      <mesh geometry={lightRaysGeometry}>
        <meshBasicMaterial vertexColors transparent opacity={0.07} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
      </mesh>

      {archesGeometry && (
        <mesh geometry={archesGeometry}>
          <meshLambertMaterial vertexColors flatShading />
        </mesh>
      )}

      {/* Bannière d'accueil, au-dessus du comptoir d'accueil — nettement au sud du panneau de porte
          de l'aile nord (Industrialisation, à x = 0 lui aussi, voir `doorPanelPosition`) : à l'ancienne
          position (z = -6,2, à seulement 2,7 m de la porte à z = -8,94) les deux se chevauchaient à
          l'écran depuis toutes les vues par défaut du hall (écran titre, spawn, arbre, comptoir — bug
          V2). Rapprochée du comptoir (centré à z ≈ -3,2, le personnage à z = -4,5) plutôt que
          collée au mur du fond : l'écart à l'écran (mesuré par projection, voir le rapport) reste
          ≥ 5 pt d'écran même depuis le point de vue le plus défavorable (spawn, le plus éloigné). */}
      <mesh position={[0, 3.2, -4]}>
        <planeGeometry args={[3.6, 1.1]} />
        <meshBasicMaterial map={bannerTexture} toneMapped={false} transparent />
      </mesh>

      {/* Plaque « Rémi Godeau · L'Opinion », posée sur le comptoir face au joueur. */}
      <mesh position={curatorPlatePos} rotation-x={-Math.PI / 2.6}>
        <planeGeometry args={[0.5, 0.16]} />
        <meshBasicMaterial map={curatorPlateTexture} toneMapped={false} />
      </mesh>

      {wingPanels.map(({ wing, texture }) => (
        <mesh key={wing} position={doorPanelPosition(wing)} rotation-y={doorPanelRotation(wing)}>
          <planeGeometry args={[1.9, 0.7]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      ))}

      {/* Ailes sans aucune personne : porte fermée, panneau « Bientôt » + cordon décoratif devant. */}
      {architecture.comingSoonWings.map((wing) => (
        <mesh key={wing} position={doorPanelPosition(wing)} rotation-y={doorPanelRotation(wing)}>
          <planeGeometry args={[1.9, 0.7]} />
          <meshBasicMaterial map={comingSoonTexture} toneMapped={false} />
        </mesh>
      ))}
      {comingSoonBarriers.map(({ wing, geometry }) => (
        <mesh key={wing} geometry={geometry}>
          <meshLambertMaterial vertexColors />
        </mesh>
      ))}

      {layout.frames.map((frame) => {
        const person = peopleById.get(frame.personId)
        return person ? <PortraitFrame key={frame.personId} frame={frame} person={person} fade={fadeByPersonId.get(frame.personId)} /> : null
      })}

      {/* Modèles 3D CC0 (bancs, jardinières, colonnes, racks…) posés sur les emplacements exposés par
          `architecture.decorPlacements` — module props, WEL-874 (voir le contrat en tête de layout.ts). */}
      <Suspense fallback={null}>
        <RoomProps architecture={architecture} layout={layout} />
      </Suspense>
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

/** Même position que `doorPanelPosition`, au sol (pour le cordon décoratif d'une aile « Bientôt »). */
function doorPanelCenter(wing: ExhibitWingId): { x: number; z: number } {
  const [x, , z] = doorPanelPosition(wing)
  return { x, z }
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
