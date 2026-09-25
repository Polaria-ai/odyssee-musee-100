/**
 * La Porte de 2040 : un anneau (aller, dans le hall à `hallReservedSpots.timePortal`) et sa porte de
 * retour (dans la salle). Rendu ici uniquement — le fondu et la téléportation appartiennent au module
 * interface (`PortalFade.tsx`, contrat : `store.portalTransition`). Ce fichier ne fait QUE détecter le
 * passage (le joueur entre dans l'anneau) et poser `portalTransition` ; il ne déplace jamais le joueur.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferGeometry, CanvasTexture, Float32BufferAttribute, Points, PointsMaterial, MeshBasicMaterial, RingGeometry, SRGBColorSpace } from 'three'
import type { ArchivesLayout, Lang, Placement } from '../../types'
import { isOverlayOpen, useGame } from '../../state/gameStore'
import { player } from '../../state/runtime'
import { wingThemes } from '../../styles/tokens'
import { drawGateSign } from './textures'
import { ARCHIVES_MODELS } from './models'
import { DecorModel } from './DecorModel'
import { PORTAL_RING_RADIUS, PORTAL_TRIGGER_LOCK_SECONDS, PORTAL_TRIGGER_RADIUS } from './constants'

const RING_SCALE = (PORTAL_RING_RADIUS * 2) / 1.3 // le modèle brut mesure ≈ 1,3 m de haut (voir docs/assets/archives.md)
const RING_TINT = wingThemes.archives.accent

// Particules légères autour de l'anneau : une seule géométrie/matériau partagés par les deux portes.
const PARTICLE_COUNT = 22
const particleGeometry = new BufferGeometry()
{
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const a = (i / PARTICLE_COUNT) * Math.PI * 2
    const wobble = 0.12 * Math.sin(i * 2.3)
    positions[i * 3] = Math.cos(a) * (PORTAL_RING_RADIUS + wobble)
    positions[i * 3 + 1] = 1.0 + 0.5 * Math.sin(a * 2)
    positions[i * 3 + 2] = Math.sin(a) * (PORTAL_RING_RADIUS + wobble)
  }
  particleGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
}
const particleMaterial = new PointsMaterial({ color: RING_TINT, size: 0.05, transparent: true, opacity: 0.85, sizeAttenuation: true })

// Flaque de lumière au sol, sous chaque anneau : « bien posée », pas juste un anneau flottant sans
// ancrage — un seul dégradé radial partagé par les deux portes (aller et retour).
let groundGlowTexture: CanvasTexture | null = null
function sharedGroundGlow(): CanvasTexture {
  if (groundGlowTexture) return groundGlowTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(127, 214, 232, 0.55)')
    g.addColorStop(0.7, 'rgba(127, 214, 232, 0.18)')
    g.addColorStop(1, 'rgba(127, 214, 232, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  groundGlowTexture = new CanvasTexture(canvas)
  groundGlowTexture.colorSpace = SRGBColorSpace
  groundGlowTexture.needsUpdate = true
  return groundGlowTexture
}
const groundGlowGeometry = new RingGeometry(0, PORTAL_RING_RADIUS * 1.6, 24)
const groundGlowMaterial = new MeshBasicMaterial({ map: sharedGroundGlow(), transparent: true, toneMapped: false, depthWrite: false })

function PortalRing({ placement, subtitleKey, lang }: { placement: Placement; subtitleKey: 'toArchives' | 'toHall'; lang: Lang }) {
  const signTex = useMemo(() => drawGateSign(subtitleKey, lang), [subtitleKey, lang])
  const particlesRef = useRef<Points>(null)
  useFrame((_state, delta) => {
    if (particlesRef.current) particlesRef.current.rotation.y += delta * 0.25
  })
  return (
    <group position={[placement.position.x, 0, placement.position.z]} rotation-y={placement.rotationY}>
      <mesh geometry={groundGlowGeometry} material={groundGlowMaterial} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} />
      <DecorModel path={ARCHIVES_MODELS.portalRing} tint={RING_TINT} position={[0, 0, 0]} scale={RING_SCALE} />
      <points ref={particlesRef} geometry={particleGeometry} material={particleMaterial} />
      <mesh position={[0, 2.5, 0.55]}>
        <planeGeometry args={[1.0, 0.5]} />
        <meshBasicMaterial map={signTex} toneMapped={false} transparent />
      </mesh>
    </group>
  )
}

/**
 * Détecte le passage du joueur dans l'un des deux anneaux et pose `portalTransition` (verrou anti-
 * rebond `PORTAL_TRIGGER_LOCK_SECONDS`, jamais si une surimpression est ouverte ou un passage est déjà
 * en cours). Ne téléporte jamais elle-même : voir `PortalFade.tsx`.
 */
function usePortalTriggers(archives: ArchivesLayout) {
  const lockUntilRef = useRef(0)
  useFrame(({ clock }) => {
    const state = useGame.getState()
    if (state.screen !== 'play') return
    if (state.portalTransition !== null) return
    if (clock.elapsedTime < lockUntilRef.current) return
    if (isOverlayOpen(state)) return

    const dHall = Math.hypot(player.x - archives.hallPortal.position.x, player.z - archives.hallPortal.position.z)
    if (dHall <= PORTAL_TRIGGER_RADIUS) {
      state.setPortalTransition('to-archives')
      lockUntilRef.current = clock.elapsedTime + PORTAL_TRIGGER_LOCK_SECONDS
      return
    }
    const dReturn = Math.hypot(player.x - archives.returnPortal.position.x, player.z - archives.returnPortal.position.z)
    if (dReturn <= PORTAL_TRIGGER_RADIUS) {
      state.setPortalTransition('to-hall')
      lockUntilRef.current = clock.elapsedTime + PORTAL_TRIGGER_LOCK_SECONDS
    }
  })
}

/** Les deux anneaux (aller dans le hall, retour dans la salle) + la détection de passage. */
export function ArchivesPortals({ archives }: { archives: ArchivesLayout }) {
  const lang = useGame((s) => s.lang)
  usePortalTriggers(archives)
  return (
    <>
      <PortalRing placement={archives.hallPortal} subtitleKey="toArchives" lang={lang} />
      <PortalRing placement={archives.returnPortal} subtitleKey="toHall" lang={lang} />
    </>
  )
}
