/**
 * Une vitrine d'archive : socle + capsule holographique (géométrie procédurale partagée, comme
 * `PortraitFrame.tsx`/`StampStations.tsx` — un modèle CC0 par vitrine dépasserait largement le budget
 * de dessin pour les vitrines de tables rondes, voir `room/models.ts`). Écran = texture canvas unique
 * (titre + heure + pictogramme, voir `room/textures.ts`); le texte intégral s'ouvre dans la fiche.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, Mesh } from 'three'
import { CylinderGeometry, IcosahedronGeometry, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry } from 'three'
import type { ArchiveSlot, EveningSession, SessionArchive } from '../../types'
import { useGame } from '../../state/gameStore'
import { player } from '../../state/runtime'
import { charter3d } from '../../styles/tokens'
import { approach, occludesPlayer, type OcclusionObstacle } from '../../world/occlusion'
import { drawCapsuleScreen, archivesBubbleTexture } from './textures'
import { CAPSULE_RADIUS, SCREEN_HEIGHT, SCREEN_WIDTH, SCREEN_Y, SOCLE_HEIGHT, SOCLE_RADIUS } from './constants'

// Géométries et matériaux partagés au niveau du module : une seule instance pour toutes les vitrines
// (jusqu'à 24), jamais recréée par instance (mobile-first, comme `StampStations.tsx`).
const SOCLE_GEO = new CylinderGeometry(SOCLE_RADIUS, SOCLE_RADIUS * 1.12, SOCLE_HEIGHT, 10)
const CAPSULE_GEO = new IcosahedronGeometry(CAPSULE_RADIUS, 1)
const SCREEN_GEO = new PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT)
const BUBBLE_GEO = new PlaneGeometry(0.32, 0.32)

// Socle clair (blanc bleuté de la charte), pas un cylindre sombre : à la vérification visuelle, les
// socles très sombres fondaient les vitrines en une masse noire compacte, surtout groupées par rangées.
// Un socle clair les rend lisibles individuellement sur le sol bleu (9,4:1) et laisse la capsule
// (cyan en attente, corail une fois archivée) porter le signal de couleur de chaque vitrine.
const vitrineCharter = charter3d.archives.vitrine
const SOCLE_MATERIAL = new MeshLambertMaterial({ color: vitrineCharter.socle, emissive: vitrineCharter.socleEmissive, emissiveIntensity: 0.04 })
const SOCLE_MATERIAL_HIGHLIGHT = new MeshLambertMaterial({ color: vitrineCharter.socleHighlight, emissive: vitrineCharter.socleHighlightEmissive, emissiveIntensity: 0.35 })
// Capsule « en attente » : cyan translucide, pulse lente (mutée UNE fois par image ci-dessous — effet
// PARTAGÉ et synchronisé entre toutes les capsules en attente, jamais un effet local par instance).
const CAPSULE_IDLE_MATERIAL = new MeshLambertMaterial({ color: vitrineCharter.capsuleIdle, emissive: vitrineCharter.capsuleIdle, emissiveIntensity: 0.5, transparent: true, opacity: 0.55 })
const CAPSULE_ARCHIVED_MATERIAL = new MeshLambertMaterial({ color: vitrineCharter.capsuleArchived, emissive: vitrineCharter.capsuleArchived, emissiveIntensity: 0.45, transparent: true, opacity: 0.75 })

/** Sommet de la vitrine posée au sol (capsule comprise), pour le test d'occultation. */
const VITRINE_TOP = SOCLE_HEIGHT + CAPSULE_RADIUS * 1.7
/** Échelle verticale d'une vitrine rétractée, et vitesse de rétraction (unités d'échelle par seconde). */
const RETRACTED_SCALE = 0.35
const RETRACT_SPEED = 4

let bubbleMaterial: MeshBasicMaterial | null = null
function sharedBubbleMaterial(): MeshBasicMaterial {
  if (!bubbleMaterial) bubbleMaterial = new MeshBasicMaterial({ map: archivesBubbleTexture(), transparent: true, toneMapped: false })
  return bubbleMaterial
}

/** Pulse lente et partagée de la capsule « en attente » (mutation d'un matériau commun, aucune allocation). */
export function pulseIdleCapsule(elapsed: number): void {
  CAPSULE_IDLE_MATERIAL.emissiveIntensity = 0.35 + Math.sin(elapsed * 1.1) * 0.18
}

export function Vitrine({ slot, session, archive }: { slot: ArchiveSlot; session: EveningSession; archive: SessionArchive | undefined }) {
  const lang = useGame((s) => s.lang)
  const highlighted = useGame((s) => s.nearbySessionId === slot.sessionId)
  const archived = Boolean(archive?.published)

  const screenTex = useMemo(() => drawCapsuleScreen(session, lang, archived), [session, lang, archived])

  // Emprise de la vitrine pour l'occultation (calculée une fois, jamais par image).
  const obstacle = useMemo<OcclusionObstacle>(() => {
    const [x, , z] = slot.position
    const r = CAPSULE_RADIUS
    return { box: { minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r }, height: VITRINE_TOP }
  }, [slot.position])

  const groupRef = useRef<Group>(null)
  const retractRef = useRef(1)
  const bubbleRef = useRef<Mesh>(null)
  useFrame(({ clock, camera }, dt) => {
    if (bubbleRef.current) bubbleRef.current.position.y = SCREEN_Y + SCREEN_HEIGHT / 2 + 0.4 + Math.sin(clock.elapsedTime * 2.4) * 0.06
    // Une vitrine qui cache le joueur se rétracte dans son socle (hologramme qui s'éteint), puis
    // revient : même principe que les cloisons estompées du musée, sans dupliquer de matériau.
    const target = occludesPlayer(obstacle, player.x, player.z, camera.position) ? RETRACTED_SCALE : 1
    retractRef.current = approach(retractRef.current, target, dt * RETRACT_SPEED)
    if (groupRef.current) groupRef.current.scale.y = retractRef.current
  })

  // Posée au sol : `slot.position[1]` (hauteur du socle) sert au repère de l'écran, pas au placement.
  return (
    <group ref={groupRef} position={[slot.position[0], 0, slot.position[2]]} rotation-y={slot.rotationY}>
      <mesh geometry={SOCLE_GEO} material={highlighted ? SOCLE_MATERIAL_HIGHLIGHT : SOCLE_MATERIAL} position={[0, SOCLE_HEIGHT / 2, 0]} />
      <mesh geometry={CAPSULE_GEO} material={archived ? CAPSULE_ARCHIVED_MATERIAL : CAPSULE_IDLE_MATERIAL} position={[0, SOCLE_HEIGHT + CAPSULE_RADIUS * 0.7, 0]} />
      <mesh geometry={SCREEN_GEO} position={[0, SCREEN_Y, CAPSULE_RADIUS * 0.55]}>
        <meshBasicMaterial map={screenTex} toneMapped={false} transparent />
      </mesh>
      {highlighted && <mesh ref={bubbleRef} geometry={BUBBLE_GEO} material={sharedBubbleMaterial()} position={[0, SCREEN_Y + SCREEN_HEIGHT / 2 + 0.4, CAPSULE_RADIUS * 0.55]} />}
    </group>
  )
}
