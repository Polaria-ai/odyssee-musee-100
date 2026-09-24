/**
 * Minerve, la chouette conservatrice — personnage original, derrière son comptoir.
 * Géométries et matériaux partagés (créés une seule fois, au chargement du module) ;
 * aucune allocation d'objet three.js dans useFrame (seuls des nombres sont écrits).
 * Propriétaire : agent npc.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Placement } from '../types'
import { useGame } from '../state/gameStore'
import { player as runtimePlayer } from '../state/runtime'
import { palette } from '../styles/tokens'

type Mood = 'neutral' | 'happy' | 'surprised' | 'thinking'

// --- Réglages ---------------------------------------------------------------
/** Hauteur du perchoir (comptoir + tabouret construits par le module monde). */
const BASE_Y = 0.9
const HEAD_MAX_TURN = Math.PI / 3 // ±60°
const BLINK_DURATION = 0.12
const BLINK_MIN = 3
const BLINK_RANGE = 3
const BUBBLE_BASE_Y = 2.25

// --- Géométries partagées (une seule instance, réutilisée par tous les meshes) ---
const geo = {
  bodyCore: new THREE.SphereGeometry(0.4, 14, 10),
  belly: new THREE.SphereGeometry(0.3, 12, 9),
  head: new THREE.SphereGeometry(0.3, 14, 10),
  tuft: new THREE.ConeGeometry(0.035, 0.15, 6),
  eyeWhite: new THREE.SphereGeometry(0.115, 10, 8),
  pupil: new THREE.SphereGeometry(0.05, 8, 8),
  beak: new THREE.ConeGeometry(0.06, 0.12, 8),
  wing: new THREE.SphereGeometry(0.24, 10, 8),
  glassesRing: new THREE.TorusGeometry(0.12, 0.014, 8, 20),
  glassesBridge: new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6),
  scarfRing: new THREE.TorusGeometry(0.3, 0.045, 8, 20),
  scarfFlap: new THREE.BoxGeometry(0.1, 0.3, 0.02),
  notebook: new THREE.BoxGeometry(0.16, 0.02, 0.22),
  bubble: new THREE.PlaneGeometry(0.52, 0.4),
}

// --- Matériaux partagés (Lambert uniquement, pas d'ombres temps réel) -----------
// Gris-lilas pâle, distinct du conservateur du jeu d'inspiration (pas de gilet vert).
const OWL_PLUMAGE = '#c9bfe3'
const mat = {
  plumage: new THREE.MeshLambertMaterial({ color: OWL_PLUMAGE }),
  belly: new THREE.MeshLambertMaterial({ color: palette.cream }),
  eyeWhite: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  pupil: new THREE.MeshLambertMaterial({ color: palette.shadow }),
  beak: new THREE.MeshLambertMaterial({ color: palette.gold }),
  glasses: new THREE.MeshLambertMaterial({ color: palette.ink }),
  scarf: new THREE.MeshLambertMaterial({ color: palette.gold }),
  notebook: new THREE.MeshLambertMaterial({ color: palette.wood }),
}

let bubbleMaterialCache: THREE.MeshLambertMaterial | null = null

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Petite bulle « … » dessinée sur un canvas 2D (pas de police CDN, pas de <Html>). Mise en cache. */
function getBubbleMaterial(): THREE.MeshLambertMaterial {
  if (bubbleMaterialCache) return bubbleMaterialCache
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 100
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    roundRect(ctx, 6, 6, 116, 58, 20)
    ctx.fillStyle = palette.cream
    ctx.fill()
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 4
    roundRect(ctx, 6, 6, 116, 58, 20)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(52, 62)
    ctx.lineTo(64, 92)
    ctx.lineTo(76, 62)
    ctx.closePath()
    ctx.fillStyle = palette.cream
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = palette.ink
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(38 + i * 26, 35, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  bubbleMaterialCache = new THREE.MeshLambertMaterial({ map: texture, transparent: true, depthWrite: false })
  return bubbleMaterialCache
}

function wrapAngle(a: number): number {
  return (((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
}

/** PRNG déterministe (pas de Math.random) : même séquence de clignements à chaque partie. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface BlinkState {
  blinking: boolean
  /** Instant (s, horloge de la scène) du prochain clignement. -1 = pas encore programmé. */
  next: number
  end: number
}

/**
 * La chouette conservatrice, derrière son comptoir dans le hall.
 * Posée à `placement.position`, surélevée comme perchée sur un tabouret, regarde
 * vers +Z tourné de `placement.rotationY`.
 */
export function Minerve({ placement }: { placement: Placement }) {
  const dialogue = useGame((s) => s.dialogue)
  const dialogueIndex = useGame((s) => s.dialogueIndex)
  const nearCurator = useGame((s) => s.nearCurator)

  const dialogueOpen = dialogue !== null
  const mood: Mood = dialogue ? (dialogue.lines[dialogueIndex]?.mood ?? 'neutral') : 'neutral'
  const showBubble = nearCurator && !dialogueOpen

  const bodyRef = useRef<THREE.Group | null>(null)
  const headRef = useRef<THREE.Group | null>(null)
  const eyesRef = useRef<THREE.Group | null>(null)
  const leftWingRef = useRef<THREE.Mesh | null>(null)
  const rightWingRef = useRef<THREE.Mesh | null>(null)
  const bubbleRef = useRef<THREE.Mesh | null>(null)

  const rng = useRef(mulberry32(0x4d494e56)) // graine fixe ("MINV") : séquence reproductible
  const blink = useRef<BlinkState>({ blinking: false, next: -1, end: 0 })

  const bubbleMat = useMemo(() => getBubbleMaterial(), [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // Clignement : intervalle pseudo-aléatoire déterministe entre 3 et 6 s.
    const b = blink.current
    if (b.next < 0) b.next = t + BLINK_MIN + rng.current() * BLINK_RANGE
    if (!b.blinking && t >= b.next) {
      b.blinking = true
      b.end = t + BLINK_DURATION
    } else if (b.blinking && t >= b.end) {
      b.blinking = false
      b.next = t + BLINK_MIN + rng.current() * BLINK_RANGE
    }
    if (eyesRef.current) eyesRef.current.scale.y = b.blinking ? 0.08 : 1

    // Profil d'animation selon l'humeur de la ligne de dialogue en cours (ou repos).
    let bobAmp = 0.02
    let bobSpeed = 1.6
    let swaySpeed = 0.8
    let wingAmp = 0.03
    let wingSpeed = 1.1
    let headTiltTarget = 0
    let headScaleTarget = 1
    if (mood === 'happy') {
      bobAmp = 0.1
      bobSpeed = 5.2
      wingAmp = 0.4
      wingSpeed = 7
    } else if (mood === 'thinking') {
      swaySpeed = 0.35
      headTiltTarget = 0.14
      wingAmp = 0.015
    } else if (mood === 'surprised') {
      headScaleTarget = 1.08
      wingAmp = 0.15
      wingSpeed = 3
    }

    if (bodyRef.current) {
      bodyRef.current.position.y = BASE_Y + Math.sin(t * bobSpeed) * bobAmp
      bodyRef.current.rotation.z = Math.sin(t * swaySpeed) * 0.035
    }
    if (leftWingRef.current) leftWingRef.current.rotation.z = 0.12 + Math.sin(t * wingSpeed) * wingAmp
    if (rightWingRef.current) rightWingRef.current.rotation.z = -0.12 - Math.sin(t * wingSpeed) * wingAmp

    // Tête : tourne vers le joueur (état chaud `runtime.player`), bornée à ±60°.
    const dx = runtimePlayer.x - placement.position.x
    const dz = runtimePlayer.z - placement.position.z
    let turn = wrapAngle(Math.atan2(dx, dz) - placement.rotationY)
    if (turn > HEAD_MAX_TURN) turn = HEAD_MAX_TURN
    else if (turn < -HEAD_MAX_TURN) turn = -HEAD_MAX_TURN
    if (headRef.current) {
      const h = headRef.current
      h.rotation.y += (turn - h.rotation.y) * Math.min(1, delta * 4)
      h.rotation.x += (headTiltTarget - h.rotation.x) * Math.min(1, delta * 3)
      h.scale.setScalar(h.scale.x + (headScaleTarget - h.scale.x) * Math.min(1, delta * 5))
    }

    // Bulle « … » : flotte doucement et fait toujours face à la caméra.
    if (bubbleRef.current) {
      bubbleRef.current.position.y = BUBBLE_BASE_Y + Math.sin(t * 2.2) * 0.05
      bubbleRef.current.quaternion.copy(state.camera.quaternion)
    }
  })

  return (
    <>
      <group position={[placement.position.x, 0, placement.position.z]} rotation={[0, placement.rotationY, 0]}>
        <group ref={bodyRef} position={[0, BASE_Y, 0]}>
          <mesh geometry={geo.bodyCore} material={mat.plumage} />
          <mesh geometry={geo.belly} material={mat.belly} position={[0, -0.02, 0.22]} scale={[0.8, 0.9, 0.55]} />
          <mesh ref={leftWingRef} geometry={geo.wing} material={mat.plumage} position={[-0.35, 0.05, -0.04]} scale={[0.42, 0.85, 0.5]} />
          <mesh ref={rightWingRef} geometry={geo.wing} material={mat.plumage} position={[0.35, 0.05, -0.04]} scale={[0.42, 0.85, 0.5]} />
          <mesh geometry={geo.notebook} material={mat.notebook} position={[-0.3, -0.16, 0.06]} rotation={[0, 0.2, 0]} />
          <mesh geometry={geo.scarfRing} material={mat.scarf} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={geo.scarfFlap} material={mat.scarf} position={[-0.04, 0.06, 0.27]} rotation={[0.12, 0, 0.06]} />
          <mesh
            geometry={geo.scarfFlap}
            material={mat.scarf}
            position={[0.05, 0.02, 0.26]}
            rotation={[-0.08, 0, -0.05]}
            scale={[1, 1.15, 1]}
          />

          <group ref={headRef} position={[0, 0.68, 0]}>
            <mesh geometry={geo.head} material={mat.plumage} />
            <mesh geometry={geo.tuft} material={mat.plumage} position={[-0.14, 0.27, 0.02]} rotation={[0, 0, 0.4]} />
            <mesh geometry={geo.tuft} material={mat.plumage} position={[0.14, 0.27, 0.02]} rotation={[0, 0, -0.4]} />
            <group ref={eyesRef} position={[0, 0.02, 0]}>
              <mesh geometry={geo.eyeWhite} material={mat.eyeWhite} position={[-0.13, 0, 0.23]} />
              <mesh geometry={geo.pupil} material={mat.pupil} position={[-0.13, 0, 0.31]} />
              <mesh geometry={geo.eyeWhite} material={mat.eyeWhite} position={[0.13, 0, 0.23]} />
              <mesh geometry={geo.pupil} material={mat.pupil} position={[0.13, 0, 0.31]} />
            </group>
            <mesh geometry={geo.glassesRing} material={mat.glasses} position={[-0.13, 0.02, 0.27]} />
            <mesh geometry={geo.glassesRing} material={mat.glasses} position={[0.13, 0.02, 0.27]} />
            <mesh geometry={geo.glassesBridge} material={mat.glasses} position={[0, 0.02, 0.27]} rotation={[0, 0, Math.PI / 2]} />
            <mesh geometry={geo.beak} material={mat.beak} position={[0, -0.08, 0.28]} rotation={[Math.PI / 2, 0, 0]} />
          </group>
        </group>
      </group>

      {showBubble && (
        <mesh
          ref={bubbleRef}
          geometry={geo.bubble}
          material={bubbleMat}
          position={[placement.position.x, BUBBLE_BASE_Y, placement.position.z]}
        />
      )}
    </>
  )
}
