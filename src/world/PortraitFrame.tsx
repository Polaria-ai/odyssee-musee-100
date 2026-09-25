/**
 * Un portrait accroché : cadre doré mouluré (plusieurs couches biseautées) + passe-partout crème,
 * toile (photo ou portrait d'attente) légèrement en retrait, petit spot mural doré avec halo additif
 * discret, cartel en laiton haute résolution (WEL-875 — voir `docs/assets/frames.md`).
 * Chargement paresseux de la photo (< 14 m, quelques vérifications par seconde, jamais déchargée).
 * Pas de <Text>/<Html> drei : tout le texte est une texture canvas 2D.
 */
import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry } from 'three'
import type { Mesh, Texture } from 'three'
import type { FrameSlot, Person } from '../types'
import { useGame } from '../state/gameStore'
import { player } from '../state/runtime'
import { wingThemes, dims as tokenDims } from '../styles/tokens'
import { drawPlaceholderPortrait, loadPersonPhoto } from './textures'
import { drawFrameCartel } from './frameCartel'
import { FRAME_GEOMETRY, GOLD_BRIGHT, HALO_LOCAL_Y, HALO_LOCAL_Z, PAINTING_RECESS_Z } from './frameGeometry'
import { HALO_GEOMETRY, fadeableHaloMaterial, sharedHaloMaterial } from './frameHalo'
import { PORTRAIT_CHECK_RATE_HZ, PORTRAIT_LOAD_DISTANCE } from './constants'
import { bubbleTexture } from './bubbleTexture'

// Plaque 512×128 (voir frameCartel.ts) : aspect 4/1, plus large et plus basse que l'ancien cartel
// (256×96, 2.65/1) — plus de pixels par caractère, donc plus lisible à distance de jeu. `CARTEL_GAP`
// un peu plus généreux que l'ancien (0.14) pour garder un dégagement net sous la moulure extérieure du
// nouveau cadre (bien plus large que l'ancien bord simple, voir `frameGeometry.ts::LAYER_MARGIN.outer`).
const CARTEL_WIDTH = 0.98
const CARTEL_HEIGHT = 0.245
const CARTEL_GAP = 0.18
const BOB_SPEED = 2.4
const BOB_RANGE = 0.08

// Géométries et matériaux partagés au niveau du module (comme src/player/AvatarMesh.tsx) : une
// seule instance pour tous les cadres (jusqu'à ~120), passée en prop `geometry`/`material` — R3F ne
// dispose que ce qu'il possède (JSX imbriqué), jamais un objet reçu en prop, donc rien n'est libéré
// par erreur quand un cadre se démonte. Seuls les matériaux liés à une texture par personne (toile,
// cartel) restent propres à chaque instance.
const PAINTING_GEO = new PlaneGeometry(tokenDims.frameWidth, tokenDims.frameHeight)
const CARTEL_GEO = new PlaneGeometry(CARTEL_WIDTH, CARTEL_HEIGHT)
const BUBBLE_GEO = new PlaneGeometry(0.32, 0.32)
// `vertexColors: true` : la géométrie fusionnée (`FRAME_GEOMETRY`) porte déjà la couleur de chaque
// couche (moulures + passe-partout + spot) par sommet — voir `frameGeometry.ts`. Un seul matériau
// (couleur de base blanche par défaut) suffit donc pour tout le relief, au lieu d'un matériau par
// teinte. `flatShading: true` : la vasque du spot est un cylindre low-poly (8 segments, comme les
// colonnes du hall, `roomGeometry.ts`) — sans cet indicateur, three.js lisserait ses normales et la
// vasque paraîtrait ronde/floue au lieu du style « facetté » du reste du musée.
const FRAME_MATERIAL = new MeshLambertMaterial({ vertexColors: true, flatShading: true })
const FRAME_MATERIAL_HIGHLIGHT = new MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: GOLD_BRIGHT, emissiveIntensity: 0.32 })

let bubbleMaterial: MeshBasicMaterial | null = null
/** Matériau de la bulle « ! », créé une seule fois (paresseux : la texture a besoin d'un canvas DOM). */
function sharedBubbleMaterial(): MeshBasicMaterial {
  if (!bubbleMaterial) bubbleMaterial = new MeshBasicMaterial({ map: bubbleTexture(), transparent: true, toneMapped: false })
  return bubbleMaterial
}

/**
 * État de fondu d'une cimaise (voir `Occluder`, `occlusion.ts`, `Museum.tsx`) : objet mutable simple
 * (pas de `useState`/ref three.js), mis à jour par `Museum` dans son propre `useFrame` et relu ici
 * dans le nôtre. Un cadre dont la cimaise n'occulte personne reste à `opacity: 1` en permanence.
 */
export interface FrameFade {
  opacity: number
}

export function PortraitFrame({ frame, person, fade }: { frame: FrameSlot; person: Person; fade?: FrameFade }) {
  const lang = useGame((s) => s.lang)
  const highlighted = useGame((s) => s.nearbyPersonId === person.id)

  const [photoTex, setPhotoTex] = useState<Texture | null>(null)
  const checkTimer = useRef(0)
  const requested = useRef(false)

  useFrame((_state, delta) => {
    if (requested.current || !person.photoUrl) return
    checkTimer.current += delta
    if (checkTimer.current < 1 / PORTRAIT_CHECK_RATE_HZ) return
    checkTimer.current = 0
    const dx = player.x - frame.position[0]
    const dz = player.z - frame.position[2]
    if (dx * dx + dz * dz <= PORTRAIT_LOAD_DISTANCE * PORTRAIT_LOAD_DISTANCE) {
      requested.current = true
      loadPersonPhoto(person.photoUrl).then(setPhotoTex).catch(() => {})
    }
  })

  const accentColor = wingThemes[frame.wing].accent
  // `drawPlaceholderPortrait`/`drawFrameCartel` mettent leurs textures en cache par personne + langue
  // (voir textures.ts / frameCartel.ts) : la bascule FR/EN ne recrée jamais de texture GPU orpheline
  // pour les ~100 cadres, et on n'a pas besoin de dispose() nous-mêmes (dangereux ici sous
  // React.StrictMode : le double rendu des effets en dev disposerait une texture encore affichée par
  // `useMemo`, qui lui n'est pas rejoué en même temps).
  const placeholderTex = useMemo(() => drawPlaceholderPortrait(accentColor, person.order, lang), [accentColor, person.order, lang])
  const cartelTex = useMemo(() => drawFrameCartel(person, lang), [person, lang])
  const paintingTex = photoTex ?? placeholderTex

  const bubbleRef = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!bubbleRef.current) return
    bubbleRef.current.position.y = tokenDims.frameHeight / 2 + 0.45 + Math.sin(clock.elapsedTime * BOB_SPEED) * BOB_RANGE
  })

  // Cadre accroché à une cimaise occultante (voir `Occluder`) : matériaux PROPRES à cette instance
  // (jamais `FRAME_MATERIAL`/`FRAME_MATERIAL_HIGHLIGHT`/le halo partagé, tous partagés par les autres
  // cadres), pour pouvoir suivre son fondu sans jamais l'imposer aux cadres non concernés. `useMemo`
  // sur `[fade]` seul : la présence de `fade` ne change jamais après montage (mission occultation
  // figée par le plan), donc ces instances sont créées une seule fois.
  const frameMaterial = useMemo(() => (fade ? new MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, depthWrite: false }) : null), [fade])
  const haloMaterial = useMemo(() => (fade ? fadeableHaloMaterial() : null), [fade])
  const paintingMatRef = useRef<MeshBasicMaterial>(null)
  const cartelMatRef = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    if (!fade) return
    const o = fade.opacity
    if (frameMaterial) {
      frameMaterial.opacity = o
      frameMaterial.emissiveIntensity = highlighted ? 0.35 : 0
    }
    if (haloMaterial) haloMaterial.opacity = 0.5 * o
    if (paintingMatRef.current) paintingMatRef.current.opacity = o
    if (cartelMatRef.current) cartelMatRef.current.opacity = o
  })

  // Liseré lumineux du cadre proche : pulsation douce de l'émissif du matériau de surbrillance PARTAGÉ
  // (`FRAME_MATERIAL_HIGHLIGHT`). Sûr malgré le partage : `nearbyPersonId` (donc `highlighted`) ne
  // désigne jamais plus d'un cadre à la fois, donc au plus UNE des ~100 instances entre jamais dans ce
  // `if` à une image donnée — jamais deux cadres qui se disputent la même valeur. Cadres en fondu
  // exclus (matériau propre déjà géré ci-dessus, intensité statique comme avant WEL-875).
  useFrame(({ clock }) => {
    if (highlighted && !fade) {
      FRAME_MATERIAL_HIGHLIGHT.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime * 3.2) * 0.12
    }
  })

  return (
    <group position={frame.position} rotation-y={frame.rotationY}>
      {/* Moulure dorée biseautée + passe-partout + spot mural : une seule géométrie fusionnée (voir frameGeometry.ts). */}
      <mesh geometry={FRAME_GEOMETRY} material={frameMaterial ?? (highlighted ? FRAME_MATERIAL_HIGHLIGHT : FRAME_MATERIAL)} />
      {/* Halo additif discret sous le spot : plan partagé + matériau partagé (sauf cadre en fondu). */}
      <mesh position={[0, HALO_LOCAL_Y, HALO_LOCAL_Z]} geometry={HALO_GEOMETRY} material={haloMaterial ?? sharedHaloMaterial()} />
      <mesh position={[0, 0, PAINTING_RECESS_Z]} geometry={PAINTING_GEO}>
        <meshBasicMaterial ref={paintingMatRef} map={paintingTex} toneMapped={false} transparent={!!fade} depthWrite={!fade} />
      </mesh>
      <mesh position={[0, -tokenDims.frameHeight / 2 - CARTEL_GAP - CARTEL_HEIGHT / 2, 0.001]} geometry={CARTEL_GEO}>
        <meshBasicMaterial ref={cartelMatRef} map={cartelTex} toneMapped={false} transparent={!!fade} depthWrite={!fade} />
      </mesh>
      {highlighted && (
        <mesh ref={bubbleRef} position={[0, tokenDims.frameHeight / 2 + 0.45, 0.02]} geometry={BUBBLE_GEO} material={sharedBubbleMaterial()} />
      )}
    </group>
  )
}
