/**
 * Les gestes dans le cadre : squelette réel de Rémi (fixture extraite du GLB, mesurée contre le rendu du
 * jeu) + vrai moteur de gestes + vraie pose des os + vrai cadrage + caméra à ce cadre. On vérifie, pour
 * chaque geste, des deux côtés, dans les deux variantes et plusieurs ratios de conteneur, que :
 *  - chaque segment de bras finit exactement dans la direction visée (la limite de rotation ne mord pas) ;
 *  - coudes et poings restent dans la largeur du cadre ;
 *  - les poings sont dans la partie visible du buste (au-dessus de la coupe, sous le menton) ;
 *  - les poings ne traversent pas le torse (volume approché).
 */
import { describe, expect, it } from 'vitest'
import { Group, PerspectiveCamera, Vector3 } from 'three'
import { BonePoseDriver } from './bonePose'
import { ATTENTION, BODY_YAW, BUST_FOV } from './config'
import { chinWorld, FIST_RADIUS as FIST_RADIUS_MEASURED } from './fistGeometry.fixture'
import { FRAME_SAFE_FRACTION, computeFraming } from './framing'
import { AIM_SEGMENTS, AIM_STRIDE, GESTURE_IDS, createGestureEngine, type AimSegment } from './gestures'
import { measureBust } from './rig'
import { makeRemiSkeleton } from './remiSkeleton.fixture'
import type { RemiBustVariant } from '../contract'

/** Le poing dépasse l'os du poignet d'environ 10 cm dans l'axe de l'avant-bras ; son rayon ~ 4,5 cm. */
const FIST_OFFSET = 0.1
const FIST_RADIUS = 0.045
/** Volume approché du torse autour de l'axe de la colonne (mesuré sur les rendus de `dev/capture-bust.mjs`). */
const TORSO_HALF_WIDTH = 0.2
const TORSO_HALF_DEPTH = 0.1

const CASES: [RemiBustVariant, number][] = [
  ['split', 0.6],
  ['split', 0.8],
  ['split', 1],
  ['split', 1.4],
  ['fullscreen', 0.42],
  ['fullscreen', 390 / 844],
  ['fullscreen', 0.5],
  ['fullscreen', 0.6],
]

function scene(variant: RemiBustVariant, aspect: number) {
  const { root, bones } = makeRemiSkeleton()
  const metrics = measureBust(root, 1.8)
  const world = new Group()
  world.rotation.y = BODY_YAW[variant]
  world.add(root)
  const framing = computeFraming({ metrics, variant, aspect, fovDeg: BUST_FOV })
  const camera = new PerspectiveCamera(BUST_FOV, aspect, 0.1, 30)
  camera.position.set(0, framing.cameraY, framing.distance)
  camera.lookAt(0, framing.cameraY, 0)
  camera.updateMatrixWorld(true)
  const driver = new BonePoseDriver(root, root)
  const make = () => createGestureEngine(1, { ...ATTENTION[variant], bodyYaw: BODY_YAW[variant], reach: framing.reach })
  return { root, bones, world, metrics, framing, camera, driver, make }
}

describe('gestes dans le cadre', () => {
  for (const [variant, aspect] of CASES) {
    it(`${variant}, ratio ${aspect.toFixed(2)} : visées atteintes, mains dans le cadre, devant le torse`, () => {
      const { bones, world, framing, camera, driver, make } = scene(variant, aspect)
      const halfFrameWidth = (framing.frameHeight * aspect) / 2
      const cutNdc = 1 - 2 * framing.cutFraction
      const chinNdc = 1 - 2 * framing.headCenterFraction
      const spine = bones.get('Spine01')!.getWorldPosition(new Vector3())
      const a = new Vector3()
      const b = new Vector3()

      for (const id of GESTURE_IDS) {
        for (const mirrored of [false, true]) {
          const engine = make()
          engine.forceGesture(id, mirrored)
          engine.update(1 / 60, 'speaking')
          driver.apply(engine.pose, engine.aim)
          world.updateMatrixWorld(true)
          let activeArms = 0

          for (const side of ['left', 'right'] as const) {
            const arm: AimSegment = `${side}Arm`
            const fore: AimSegment = `${side}ForeArm`
            if (engine.aim[AIM_SEGMENTS.indexOf(arm) * AIM_STRIDE + 3] < 0.5) continue
            activeArms++
            const label = `${id}${mirrored ? ' (miroir)' : ''}, bras ${side}`

            // 1. Chaque segment finit dans la direction visée : la rotation bornée n'a pas tronqué le geste.
            const cap = side === 'left' ? 'Left' : 'Right'
            for (const [seg, from, to] of [
              [arm, `${cap}Arm`, `${cap}ForeArm`],
              [fore, `${cap}ForeArm`, `${cap}Hand`],
            ] as const) {
              bones.get(from)!.getWorldPosition(a)
              bones.get(to)!.getWorldPosition(b)
              const dir = b.sub(a).normalize()
              const o = AIM_SEGMENTS.indexOf(seg) * AIM_STRIDE
              const target = new Vector3(engine.aim[o], engine.aim[o + 1], engine.aim[o + 2])
              expect(dir.angleTo(target), `${label}, ${seg}`).toBeLessThan(2e-3)
            }

            // 2. Coude et poing dans la largeur du cadre, 3. poing dans le buste visible.
            const elbow = bones.get(`${cap}ForeArm`)!.getWorldPosition(new Vector3())
            const wrist = bones.get(`${cap}Hand`)!.getWorldPosition(new Vector3())
            const fist = wrist.clone().add(wrist.clone().sub(elbow).normalize().multiplyScalar(FIST_OFFSET))
            const elbowNdc = elbow.clone().project(camera)
            const fistNdc = fist.clone().project(camera)
            // Le coude (articulation) est dans le cadre ; sa manche peut déborder un peu, comme au repos.
            expect(Math.abs(elbowNdc.x), `${label}, coude`).toBeLessThanOrEqual(1)
            // Le poing, rayon compris, est entièrement dans le cadre.
            expect(Math.abs(fistNdc.x) + FIST_RADIUS / halfFrameWidth, `${label}, poing`).toBeLessThanOrEqual(1)
            expect(fistNdc.y, `${label}, poing sous la coupe`).toBeGreaterThan(cutNdc + 0.05)
            expect(fistNdc.y, `${label}, poing au-dessus du menton`).toBeLessThan(chinNdc)

            // 4. Le poing ne traverse pas le torse : hors de l'ellipse du torse (grossie du rayon du poing).
            const inside = ((fist.x - spine.x) / (TORSO_HALF_WIDTH + FIST_RADIUS)) ** 2 + ((fist.z - spine.z) / (TORSO_HALF_DEPTH + FIST_RADIUS)) ** 2
            expect(inside, `${label}, poing hors du torse`).toBeGreaterThanOrEqual(1)
          }
          expect(activeArms, `${id}: au moins un bras actif`).toBeGreaterThan(0)
        }
      }
    })
  }

  it('réflexion : la main monte sous le menton, jamais devant la bouche ni les yeux', () => {
    for (const [variant, aspect] of CASES) {
      const { bones, world, camera, driver, make, framing } = scene(variant, aspect)
      const engine = make()
      for (let i = 0; i < 180; i++) engine.update(1 / 60, 'thinking')
      driver.apply(engine.pose, engine.aim)
      world.updateMatrixWorld(true)
      const elbow = bones.get('RightForeArm')!.getWorldPosition(new Vector3())
      const wrist = bones.get('RightHand')!.getWorldPosition(new Vector3())
      const fist = wrist.clone().add(wrist.clone().sub(elbow).normalize().multiplyScalar(FIST_OFFSET))
      // Le bout du menton (mesuré sur le maillage), pas l'os de la tête : celui-ci est ~5 cm plus haut, et un poing
      // collé au menton passait ce test (capture de Baptiste, 01/10). Le poing, rayon compris, reste sous le menton.
      const chinY = chinWorld(bones.get('Head')!).y
      expect(fist.y + FIST_RADIUS_MEASURED, `${variant} ${aspect}`).toBeLessThanOrEqual(chinY)
      expect(Math.abs(fist.clone().project(camera).x)).toBeLessThan(FRAME_SAFE_FRACTION)
      expect(fist.clone().project(camera).y).toBeGreaterThan(1 - 2 * framing.cutFraction)
    }
  })
})
