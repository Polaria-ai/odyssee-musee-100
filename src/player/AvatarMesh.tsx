// Propriétaire : agent joueur. Réutilisé par la présence et l'écran de personnalisation (~40 instances).
//
// Géométries « composées » : plusieurs volumes (corps + col, tête + frange, yeux + reflet…) sont
// fusionnés UNE SEULE FOIS au chargement du module (`mergeAvatarParts`, même technique que
// `src/world/roomGeometry.ts`) en une unique BufferGeometry, plutôt que rendus comme plusieurs
// <mesh> séparés. Le détail visuel augmente sans augmenter le nombre d'appels de dessin : budget
// tenu à ≤ 12 mesh par avatar dans toutes les configurations (tenue + accessoire), vérifié à l'œil
// avec `window.__musee.renderInfo()`. Les couleurs qui varient avec la tenue restent portées par un
// matériau (cloné une fois par couleur, `materialFor`) ; les fusions à deux couleurs fixes (yeux +
// reflet, fleur) portent leur couleur par sommet (`paintColor`, attribut `color`) sur un matériau
// unique `vertexColors: true` — jamais de géométrie reconstruite par image, jamais dans useFrame.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Group, Mesh } from 'three'
import type { AccessoryId, AvatarConfig, OutfitId } from '../types'
import { palette } from '../styles/tokens'

export interface AvatarMeshProps {
  config: AvatarConfig
  moving?: boolean
  /** Vitesse en m/s, pour le rythme de la marche. */
  speed?: number
}

// ---------------------------------------------------------------------------
// Aides de fusion — même contrat que `mergeAll`/`paint` de `src/world/roomGeometry.ts` :
// `mergeGeometries` exige des géométries toutes indexées ou toutes non-indexées (jamais un mélange),
// donc on uniformise vers « non-indexé » ici, une seule fois.
// ---------------------------------------------------------------------------

function mergeAvatarParts(parts: BufferGeometry[]): BufferGeometry {
  const uniform = parts.map((p) => (p.index ? p.toNonIndexed() : p))
  const merged = mergeGeometries(uniform, false)
  merged.computeBoundingSphere()
  return merged
}

const _avatarColor = new Color()
/** Peint tous les sommets d'une géométrie d'une couleur unie (attribut `color`), pour une fusion à couleurs mélangées. */
function paintColor(geo: BufferGeometry, hex: string): BufferGeometry {
  _avatarColor.set(hex)
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = _avatarColor.r
    colors[i * 3 + 1] = _avatarColor.g
    colors[i * 3 + 2] = _avatarColor.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

// ---------------------------------------------------------------------------
// Géométries partagées au niveau du module : créées une seule fois, réutilisées
// par toutes les instances (présence, personnalisation). Ne jamais en créer dans le composant.
// ---------------------------------------------------------------------------

// Tête : plus de segments (lissée), légèrement étirée en largeur / aplatie en profondeur au rendu
// (voir `scale` sur le <mesh>, pas ici) pour une silhouette « pomme » plutôt qu'une sphère nue.
// Rayon (0.24) volontairement inchangé : `src/features/avatar/preview.ts` mesure la vraie boîte
// englobante du mesh monté (jamais une proportion devinée), mais on garde la même hauteur de
// personnage par cohérence avec `docs/DESIGN.md` (« ≈ 1,15 m ») sans qu'aucun autre module ne le suppose.
const HEAD_GEO = new SphereGeometry(0.24, 22, 16)

const BODY_GEO = new CapsuleGeometry(0.17, 0.2, 4, 8)

/**
 * Frange modelée : calotte de cheveux + 3 mèches sur le front + une mèche latérale asymétrique.
 * `thetaLength` de la calotte réduit à 0.42π (contre 0.54π à l'origine) : à 0.54π elle descendait
 * jusqu'à y ≈ -0.03 (repère tête), sous le niveau des yeux (y = 0.01) — les cheveux recouvraient
 * alors quasi tout le visage, reflet et joues compris (régression trouvée en vérification visuelle,
 * capture `screens/player/01-customize-default-portrait.png`). À 0.42π la calotte s'arrête vers
 * y ≈ +0.09, nettement au-dessus des yeux ; les mèches ci-dessous redescendent depuis ce bord pour
 * une vraie frange sur le front, sans jamais engloutir le visage.
 */
function buildHairGeometry(): BufferGeometry {
  const cap = new SphereGeometry(0.248, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42)
  const parts: BufferGeometry[] = [cap]
  const bangs: Array<[number, number, number, number]> = [
    [-0.1, 0.075, 0.19, 0.3],
    [0, 0.09, 0.22, 0],
    [0.1, 0.075, 0.19, -0.3],
  ]
  for (const [x, y, z, tilt] of bangs) {
    const lock = new CapsuleGeometry(0.027, 0.05, 3, 6)
    lock.rotateX(Math.PI / 2 + 0.35)
    lock.rotateZ(tilt)
    lock.translate(x, y, z)
    parts.push(lock)
  }
  // Mèche latérale, un peu plus longue : casse la symétrie parfaite, silhouette plus « dessinée ».
  const wisp = new CapsuleGeometry(0.022, 0.1, 3, 6)
  wisp.rotateZ(-1.1)
  wisp.translate(0.2, -0.03, 0.02)
  parts.push(wisp)
  return mergeAvatarParts(parts)
}
const HAIR_GEO = buildHairGeometry()

/** Yeux (iris sombre) + petit reflet clair par sommet : une seule géométrie, `vertexColors: true`. */
function buildEyesGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = []
  const sides: Array<[number, number, number]> = [
    [-0.09, 0.01, 0.205],
    [0.09, 0.01, 0.205],
  ]
  for (const [x, y, z] of sides) {
    const iris = new SphereGeometry(0.03, 12, 10)
    paintColor(iris, '#241a14')
    iris.translate(x, y, z)
    parts.push(iris)
    const highlight = new SphereGeometry(0.011, 8, 6)
    paintColor(highlight, '#fefefe')
    highlight.translate(x - 0.012, y + 0.015, z + 0.022)
    parts.push(highlight)
  }
  return mergeAvatarParts(parts)
}
const EYES_GEO = buildEyesGeometry()

function buildCheeksGeometry(): BufferGeometry {
  const parts = [-0.15, 0.15].map((x) => {
    const cheek = new SphereGeometry(0.052, 10, 8)
    cheek.scale(1, 0.7, 0.42)
    cheek.translate(x, -0.05, 0.162)
    return cheek
  })
  return mergeAvatarParts(parts)
}
const CHEEK_GEO = buildCheeksGeometry()

/** Bras + petite main en moufle (aplatie, arrondie) fusionnés : un seul mesh par bras. */
function buildArmGeometry(): BufferGeometry {
  const arm = new CapsuleGeometry(0.06, 0.2, 4, 8)
  arm.translate(0, -0.13, 0)
  const hand = new SphereGeometry(0.078, 10, 8)
  hand.scale(1.12, 0.82, 1.02)
  hand.translate(0, -0.27, 0.01)
  return mergeAvatarParts([arm, hand])
}
const ARM_GEO = buildArmGeometry()

/** Chaussure (semelle + petit talon) : remplace le pied « boule » nue par une silhouette de soulier. */
function buildShoeGeometry(): BufferGeometry {
  const sole = new SphereGeometry(0.1, 12, 8)
  sole.scale(1.18, 0.72, 1.42)
  sole.translate(0, -0.028, 0.02)
  const heel = new SphereGeometry(0.062, 8, 6)
  heel.scale(1, 0.6, 0.85)
  heel.translate(0, -0.045, -0.07)
  return mergeAvatarParts([sole, heel])
}
const FOOT_GEO = buildShoeGeometry()

// --- Tenues : corps + détail de lisibilité fusionnés en une seule géométrie par tenue -------------
// (col pour le t-shirt, capuche + cordons pour le sweat, revers pour le costume, nœud pour la robe).
// La couleur de tenue reste portée par le matériau (`materialFor`) : ces géométries n'ont pas de
// couleur par sommet, uniquement de la forme.

function buildTeeGeometry(): BufferGeometry {
  const body = new CapsuleGeometry(0.17, 0.2, 4, 8)
  const collar = new TorusGeometry(0.095, 0.016, 6, 14, Math.PI * 1.2)
  collar.rotateX(Math.PI / 2 + 0.1)
  collar.rotateY(-Math.PI * 0.1)
  collar.translate(0, 0.215, 0.02)
  return mergeAvatarParts([body, collar])
}
const TEE_GEO = buildTeeGeometry()

function buildHoodieGeometry(): BufferGeometry {
  const body = new CapsuleGeometry(0.17, 0.2, 4, 8)
  body.scale(1.08, 1, 1.08)
  const hood = new SphereGeometry(0.12, 12, 9)
  hood.translate(0, 0.24, -0.1)
  const drawstringL = new CylinderGeometry(0.008, 0.008, 0.09, 5)
  drawstringL.translate(-0.035, 0.07, 0.185)
  const drawstringR = new CylinderGeometry(0.008, 0.008, 0.09, 5)
  drawstringR.translate(0.035, 0.07, 0.185)
  return mergeAvatarParts([body, hood, drawstringL, drawstringR])
}
const HOODIE_GEO = buildHoodieGeometry()

function buildSuitBodyGeometry(): BufferGeometry {
  const body = new CapsuleGeometry(0.17, 0.2, 4, 8)
  const lapelL = new BoxGeometry(0.05, 0.17, 0.02)
  lapelL.rotateZ(0.4)
  lapelL.translate(-0.08, 0.15, 0.145)
  const lapelR = new BoxGeometry(0.05, 0.17, 0.02)
  lapelR.rotateZ(-0.4)
  lapelR.translate(0.08, 0.15, 0.145)
  return mergeAvatarParts([body, lapelL, lapelR])
}
const SUIT_BODY_GEO = buildSuitBodyGeometry()

function buildDressGeometry(): BufferGeometry {
  const top = new CapsuleGeometry(0.16, 0.06, 4, 8)
  top.translate(0, 0.16, 0)
  const skirt = new ConeGeometry(0.27, 0.34, 14)
  skirt.translate(0, -0.03, 0)
  const bow = new TorusGeometry(0.032, 0.012, 6, 10)
  bow.rotateX(Math.PI / 2)
  bow.translate(0, 0.19, 0.14)
  return mergeAvatarParts([top, skirt, bow])
}
const DRESS_GEO = buildDressGeometry()

function buildOverallsTopGeometry(): BufferGeometry {
  const bib = new BoxGeometry(0.22, 0.18, 0.04)
  bib.translate(0, 0.05, 0.15)
  const strapL = new BoxGeometry(0.05, 0.34, 0.03)
  strapL.rotateX(0.25)
  strapL.translate(-0.08, 0.2, 0.12)
  const strapR = new BoxGeometry(0.05, 0.34, 0.03)
  strapR.rotateX(0.25)
  strapR.translate(0.08, 0.2, 0.12)
  const button = new SphereGeometry(0.014, 8, 6)
  button.translate(0, 0.02, 0.172)
  return mergeAvatarParts([bib, strapL, strapR, button])
}
const OVERALLS_TOP_GEO = buildOverallsTopGeometry()

// --- Accessoires : fusionnés quand plusieurs volumes partagent une couleur -------------------------

function buildGlassesGeometry(): BufferGeometry {
  const lensL = new CylinderGeometry(0.062, 0.062, 0.014, 14)
  lensL.rotateX(Math.PI / 2)
  lensL.translate(-0.09, 0, 0)
  const lensR = new CylinderGeometry(0.062, 0.062, 0.014, 14)
  lensR.rotateX(Math.PI / 2)
  lensR.translate(0.09, 0, 0)
  const bridge = new BoxGeometry(0.045, 0.012, 0.012)
  return mergeAvatarParts([lensL, lensR, bridge])
}
const GLASSES_GEO = buildGlassesGeometry()

const BERET_GEO = new CylinderGeometry(0.21, 0.19, 0.07, 14)

function buildHeadphonesGeometry(): BufferGeometry {
  const band = new TorusGeometry(0.25, 0.018, 6, 14, Math.PI)
  band.rotateZ(Math.PI)
  band.rotateX(Math.PI / 2)
  const cupL = new CylinderGeometry(0.06, 0.06, 0.03, 10)
  cupL.rotateZ(Math.PI / 2)
  cupL.translate(-0.24, -0.05, 0)
  const cupR = new CylinderGeometry(0.06, 0.06, 0.03, 10)
  cupR.rotateZ(Math.PI / 2)
  cupR.translate(0.24, -0.05, 0)
  return mergeAvatarParts([band, cupL, cupR])
}
const HEADPHONES_GEO = buildHeadphonesGeometry()

function buildFlowerGeometry(): BufferGeometry {
  const petals = new SphereGeometry(0.048, 10, 8)
  paintColor(petals, '#e76f6f')
  const center = new SphereGeometry(0.021, 8, 6)
  paintColor(center, '#e8c872')
  center.translate(0, 0, 0.032)
  return mergeAvatarParts([petals, center])
}
const FLOWER_GEO = buildFlowerGeometry()

function buildCapGeometry(): BufferGeometry {
  const dome = new SphereGeometry(0.255, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)
  const brim = new CylinderGeometry(0.17, 0.17, 0.02, 14, 1, false, -Math.PI / 2, Math.PI)
  brim.rotateX(Math.PI / 2)
  brim.translate(0, -0.02, 0.2)
  return mergeAvatarParts([dome, brim])
}
const CAP_GEO = buildCapGeometry()

const SHADOW_GEO = new PlaneGeometry(0.62, 0.62)

// ---------------------------------------------------------------------------
// Matériaux : fixes en constantes, dynamiques (couleurs d'avatar) mis en cache par couleur.
// ---------------------------------------------------------------------------

const EYES_MATERIAL = new MeshLambertMaterial({ vertexColors: true })
const CHEEK_MATERIAL = new MeshLambertMaterial({ color: '#f2a6a0', transparent: true, opacity: 0.85 })
const GLASSES_MATERIAL = new MeshLambertMaterial({ color: '#2c2420' })
const BERET_MATERIAL = new MeshLambertMaterial({ color: '#b0413e' })
const CAP_MATERIAL = new MeshLambertMaterial({ color: '#4fb3a9' })
const HEADPHONE_MATERIAL = new MeshLambertMaterial({ color: '#3b2a1e' })
const FLOWER_MATERIAL = new MeshLambertMaterial({ vertexColors: true })
const TIE_GEO = new BoxGeometry(0.06, 0.22, 0.03)
const TIE_MATERIAL = new MeshLambertMaterial({ color: '#3b2a1e' })
const UNDERSHIRT_MATERIAL = new MeshLambertMaterial({ color: '#fdf1d6' })
/** Chaussures : couleur fixe (brun encre), indépendante de la tenue — comme dans la plupart des jeux « cosy ». */
const SHOE_MATERIAL = new MeshLambertMaterial({ color: palette.ink })

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
      return <mesh geometry={GLASSES_GEO} material={GLASSES_MATERIAL} position={[0, 0.01, 0.21]} />
    case 'beret':
      return <mesh geometry={BERET_GEO} material={BERET_MATERIAL} position={[0.05, 0.24, -0.03]} rotation-z={-0.25} />
    case 'headphones':
      return <mesh geometry={HEADPHONES_GEO} material={HEADPHONE_MATERIAL} position={[0, 0.16, 0]} />
    case 'flower':
      return <mesh geometry={FLOWER_GEO} material={FLOWER_MATERIAL} position={[0.19, 0.18, 0.05]} />
    case 'cap':
      return <mesh geometry={CAP_GEO} material={CAP_MATERIAL} position={[0, 0.2, 0]} />
    default:
      return null
  }
}

function OutfitBody({ outfit, color }: { outfit: OutfitId; color: string }) {
  const outfitMaterial = materialFor(color)
  switch (outfit) {
    case 'dress':
      return <mesh geometry={DRESS_GEO} material={outfitMaterial} />
    case 'hoodie':
      return <mesh geometry={HOODIE_GEO} material={outfitMaterial} />
    case 'suit':
      return (
        <group>
          <mesh geometry={SUIT_BODY_GEO} material={outfitMaterial} />
          <mesh geometry={TIE_GEO} material={TIE_MATERIAL} position={[0, 0.03, 0.17]} />
        </group>
      )
    case 'overalls':
      return (
        <group>
          <mesh geometry={BODY_GEO} material={UNDERSHIRT_MATERIAL} />
          <mesh geometry={OVERALLS_TOP_GEO} material={outfitMaterial} />
        </group>
      )
    case 'tee':
    default:
      return <mesh geometry={TEE_GEO} material={outfitMaterial} />
  }
}

/**
 * Petit personnage chibi low-poly (≈ 1,15 m), pieds à y = 0, regarde vers +Z.
 * Géométries partagées et fusionnées au niveau du module, matériaux mis en cache par couleur : peut
 * être instancié une quarantaine de fois (présence + personnalisation) sans recréer de ressources
 * GPU, et sans dépasser 12 mesh (donc 12 appels de dessin) par instance, tenue + accessoire compris.
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
          <mesh geometry={ARM_GEO} material={skinMaterial} />
        </group>
        <group ref={armRightRef} position={[ARM_X, ARM_Y, 0]}>
          <mesh geometry={ARM_GEO} material={skinMaterial} />
        </group>

        <mesh ref={footLeftRef} geometry={FOOT_GEO} material={SHOE_MATERIAL} position={[-LEG_X, FOOT_BASE_Y, 0]} />
        <mesh ref={footRightRef} geometry={FOOT_GEO} material={SHOE_MATERIAL} position={[LEG_X, FOOT_BASE_Y, 0]} />

        <group position={[0, HEAD_Y, 0]}>
          <mesh geometry={HEAD_GEO} material={skinMaterial} scale={[1.04, 1, 0.97]} />
          <mesh geometry={HAIR_GEO} material={hairMaterial} />
          <mesh geometry={EYES_GEO} material={EYES_MATERIAL} />
          <mesh geometry={CHEEK_GEO} material={CHEEK_MATERIAL} />
          <Accessory accessory={config.accessory} />
        </group>
      </group>
    </group>
  )
}
