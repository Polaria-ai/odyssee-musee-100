// Propriétaire : agent joueur.
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Plane, Quaternion, Raycaster, Vector2, Vector3 } from 'three'
import type { Group } from 'three'
import type { MuseumLayout, Vec2, WingId } from '../types'
import { isOverlayOpen, useGame } from '../state/gameStore'
import { bridges, input, player } from '../state/runtime'
import { dims } from '../styles/tokens'
import { AvatarMesh } from './AvatarMesh'
import { escapeCollider, inputToWorldDirection, resolveMovement, smoothAngle } from './physics'
import {
  boundedCameraPosition,
  distanceForAspect,
  fixedOrientationReference,
  LOOK_DISTANCE_FACTOR,
  LOOK_STILLNESS_SECONDS,
  LOOK_TRANSITION_SECONDS,
  lookRaiseFor,
  prefersReducedMotion,
  stepBlend,
  dialogueShiftFor,
  DIALOGUE_TRANSITION_SECONDS,
} from './camera'

const WALK_SPEED = 3.2
const RUN_SPEED = 5.6
const ACCEL = 14 // m/s², montée en vitesse
const DECEL = 20 // m/s², freinage (plus vif que l'accélération)
const ROTATE_RATE = 12 // taux d'amortissement de la rotation, indépendant du framerate
const MOVE_EPSILON = 0.01 // en dessous, le joueur est considéré à l'arrêt

const TAP_STOP_DISTANCE = 0.3
const TAP_STUCK_TIMEOUT = 0.5

const NEARBY_CHECK_INTERVAL = 0.12 // ~120 ms
const CURATOR_RADIUS = 2.6
const FACING_DOT_MIN = 0.15 // le joueur doit à peu près se tourner vers le cadre pour qu'il s'illumine

// Caméra 3e personne, orientation fixe (diorama) : décalage derrière/au-dessus du joueur calculé
// depuis le contrat partagé `cameraRig` (src/styles/tokens.ts), distance adaptée au format d'écran.
// Seule la position (et, en mode « regard », la distance/hauteur visée) est amortie ; l'orientation
// est calculée une fois pour toutes (voir `fixedOrientationReference`, jamais recalculée par joueur).
const CAMERA_DAMP_RATE = 6

const FIXED_CAMERA_QUATERNION = new Quaternion()
{
  // `Object3D.lookAt()` oriente un objet quelconque pour que son +Z (pas -Z) regarde la cible
  // (voir la source three.js : elle inverse les arguments passés à `Matrix4.lookAt` sauf pour
  // `isCamera`/`isLight`). Avec un `Object3D` nu, le quaternion obtenu regarde donc exactement à
  // l'opposé de la cible une fois copié sur une vraie caméra (-Z) : la scène entière tombe hors
  // champ (caméra plein ciel). Un helper qui s'identifie comme caméra (`isCamera`) prend le bon
  // embranchement et vise réellement la cible.
  const { position, target } = fixedOrientationReference()
  const helper = new PerspectiveCamera()
  helper.position.set(position.x, position.y, position.z)
  helper.lookAt(target.x, target.y, target.z)
  FIXED_CAMERA_QUATERNION.copy(helper.quaternion)
}

const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const raycaster = new Raycaster()
const ndc = new Vector2()
const floorHit = new Vector3()

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/** `t` pour une interpolation exponentielle indépendante du framerate (`rate` en 1/s). */
function dampT(rate: number, delta: number): number {
  return 1 - Math.exp(-rate * delta)
}

function roomAt(layout: MuseumLayout, x: number, z: number): WingId | null {
  for (const room of layout.rooms) {
    const b = room.bounds
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return room.id
  }
  return null
}

/** Joueur : déplacement, collisions, caméra 3e personne, détection du portrait proche. */
export function Player({ layout }: { layout: MuseumLayout }) {
  const { camera, gl } = useThree()

  const groupRef = useRef<Group>(null)
  const dirRef = useRef<Vec2>({ x: 0, z: 0 })
  const tapStuckTimer = useRef(0)
  const nearbyTimer = useRef(0)
  const stillTimer = useRef(0)
  const lookBlend = useRef(0)
  const dialogueBlend = useRef(0)
  const reducedMotionRef = useRef(false)
  const [visualMoving, setVisualMoving] = useState(false)
  const [visualSpeed, setVisualSpeed] = useState(0)

  // Préférence « mouvement réduit » : lue une fois puis suivie via l'évènement `change`, jamais
  // interrogée à chaque image (le mode « regard » la lit 60 fois par seconde dans `useFrame`).
  useEffect(() => {
    reducedMotionRef.current = prefersReducedMotion()
    if (typeof window === 'undefined' || !window.matchMedia) return
    let mq: MediaQueryList
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    } catch {
      return
    }
    const onChange = () => {
      reducedMotionRef.current = mq.matches
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Si le joueur est téléporté (spawn, changement de plan) à l'intérieur d'un obstacle, on le repousse.
  // On resynchronise aussi le groupe rendu ici : sans ça, la toute première image affiche l'avatar
  // à l'origine du monde (position par défaut du groupe) avant le premier passage de `useFrame`.
  useEffect(() => {
    const safe = escapeCollider({ x: player.x, z: player.z }, dims.playerRadius, layout.colliders)
    player.x = safe.x
    player.z = safe.z
    if (groupRef.current) {
      groupRef.current.position.set(player.x, 0, player.z)
      groupRef.current.rotation.y = player.rotY
    }
  }, [layout])

  // Pont DOM → monde : convertit un tap écran en point au sol (utilisé par TouchJoystick).
  useEffect(() => {
    function screenToFloor(clientX: number, clientY: number): Vec2 | null {
      const rect = gl.domElement.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -(((clientY - rect.top) / rect.height) * 2 - 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.ray.intersectPlane(FLOOR_PLANE, floorHit)
      if (!hit) return null
      return { x: floorHit.x, z: floorHit.z }
    }
    bridges.screenToFloor = screenToFloor
    return () => {
      if (bridges.screenToFloor === screenToFloor) bridges.screenToFloor = null
    }
  }, [camera, gl])

  useFrame((state, rawDelta) => {
    // Un onglet remis au premier plan peut livrer un `delta` énorme : on le borne pour éviter un téléport.
    const dt = Math.min(rawDelta, 1 / 15)
    const overlay = isOverlayOpen(useGame.getState())

    let desiredSpeed = 0
    let usingTap = false

    if (!overlay) {
      const stickDir = inputToWorldDirection(input.moveX, input.moveY)
      if (stickDir.x !== 0 || stickDir.z !== 0) {
        input.tapTarget = null
        tapStuckTimer.current = 0
        dirRef.current = stickDir
        desiredSpeed = input.run ? RUN_SPEED : WALK_SPEED
      } else if (input.tapTarget) {
        const dx = input.tapTarget.x - player.x
        const dz = input.tapTarget.z - player.z
        const dist = Math.hypot(dx, dz)
        if (dist <= TAP_STOP_DISTANCE) {
          input.tapTarget = null
          tapStuckTimer.current = 0
        } else {
          dirRef.current = { x: dx / dist, z: dz / dist }
          desiredSpeed = WALK_SPEED
          usingTap = true
        }
      }
    }

    // Accélération / décélération douces vers la vitesse désirée (0 = pas d'entrée).
    player.speed =
      desiredSpeed > player.speed
        ? Math.min(desiredSpeed, player.speed + ACCEL * dt)
        : Math.max(desiredSpeed, player.speed - DECEL * dt)

    const moving = player.speed > MOVE_EPSILON

    if (moving) {
      const dir = dirRef.current
      const step = player.speed * dt
      const deltaMove = { x: dir.x * step, z: dir.z * step }
      const prevX = player.x
      const prevZ = player.z
      const next = resolveMovement({ x: player.x, z: player.z }, deltaMove, dims.playerRadius, layout.colliders)
      player.x = next.x
      player.z = next.z

      if (usingTap) {
        const intended = Math.hypot(deltaMove.x, deltaMove.z)
        const actual = Math.hypot(player.x - prevX, player.z - prevZ)
        if (intended > 1e-5 && actual < intended * 0.2) {
          tapStuckTimer.current += dt
          if (tapStuckTimer.current >= TAP_STUCK_TIMEOUT) {
            input.tapTarget = null
            tapStuckTimer.current = 0
          }
        } else {
          tapStuckTimer.current = 0
        }
      }

      const targetAngle = Math.atan2(dir.x, dir.z)
      player.rotY = smoothAngle(player.rotY, targetAngle, dampT(ROTATE_RATE, dt))
    } else {
      tapStuckTimer.current = 0
    }

    player.moving = moving

    // Applique la position/rotation au groupe rendu (le `player` chaud lui-même reste hors React).
    if (groupRef.current) {
      groupRef.current.position.set(player.x, 0, player.z)
      groupRef.current.rotation.y = player.rotY
    }

    // Portrait proche, comptoir d'accueil, salle courante : ~toutes les 120 ms, pas chaque image.
    nearbyTimer.current += dt
    if (nearbyTimer.current >= NEARBY_CHECK_INTERVAL) {
      nearbyTimer.current = 0
      const forwardX = Math.sin(player.rotY)
      const forwardZ = Math.cos(player.rotY)

      let nearestId: string | null = null
      let nearestDist = Infinity
      for (const frame of layout.frames) {
        const dx = frame.viewPoint.x - player.x
        const dz = frame.viewPoint.z - player.z
        const dist = Math.hypot(dx, dz)
        if (dist > dims.interactRadius) continue
        const toFrameX = frame.position[0] - player.x
        const toFrameZ = frame.position[2] - player.z
        const toFrameLen = Math.hypot(toFrameX, toFrameZ)
        if (toFrameLen < 1e-4) continue
        const facing = (toFrameX / toFrameLen) * forwardX + (toFrameZ / toFrameLen) * forwardZ
        if (facing < FACING_DOT_MIN) continue
        if (dist < nearestDist) {
          nearestDist = dist
          nearestId = frame.personId
        }
      }

      const curatorDist = Math.hypot(layout.curator.position.x - player.x, layout.curator.position.z - player.z)
      const g = useGame.getState()
      g.setNearby(nearestId)
      g.setNearCurator(curatorDist <= CURATOR_RADIUS)
      g.setCurrentRoom(roomAt(layout, player.x, player.z))
    }

    // Mode « regard » : portrait proche + joueur immobile depuis LOOK_STILLNESS_SECONDS → cadrage
    // resserré (voir camera.ts). `stillTimer` repart de zéro dès que le joueur bouge ; `lookBlend`
    // suit à vitesse constante (LOOK_TRANSITION_SECONDS, instantané si mouvement réduit).
    stillTimer.current = moving ? 0 : stillTimer.current + dt
    const nearbyPersonId = useGame.getState().nearbyPersonId
    const wantsLook = nearbyPersonId !== null && stillTimer.current >= LOOK_STILLNESS_SECONDS
    lookBlend.current = stepBlend(lookBlend.current, wantsLook ? 1 : 0, dt, LOOK_TRANSITION_SECONDS, reducedMotionRef.current)
    const dialogueOpen = useGame.getState().dialogue !== null
    dialogueBlend.current = stepBlend(dialogueBlend.current, dialogueOpen ? 1 : 0, dt, DIALOGUE_TRANSITION_SECONDS, reducedMotionRef.current)

    // Caméra : distance adaptée au format d'écran courant (contrat `cameraRig`, recalculée chaque
    // image — aucune allocation three.js, juste de l'arithmétique), resserrée en mode « regard ».
    // Position amortie (exponentielle, indépendante du framerate), bornée par le plan sans jamais
    // rogner le décalage normal près des bords (bug V1 corrigé à l'intégration, voir `camera.ts` :
    // les bornes sont décalées du décalage réellement appliqué pour la distance courante, qui varie
    // maintenant avec le format d'écran). Orientation toujours fixe (recopiée, jamais recalculée).
    const aspect = state.size.width / state.size.height
    const baseDistance = distanceForAspect(aspect)
    const distance = lerp(baseDistance, baseDistance * LOOK_DISTANCE_FACTOR, lookBlend.current)
    const extraY = lookRaiseFor(dims.frameCenterY, distance) * lookBlend.current
    const targetCam = boundedCameraPosition(player.x, player.z, distance, layout.bounds, extraY)
    const camT = dampT(CAMERA_DAMP_RATE, dt)
    state.camera.position.x = lerp(state.camera.position.x, targetCam.x, camT)
    state.camera.position.y = lerp(state.camera.position.y, targetCam.y, camT)
    const dialogueShift = dialogueShiftFor(distance, dialogueBlend.current)
    state.camera.position.z = lerp(state.camera.position.z, targetCam.z + dialogueShift, camT)
    state.camera.quaternion.copy(FIXED_CAMERA_QUATERNION)

    // État visuel (idle/marche de Cyril, voir AvatarMesh) : on ne pousse un re-render que sur un vrai changement,
    // le `player` chaud lui-même reste hors React à chaque image.
    if (player.moving !== visualMoving) setVisualMoving(player.moving)
    if (Math.abs(player.speed - visualSpeed) > 0.12) setVisualSpeed(player.speed)
  })

  return (
    <group ref={groupRef}>
      <AvatarMesh moving={visualMoving} speed={visualSpeed} />
    </group>
  )
}
