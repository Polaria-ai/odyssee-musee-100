/**
 * Poignets et poings de Rémi (WEL-927), par cinématique directe : squelette réel (fixture extraite du GLB) +
 * vrai moteur de gestes + vraie pose des os + vrai cadrage et caméra de chaque variante. On rejoue de longues
 * séquences (toutes les humeurs, plusieurs graines, plusieurs ratios de conteneur) et on vérifie, à chaque
 * instant échantillonné, que :
 *  - le poing reste SOUS le menton, avec une marge (jamais devant la bouche ni le menton : la capture de
 *    Baptiste montrait un poing collé au menton, que l'ancien test, qui prenait l'os de la tête pour le menton,
 *    laissait passer) ;
 *  - tout poing levé reste dans la largeur du cadre ;
 *  - en parole, l'orientation du poing dans le MONDE ne reste jamais la même plus de 1,5 s.
 * La géométrie du poing et du menton (`fistGeometry.fixture.ts`) est mesurée sur le maillage du GLB.
 */
import { describe, expect, it } from 'vitest'
import { Group, PerspectiveCamera, Quaternion } from 'three'
import type { RemiBustVariant, RemiMood } from '../contract'
import { BonePoseDriver } from './bonePose'
import { ATTENTION, BODY_YAW, BUST_FOV } from './config'
import { chinNdcY, fistCentreNdcY, fistNdcX, fistTopNdcY } from './fistGeometry.fixture'
import { computeFraming } from './framing'
import { GESTURE_IDS, createGestureEngine, type GestureEngine } from './gestures'
import { makeRemiSkeleton } from './remiSkeleton.fixture'
import { measureBust } from './rig'

/** Pas de la simulation : 30 i/s suffisent (un poing bouge de 3 cm au plus par pas) et coûtent moitié moins qu'à 60. */
const DT = 1 / 30
/** Délai laissé à chaque longue séquence : la machine de CI peut être très chargée. */
const LONG = 60_000
/** Le poing reste au moins 3 cm sous le menton (distance mesurée dans le plan du personnage, perspective comprise). */
const CHIN_MARGIN = 0.03

const CASES: [RemiBustVariant, number][] = [
  ['split', 0.8],
  ['split', 1.4],
  ['fullscreen', 390 / 844],
  ['fullscreen', 0.6],
]
/** Un enchaînement de 90 s qui passe par toutes les humeurs, dans un ordre où les transitions comptent. */
const SEQUENCE: [RemiMood, number][] = [
  ['speaking', 40],
  ['thinking', 8],
  ['speaking', 12],
  ['listening', 6],
  ['speaking', 20],
  ['idle', 4],
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
  const engine = (seed: number) => createGestureEngine(seed, { ...ATTENTION[variant], bodyYaw: BODY_YAW[variant], reach: framing.reach })
  return { bones, world, framing, camera, driver, engine }
}

type Scene = ReturnType<typeof scene>

interface Sample {
  /** Marge entre le haut du poing et le menton (mètres, plan du personnage). */
  margin: number
  /** Étendue horizontale écran du poing, rayon compris (NDC). */
  x: { min: number; max: number }
  /** Hauteur écran du centre du poing (NDC). */
  centreY: number
  gesture: string | null
}

/** Joue `seconds` secondes d'humeur `mood` et appelle `each` à une image sur `every`, après la pose des os. */
function play(s: Scene, engine: GestureEngine, mood: RemiMood, seconds: number, every: number, each: (hand: 'LeftHand' | 'RightHand', sample: Sample, frame: number) => void, frameStart = 0): number {
  const frames = Math.round(seconds / DT)
  for (let f = 0; f < frames; f++) {
    engine.update(DT, mood)
    s.driver.apply(engine.pose, engine.aim)
    s.world.updateMatrixWorld(true)
    if ((frameStart + f) % every !== 0) continue
    const chin = chinNdcY(s.bones.get('Head')!, s.camera)
    for (const hand of ['LeftHand', 'RightHand'] as const) {
      const bone = s.bones.get(hand)!
      each(
        hand,
        {
          margin: ((chin - fistTopNdcY(bone, s.camera)) * s.framing.frameHeight) / 2,
          x: fistNdcX(bone, s.camera),
          centreY: fistCentreNdcY(bone, s.camera),
          gesture: engine.activeGesture,
        },
        frameStart + f,
      )
    }
  }
  return frameStart + frames
}

describe('poings : jamais devant le visage', () => {
  it(`toutes humeurs, 3 graines, 4 cadres : le haut du poing reste à ${CHIN_MARGIN * 100} cm au moins sous le bout du menton`, () => {
    let worst = Infinity
    let where = ''
    for (const [variant, aspect] of CASES) {
      const s = scene(variant, aspect)
      for (const seed of [1, 2, 3]) {
        const engine = s.engine(seed)
        let frame = 0
        for (const [mood, seconds] of SEQUENCE) {
          frame = play(s, engine, mood, seconds, 2, (hand, sample) => {
            if (sample.margin < worst) {
              worst = sample.margin
              where = `${variant} ${aspect.toFixed(2)} graine ${seed} ${hand} ${mood} ${sample.gesture ?? ''}`
            }
          }, frame)
        }
      }
    }
    expect(worst, where).toBeGreaterThanOrEqual(CHIN_MARGIN)
  }, LONG)

  it(`chaque geste forcé, des deux côtés, oscillations et battements compris : poing à ${CHIN_MARGIN * 100} cm au moins sous le menton`, () => {
    for (const [variant, aspect] of CASES) {
      const s = scene(variant, aspect)
      for (const id of GESTURE_IDS) {
        for (const mirrored of [false, true]) {
          const engine = s.engine(1)
          engine.forceGesture(id, mirrored)
          let worst = Infinity
          play(s, engine, 'speaking', 7, 4, (_hand, sample) => (worst = Math.min(worst, sample.margin)))
          expect(worst, `${variant} ${aspect.toFixed(2)} ${id}${mirrored ? ' (miroir)' : ''}`).toBeGreaterThanOrEqual(CHIN_MARGIN)
        }
      }
    }
  }, LONG)

  it('réflexion : la main reste sous le menton, dans le cadre, et visible (au-dessus de la coupe du buste)', () => {
    for (const [variant, aspect] of CASES) {
      const s = scene(variant, aspect)
      const engine = s.engine(1)
      const cutNdc = 1 - 2 * s.framing.cutFraction
      const installed = play(s, engine, 'thinking', 3, 1000, () => {}) // la pose s'installe
      let worst = Infinity
      let highest = -Infinity
      let lowest = Infinity
      play(s, engine, 'thinking', 10, 3, (hand, sample) => {
        if (hand !== 'RightHand') return
        worst = Math.min(worst, sample.margin)
        highest = Math.max(highest, sample.centreY)
        lowest = Math.min(lowest, sample.centreY)
        expect(sample.x.min, `${variant} ${aspect.toFixed(2)}`).toBeGreaterThan(-1)
        expect(sample.x.max, `${variant} ${aspect.toFixed(2)}`).toBeLessThan(1)
      }, installed)
      expect(worst, `${variant} ${aspect.toFixed(2)} : sous le menton`).toBeGreaterThanOrEqual(CHIN_MARGIN)
      expect(lowest, `${variant} ${aspect.toFixed(2)} : au-dessus de la coupe`).toBeGreaterThan(cutNdc)
      expect(highest, `${variant} ${aspect.toFixed(2)} : au niveau de la poitrine, pas du visage`).toBeLessThan(chinNdcY(s.bones.get('Head')!, s.camera))
    }
  }, LONG)

  it('tout poing levé reste dans la largeur du cadre (rayon du poing compris), durant toutes les séquences', () => {
    for (const [variant, aspect] of CASES) {
      const s = scene(variant, aspect)
      const cutNdc = 1 - 2 * s.framing.cutFraction
      let raisedSamples = 0
      let outside = 0
      let worst = 0
      for (const seed of [1, 2]) {
        const engine = s.engine(seed)
        let frame = 0
        for (const [mood, seconds] of SEQUENCE) {
          frame = play(s, engine, mood, seconds, 3, (_hand, sample) => {
            if (sample.centreY <= cutNdc) return // main qui pend : sous la coupe, masquée par le fondu du buste
            raisedSamples++
            const over = Math.max(sample.x.max - 1, -1 - sample.x.min)
            if (over > 0) {
              outside++
              worst = Math.max(worst, over)
            }
          }, frame)
        }
      }
      expect(raisedSamples, `${variant} ${aspect.toFixed(2)} : des poings levés ont été vus`).toBeGreaterThan(100)
      expect(outside, `${variant} ${aspect.toFixed(2)} : dépassement max ${worst.toFixed(3)} NDC`).toBe(0)
    }
  }, LONG)
})

describe('poings : variété vue à l\'écran', () => {
  it('en parole, l\'orientation du poing dans le monde ne reste jamais la même plus de 1,5 s (3 graines, 2 mains, 2 variantes)', () => {
    const windowFrames = Math.round(1.5 / DT)
    for (const [variant, aspect] of [CASES[0], CASES[2]]) {
      const s = scene(variant, aspect)
      for (const seed of [1, 2, 3]) {
        const engine = s.engine(seed)
        const quats: Record<string, Quaternion[]> = { LeftHand: [], RightHand: [] }
        play(s, engine, 'speaking', 2, 1000, () => {}) // la parole s'installe (transition d'humeur, premier geste)
        const frames = Math.round(60 / DT)
        for (let f = 0; f < frames; f++) {
          engine.update(DT, 'speaking')
          s.driver.apply(engine.pose, engine.aim)
          s.world.updateMatrixWorld(true)
          if (f % 2 === 0) for (const hand of ['LeftHand', 'RightHand'] as const) quats[hand].push(s.bones.get(hand)!.getWorldQuaternion(new Quaternion()))
        }
        for (const hand of ['LeftHand', 'RightHand'] as const) {
          const series = quats[hand]
          const length = windowFrames / 2
          let least = Infinity
          for (let a = 0; a + length < series.length; a++) {
            // Étendue de la fenêtre : le plus grand angle entre deux orientations du poing sur ces 1,5 s.
            let range = 0
            for (let i = a; i <= a + length; i += 2) for (let j = i + 2; j <= a + length; j += 2) range = Math.max(range, series[i].angleTo(series[j]))
            least = Math.min(least, range)
          }
          // Mesuré : au pire 4° (le poing qui pend, hors cadre) ; un poing levé bouge de 10° et plus.
          expect((least * 180) / Math.PI, `${variant} graine ${seed} ${hand}`).toBeGreaterThanOrEqual(3.5)
        }
      }
    }
  }, LONG)
})
