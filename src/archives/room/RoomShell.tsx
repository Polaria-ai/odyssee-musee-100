/**
 * Ambiance fixe de la salle : sol (frise chronologique), murs, seuil lumineux de la porte, pupitre
 * d'entrée, cristaux et antennes décoratives (Space Kit, voir `models.ts`). Tout est statique — les
 * seuls éléments qui changent d'état sont les vitrines (`Vitrine.tsx`).
 *
 * Plan en croix (WEL-888) : la salle est accrochée au sud du hall. Son mur nord n'est PAS rendu ici :
 * c'est le mur sud du hall (coupé bas, percé de la porte), dessiné par `src/world/Museum.tsx`. Rien de
 * haut près de ce mur : la caméra, toujours au sud du joueur, survole la salle quand le joueur est
 * dans le hall.
 *
 * Le podium de l'Archiviste n'est PAS rendu ici : `src/archives/Archivist.tsx` le construit en entier
 * (socle, hologramme, anneaux, bulle de dialogue) et détecte lui-même la proximité du joueur.
 */
import { useMemo } from 'react'
import { BoxGeometry, CylinderGeometry, MeshLambertMaterial } from 'three'
import type { ArchivesLayout, Lang } from '../../types'
import { wingThemes, palette } from '../../styles/tokens'
import { ENTRANCE_LECTERN } from '../layout'
import { drawArchivesFloor, drawEntranceSign } from './textures'
import { ARCHIVES_MODELS } from './models'
import { DecorModel } from './DecorModel'
import { SOUTH_WALL_CUT_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from './constants'

const theme = wingThemes.archives

const PILLAR_GEO = new CylinderGeometry(0.24, 0.28, WALL_HEIGHT, 10)
const PILLAR_MATERIAL = new MeshLambertMaterial({ color: theme.trim })
const WALL_MATERIAL = new MeshLambertMaterial({ color: theme.wall })
const THRESHOLD_MATERIAL = new MeshLambertMaterial({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.55 })
// Banc bas (une seule boîte, mobile-first) : bois clair, à la couleur du hall pour ancrer le lien
// avec le reste du musée (« 2040 mais cosy »).
const BENCH_GEO = new BoxGeometry(1.3, 0.32, 0.44)
const BENCH_MATERIAL = new MeshLambertMaterial({ color: palette.wood })
// Plaque murale (panneau) : une seule géométrie/matériau réutilisés le long des murs latéraux.
const WALL_PANEL_GEO = new BoxGeometry(0.06, 2.2, 1.5)
const WALL_PANEL_MATERIAL = new MeshLambertMaterial({ color: palette.paper, emissive: theme.accent, emissiveIntensity: 0.05 })
// Pupitre du panneau d'entrée : pied bas (bois sombre du hall) + panneau incliné vers la caméra.
const LECTERN_GEO = new BoxGeometry(ENTRANCE_LECTERN.halfWidth * 2 - 0.1, 0.72, ENTRANCE_LECTERN.halfDepth * 2 - 0.1)
const LECTERN_MATERIAL = new MeshLambertMaterial({ color: palette.woodDark })
const SIGN_WIDTH = 2.2
const SIGN_HEIGHT = SIGN_WIDTH * (176 / 512)
/** Inclinaison du panneau : 60° vers l'arrière, presque face à la caméra plongeante (48°). */
const SIGN_TILT = -Math.PI / 3

/** Sol de la galerie : une seule texture (frise + repères), un seul mesh. */
function Floor({ archives, lang }: { archives: ArchivesLayout; lang: Lang }) {
  const b = archives.room.bounds
  const tex = useMemo(() => drawArchivesFloor(b, archives.slots, lang), [b, archives.slots, lang])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2]}>
      <planeGeometry args={[b.maxX - b.minX, b.maxZ - b.minZ]} />
      <meshLambertMaterial map={tex} />
    </mesh>
  )
}

/**
 * Murs est, ouest et sud (le mur nord est celui du hall, voir l'en-tête). Sud coupé bas, comme le
 * hall : jamais rien de haut entre la caméra et le joueur. Est/ouest à la hauteur d'une aile.
 */
function Walls({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const width = b.maxX - b.minX
  const depth = b.maxZ - b.minZ
  const southGeo = useMemo(() => new BoxGeometry(width, SOUTH_WALL_CUT_HEIGHT, WALL_THICKNESS), [width])
  const sideGeo = useMemo(() => new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, depth), [depth])
  return (
    <>
      <mesh geometry={southGeo} material={WALL_MATERIAL} position={[(b.minX + b.maxX) / 2, SOUTH_WALL_CUT_HEIGHT / 2, b.maxZ]} />
      <mesh geometry={sideGeo} material={WALL_MATERIAL} position={[b.minX, WALL_HEIGHT / 2, (b.minZ + b.maxZ) / 2]} />
      <mesh geometry={sideGeo} material={WALL_MATERIAL} position={[b.maxX, WALL_HEIGHT / 2, (b.minZ + b.maxZ) / 2]} />
    </>
  )
}

/** Seuil lumineux dans l'embrasure de la porte (le mur sud du hall n'a pas de linteau, voir world/layout.ts). */
function DoorThreshold({ archives }: { archives: ArchivesLayout }) {
  const d = archives.door
  return (
    <mesh position={[d.x, 0.012, d.z]} material={THRESHOLD_MATERIAL}>
      <boxGeometry args={[d.width, 0.024, WALL_THICKNESS + 0.2]} />
    </mesh>
  )
}

/** Panneaux clairs le long des murs latéraux (« murs clairs à panneaux », voir docs/DESIGN.md) : une
 * plaque crème encastrée, quelques exemplaires fixes de chaque côté — jamais un mur totalement nu. */
function WallPanels({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const zs = [b.minZ + (b.maxZ - b.minZ) * 0.28, b.minZ + (b.maxZ - b.minZ) * 0.62]
  return (
    <>
      {zs.map((z) => (
        <mesh key={`w-${z}`} geometry={WALL_PANEL_GEO} material={WALL_PANEL_MATERIAL} position={[b.minX + WALL_THICKNESS / 2 + 0.02, 1.5, z]} />
      ))}
      {zs.map((z) => (
        <mesh key={`e-${z}`} geometry={WALL_PANEL_GEO} material={WALL_PANEL_MATERIAL} position={[b.maxX - WALL_THICKNESS / 2 - 0.02, 1.5, z]} />
      ))}
    </>
  )
}

/** Deux piliers d'angle au sud (métal sombre). Pas au nord : ils se dresseraient entre la caméra et un
 * joueur longeant le mur sud du hall. */
function CornerPillars({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const inset = 0.3
  const corners: [number, number][] = [
    [b.minX + inset, b.maxZ - inset],
    [b.maxX - inset, b.maxZ - inset],
  ]
  return (
    <>
      {corners.map(([x, z]) => (
        <mesh key={`${x}-${z}`} geometry={PILLAR_GEO} material={PILLAR_MATERIAL} position={[x, WALL_HEIGHT / 2, z]} />
      ))}
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
      <DecorModel path={ARCHIVES_MODELS.crystals} tint="#8fd8e6" position={[b.minX + 1.1, 0, b.maxZ - 1.0]} scale={0.8} />
      <DecorModel path={ARCHIVES_MODELS.crystals} tint="#e8c872" position={[b.maxX - 1.1, 0, b.maxZ - 1.0]} scale={0.7} rotation={[0, Math.PI / 3, 0]} />
      <DecorModel path={ARCHIVES_MODELS.antenna} tint={theme.trim} position={[b.minX + 1.2, 0, b.minZ + 1.1]} scale={0.9} rotation={[0, Math.PI / 4, 0]} />
      <DecorModel path={ARCHIVES_MODELS.antenna} tint={theme.trim} position={[b.maxX - 1.2, 0, b.minZ + 1.1]} scale={0.9} rotation={[0, -Math.PI / 4, 0]} />
    </>
  )
}

/**
 * Panneau d'entrée (titre + date + mention provisoire) sur un pupitre bas, juste après la porte, à
 * l'ouest du passage. Incliné vers la caméra plutôt que dressé : un panneau vertical à cet endroit
 * se trouverait entre la caméra et un joueur resté dans le hall.
 */
function EntranceSign({ archives, lang }: { archives: ArchivesLayout; lang: Lang }) {
  const tex = useMemo(() => drawEntranceSign(lang), [lang])
  const x = archives.door.x + ENTRANCE_LECTERN.dx
  const z = archives.room.bounds.minZ + ENTRANCE_LECTERN.dz
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={LECTERN_GEO} material={LECTERN_MATERIAL} position={[0, 0.36, 0]} />
      <mesh position={[0, 0.72 + (SIGN_HEIGHT / 2) * Math.cos(SIGN_TILT), 0]} rotation-x={SIGN_TILT}>
        <planeGeometry args={[SIGN_WIDTH, SIGN_HEIGHT]} />
        <meshBasicMaterial map={tex} toneMapped={false} transparent />
      </mesh>
    </group>
  )
}

/** Deux bancs bas contre les murs latéraux, près de la porte : un peu de mobilier « musée cosy »,
 * hors du chemin de marche (les colonnes de vitrines s'arrêtent à `ROW_X_OFFSETS`, voir constants.ts). */
function Benches({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const z = b.minZ + 3.2
  return (
    <>
      <mesh geometry={BENCH_GEO} material={BENCH_MATERIAL} position={[b.minX + 1.0, 0.16, z]} rotation-y={Math.PI / 2} />
      <mesh geometry={BENCH_GEO} material={BENCH_MATERIAL} position={[b.maxX - 1.0, 0.16, z]} rotation-y={Math.PI / 2} />
    </>
  )
}

export function RoomShell({ archives, lang }: { archives: ArchivesLayout; lang: Lang }) {
  return (
    <>
      <Floor archives={archives} lang={lang} />
      <Walls archives={archives} />
      <DoorThreshold archives={archives} />
      <WallPanels archives={archives} />
      <CornerPillars archives={archives} />
      <Accents archives={archives} />
      <Benches archives={archives} />
      <EntranceSign archives={archives} lang={lang} />
    </>
  )
}
