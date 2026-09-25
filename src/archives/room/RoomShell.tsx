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
import { BoxGeometry, CylinderGeometry, MeshBasicMaterial, MeshLambertMaterial } from 'three'
import type { ArchivesLayout, Lang } from '../../types'
import { wingThemes, palette } from '../../styles/tokens'
import { archivesCeilingTexture, drawArchivesFloor, drawArchivistBackdrop, drawEntranceSign } from './textures'
import { ARCHIVES_MODELS } from './models'
import { DecorModel } from './DecorModel'
import { CEILING_HEIGHT, NORTH_WALL_HEIGHT, SIDE_WALL_HEIGHT, SOUTH_WALL_CUT_HEIGHT, WALL_HEIGHT, WALL_THICKNESS } from './constants'

const theme = wingThemes.archives

const PILLAR_GEO = new CylinderGeometry(0.24, 0.28, WALL_HEIGHT, 10)
const PILLAR_MATERIAL = new MeshLambertMaterial({ color: theme.trim })
const RIB_MATERIAL = new MeshLambertMaterial({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.12 })
const WALL_MATERIAL = new MeshLambertMaterial({ color: theme.wall })
const TRIM_MATERIAL = new MeshLambertMaterial({ color: theme.accent })
const CEILING_MATERIAL = new MeshBasicMaterial({ map: archivesCeilingTexture(), toneMapped: false })
// Colonne lumineuse (flanque l'Archiviste) : une seule géométrie/matériau partagés pour les deux
// instances, comme le reste du module.
const LIGHT_COLUMN_GEO = new CylinderGeometry(0.1, 0.13, NORTH_WALL_HEIGHT - 0.6, 10)
const LIGHT_COLUMN_MATERIAL = new MeshLambertMaterial({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.5 })
const LIGHT_COLUMN_CAP_GEO = new CylinderGeometry(0.16, 0.16, 0.08, 10)
const LIGHT_COLUMN_CAP_MATERIAL = new MeshLambertMaterial({ color: palette.gold, emissive: palette.gold, emissiveIntensity: 0.6 })
// Banc bas (une seule boîte, mobile-first) : bois clair, à la couleur du hall pour ancrer le lien
// avec le reste du musée (« 2040 mais cosy »).
const BENCH_GEO = new BoxGeometry(1.3, 0.32, 0.44)
const BENCH_MATERIAL = new MeshLambertMaterial({ color: palette.wood })
// Plaque murale (panneau) : une seule géométrie/matériau réutilisés le long des murs latéraux.
const WALL_PANEL_GEO = new BoxGeometry(0.06, 2.2, 1.5)
const WALL_PANEL_MATERIAL = new MeshLambertMaterial({ color: palette.paper, emissive: theme.accent, emissiveIntensity: 0.05 })

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

/** Plafond : voûte sombre et douce qui ferme la vue vers le haut (voir constants.ts::CEILING_HEIGHT :
 * la caméra fixe, assez reculée et surélevée, cadrerait sinon une bonne partie du ciel de fond). */
function Ceiling({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  return (
    <mesh rotation-x={Math.PI / 2} position={[(b.minX + b.maxX) / 2, CEILING_HEIGHT, (b.minZ + b.maxZ) / 2]} material={CEILING_MATERIAL}>
      <planeGeometry args={[b.maxX - b.minX + 1, b.maxZ - b.minZ + 1]} />
    </mesh>
  )
}

/** Les 4 murs (sud coupé bas, comme le hall : jamais rien de haut entre la caméra et le joueur). Les
 * murs latéraux et le mur nord (derrière l'Archiviste) montent nettement plus haut que
 * `WALL_HEIGHT` (piliers décoratifs) : voir `constants.ts::SIDE_WALL_HEIGHT` / `NORTH_WALL_HEIGHT`
 * pour le calcul (fermer le champ de vision de la caméra fixe au plus près des vitrines/de
 * l'Archiviste). Le plafond (`Ceiling`) monte au moins aussi haut que les deux. */
function Walls({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const width = b.maxX - b.minX
  const depth = b.maxZ - b.minZ
  const southGeo = useMemo(() => new BoxGeometry(width, SOUTH_WALL_CUT_HEIGHT, WALL_THICKNESS), [width])
  const northGeo = useMemo(() => new BoxGeometry(width, NORTH_WALL_HEIGHT, WALL_THICKNESS), [width])
  const sideGeo = useMemo(() => new BoxGeometry(WALL_THICKNESS, SIDE_WALL_HEIGHT, depth), [depth])
  return (
    <>
      <mesh geometry={southGeo} material={WALL_MATERIAL} position={[(b.minX + b.maxX) / 2, SOUTH_WALL_CUT_HEIGHT / 2, b.maxZ]} />
      <mesh geometry={northGeo} material={WALL_MATERIAL} position={[(b.minX + b.maxX) / 2, NORTH_WALL_HEIGHT / 2, b.minZ]} />
      <mesh geometry={sideGeo} material={WALL_MATERIAL} position={[b.minX, SIDE_WALL_HEIGHT / 2, (b.minZ + b.maxZ) / 2]} />
      <mesh geometry={sideGeo} material={WALL_MATERIAL} position={[b.maxX, SIDE_WALL_HEIGHT / 2, (b.minZ + b.maxZ) / 2]} />
      {/* Bandeau lumineux au pied du mur nord, à la couleur de la salle (panneaux, voir docs/DESIGN.md). */}
      <mesh position={[(b.minX + b.maxX) / 2, 0.06, b.minZ + WALL_THICKNESS / 2 + 0.01]} material={TRIM_MATERIAL}>
        <boxGeometry args={[width - 0.6, 0.1, 0.05]} />
      </mesh>
    </>
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

/** Deux arches de plafond, comme des côtes de vaisseau, purement décoratives : accrochées juste sous
 * le plafond (`CEILING_HEIGHT`, pas `WALL_HEIGHT` qui n'est que la hauteur des piliers d'angle) pour
 * rester visuellement des arches DE PLAFOND quelle que soit la hauteur de ce dernier. */
function CeilingRibs({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const width = b.maxX - b.minX
  const ribGeo = useMemo(() => new BoxGeometry(width - 1.0, 0.12, 0.16), [width])
  const zs = [b.minZ + (b.maxZ - b.minZ) * 0.32, b.minZ + (b.maxZ - b.minZ) * 0.66]
  return (
    <>
      {zs.map((z) => (
        <mesh key={z} geometry={ribGeo} material={RIB_MATERIAL} position={[(b.minX + b.maxX) / 2, CEILING_HEIGHT - 0.2, z]} />
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

/** Grand panneau d'entrée (titre + date + mention provisoire), bien en vue depuis l'arrivée — comme
 * la grande bannière du hall (docs/DESIGN.md). Remplace l'ancien petit bandeau isolé. */
function EntranceSign({ archives, lang }: { archives: ArchivesLayout; lang: Lang }) {
  const tex = useMemo(() => drawEntranceSign(lang), [lang])
  const a = archives.arrival.position
  // Pas de rotation : le plan par défaut fait face à +Z, exactement le côté d'où le joueur
  // regarde (caméra fixe vers −Z, voir docs/DESIGN.md) — un `rotation-y={Math.PI}` ici tournerait
  // le panneau dos à la caméra (constat de vérification visuelle : c'était le bug de l'ancien
  // `ProvisionalSign`, invisible depuis l'arrivée ; comparer aux panneaux de la Porte de 2040 dans
  // `Portal.tsx`, qui n'appliquent eux-mêmes aucune rotation sur le plan du panneau).
  return (
    <mesh position={[a.x, 2.05, a.z - 2.2]}>
      <planeGeometry args={[2.6, 0.9]} />
      <meshBasicMaterial map={tex} toneMapped={false} transparent />
    </mesh>
  )
}

/** Deux bancs bas contre les murs latéraux, près de l'arrivée : un peu de mobilier « musée cosy »,
 * hors du chemin de marche (les colonnes de vitrines s'arrêtent à `ROW_X_OFFSETS`, voir constants.ts). */
function Benches({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const z = b.maxZ - 3.6
  return (
    <>
      <mesh geometry={BENCH_GEO} material={BENCH_MATERIAL} position={[b.minX + 1.0, 0.16, z]} rotation-y={Math.PI / 2} />
      <mesh geometry={BENCH_GEO} material={BENCH_MATERIAL} position={[b.maxX - 1.0, 0.16, z]} rotation-y={Math.PI / 2} />
    </>
  )
}

/** Halo derrière l'Archiviste et deux colonnes lumineuses qui l'encadrent : la vue « fond de salle »
 * (vérification visuelle) montrait un mur nu très en retrait de l'hologramme, avec beaucoup de vide. */
function ArchivistSurround({ archives }: { archives: ArchivesLayout }) {
  const b = archives.room.bounds
  const p = archives.archivist.position
  const backdropTex = useMemo(() => drawArchivistBackdrop(), [])
  const columnZ = b.minZ + 0.5
  return (
    <>
      {/* Pas de rotation non plus ici (même remarque que `EntranceSign`) : le plan par défaut fait déjà
          face à +Z, vers la caméra. */}
      <mesh position={[p.x, 2.2, b.minZ + WALL_THICKNESS / 2 + 0.03]}>
        <planeGeometry args={[3.6, 3.6]} />
        <meshBasicMaterial map={backdropTex} toneMapped={false} transparent depthWrite={false} />
      </mesh>
      <mesh geometry={LIGHT_COLUMN_GEO} material={LIGHT_COLUMN_MATERIAL} position={[p.x - 1.9, (NORTH_WALL_HEIGHT - 0.6) / 2, columnZ]} />
      <mesh geometry={LIGHT_COLUMN_GEO} material={LIGHT_COLUMN_MATERIAL} position={[p.x + 1.9, (NORTH_WALL_HEIGHT - 0.6) / 2, columnZ]} />
      <mesh geometry={LIGHT_COLUMN_CAP_GEO} material={LIGHT_COLUMN_CAP_MATERIAL} position={[p.x - 1.9, NORTH_WALL_HEIGHT - 0.64, columnZ]} />
      <mesh geometry={LIGHT_COLUMN_CAP_GEO} material={LIGHT_COLUMN_CAP_MATERIAL} position={[p.x + 1.9, NORTH_WALL_HEIGHT - 0.64, columnZ]} />
    </>
  )
}

export function RoomShell({ archives, lang }: { archives: ArchivesLayout; lang: Lang }) {
  return (
    <>
      <Floor archives={archives} lang={lang} />
      <Ceiling archives={archives} />
      <Walls archives={archives} />
      <WallPanels archives={archives} />
      <CornerPillars archives={archives} />
      <CeilingRibs archives={archives} />
      <Accents archives={archives} />
      <ArchivistSurround archives={archives} />
      <Benches archives={archives} />
      <EntranceSign archives={archives} lang={lang} />
    </>
  )
}
