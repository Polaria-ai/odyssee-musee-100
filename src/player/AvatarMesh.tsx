// Propriétaire : agent joueur. Réutilisé par la présence et l'écran de personnalisation (~40 instances).
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import type { Group, Mesh } from 'three'
import type { AccessoryId, AvatarConfig, OutfitId } from '../types'

export interface AvatarMeshProps {
  config: AvatarConfig
  moving?: boolean
  /** Vitesse en m/s, pour le rythme de la marche. */
  speed?: number
}

// ---------------------------------------------------------------------------
// Géométries partagées au niveau du module : créées une seule fois, réutilisées
// par toutes les instances (présence, personnalisation). Ne jamais en créer dans le composant.
// ---------------------------------------------------------------------------

const HEAD_GEO = new SphereGeometry(0.24, 14, 12)
// Calotte de cheveux : sphère tronquée (pôle nord → un peu sous l'équateur) qui laisse le visage nu.
const HAIR_GEO = new SphereGeometry(0.248, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.54)
const EYE_GEO = new SphereGeometry(0.028, 8, 6)
const CHEEK_GEO = new SphereGeometry(0.05, 8, 6)

const BODY_GEO = new CapsuleGeometry(0.17, 0.2, 4, 8)
const DRESS_TOP_GEO = new CapsuleGeometry(0.16, 0.06, 4, 8)
const DRESS_SKIRT_GEO = new ConeGeometry(0.27, 0.34, 12)
const HOOD_GEO = new SphereGeometry(0.12, 10, 8)
const TIE_GEO = new BoxGeometry(0.06, 0.22, 0.03)
const BIB_GEO = new BoxGeometry(0.22, 0.18, 0.04)
const STRAP_GEO = new BoxGeometry(0.05, 0.34, 0.03)

const ARM_GEO = new CapsuleGeometry(0.06, 0.2, 3, 6)
const HAND_GEO = new SphereGeometry(0.075, 8, 8)
const FOOT_GEO = new SphereGeometry(0.1, 8, 8)

const GLASSES_LENS_GEO = new CylinderGeometry(0.062, 0.062, 0.014, 12)
const GLASSES_BRIDGE_GEO = new BoxGeometry(0.045, 0.012, 0.012)
const BERET_GEO = new CylinderGeometry(0.21, 0.19, 0.07, 14)
const CAP_DOME_GEO = new SphereGeometry(0.255, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)
const CAP_BRIM_GEO = new CylinderGeometry(0.17, 0.17, 0.02, 14, 1, false, -Math.PI / 2, Math.PI)
const HEADPHONE_BAND_GEO = new TorusGeometry(0.25, 0.018, 6, 14, Math.PI)
const HEADPHONE_CUP_GEO = new CylinderGeometry(0.06, 0.06, 0.03, 10)
const FLOWER_GEO = new SphereGeometry(0.045, 8, 6)
const FLOWER_CENTER_GEO = new SphereGeometry(0.02, 6, 6)

const SHADOW_GEO = new PlaneGeometry(0.62, 0.62)

// ---------------------------------------------------------------------------
// Matériaux : fixes en constantes, dynamiques (couleurs d'avatar) mis en cache par couleur.
// ---------------------------------------------------------------------------

const EYE_MATERIAL = new MeshLambertMaterial({ color: '#241a14' })
const CHEEK_MATERIAL = new MeshLambertMaterial({ color: '#f2a6a0', transparent: true, opacity: 0.85 })
const GLASSES_MATERIAL = new MeshLambertMaterial({ color: '#2c2420' })
const BERET_MATERIAL = new MeshLambertMaterial({ color: '#b0413e' })
const CAP_MATERIAL = new MeshLambertMaterial({ color: '#4fb3a9' })
const HEADPHONE_MATERIAL = new MeshLambertMaterial({ color: '#3b2a1e' })
const FLOWER_MATERIAL = new MeshLambertMaterial({ color: '#e76f6f' })
const FLOWER_CENTER_MATERIAL = new MeshLambertMaterial({ color: '#e8c872' })
const TIE_MATERIAL = new MeshLambertMaterial({ color: '#3b2a1e' })
const UNDERSHIRT_MATERIAL = new MeshLambertMaterial({ color: '#fdf1d6' })

// Borné : `config.skinTone/hairColor/outfitColor` peut venir d'un pair distant (présence Supabase
// Realtime, voir `sanitizeAvatar`), qui accepte n'importe quel hex #rrggbb valide, pas seulement les
// pastilles proposées par l'écran de personnalisation. Sans borne, un pair malveillant changeant de
// couleur en boucle ferait grossir cette table indéfiniment. Au-delà de la limite on ne met plus en
// cache (nouveau matériau non partagé pour cette couleur) plutôt que d'évincer une entrée : un
// matériau du cache peut être utilisé par un avatar actuellement affiché, et ce module ne libère
// jamais ses ressources partagées (choix délibéré, comme les géométries ci-dessus) — l'évincer
// casserait ce mesh sans rien économiser puisqu'il resterait référencé.
const COLOR_CACHE_LIMIT = 64
const colorMaterialCache = new Map<string, MeshLambertMaterial>()

/** Matériau Lambert mis en cache par couleur hex : une seule instance par couleur, quel que soit le nombre d'avatars. */
function materialFor(color: string): MeshLambertMaterial {
  const cached = colorMaterialCache.get(color)
  if (cached) return cached
  const material = new MeshLambertMaterial({ color })
  if (colorMaterialCache.size < COLOR_CACHE_LIMIT) colorMaterialCache.set(color, material)
  return material
}

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

const SHADOW_TEXTURE = createShadowTexture()
const SHADOW_MATERIAL = new MeshBasicMaterial({
  map: SHADOW_TEXTURE ?? undefined,
  transparent: true,
  depthWrite: false,
  opacity: 0.9,
})

// ---------------------------------------------------------------------------
// Proportions (mètres), chibi ≈ 1,15 m, pieds à y = 0.
// ---------------------------------------------------------------------------

const BODY_BASE_Y = 0.41
const HEAD_Y = 0.51
const ARM_X = 0.22
const ARM_Y = 0.24
const LEG_X = 0.09
const FOOT_BASE_Y = -0.31
const REFERENCE_SPEED = 5.6 // vitesse de course : calibre seulement l'amplitude de l'animation, purement cosmétique.

function Accessory({ accessory }: { accessory: AccessoryId }) {
  switch (accessory) {
    case 'glasses':
      return (
        <group position={[0, 0.01, 0.21]}>
          <mesh geometry={GLASSES_LENS_GEO} material={GLASSES_MATERIAL} position={[-0.09, 0, 0]} rotation-x={Math.PI / 2} />
          <mesh geometry={GLASSES_LENS_GEO} material={GLASSES_MATERIAL} position={[0.09, 0, 0]} rotation-x={Math.PI / 2} />
          <mesh geometry={GLASSES_BRIDGE_GEO} material={GLASSES_MATERIAL} position={[0, 0, 0]} />
        </group>
      )
    case 'beret':
      return <mesh geometry={BERET_GEO} material={BERET_MATERIAL} position={[0.05, 0.24, -0.03]} rotation-z={-0.25} />
    case 'headphones':
      return (
        <group position={[0, 0.16, 0]}>
          <mesh geometry={HEADPHONE_BAND_GEO} material={HEADPHONE_MATERIAL} rotation-z={Math.PI} rotation-x={Math.PI / 2} />
          <mesh geometry={HEADPHONE_CUP_GEO} material={HEADPHONE_MATERIAL} position={[-0.24, -0.05, 0]} rotation-z={Math.PI / 2} />
          <mesh geometry={HEADPHONE_CUP_GEO} material={HEADPHONE_MATERIAL} position={[0.24, -0.05, 0]} rotation-z={Math.PI / 2} />
        </group>
      )
    case 'flower':
      return (
        <group position={[0.19, 0.18, 0.05]}>
          <mesh geometry={FLOWER_GEO} material={FLOWER_MATERIAL} />
          <mesh geometry={FLOWER_CENTER_GEO} material={FLOWER_CENTER_MATERIAL} position={[0, 0, 0.03]} />
        </group>
      )
    case 'cap':
      return (
        <group position={[0, 0.2, 0]}>
          <mesh geometry={CAP_DOME_GEO} material={CAP_MATERIAL} />
          <mesh geometry={CAP_BRIM_GEO} material={CAP_MATERIAL} position={[0, -0.02, 0.2]} rotation-x={Math.PI / 2} />
        </group>
      )
    default:
      return null
  }
}

function OutfitBody({ outfit, color }: { outfit: OutfitId; color: string }) {
  const outfitMaterial = materialFor(color)
  switch (outfit) {
    case 'dress':
      return (
        <group>
          <mesh geometry={DRESS_TOP_GEO} material={outfitMaterial} position={[0, 0.16, 0]} />
          <mesh geometry={DRESS_SKIRT_GEO} material={outfitMaterial} position={[0, -0.03, 0]} />
        </group>
      )
    case 'hoodie':
      return (
        <group>
          <mesh geometry={BODY_GEO} material={outfitMaterial} scale={[1.08, 1, 1.08]} />
          <mesh geometry={HOOD_GEO} material={outfitMaterial} position={[0, 0.24, -0.1]} />
        </group>
      )
    case 'suit':
      return (
        <group>
          <mesh geometry={BODY_GEO} material={outfitMaterial} />
          <mesh geometry={TIE_GEO} material={TIE_MATERIAL} position={[0, 0.03, 0.17]} />
        </group>
      )
    case 'overalls':
      return (
        <group>
          <mesh geometry={BODY_GEO} material={UNDERSHIRT_MATERIAL} />
          <mesh geometry={BIB_GEO} material={outfitMaterial} position={[0, 0.05, 0.15]} />
          <mesh geometry={STRAP_GEO} material={outfitMaterial} position={[-0.08, 0.2, 0.12]} rotation-x={0.25} />
          <mesh geometry={STRAP_GEO} material={outfitMaterial} position={[0.08, 0.2, 0.12]} rotation-x={0.25} />
        </group>
      )
    case 'tee':
    default:
      return <mesh geometry={BODY_GEO} material={outfitMaterial} />
  }
}

/**
 * Petit personnage chibi low-poly (≈ 1,15 m), pieds à y = 0, regarde vers +Z.
 * Géométries partagées au niveau du module, matériaux mis en cache par couleur : peut être
 * instancié une quarantaine de fois (présence + personnalisation) sans recréer de ressources GPU.
 */
export function AvatarMesh({ config, moving = false, speed = 0 }: AvatarMeshProps) {
  const bodyRef = useRef<Group>(null)
  const armLeftRef = useRef<Group>(null)
  const armRightRef = useRef<Group>(null)
  const footLeftRef = useRef<Mesh>(null)
  const footRightRef = useRef<Mesh>(null)
  const phase = useRef(0)
  const breath = useRef(Math.random() * Math.PI * 2)

  const skinMaterial = useMemo(() => materialFor(config.skinTone), [config.skinTone])
  const hairMaterial = useMemo(() => materialFor(config.hairColor), [config.hairColor])

  useFrame((_state, delta) => {
    const intensity = Math.min(1, Math.max(0, speed) / REFERENCE_SPEED)
    breath.current += delta * 1.6

    if (moving) {
      phase.current += delta * (4 + intensity * 5)
      const swing = Math.sin(phase.current) * (0.5 + intensity * 0.5)
      if (armLeftRef.current) armLeftRef.current.rotation.x = swing
      if (armRightRef.current) armRightRef.current.rotation.x = -swing
      const stride = Math.sin(phase.current) * (0.05 + intensity * 0.07)
      const hop = Math.max(0, Math.sin(phase.current)) * (0.015 + intensity * 0.02)
      if (footLeftRef.current) {
        footLeftRef.current.position.z = stride
        footLeftRef.current.position.y = FOOT_BASE_Y + hop
      }
      if (footRightRef.current) {
        footRightRef.current.position.z = -stride
        footRightRef.current.position.y = FOOT_BASE_Y + Math.max(0, -Math.sin(phase.current)) * (0.015 + intensity * 0.02)
      }
      if (bodyRef.current) bodyRef.current.position.y = BODY_BASE_Y + Math.abs(Math.sin(phase.current * 2)) * 0.025
      if (bodyRef.current) bodyRef.current.scale.y = 1
    } else {
      const idle = Math.sin(breath.current) * 0.05
      if (armLeftRef.current) armLeftRef.current.rotation.x = idle
      if (armRightRef.current) armRightRef.current.rotation.x = -idle
      if (footLeftRef.current) {
        footLeftRef.current.position.z = 0
        footLeftRef.current.position.y = FOOT_BASE_Y
      }
      if (footRightRef.current) {
        footRightRef.current.position.z = 0
        footRightRef.current.position.y = FOOT_BASE_Y
      }
      if (bodyRef.current) {
        bodyRef.current.position.y = BODY_BASE_Y
        bodyRef.current.scale.y = 1 + Math.sin(breath.current * 0.5) * 0.014
      }
    }
  })

  return (
    <group>
      <mesh geometry={SHADOW_GEO} material={SHADOW_MATERIAL} position={[0, 0.01, 0]} rotation-x={-Math.PI / 2} />
      <group ref={bodyRef} position={[0, BODY_BASE_Y, 0]}>
        <OutfitBody outfit={config.outfit} color={config.outfitColor} />

        <group ref={armLeftRef} position={[-ARM_X, ARM_Y, 0]}>
          <mesh geometry={ARM_GEO} material={skinMaterial} position={[0, -0.13, 0]} />
          <mesh geometry={HAND_GEO} material={skinMaterial} position={[0, -0.26, 0]} />
        </group>
        <group ref={armRightRef} position={[ARM_X, ARM_Y, 0]}>
          <mesh geometry={ARM_GEO} material={skinMaterial} position={[0, -0.13, 0]} />
          <mesh geometry={HAND_GEO} material={skinMaterial} position={[0, -0.26, 0]} />
        </group>

        <mesh ref={footLeftRef} geometry={FOOT_GEO} material={skinMaterial} position={[-LEG_X, FOOT_BASE_Y, 0]} />
        <mesh ref={footRightRef} geometry={FOOT_GEO} material={skinMaterial} position={[LEG_X, FOOT_BASE_Y, 0]} />

        <group position={[0, HEAD_Y, 0]}>
          <mesh geometry={HEAD_GEO} material={skinMaterial} />
          <mesh geometry={HAIR_GEO} material={hairMaterial} />
          <mesh geometry={EYE_GEO} material={EYE_MATERIAL} position={[-0.09, 0.01, 0.205]} />
          <mesh geometry={EYE_GEO} material={EYE_MATERIAL} position={[0.09, 0.01, 0.205]} />
          <mesh geometry={CHEEK_GEO} material={CHEEK_MATERIAL} position={[-0.15, -0.05, 0.16]} scale={[1, 0.7, 0.4]} />
          <mesh geometry={CHEEK_GEO} material={CHEEK_MATERIAL} position={[0.15, -0.05, 0.16]} scale={[1, 0.7, 0.4]} />
          <Accessory accessory={config.accessory} />
        </group>
      </group>
    </group>
  )
}
