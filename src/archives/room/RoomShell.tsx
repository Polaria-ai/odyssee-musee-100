/**
 * Ambiance fixe de la salle : sol (frise chronologique), murs, seuil lumineux de la porte, pupitre
 * d'entrée, panneaux, piliers, cristaux et antennes décoratives (Space Kit, voir `models.ts`). Les seuls
 * éléments qui changent d'état sont les vitrines (`Vitrine.tsx`) et la hauteur des murs (ci-dessous).
 *
 * Charte 3D du 29/09/2026 (`docs/CHARTE-3D.md` §7.3) : sols et murs au bleu de la charte, lambris bleu, listel
 * blanc, corniche cyan ; mobilier blanc bleuté ; cristaux cyan vif et corail. Aucune couleur en dur ici :
 * tout vient de `charter3d` (directement ou via `geometry.ts`, qui fusionne les murs en couleurs par sommet).
 *
 * Une pièce complète (retour de Baptiste du 29/09) : murs est et ouest à la hauteur des autres salles
 * (`dims.wallHeight`), mur sud coupé côté caméra comme partout, mur nord haut. Plan en croix (WEL-888) : ce
 * mur nord est le mur SUD DU HALL (`ArchivesLayout.northWall`), que le monde ne dessine plus. Il reste coupé
 * tant que le joueur est dans le hall — la caméra, toujours au sud du joueur, le survolerait — et monte à
 * pleine hauteur, avec un linteau et le bandeau « Les Archives de 2040 » au-dessus de la porte, quand le
 * joueur entre dans la salle (`useGame.currentRoom === 'archives'`). Voir `wallRise.ts` pour la logique.
 *
 * Le podium de l'Archiviste n'est PAS rendu ici : `src/archives/Archivist.tsx` le construit en entier
 * (socle, hologramme, anneaux, bulle de dialogue) et détecte lui-même la proximité du joueur.
 */
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Mesh, MeshBasicMaterial as MeshBasicMaterialType } from 'three'
import { MeshLambertMaterial, PlaneGeometry } from 'three'
import type { ArchivesLayout, Lang } from '../../types'
import { useGame } from '../../state/gameStore'
import { player } from '../../state/runtime'
import { charter3d } from '../../styles/tokens'
import { approach, occludesPlayer, type OcclusionObstacle } from '../../world/occlusion'
import { FLOOR_SPECS, ROOM_FLOOR_KIND } from '../../world/floorSpec'
import { useFloorMaterialOver } from '../../world/useFloorMaterial'
import { ENTRANCE_LECTERN } from '../layout'
import { drawArchivesBanner, drawArchivesFloor, drawEntranceSign } from './textures'
import { ARCHIVES_MODELS } from './models'
import { DecorModel } from './DecorModel'
import { DOOR_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from './constants'
import {
  BANNER_CENTER_Y,
  BANNER_HEIGHT,
  BANNER_WIDTH,
  LECTERN_HEIGHT,
  archivesWalls,
  buildCrownGeometry,
  buildFloorGeometry,
  buildPanelGeometry,
  buildPillarGeometry,
  buildShellGeometry,
  buildUpperBodyGeometry,
} from './geometry'
import { RISE_RATE, isInArchives, northWallTarget, riseFrame, sideWallObstacles, sideWallTarget, sideWallsHidePlayer, stepRise } from './wallRise'

const charter = charter3d.archives

// Un seul matériau à couleurs par sommet pour toute la charpente de la salle (murs, mobilier, piliers).
const SHELL_MATERIAL = new MeshLambertMaterial({ vertexColors: true })
const THRESHOLD_MATERIAL = new MeshLambertMaterial({ color: charter.threshold, emissive: charter.threshold, emissiveIntensity: 0.55 })
// Écrans muraux : dalles nuit liserées de cyan (les couleurs viennent des sommets), faible émission cyan.
const PANEL_MATERIAL = new MeshLambertMaterial({ vertexColors: true, emissive: charter.panel.emissive, emissiveIntensity: charter.panel.emissiveIntensity })
const PILLAR_GEO = buildPillarGeometry()
const BANNER_GEO = new PlaneGeometry(BANNER_WIDTH, BANNER_HEIGHT)

const SIGN_WIDTH = 2.2
const SIGN_HEIGHT = SIGN_WIDTH * (176 / 512)
/** Inclinaison du panneau : 60° vers l'arrière, presque face à la caméra plongeante (48°). */
const SIGN_TILT = -Math.PI / 3

/**
 * Sol de la galerie : la frise peinte (une seule texture, un seul mesh) sur une matière de marbre (WEL-923).
 * La géométrie porte des UV en coordonnées monde, à l'échelle du marbre du hall (`FLOOR_SPECS`) : la carte
 * de détail et celle des normales les lisent telles quelles, et la frise, peinte sur 0..1 pour toute la salle,
 * est ramenée à ces UV par la transformation de sa texture (`repeat`/`offset`).
 */
function Floor({ archives, lang }: { archives: ArchivesLayout; lang: Lang }) {
  const b = archives.room.bounds
  const tex = useMemo(() => drawArchivesFloor(b, archives.slots, lang), [b, archives.slots, lang])
  const material = useFloorMaterialOver(ROOM_FLOOR_KIND.archives, tex)
  const geometry = useMemo(() => buildFloorGeometry(b), [b])
  useLayoutEffect(() => {
    const tile = FLOOR_SPECS[ROOM_FLOOR_KIND.archives].tileMeters
    const w = b.maxX - b.minX
    const d = b.maxZ - b.minZ
    // u_frise = (x − minX) / w ; v_frise = 1 − (z − minZ) / d (la rangée 0 de la frise est au nord, `paintArchivesFloor`).
    tex.repeat.set(tile / w, -tile / d)
    tex.offset.set(-b.minX / w, 1 + b.minZ / d)
  }, [tex, b])
  return <mesh geometry={geometry} material={material} />
}

/**
 * Charpente fixe : la base des quatre murs (corps jusqu'à la hauteur d'un mur coupé, plinthe, lambris,
 * listel, liseré du mur sud), les deux bancs et le pupitre. Un appel de dessin.
 */
function Shell({ archives }: { archives: ArchivesLayout }) {
  const geometry = useMemo(() => buildShellGeometry(archives), [archives])
  return <mesh geometry={geometry} material={SHELL_MATERIAL} />
}

/** Place un maillage de hauteur 1 (origine en bas) sur `[bottom, bottom + height]` ; masqué si la hauteur est nulle. */
function setSpan(mesh: Mesh | null, bottom: number, height: number) {
  if (!mesh) return
  mesh.visible = height > 1e-3
  mesh.position.y = bottom
  mesh.scale.y = Math.max(height, 1e-3)
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Parties mobiles des murs : corps supérieur et couronne (liseré d'accent sur le mur coupé, corniche sur le
 * mur haut) du mur nord et des murs latéraux, linteau et bandeau de la porte. Deux progressions amorties
 * indépendantes (voir `wallRise.ts`) : le mur nord suit la présence du joueur dans la salle ; les murs
 * latéraux restent hauts sauf s'ils cachent un joueur resté dans l'angle du hall.
 */
function RisingWalls({ archives, lang }: { archives: ArchivesLayout; lang: Lang }) {
  const walls = useMemo(() => archivesWalls(archives), [archives])
  const geo = useMemo(
    () => ({
      northBody: buildUpperBodyGeometry(walls.north),
      northCrown: buildCrownGeometry(walls.north),
      sideBody: buildUpperBodyGeometry([walls.east, walls.west]),
      sideCrown: buildCrownGeometry([walls.east, walls.west]),
      lintel: buildUpperBodyGeometry([walls.doorway]),
      lintelCrown: buildCrownGeometry([walls.doorway]),
    }),
    [walls],
  )
  const sideObstacles = useMemo<OcclusionObstacle[]>(() => sideWallObstacles(archives), [archives])
  const bannerTexture = useMemo(() => drawArchivesBanner(lang), [lang])
  const reducedMotion = useMemo(prefersReducedMotion, [])

  const northBody = useRef<Mesh>(null)
  const northCrown = useRef<Mesh>(null)
  const sideBody = useRef<Mesh>(null)
  const sideCrown = useRef<Mesh>(null)
  const lintel = useRef<Mesh>(null)
  const lintelCrown = useRef<Mesh>(null)
  const banner = useRef<Mesh>(null)
  const bannerMaterial = useRef<MeshBasicMaterialType>(null)
  // Dans la salle au chargement (accès direct, test) : le mur nord est déjà haut, sans animation.
  const rise = useRef({ north: isInArchives(useGame.getState().currentRoom) ? 1 : 0, sides: 1 })

  const applyNorth = (p: number) => {
    const f = riseFrame(p)
    setSpan(northBody.current, f.bodyBottom, f.bodyHeight)
    setSpan(northCrown.current, f.crownBottom, f.crownHeight)
    setSpan(lintel.current, DOOR_HEIGHT, f.lintelHeight)
    setSpan(lintelCrown.current, f.crownBottom, f.lintelCrownVisible ? f.crownHeight : 0)
    if (bannerMaterial.current) bannerMaterial.current.opacity = f.bannerOpacity
    if (banner.current) banner.current.visible = f.bannerOpacity > 0.01
  }
  const applySides = (p: number) => {
    const f = riseFrame(p)
    setSpan(sideBody.current, f.bodyBottom, f.bodyHeight)
    setSpan(sideCrown.current, f.crownBottom, f.crownHeight)
  }

  // État initial (et après chaque rendu : R3F peut avoir réappliqué des propriétés).
  useLayoutEffect(() => {
    applyNorth(rise.current.north)
    applySides(rise.current.sides)
  })

  useFrame(({ camera }, dt) => {
    const inArchives = isInArchives(useGame.getState().currentRoom)
    const rate = reducedMotion ? Infinity : RISE_RATE
    const north = stepRise(rise.current.north, northWallTarget(inArchives), dt, rate)
    if (north !== rise.current.north) {
      rise.current.north = north
      applyNorth(north)
    }
    const hides = !inArchives && sideWallsHidePlayer(sideObstacles, player.x, player.z, camera.position)
    const sides = stepRise(rise.current.sides, sideWallTarget(inArchives, hides), dt, rate)
    if (sides !== rise.current.sides) {
      rise.current.sides = sides
      applySides(sides)
    }
  })

  const doorX = (walls.doorway.minX + walls.doorway.maxX) / 2
  return (
    <>
      <mesh ref={northBody} geometry={geo.northBody} material={SHELL_MATERIAL} />
      <mesh ref={northCrown} geometry={geo.northCrown} material={SHELL_MATERIAL} />
      <mesh ref={sideBody} geometry={geo.sideBody} material={SHELL_MATERIAL} />
      <mesh ref={sideCrown} geometry={geo.sideCrown} material={SHELL_MATERIAL} />
      {/* Linteau au-dessus de la porte : n'existe qu'une fois le mur plus haut que la porte. */}
      <mesh ref={lintel} geometry={geo.lintel} material={SHELL_MATERIAL} />
      <mesh ref={lintelCrown} geometry={geo.lintelCrown} material={SHELL_MATERIAL} />
      {/* Bandeau « Les Archives de 2040 », face à la salle (+Z), qui apparaît quand le mur est presque haut. */}
      <mesh ref={banner} geometry={BANNER_GEO} position={[doorX, BANNER_CENTER_Y, walls.doorway.maxZ + 0.02]}>
        <meshBasicMaterial ref={bannerMaterial} map={bannerTexture} transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
    </>
  )
}

/** Seuil lumineux dans l'embrasure de la porte (la porte est percée dans le mur nord, voir `RisingWalls`). */
function DoorThreshold({ archives }: { archives: ArchivesLayout }) {
  const d = archives.door
  return (
    <mesh position={[d.x, 0.012, d.z]} material={THRESHOLD_MATERIAL}>
      <boxGeometry args={[d.width, 0.024, WALL_THICKNESS + 0.2]} />
    </mesh>
  )
}

/** Écrans sombres liserés de cyan le long des murs latéraux (« murs à panneaux », voir docs/DESIGN.md) : jamais un mur totalement nu. */
function WallPanels({ archives }: { archives: ArchivesLayout }) {
  const geometry = useMemo(() => buildPanelGeometry(archives), [archives])
  return <mesh geometry={geometry} material={PANEL_MATERIAL} />
}

/** Rayon du fût d'un pilier au pied, et échelle d'un pilier rétracté (même principe que les vitrines). */
const PILLAR_RADIUS = 0.36
const PILLAR_RETRACTED_SCALE = 0.25
const PILLAR_RETRACT_SPEED = 4

/**
 * Un pilier d'angle. Au sud, donc entre la caméra et un joueur qui longe le mur du fond : il se rétracte
 * quand il le cache, puis revient (voir `Vitrine.tsx`).
 */
function Pillar({ x, z }: { x: number; z: number }) {
  const ref = useRef<Mesh>(null)
  const scale = useRef(1)
  const obstacle = useMemo<OcclusionObstacle>(
    () => ({ box: { minX: x - PILLAR_RADIUS, maxX: x + PILLAR_RADIUS, minZ: z - PILLAR_RADIUS, maxZ: z + PILLAR_RADIUS }, height: WALL_HEIGHT }),
    [x, z],
  )
  useFrame(({ camera }, dt) => {
    const target = occludesPlayer(obstacle, player.x, player.z, camera.position) ? PILLAR_RETRACTED_SCALE : 1
    scale.current = approach(scale.current, target, dt * PILLAR_RETRACT_SPEED)
    if (ref.current) ref.current.scale.y = scale.current
  })
  return <mesh ref={ref} geometry={PILLAR_GEO} material={SHELL_MATERIAL} position={[x, 0, z]} />
}

/** Deux piliers d'angle au sud. Pas au nord : ils se dresseraient entre la caméra et un joueur longeant le mur sud du hall. */
function CornerPillars({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const inset = 0.3
  return (
    <>
      <Pillar x={b.minX + inset} z={b.maxZ - inset} />
      <Pillar x={b.maxX - inset} z={b.maxZ - inset} />
    </>
  )
}

/** Cristaux (tiennent lieu de « plantes futuristes ») et antennes, quelques accents fixes. Les
 * antennes, plus hautes, restent au nord : entre la caméra et un joueur du hall, elles passent sous
 * sa ligne de vue (≈ 2,8 m à cette distance du mur). */
function Accents({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  return (
    <>
      <DecorModel path={ARCHIVES_MODELS.crystals} tint={charter.crystals.a} position={[b.minX + 1.1, 0, b.maxZ - 1.0]} scale={0.8} />
      <DecorModel path={ARCHIVES_MODELS.crystals} tint={charter.crystals.b} position={[b.maxX - 1.1, 0, b.maxZ - 1.0]} scale={0.7} rotation={[0, Math.PI / 3, 0]} />
      <DecorModel path={ARCHIVES_MODELS.antenna} tint={charter.antenna} position={[b.minX + 1.2, 0, b.minZ + 1.1]} scale={0.9} rotation={[0, Math.PI / 4, 0]} />
      <DecorModel path={ARCHIVES_MODELS.antenna} tint={charter.antenna} position={[b.maxX - 1.2, 0, b.minZ + 1.1]} scale={0.9} rotation={[0, -Math.PI / 4, 0]} />
    </>
  )
}

/**
 * Panneau d'entrée (titre + date + mention provisoire) sur un pupitre bas (`Shell`), juste après la porte,
 * à l'ouest du passage. Incliné vers la caméra plutôt que dressé : un panneau vertical à cet endroit
 * se trouverait entre la caméra et un joueur resté dans le hall.
 */
function EntranceSign({ archives, lang }: { archives: ArchivesLayout; lang: Lang }) {
  const tex = useMemo(() => drawEntranceSign(lang), [lang])
  const x = archives.door.x + ENTRANCE_LECTERN.dx
  const z = archives.room.bounds.minZ + ENTRANCE_LECTERN.dz
  return (
    <mesh position={[x, LECTERN_HEIGHT + (SIGN_HEIGHT / 2) * Math.cos(SIGN_TILT), z]} rotation-x={SIGN_TILT}>
      <planeGeometry args={[SIGN_WIDTH, SIGN_HEIGHT]} />
      <meshBasicMaterial map={tex} toneMapped={false} transparent />
    </mesh>
  )
}

export function RoomShell({ archives, lang }: { archives: ArchivesLayout; lang: Lang }) {
  return (
    <>
      <Floor archives={archives} lang={lang} />
      <Shell archives={archives} />
      <RisingWalls archives={archives} lang={lang} />
      <DoorThreshold archives={archives} />
      <WallPanels archives={archives} />
      <CornerPillars archives={archives} />
      <Accents archives={archives} />
      <EntranceSign archives={archives} lang={lang} />
    </>
  )
}
