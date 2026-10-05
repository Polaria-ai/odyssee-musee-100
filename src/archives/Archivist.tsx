/**
 * L'Archiviste de 2040 : une IA venue du futur, devenue un vrai personnage 3D « comme Cyril ou Rémi »
 * (décision de Baptiste du 01/10/2026, WEL-928). Personne ENTIÈREMENT GÉNÉRÉE (aucune personne réelle) :
 * `GlbCharacter` (clips « idle » en boucle, « wave » joué une fois à l'approche, « talk » pendant ses
 * répliques), posée pieds à y = 0 à `placement.position`, orientée vers le joueur dans une plage bornée
 * (`turnToward` / `approach`, comme `npc/Remi.tsx`).
 *
 * Identité « IA venue de 2040 », sobre : un socle projecteur plat sous ses pieds, son liseré cyan et un
 * halo cyan au sol (couleurs `charter3d.archives.archivist`, voir `docs/CHARTE-3D.md` §4.8). Plus d'anneaux,
 * de particules ni de silhouette translucide. La bulle « … » d'invitation au-dessus de la tête est conservée.
 *
 * Inchangés : le collider (`layout.ts`), la portée de conversation (`ARCHIVIST_TALK_RADIUS`) et les
 * dialogues (`archivistScript.ts`). Caméra toujours AU SUD du joueur : rien de haut entre eux (elle mesure
 * 1,7 m, le socle quelques centimètres).
 *
 * Géométries et matériaux partagés (créés une seule fois, au chargement du module) ; aucune allocation
 * d'objet three.js dans `useFrame` (seuls des nombres sont écrits). Le modèle se charge sous son propre
 * `<Suspense>` : tant qu'il arrive, la salle (et le reste du musée) s'affiche sans lui.
 * Propriétaire : workflow « Archives de 2040 ».
 */
import { Suspense, useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GlbCharacter } from '../characters'
import { findSkinnedMesh } from '../characters/characterRig'
import { BODY_TURN_RATE, approach, turnToward } from '../npc/remiBehavior'
import type { Placement } from '../types'
import { useGame } from '../state/gameStore'
import { debugEnabled } from '../scene/debugApi'
import { archivistProbe, player as runtimePlayer } from '../state/runtime'
import { charter3d } from '../styles/tokens'
import { playerCoversBubble } from './archivistBubble'
import { ARCHIVIST_NAME } from './archivistScript'
import { ARCHIVIST_TALK_RADIUS } from './room/constants'
import { useArchivistGreeting } from './useArchivistGreeting'

// --- Réglages -----------------------------------------------------------------
/** Portée de détection du joueur (contrat) : identique à `store.setNearArchivist`. */
const ARCHIVIST_RADIUS = ARCHIVIST_TALK_RADIUS
const NEARBY_CHECK_INTERVAL = 0.15 // ~150 ms, comme les autres sondes de proximité du jeu
/**
 * Hauteur du centre de la bulle : au-dessus de la tête (1,7 m) et du bras levé pendant le salut. La
 * bulle mesure 0,40 m de haut : son bord bas est à 2,05 m, juste au-dessus de la main levée.
 */
const BUBBLE_BASE_Y = 2.25
const BUBBLE_BOB = 0.05
/**
 * Elle ne suit le joueur du regard que de près (au-delà, elle reprend son orientation de repos) : le
 * joueur resté dans le hall, au nord du mur, ne la ferait sinon pas se tourner vers ce mur.
 */
const TRACK_RADIUS = 6.5

/** Compteur de la sonde de test (`archivistProbe.drawn`) : appelé par three à chaque fois que le maillage est dessiné. */
function countDraw(): void {
  archivistProbe.drawn += 1
}

const colors = charter3d.archives.archivist // socle, liseré, halo cyan et bulle (voir docs/CHARTE-3D.md §4.8)

// --- Socle projecteur et halo (géométries partagées : un seul Archiviste dans le jeu) ------------
const PLINTH_HEIGHT = 0.03
const PLINTH_RADIUS = 0.66
const HALO_RADIUS = 1.15
const geo = {
  plinth: new THREE.CylinderGeometry(PLINTH_RADIUS - 0.04, PLINTH_RADIUS, PLINTH_HEIGHT, 40),
  /** Liseré cyan posé sur le socle, à plat. */
  rim: new THREE.RingGeometry(PLINTH_RADIUS - 0.09, PLINTH_RADIUS - 0.03, 56).rotateX(-Math.PI / 2),
  /** Halo au sol, plus large que le socle. */
  halo: new THREE.CircleGeometry(HALO_RADIUS, 48).rotateX(-Math.PI / 2),
  bubble: new THREE.PlaneGeometry(0.52, 0.4),
}

const mat = {
  plinth: new THREE.MeshLambertMaterial({ color: colors.plinth }),
  rim: new THREE.MeshBasicMaterial({ color: colors.plinthRim }),
}

let haloMaterialCache: THREE.MeshBasicMaterial | null = null
let bubbleMaterialCache: THREE.MeshBasicMaterial | null = null

/** Opacité du halo au repos, et amplitude de sa respiration (nombres écrits dans `useFrame`). */
const HALO_OPACITY = 0.9
const HALO_BREATH = 0.12

/** Halo cyan : dégradé radial (transparent sous le socle, cyan près du liseré, fondu vers l'extérieur). */
function getHaloMaterial(): THREE.MeshBasicMaterial {
  if (haloMaterialCache) return haloMaterialCache
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  let map: THREE.CanvasTexture | null = null
  if (ctx) {
    const c = size / 2
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c)
    // Le rayon du canvas vaut HALO_RADIUS (1,15 m) : le bord du socle est à ~0,57 de ce rayon.
    gradient.addColorStop(0, 'rgba(109, 228, 229, 0)')
    gradient.addColorStop(0.5, 'rgba(109, 228, 229, 0)')
    gradient.addColorStop(0.58, 'rgba(109, 228, 229, 0.42)')
    gradient.addColorStop(0.78, 'rgba(109, 228, 229, 0.14)')
    gradient.addColorStop(1, 'rgba(109, 228, 229, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.needsUpdate = true
  }
  haloMaterialCache = new THREE.MeshBasicMaterial({
    color: colors.halo,
    map,
    transparent: true,
    opacity: HALO_OPACITY,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  return haloMaterialCache
}

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
    ctx.fillStyle = colors.bubbleFill
    ctx.fill()
    ctx.strokeStyle = colors.bubbleStroke
    ctx.lineWidth = 4
    roundRect(ctx, 6, 6, 116, 58, 20)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(52, 62)
    ctx.lineTo(64, 92)
    ctx.lineTo(76, 62)
    ctx.closePath()
    ctx.fillStyle = colors.bubbleFill
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = colors.bubbleDots
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

/**
 * L'Archiviste, debout sur son socle projecteur. Détecte lui-même la proximité du joueur
 * (`runtime.player`, rayon `ARCHIVIST_RADIUS`) et met à jour `store.setNearArchivist` : aucun
 * autre module ne calcule cette distance.
 */
export function Archivist({ placement }: { placement: Placement }) {
  const dialogue = useGame((s) => s.dialogue)
  const nearArchivist = useGame((s) => s.nearArchivist)
  const { waving, onWaveDone } = useArchivistGreeting()

  const dialogueOpen = dialogue !== null
  const isArchivistSpeaking = dialogueOpen && dialogue?.speaker === ARCHIVIST_NAME
  const showBubble = nearArchivist && !dialogueOpen
  // Le salut prime ; ensuite elle gesticule tant qu'elle parle ; sinon elle attend.
  const clip = waving ? 'wave' : isArchivistSpeaking ? 'talk' : 'idle'

  const bodyRef = useRef<THREE.Group | null>(null)
  const bubbleRef = useRef<THREE.Mesh | null>(null)
  const turn = useRef(0)
  const nearbyTimer = useRef(0)

  const bubbleMat = useMemo(() => getBubbleMaterial(), [])
  const haloMat = useMemo(() => getHaloMaterial(), [])

  // Sonde de test (`window.__musee.archivist()`, voir `scene/debugApi.ts`) : le clip demandé…
  useLayoutEffect(() => {
    archivistProbe.clip = clip
  }, [clip])

  // … et le chargement du modèle : le groupe du personnage n'est monté qu'une fois le GLB arrivé (avant,
  // le `<Suspense>` ne rend rien). Ref par fonction : le parent ne se re-rend pas quand le modèle arrive.
  const bindBody = useCallback((group: THREE.Group | null) => {
    bodyRef.current = group
    const mesh = group ? findSkinnedMesh(group) : null
    archivistProbe.loaded = !!mesh
    archivistProbe.triangles = mesh ? Math.round((mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3) : 0
    // Three n'appelle `onBeforeRender` que pour un objet réellement dessiné (après le culling) : de quoi tester
    // qu'elle n'est pas dessinée hors du champ. Rien en production (sonde de test inactive).
    if (mesh && debugEnabled()) mesh.onBeforeRender = countDraw
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dx = runtimePlayer.x - placement.position.x
    const dz = runtimePlayer.z - placement.position.z

    // Le buste suit le joueur (borné autour de l'orientation de repos) tant qu'il est près ; l'orientation
    // n'est donc écrite qu'ici, jamais par une prop.
    const body = bodyRef.current
    if (body) {
      const target = dx * dx + dz * dz <= TRACK_RADIUS * TRACK_RADIUS ? turnToward(dx, dz, placement.rotationY) : 0
      turn.current = approach(turn.current, target, BODY_TURN_RATE, delta)
      body.rotation.y = placement.rotationY + turn.current
      archivistProbe.yaw = turn.current
    }

    // Halo : respiration lente de l'opacité (un matériau partagé, un nombre écrit).
    haloMat.opacity = HALO_OPACITY + Math.sin(t * 1.6) * HALO_BREATH

    // Bulle « … » : flotte doucement et fait toujours face à la caméra. Cachée quand le joueur est juste
    // derrière elle : la caméra est au sud, la bulle se poserait sur son torse (`archivistBubble.ts`).
    const bubble = bubbleRef.current
    if (bubble) {
      bubble.position.y = BUBBLE_BASE_Y + Math.sin(t * 2.2) * BUBBLE_BOB
      bubble.quaternion.copy(state.camera.quaternion)
      bubble.visible = !playerCoversBubble(dx, dz)
    }

    // Détection de proximité (contrat) : ~150 ms, pas chaque image.
    nearbyTimer.current += delta
    if (nearbyTimer.current >= NEARBY_CHECK_INTERVAL) {
      nearbyTimer.current = 0
      useGame.getState().setNearArchivist(Math.hypot(dx, dz) <= ARCHIVIST_RADIUS)
    }
  })

  return (
    <>
      {/* Socle projecteur plat, liseré et halo cyan au sol : l'identité « IA venue de 2040 », sans écran ni silhouette. */}
      <group position={[placement.position.x, 0, placement.position.z]}>
        <mesh geometry={geo.plinth} material={mat.plinth} position={[0, PLINTH_HEIGHT / 2, 0]} />
        <mesh geometry={geo.rim} material={mat.rim} position={[0, PLINTH_HEIGHT + 0.002, 0]} />
        <mesh geometry={geo.halo} material={haloMat} position={[0, 0.012, 0]} renderOrder={1} />
      </group>

      <Suspense fallback={null}>
        <GlbCharacter
          ref={bindBody}
          character="archiviste"
          clip={clip}
          oneShot={waving}
          onDone={onWaveDone}
          position={[placement.position.x, 0, placement.position.z]}
        />
      </Suspense>

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
