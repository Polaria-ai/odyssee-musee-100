/**
 * Ambiance fixe de la salle : sol (frise chronologique), murs, quelques arches de plafond, cristaux et
 * antennes décoratives (Space Kit, voir `models.ts`). Tout est statique — les seuls éléments qui
 * changent d'état sont les vitrines (`Vitrine.tsx`) et les anneaux (`Portal.tsx`).
 *
 * Le podium de l'Archiviste n'est PAS rendu ici : `src/archives/Archivist.tsx` (autre phase de ce même
 * workflow) le construit déjà en entier (socle, hologramme, anneaux, bulle de dialogue) et détecte lui-
 * même la proximité du joueur — `ArchivesRoom.tsx` le monte directement à `archives.archivist`. Un
 * second rendu ici doublonnerait la silhouette et la détection de proximité.
 */
import { useMemo } from 'react'
import { BoxGeometry, CylinderGeometry, MeshLambertMaterial } from 'three'
import type { ArchivesLayout, EveningSession, Lang } from '../../types'
import { wingThemes } from '../../styles/tokens'
import { drawArchivesFloor, drawProvisionalBanner } from './textures'
import { ARCHIVES_MODELS } from './models'
import { DecorModel } from './DecorModel'
import { SOUTH_WALL_CUT_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from './constants'

const theme = wingThemes.archives

const PILLAR_GEO = new CylinderGeometry(0.24, 0.28, WALL_HEIGHT, 10)
const PILLAR_MATERIAL = new MeshLambertMaterial({ color: theme.trim })
const RIB_MATERIAL = new MeshLambertMaterial({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.12 })
const WALL_MATERIAL = new MeshLambertMaterial({ color: theme.wall })
const TRIM_MATERIAL = new MeshLambertMaterial({ color: theme.accent })

function hourOf(sessions: EveningSession[], sessionId: string): string {
  return sessions.find((s) => s.id === sessionId)?.startTime ?? ''
}

/** Sol de la galerie : une seule texture (frise + repères), un seul mesh. */
function Floor({ archives, sessions, lang }: { archives: ArchivesLayout; sessions: EveningSession[]; lang: Lang }) {
  const b = archives.room.bounds
  const hours = useMemo(() => archives.slots.map((s) => hourOf(sessions, s.sessionId)), [archives.slots, sessions])
  const tex = useMemo(() => drawArchivesFloor(b, archives.slots, hours, lang), [b, archives.slots, hours, lang])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2]}>
      <planeGeometry args={[b.maxX - b.minX, b.maxZ - b.minZ]} />
      <meshLambertMaterial map={tex} />
    </mesh>
  )
}

/** Les 4 murs (sud coupé bas, comme le hall : jamais rien de haut entre la caméra et le joueur). */
function Walls({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const width = b.maxX - b.minX
  const depth = b.maxZ - b.minZ
  const southGeo = useMemo(() => new BoxGeometry(width, SOUTH_WALL_CUT_HEIGHT, WALL_THICKNESS), [width])
  const northGeo = useMemo(() => new BoxGeometry(width, WALL_HEIGHT, WALL_THICKNESS), [width])
  const sideGeo = useMemo(() => new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, depth), [depth])
  return (
    <>
      <mesh geometry={southGeo} material={WALL_MATERIAL} position={[(b.minX + b.maxX) / 2, SOUTH_WALL_CUT_HEIGHT / 2, b.maxZ]} />
      <mesh geometry={northGeo} material={WALL_MATERIAL} position={[(b.minX + b.maxX) / 2, WALL_HEIGHT / 2, b.minZ]} />
      <mesh geometry={sideGeo} material={WALL_MATERIAL} position={[b.minX, WALL_HEIGHT / 2, (b.minZ + b.maxZ) / 2]} />
      <mesh geometry={sideGeo} material={WALL_MATERIAL} position={[b.maxX, WALL_HEIGHT / 2, (b.minZ + b.maxZ) / 2]} />
      {/* Bandeau lumineux au pied du mur nord, à la couleur de la salle (panneaux, voir docs/DESIGN.md). */}
      <mesh position={[(b.minX + b.maxX) / 2, 0.06, b.minZ + WALL_THICKNESS / 2 + 0.01]} material={TRIM_MATERIAL}>
        <boxGeometry args={[width - 0.6, 0.1, 0.05]} />
      </mesh>
    </>
  )
}

/** Quatre piliers d'angle (métal sombre), comme les piliers du hall mais à l'ambiance des Archives. */
function CornerPillars({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  // Tuck tight into the geometric corners (against both walls) : les vitrines sont des socles libres
  // au centre de la salle (jamais contre un mur, voir `layout.ts::buildCandidates`), donc aucun risque
  // de chevauchement ici.
  const inset = 0.3
  const corners: [number, number][] = [
    [b.minX + inset, b.minZ + inset],
    [b.maxX - inset, b.minZ + inset],
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

/** Deux arches de plafond, comme des côtes de vaisseau, purement décoratives. */
function CeilingRibs({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const width = b.maxX - b.minX
  const ribGeo = useMemo(() => new BoxGeometry(width - 1.0, 0.12, 0.16), [width])
  const zs = [b.minZ + (b.maxZ - b.minZ) * 0.32, b.minZ + (b.maxZ - b.minZ) * 0.66]
  return (
    <>
      {zs.map((z) => (
        <mesh key={z} geometry={ribGeo} material={RIB_MATERIAL} position={[(b.minX + b.maxX) / 2, WALL_HEIGHT - 0.2, z]} />
      ))}
    </>
  )
}

/** Cristaux (tiennent lieu de « plantes futuristes ») et antennes, quelques accents fixes. */
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

/** Bandeau « Programme provisoire », posé debout près de l'arrivée. */
function ProvisionalSign({ archives, lang }: { archives: ArchivesLayout; lang: Lang }) {
  const tex = useMemo(() => drawProvisionalBanner(lang), [lang])
  const a = archives.arrival.position
  return (
    <mesh position={[a.x, 1.7, a.z - 1.4]} rotation-y={Math.PI}>
      <planeGeometry args={[1.4, 0.35]} />
      <meshBasicMaterial map={tex} toneMapped={false} transparent />
    </mesh>
  )
}

export function RoomShell({ archives, sessions, lang }: { archives: ArchivesLayout; sessions: EveningSession[]; lang: Lang }) {
  return (
    <>
      <Floor archives={archives} sessions={sessions} lang={lang} />
      <Walls archives={archives} />
      <CornerPillars archives={archives} />
      <CeilingRibs archives={archives} />
      <Accents archives={archives} />
      <ProvisionalSign archives={archives} lang={lang} />
    </>
  )
}
