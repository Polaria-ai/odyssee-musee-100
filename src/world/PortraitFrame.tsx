/**
 * Un portrait accroché : cadre doré, toile (photo ou portrait d'attente), cartel en laiton.
 * Chargement paresseux de la photo (< 14 m, quelques vérifications par seconde, jamais déchargée).
 * Pas de <Text>/<Html> drei : tout le texte est une texture canvas 2D.
 */
import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry } from 'three'
import type { Mesh, Texture } from 'three'
import type { FrameSlot, Person } from '../types'
import { useGame } from '../state/gameStore'
import { player } from '../state/runtime'
import { palette, wingThemes, dims as tokenDims } from '../styles/tokens'
import { drawCartel, drawPlaceholderPortrait, loadPersonPhoto } from './textures'
import { PORTRAIT_CHECK_RATE_HZ, PORTRAIT_LOAD_DISTANCE } from './constants'
import { bubbleTexture } from './bubbleTexture'

const CARTEL_WIDTH = 0.9
const CARTEL_HEIGHT = 0.34
const CARTEL_GAP = 0.14
const BOB_SPEED = 2.4
const BOB_RANGE = 0.08

// Géométries et matériaux partagés au niveau du module (comme src/player/AvatarMesh.tsx) : une
// seule instance pour tous les cadres (jusqu'à ~120), passée en prop `geometry`/`material` — R3F ne
// dispose que ce qu'il possède (JSX imbriqué), jamais un objet reçu en prop, donc rien n'est libéré
// par erreur quand un cadre se démonte. Seuls les matériaux liés à une texture par personne (toile,
// cartel) restent propres à chaque instance.
const FRAME_BORDER_GEO = new BoxGeometry(tokenDims.frameWidth + 0.14, tokenDims.frameHeight + 0.14, 0.05)
const PAINTING_GEO = new PlaneGeometry(tokenDims.frameWidth, tokenDims.frameHeight)
const CARTEL_GEO = new PlaneGeometry(CARTEL_WIDTH, CARTEL_HEIGHT)
const BUBBLE_GEO = new PlaneGeometry(0.32, 0.32)
const FRAME_MATERIAL = new MeshLambertMaterial({ color: palette.gold })
const FRAME_MATERIAL_HIGHLIGHT = new MeshLambertMaterial({ color: palette.gold, emissive: palette.gold, emissiveIntensity: 0.35 })

let bubbleMaterial: MeshBasicMaterial | null = null
/** Matériau de la bulle « ! », créé une seule fois (paresseux : la texture a besoin d'un canvas DOM). */
function sharedBubbleMaterial(): MeshBasicMaterial {
  if (!bubbleMaterial) bubbleMaterial = new MeshBasicMaterial({ map: bubbleTexture(), transparent: true, toneMapped: false })
  return bubbleMaterial
}

export function PortraitFrame({ frame, person }: { frame: FrameSlot; person: Person }) {
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
  // `drawPlaceholderPortrait`/`drawCartel` mettent leurs textures en cache par personne + langue
  // (voir textures.ts) : la bascule FR/EN ne recrée jamais de texture GPU orpheline pour les ~100
  // cadres, et on n'a pas besoin de dispose() nous-mêmes (dangereux ici sous React.StrictMode : le
  // double rendu des effets en dev disposerait une texture encore affichée par `useMemo`, qui lui
  // n'est pas rejoué en même temps).
  const placeholderTex = useMemo(() => drawPlaceholderPortrait(accentColor, person.order, lang), [accentColor, person.order, lang])
  const cartelTex = useMemo(() => drawCartel(person, lang), [person, lang])
  const paintingTex = photoTex ?? placeholderTex

  const bubbleRef = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!bubbleRef.current) return
    bubbleRef.current.position.y = tokenDims.frameHeight / 2 + 0.45 + Math.sin(clock.elapsedTime * BOB_SPEED) * BOB_RANGE
  })

  return (
    <group position={frame.position} rotation-y={frame.rotationY}>
      <mesh position={[0, 0, -0.03]} geometry={FRAME_BORDER_GEO} material={highlighted ? FRAME_MATERIAL_HIGHLIGHT : FRAME_MATERIAL} />
      <mesh geometry={PAINTING_GEO}>
        <meshBasicMaterial map={paintingTex} toneMapped={false} />
      </mesh>
      <mesh position={[0, -tokenDims.frameHeight / 2 - CARTEL_GAP - CARTEL_HEIGHT / 2, 0.001]} geometry={CARTEL_GEO}>
        <meshBasicMaterial map={cartelTex} toneMapped={false} />
      </mesh>
      {highlighted && (
        <mesh ref={bubbleRef} position={[0, tokenDims.frameHeight / 2 + 0.45, 0.02]} geometry={BUBBLE_GEO} material={sharedBubbleMaterial()} />
      )}
    </group>
  )
}
