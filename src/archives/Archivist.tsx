/**
 * L'Archiviste : hologramme abstrait de la salle des Archives de 2040 (silhouette translucide
 * cyan-dorée, anneaux orbitaux, particules, socle projecteur). Pas un visage, pas une personne
 * réelle : des formes simples qui suggèrent une présence, comme Minerve suggère une chouette.
 * Géométries et matériaux partagés (créés une seule fois, au chargement du module) ; aucune
 * allocation d'objet three.js dans `useFrame` (seuls des nombres sont écrits).
 * Propriétaire : workflow « Archives de 2040 ».
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Placement } from '../types'
import { useGame } from '../state/gameStore'
import { player as runtimePlayer } from '../state/runtime'
import { palette, wingThemes } from '../styles/tokens'
import { ARCHIVIST_NAME } from './archivistScript'
import { ARCHIVIST_TALK_RADIUS } from './room/constants'

// --- Réglages -----------------------------------------------------------------
/** Portée de détection du joueur (contrat) : identique à `store.setNearArchivist`. */
const ARCHIVIST_RADIUS = ARCHIVIST_TALK_RADIUS
const NEARBY_CHECK_INTERVAL = 0.15 // ~150 ms, comme les autres sondes de proximité du jeu
const CORE_BASE_Y = 1.35
const BUBBLE_BASE_Y = 2.55
const PARTICLE_COUNT = 8
const PARTICLE_RADIUS = 0.62

const theme = wingThemes.archives // bleu nuit doux + accent cyan (voir src/styles/tokens.ts)

// --- Géométries partagées (une seule instance : un seul Archiviste dans le jeu) ---
const geo = {
  torso: new THREE.SphereGeometry(0.3, 16, 12),
  head: new THREE.SphereGeometry(0.16, 14, 10),
  ringOuter: new THREE.TorusGeometry(0.56, 0.014, 8, 32),
  ringMid: new THREE.TorusGeometry(0.44, 0.012, 8, 28),
  ringInner: new THREE.TorusGeometry(0.34, 0.01, 6, 24),
  particle: new THREE.SphereGeometry(0.03, 6, 6),
  beam: new THREE.CylinderGeometry(0.02, 0.34, 1.55, 16, 1, true),
  plinth: new THREE.CylinderGeometry(0.5, 0.56, 0.16, 20),
  plinthRim: new THREE.TorusGeometry(0.5, 0.03, 8, 24),
  bubble: new THREE.PlaneGeometry(0.52, 0.4),
}

// --- Matériaux partagés (translucides, sans ombre temps réel) ------------------
const mat = {
  torso: new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.78, depthWrite: false }),
  head: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }),
  ring: new THREE.MeshBasicMaterial({ color: palette.gold, transparent: true, opacity: 0.85 }),
  particle: new THREE.MeshBasicMaterial({ color: palette.gold, transparent: true, opacity: 0.9 }),
  beam: new THREE.MeshBasicMaterial({
    color: theme.accent,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  plinth: new THREE.MeshLambertMaterial({ color: theme.trim }),
  plinthRim: new THREE.MeshBasicMaterial({ color: theme.accent }),
}

let bubbleMaterialCache: THREE.MeshBasicMaterial | null = null

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Petite bulle « … » (canvas 2D, pas de police CDN, pas de <Html>), mise en cache. */
function getBubbleMaterial(): THREE.MeshBasicMaterial {
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
    ctx.strokeStyle = theme.trim
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
    ctx.fillStyle = theme.trim
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(38 + i * 26, 35, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  bubbleMaterialCache = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  return bubbleMaterialCache
}

/** Position (non allouée) d'une particule en orbite autour du buste, à l'angle et la hauteur donnés. */
function particleAngleFor(index: number): number {
  return (index / PARTICLE_COUNT) * Math.PI * 2
}

/**
 * L'Archiviste, posé sur son socle projecteur. Détecte lui-même la proximité du joueur
 * (`runtime.player`, rayon `ARCHIVIST_RADIUS`) et met à jour `store.setNearArchivist` : aucun
 * autre module ne calcule encore cette distance (voir le rapport de fin de module).
 */
export function Archivist({ placement }: { placement: Placement }) {
  const dialogue = useGame((s) => s.dialogue)
  const dialogueIndex = useGame((s) => s.dialogueIndex)
  const nearArchivist = useGame((s) => s.nearArchivist)

  const dialogueOpen = dialogue !== null
  const isArchivistSpeaking = dialogueOpen && dialogue?.speaker === ARCHIVIST_NAME
  const mood = isArchivistSpeaking ? (dialogue?.lines[dialogueIndex]?.mood ?? 'neutral') : 'neutral'
  const showBubble = nearArchivist && !dialogueOpen

  const ringOuterRef = useRef<THREE.Mesh | null>(null)
  const ringMidRef = useRef<THREE.Mesh | null>(null)
  const ringInnerRef = useRef<THREE.Mesh | null>(null)
  const coreGroupRef = useRef<THREE.Group | null>(null)
  const particlesRef = useRef<THREE.Group | null>(null)
  const bubbleRef = useRef<THREE.Mesh | null>(null)
  const nearbyTimer = useRef(0)

  const bubbleMat = useMemo(() => getBubbleMaterial(), [])
  const particleIndices = useMemo(() => Array.from({ length: PARTICLE_COUNT }, (_, i) => i), [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // Scintillement : légère respiration d'opacité, plus marquée quand l'Archiviste parle ;
    // les anneaux tournent un peu plus vite sur une réplique « surprised » (humeur de la ligne).
    const talkPulse = isArchivistSpeaking ? 0.5 + 0.5 * Math.sin(t * 9) : 0
    const ringSpeedMul = mood === 'surprised' ? 1.6 : mood === 'thinking' ? 0.6 : 1
    mat.torso.opacity = 0.68 + Math.sin(t * 2.3) * 0.08 + talkPulse * 0.12
    mat.head.opacity = 0.78 + Math.sin(t * 2.3 + 0.6) * 0.06

    // Buste : léger flottement vertical et rotation lente sur lui-même.
    if (coreGroupRef.current) {
      coreGroupRef.current.position.y = CORE_BASE_Y + Math.sin(t * 1.1) * 0.05
      coreGroupRef.current.rotation.y += delta * 0.25
    }

    // Anneaux orbitaux : chacun tourne à sa vitesse et son axe pour suggérer un halo 3D.
    if (ringOuterRef.current) {
      ringOuterRef.current.rotation.x = Math.PI / 2.6
      ringOuterRef.current.rotation.z += delta * 0.3 * ringSpeedMul
    }
    if (ringMidRef.current) {
      ringMidRef.current.rotation.x = Math.PI / 3.4
      ringMidRef.current.rotation.z -= delta * 0.45 * ringSpeedMul
    }
    if (ringInnerRef.current) {
      ringInnerRef.current.rotation.x = -Math.PI / 3
      ringInnerRef.current.rotation.z += delta * 0.6 * ringSpeedMul
    }

    // Particules dorées : orbite lente autour du buste, hauteur qui ondule doucement.
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.18
      for (let i = 0; i < particlesRef.current.children.length; i++) {
        const p = particlesRef.current.children[i]
        p.position.y = 0.12 * Math.sin(t * 1.4 + i)
      }
    }

    // Bulle « … » : flotte doucement et fait toujours face à la caméra.
    if (bubbleRef.current) {
      bubbleRef.current.position.y = BUBBLE_BASE_Y + Math.sin(t * 2.2) * 0.05
      bubbleRef.current.quaternion.copy(state.camera.quaternion)
    }

    // Détection de proximité (contrat) : ~150 ms, pas chaque image.
    nearbyTimer.current += delta
    if (nearbyTimer.current >= NEARBY_CHECK_INTERVAL) {
      nearbyTimer.current = 0
      const dist = Math.hypot(runtimePlayer.x - placement.position.x, runtimePlayer.z - placement.position.z)
      useGame.getState().setNearArchivist(dist <= ARCHIVIST_RADIUS)
    }
  })

  return (
    <>
      {/* Échelle 1,35 : à la distance d'interaction, l'hologramme doit se voir d'emblée sur un téléphone. */}
      <group position={[placement.position.x, 0, placement.position.z]} rotation={[0, placement.rotationY, 0]} scale={1.35}>
        {/* Socle projecteur */}
        <mesh geometry={geo.plinth} material={mat.plinth} position={[0, 0.08, 0]} />
        <mesh geometry={geo.plinthRim} material={mat.plinthRim} position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]} />
        {/* Faisceau de projection, très translucide */}
        <mesh geometry={geo.beam} material={mat.beam} position={[0, 0.16 + 0.775, 0]} />

        {/* Buste stylisé (silhouette abstraite, sans visage) */}
        <group ref={coreGroupRef} position={[0, CORE_BASE_Y, 0]}>
          <mesh geometry={geo.torso} material={mat.torso} scale={[1, 1.3, 0.85]} />
          <mesh geometry={geo.head} material={mat.head} position={[0, 0.42, 0]} />

          {/* Anneaux orbitaux */}
          <mesh ref={ringOuterRef} geometry={geo.ringOuter} material={mat.ring} />
          <mesh ref={ringMidRef} geometry={geo.ringMid} material={mat.ring} />
          <mesh ref={ringInnerRef} geometry={geo.ringInner} material={mat.ring} />

          {/* Particules dorées en orbite */}
          <group ref={particlesRef}>
            {particleIndices.map((i) => {
              const a = particleAngleFor(i)
              return (
                <mesh
                  key={i}
                  geometry={geo.particle}
                  material={mat.particle}
                  position={[Math.cos(a) * PARTICLE_RADIUS, 0, Math.sin(a) * PARTICLE_RADIUS]}
                />
              )
            })}
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
