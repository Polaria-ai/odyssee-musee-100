// Propriétaire : module joueur-cyril.
//
// Tous les visiteurs jouent Cyril (décision du 29/09 : plus de personnalisation) : le joueur local et les
// visiteurs distants (`src/features/presence/RemoteVisitors.tsx`) passent par ce composant. Il assemble
//  - l'ombre ronde au sol (géométrie, texture et matériau partagés au niveau du module),
//  - le modèle animé (`GlbCharacter` du module personnages : un clone par instance, ressources partagées),
//  - le choix idle/marche d'après la vitesse (`pickLocomotionClip`, `walkTimeScale`).
// Budget : 2 appels de dessin par instance (ombre + maillage de Cyril), ~12 400 triangles.
import { Component, Suspense, useState, type ReactNode } from 'react'
import { CanvasTexture, MeshBasicMaterial, PlaneGeometry } from 'three'
import { GlbCharacter, type LocomotionClip } from '../characters'
import { cyrilLocomotion } from './cyrilLocomotion'

export interface AvatarMeshProps {
  /** Le personnage se déplace. Prime sur `speed` : à l'arrêt, la vitesse affichée peut traîner un instant. */
  moving?: boolean
  /** Vitesse en m/s : choisit idle/marche et règle la cadence des pas. */
  speed?: number
}

/**
 * Ombre ronde de Cyril : la largeur de l'ombre du petit personnage d'origine (0,62 m pour 1,15 m de haut)
 * rapportée à la hauteur de Cyril (1,45 m), soit ×1,26.
 */
const SHADOW_SIZE = 0.78

function createShadowTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(59, 42, 30, 0.4)')
  gradient.addColorStop(0.7, 'rgba(59, 42, 30, 0.22)')
  gradient.addColorStop(1, 'rgba(59, 42, 30, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

// Ressources partagées par toutes les instances (joueur + visiteurs distants), jamais libérées.
const SHADOW_GEO = new PlaneGeometry(SHADOW_SIZE, SHADOW_SIZE)
const SHADOW_TEXTURE = createShadowTexture()
const SHADOW_MATERIAL = new MeshBasicMaterial({
  map: SHADOW_TEXTURE ?? undefined,
  transparent: true,
  depthWrite: false,
  opacity: 0.9,
})

/**
 * Filet si le modèle de Cyril ne charge pas (réseau coupé, fichier absent) : sans lui, l'erreur remonterait
 * jusqu'au `<Canvas>` et ferait tomber toute l'application. Le visiteur garde son ombre et le musée reste jouable.
 */
class CharacterBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.warn('[Cyril] modèle 3D indisponible', error)
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Cyril, pieds à y = 0, regarde vers +Z. Le parent place et oriente le groupe (Player, RemoteVisitors).
 *
 * `moving` et `speed` viennent du joueur (vitesse réelle) ou du réseau (drapeau « bouge », vitesse de
 * marche supposée). L'hystérésis de `pickLocomotionClip` (seuil d'entrée plus haut que le seuil de sortie)
 * demande de se souvenir du clip en cours : il vit dans l'état du composant, jamais dans une ref lue au rendu.
 */
export function AvatarMesh({ moving = false, speed = 0 }: AvatarMeshProps) {
  const [current, setCurrent] = useState<LocomotionClip>('idle')
  const { clip, timeScale } = cyrilLocomotion(moving, speed, current)
  if (clip !== current) setCurrent(clip)

  return (
    <group>
      <mesh geometry={SHADOW_GEO} material={SHADOW_MATERIAL} position={[0, 0.01, 0]} rotation-x={-Math.PI / 2} />
      <CharacterBoundary>
        {/* Suspense local : si le modèle n'est pas encore là, seul Cyril attend, pas tout le musée. */}
        <Suspense fallback={null}>
          <GlbCharacter character="cyril" clip={clip} timeScale={timeScale} />
        </Suspense>
      </CharacterBoundary>
    </group>
  )
}
