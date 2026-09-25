/**
 * Minerve, la chouette conservatrice — personnage original, derrière son comptoir.
 * Géométries et matériaux partagés (créés une seule fois, au chargement du module) ;
 * aucune allocation d'objet three.js dans useFrame (seuls des nombres sont écrits).
 * Plusieurs volumes qui partagent une couleur sont fusionnés en une seule BufferGeometry
 * (`mergeMinerveParts`, même technique que `src/world/roomGeometry.ts`) : le détail visuel
 * (ailes en plumes superposées, aigrettes doubles, pupilles avec reflet…) augmente sans
 * multiplier les appels de dessin — Minerve reste une seule instance, mais partage la scène
 * avec ~40 avatars au budget serré.
 * Propriétaire : agent npc.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Placement } from '../types'
import { useGame } from '../state/gameStore'
import { player as runtimePlayer } from '../state/runtime'
import { palette } from '../styles/tokens'

type Mood = 'neutral' | 'happy' | 'surprised' | 'thinking'

// --- Réglages ---------------------------------------------------------------
/** Hauteur du perchoir (comptoir + tabouret construits par le module monde, et le petit tabouret ci-dessous). */
const BASE_Y = 0.9
const HEAD_MAX_TURN = Math.PI / 3 // ±60°
const BLINK_DURATION = 0.12
const BLINK_MIN = 3
const BLINK_RANGE = 3
const BUBBLE_BASE_Y = 2.25

// --- Aides de fusion (mêmes règles que `src/world/roomGeometry.ts`) ---------------------------
// `mergeGeometries` exige des géométries toutes indexées ou toutes non-indexées : on uniformise
// systématiquement vers « non-indexé ». `paintColor` peint tous les sommets d'une géométrie d'une
// teinte unie (attribut `color`), pour fusionner des volumes de couleurs différentes sous un seul
// matériau `vertexColors: true` (jamais de géométrie reconstruite par image).
function mergeMinerveParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const uniform = parts.map((p) => (p.index ? p.toNonIndexed() : p))
  const merged = mergeGeometries(uniform, false)
  merged.computeBoundingSphere()
  return merged
}

const _minerveColor = new THREE.Color()
function paintColor(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  _minerveColor.set(hex)
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = _minerveColor.r
    colors[i * 3 + 1] = _minerveColor.g
    colors[i * 3 + 2] = _minerveColor.b
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

// --- Géométries partagées (une seule instance, réutilisée par tous les meshes) ---
const geo = {
  bodyCore: new THREE.SphereGeometry(0.4, 18, 14),
  belly: new THREE.SphereGeometry(0.3, 16, 12),
  head: new THREE.SphereGeometry(0.3, 18, 14),
  beak: new THREE.ConeGeometry(0.06, 0.12, 8),
  scarfRing: new THREE.TorusGeometry(0.3, 0.045, 8, 20),
  scarfFlap: new THREE.BoxGeometry(0.1, 0.3, 0.02),
  notebook: new THREE.BoxGeometry(0.16, 0.02, 0.22),
  bubble: new THREE.PlaneGeometry(0.52, 0.4),
}

/**
 * Aile en plumes superposées (base arrondie + deux lobes de plumes qui se chevauchent), fusionnée.
 * Gauche et droite sont deux géométries distinctes (jamais une échelle négative pour « mirroir ») :
 * inverser un seul axe d'échelle retourne le sens des triangles, et `MeshLambertMaterial` (face
 * avant uniquement) rendrait l'aile invisible ou mal éclairée du bon côté.
 */
function buildWingGeometry(mirror: 1 | -1): THREE.BufferGeometry {
  const base = new THREE.SphereGeometry(0.24, 12, 9)
  base.scale(0.42, 0.85, 0.5)
  const featherA = new THREE.SphereGeometry(0.17, 9, 7)
  featherA.scale(0.32, 0.95, 0.4)
  featherA.translate(mirror * 0.01, -0.19, -0.05)
  const featherB = new THREE.SphereGeometry(0.13, 8, 6)
  featherB.scale(0.26, 0.85, 0.32)
  featherB.translate(mirror * 0.015, -0.34, -0.09)
  return mergeMinerveParts([base, featherA, featherB])
}
const WING_LEFT_GEO = buildWingGeometry(1)
const WING_RIGHT_GEO = buildWingGeometry(-1)

/** Aigrette double (mèche principale + petite mèche compagne) pour un plumage plus fourni. */
function buildTuftGeometry(mirror: 1 | -1): THREE.BufferGeometry {
  const main = new THREE.ConeGeometry(0.035, 0.15, 6)
  main.rotateZ(mirror * 0.4)
  main.translate(mirror * -0.14, 0.27, 0.02)
  const companion = new THREE.ConeGeometry(0.022, 0.1, 6)
  companion.rotateZ(mirror * 0.65)
  companion.translate(mirror * -0.2, 0.24, 0.04)
  return mergeMinerveParts([main, companion])
}
const TUFT_LEFT_GEO = buildTuftGeometry(1)
const TUFT_RIGHT_GEO = buildTuftGeometry(-1)

/** Petites pattes griffues sous le ventre, posées sur le perchoir. */
function buildLegsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-0.13, 0.13]) {
    const leg = new THREE.CylinderGeometry(0.032, 0.036, 0.09, 8)
    leg.translate(x, -0.38, 0.02)
    parts.push(leg)
    for (const clawX of [-0.02, 0, 0.022]) {
      const claw = new THREE.ConeGeometry(0.014, 0.06, 6)
      claw.rotateX(Math.PI / 2 + 0.15)
      claw.translate(x + clawX, -0.425, 0.06)
      parts.push(claw)
    }
  }
  return mergeMinerveParts(parts)
}
const LEGS_GEO = buildLegsGeometry()

/** Petit tabouret perchoir en bois, deux tons (pieds + assise), sous Minerve — fixe, ne se balance pas avec elle. */
function buildPerchGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const seatY = 0.5
  for (const [x, z] of [
    [-0.22, -0.18],
    [0.22, -0.18],
    [-0.22, 0.14],
    [0.22, 0.14],
  ] as const) {
    const leg = new THREE.CylinderGeometry(0.028, 0.034, seatY, 8)
    leg.translate(x, seatY / 2, z)
    paintColor(leg, palette.woodDark)
    parts.push(leg)
  }
  const seat = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16)
  seat.translate(0, seatY, 0)
  paintColor(seat, palette.wood)
  parts.push(seat)
  const rim = new THREE.TorusGeometry(0.3, 0.018, 6, 16)
  rim.rotateX(Math.PI / 2)
  rim.translate(0, seatY + 0.03, 0)
  paintColor(rim, palette.woodDark)
  parts.push(rim)
  return mergeMinerveParts(parts)
}
const PERCH_GEO = buildPerchGeometry()

// --- Placement des yeux sur la tête ------------------------------------------
// Les yeux doivent se lire comme de grands yeux ronds et ouverts (docs/DESIGN.md),
// pas comme des fentes : la sphère du blanc de l'œil doit donc dépasser largement
// de la tête plutôt que d'y être engloutie. `EYE_POKE_RATIO` fixe la fraction du
// diamètre de l'œil qui reste visible hors de la tête (le reste s'enfonce dedans,
// pour un contact solide sans laisser de vide). `eyePokeRatio` (exporté) est vérifié
// par un test unitaire pour empêcher de réintroduire des yeux engloutis.
export function eyePokeRatio(headRadius: number, eyeRadius: number, eyeX: number, eyeY: number, eyeZ: number): number {
  const distance = Math.hypot(eyeX, eyeY, eyeZ)
  const pokeDepth = distance + eyeRadius - headRadius
  return pokeDepth / (2 * eyeRadius)
}

export const HEAD_RADIUS = geo.head.parameters.radius
export const EYE_RADIUS = 0.12
export const EYE_POKE_RATIO = 0.75
export const EYE_X = 0.15
/** Décalage vertical du groupe `eyesRef` par rapport au centre de la tête. */
export const EYE_GROUP_Y = 0.02
/** Distance du centre de la tête au centre de l'œil pour obtenir `EYE_POKE_RATIO`. */
const EYE_DISTANCE = HEAD_RADIUS - EYE_RADIUS + EYE_POKE_RATIO * 2 * EYE_RADIUS
// `EYE_X` et `EYE_GROUP_Y` fixés, on résout `z` pour obtenir la distance voulue.
export const EYE_Z = Math.sqrt(Math.max(0, EYE_DISTANCE * EYE_DISTANCE - EYE_X * EYE_X - EYE_GROUP_Y * EYE_GROUP_Y))
const PUPIL_RADIUS = 0.052
/** La pupille se peint légèrement en avant du blanc de l'œil (sur sa surface visible). */
const PUPIL_Z = EYE_Z + 0.08
/** L'anneau des lunettes encercle l'œil désormais bien visible, entre le blanc et la pupille. */
const GLASSES_Z = EYE_Z + 0.04

/** Blanc des deux yeux, fusionné en une seule géométrie (même matériau, pas de couleur par sommet). */
function buildEyeWhitesGeometry(): THREE.BufferGeometry {
  const parts = [-EYE_X, EYE_X].map((x) => {
    const eye = new THREE.SphereGeometry(EYE_RADIUS, 14, 11)
    eye.translate(x, 0, EYE_Z)
    return eye
  })
  return mergeMinerveParts(parts)
}
const EYE_WHITES_GEO = buildEyeWhitesGeometry()

/** Pupilles + petit reflet clair par œil : une seule géométrie, couleur par sommet (`vertexColors: true`). */
function buildPupilsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-EYE_X, EYE_X]) {
    const pupil = new THREE.SphereGeometry(PUPIL_RADIUS, 12, 9)
    paintColor(pupil, palette.shadow)
    pupil.translate(x, 0, PUPIL_Z)
    parts.push(pupil)
    const highlight = new THREE.SphereGeometry(PUPIL_RADIUS * 0.32, 7, 6)
    paintColor(highlight, '#ffffff')
    highlight.translate(x - PUPIL_RADIUS * 0.42, PUPIL_RADIUS * 0.42, PUPIL_Z + PUPIL_RADIUS * 0.55)
    parts.push(highlight)
  }
  return mergeMinerveParts(parts)
}
const PUPILS_GEO = buildPupilsGeometry()

/** Anneaux + pont des lunettes, fusionnés en une seule géométrie (même matériau). */
function buildGlassesGeometry(): THREE.BufferGeometry {
  const ringL = new THREE.TorusGeometry(0.12, 0.014, 8, 20)
  ringL.translate(-EYE_X, EYE_GROUP_Y, GLASSES_Z)
  const ringR = new THREE.TorusGeometry(0.12, 0.014, 8, 20)
  ringR.translate(EYE_X, EYE_GROUP_Y, GLASSES_Z)
  const bridge = new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6)
  bridge.rotateZ(Math.PI / 2)
  bridge.translate(0, EYE_GROUP_Y, GLASSES_Z)
  return mergeMinerveParts([ringL, ringR, bridge])
}
const GLASSES_GEO = buildGlassesGeometry()

/**
 * Petits sourcils arqués, pour des yeux plus expressifs (indépendants du clignement).
 * Positionnés directement dans la géométrie fusionnée (une arche au-dessus de chaque œil) : le
 * groupe qui les porte (`eyebrowsRef`) ne sert qu'à la petite translation verticale selon l'humeur.
 */
function buildEyebrowsGeometry(): THREE.BufferGeometry {
  const parts = [-EYE_X, EYE_X].map((x) => {
    const side = x < 0 ? 1 : -1
    const brow = new THREE.TorusGeometry(0.075, 0.011, 6, 10, Math.PI * 0.55)
    brow.rotateZ(side > 0 ? Math.PI * 0.72 : Math.PI * 0.22)
    brow.translate(x, EYE_GROUP_Y + 0.135, GLASSES_Z - 0.015)
    return brow
  })
  return mergeMinerveParts(parts)
}
const EYEBROWS_GEO = buildEyebrowsGeometry()

// --- Matériaux partagés (Lambert uniquement, pas d'ombres temps réel) -----------
// Gris-lilas pâle, distinct du conservateur du jeu d'inspiration (pas de gilet vert).
const OWL_PLUMAGE = '#c9bfe3'
const mat = {
  plumage: new THREE.MeshLambertMaterial({ color: OWL_PLUMAGE }),
  // Ventre : voir `getBellyMaterial()` (texture « écailles »), pas une couleur unie ici.
  eyeWhite: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  pupilVC: new THREE.MeshLambertMaterial({ vertexColors: true }),
  beak: new THREE.MeshLambertMaterial({ color: palette.gold }),
  glasses: new THREE.MeshLambertMaterial({ color: palette.ink }),
  scarf: new THREE.MeshLambertMaterial({ color: palette.gold }),
  notebook: new THREE.MeshLambertMaterial({ color: palette.wood }),
  wood: new THREE.MeshLambertMaterial({ vertexColors: true }),
}

let bubbleMaterialCache: THREE.MeshLambertMaterial | null = null
let bellyMaterialCache: THREE.MeshLambertMaterial | null = null

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

/**
 * Motif « écailles » du ventre (plumage en couches) : petits arcs superposés, crème sur crème,
 * dessinés une seule fois sur un canvas 2D et répétés sur la sphère du ventre (`RepeatWrapping`).
 * Même esprit que `getBubbleMaterial` : aucune géométrie supplémentaire, juste une texture.
 */
function getBellyMaterial(): THREE.MeshLambertMaterial {
  if (bellyMaterialCache) return bellyMaterialCache
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = palette.cream
    ctx.fillRect(0, 0, 64, 64)
    ctx.strokeStyle = '#e9dcc0'
    ctx.lineWidth = 1.5
    for (let row = 0; row < 5; row++) {
      const y = row * 16
      const offset = row % 2 === 0 ? 0 : 8
      for (let col = -1; col < 5; col++) {
        const x = col * 16 + offset
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI)
        ctx.stroke()
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 2)
  texture.needsUpdate = true
  bellyMaterialCache = new THREE.MeshLambertMaterial({ map: texture, color: palette.cream })
  return bellyMaterialCache
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
  const eyebrowsRef = useRef<THREE.Group | null>(null)
  const leftWingRef = useRef<THREE.Mesh | null>(null)
  const rightWingRef = useRef<THREE.Mesh | null>(null)
  const bubbleRef = useRef<THREE.Mesh | null>(null)

  const rng = useRef(mulberry32(0x4d494e56)) // graine fixe ("MINV") : séquence reproductible
  const blink = useRef<BlinkState>({ blinking: false, next: -1, end: 0 })

  const bubbleMat = useMemo(() => getBubbleMaterial(), [])
  const bellyMat = useMemo(() => getBellyMaterial(), [])

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
    let browRaiseTarget = 0
    if (mood === 'happy') {
      bobAmp = 0.1
      bobSpeed = 5.2
      wingAmp = 0.4
      wingSpeed = 7
      browRaiseTarget = 0.012
    } else if (mood === 'thinking') {
      swaySpeed = 0.35
      headTiltTarget = 0.14
      wingAmp = 0.015
      browRaiseTarget = -0.006
    } else if (mood === 'surprised') {
      headScaleTarget = 1.08
      wingAmp = 0.15
      wingSpeed = 3
      browRaiseTarget = 0.02
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
    // Sourcils : légère montée/descente selon l'humeur — des yeux plus expressifs sans toucher au clignement.
    if (eyebrowsRef.current) {
      const eb = eyebrowsRef.current
      eb.position.y += (browRaiseTarget - eb.position.y) * Math.min(1, delta * 5)
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
        <mesh geometry={PERCH_GEO} material={mat.wood} />
        <group ref={bodyRef} position={[0, BASE_Y, 0]}>
          <mesh geometry={geo.bodyCore} material={mat.plumage} />
          <mesh geometry={geo.belly} material={bellyMat} position={[0, -0.02, 0.22]} scale={[0.8, 0.9, 0.55]} />
          <mesh geometry={LEGS_GEO} material={mat.plumage} />
          <mesh ref={leftWingRef} geometry={WING_LEFT_GEO} material={mat.plumage} position={[-0.35, 0.05, -0.04]} />
          <mesh ref={rightWingRef} geometry={WING_RIGHT_GEO} material={mat.plumage} position={[0.35, 0.05, -0.04]} />
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
            <mesh geometry={TUFT_LEFT_GEO} material={mat.plumage} />
            <mesh geometry={TUFT_RIGHT_GEO} material={mat.plumage} />
            <group ref={eyesRef} position={[0, EYE_GROUP_Y, 0]}>
              <mesh geometry={EYE_WHITES_GEO} material={mat.eyeWhite} />
              <mesh geometry={PUPILS_GEO} material={mat.pupilVC} />
            </group>
            {/* `EYEBROWS_GEO` porte déjà sa position absolue (repère de la tête) ; ce groupe ne sert
                qu'à `browRaiseTarget` (petite translation Y selon l'humeur, voir useFrame) — jamais
                de décalage statique ici, sous peine de doubler l'offset déjà dans la géométrie. */}
            <group ref={eyebrowsRef}>
              <mesh geometry={EYEBROWS_GEO} material={mat.glasses} />
            </group>
            <mesh geometry={GLASSES_GEO} material={mat.glasses} />
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
