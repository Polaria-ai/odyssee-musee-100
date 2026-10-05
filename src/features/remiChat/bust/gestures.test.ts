import { describe, expect, it } from 'vitest'
import { Euler, Quaternion } from 'three'
import type { RemiMood } from '../contract'
import {
  AIM_COUNT,
  AIM_SEGMENTS,
  AIM_STRIDE,
  BONE_LIMITS,
  DRIVEN_BONES,
  FIRST_GESTURE_DELAY_MAX,
  FIRST_GESTURE_DELAY_MIN,
  GESTURE_IDS,
  GESTURE_INTERVAL_MAX,
  GESTURE_INTERVAL_MIN,
  GesturePlanner,
  MAX_DT,
  MOODS,
  MOOD_BLEND_SECONDS,
  POSE_LENGTH,
  WRIST_BEAT_INTERVAL_MAX,
  WRIST_BEAT_INTERVAL_MIN,
  WRIST_DRIFT,
  WRIST_LIMIT_FLEX,
  WRIST_LIMIT_TILT,
  WRIST_LIMIT_TWIST,
  createGestureEngine,
  createRng,
  gestureAims,
  gestureDurationRange,
  gestureEnvelope,
  gestureWrists,
  smootherstep,
  softLimit,
  type GestureEngine,
} from './gestures'

const DT = 1 / 60
/** Vitesse angulaire maximale d'un poignet (rad/s) : ~183°/s, un petit coup de poignet vif, jamais un à-coup. Mesuré : 165°/s. */
const WRIST_MAX_RAD_PER_S = 3.2

/** Fait tourner le moteur `seconds` secondes dans l'humeur `mood`, en appelant `each` après chaque image. */
function run(engine: GestureEngine, mood: RemiMood, seconds: number, each?: () => void): void {
  const frames = Math.round(seconds / DT)
  for (let i = 0; i < frames; i++) {
    engine.update(DT, mood)
    each?.()
  }
}

const poseIndex = (bone: (typeof DRIVEN_BONES)[number]) => DRIVEN_BONES.indexOf(bone) * 3
const copy = (a: Float32Array) => Array.from(a)

describe('outils numériques', () => {
  it('createRng : suite reproductible dans [0, 1), différente selon la graine', () => {
    const a = createRng(42)
    const b = createRng(42)
    const c = createRng(43)
    const seqA = Array.from({ length: 50 }, () => a())
    expect(Array.from({ length: 50 }, () => b())).toEqual(seqA)
    expect(Array.from({ length: 50 }, () => c())).not.toEqual(seqA)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('smootherstep : 0 → 1, monotone, plat aux deux bornes', () => {
    expect(smootherstep(-1)).toBe(0)
    expect(smootherstep(0)).toBe(0)
    expect(smootherstep(1)).toBe(1)
    expect(smootherstep(2)).toBe(1)
    let prev = 0
    for (let x = 0; x <= 1; x += 0.01) {
      const v = smootherstep(x)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = v
    }
    expect(smootherstep(0.001)).toBeLessThan(1e-7)
    expect(1 - smootherstep(0.999)).toBeLessThan(1e-7)
  })

  it('softLimit : borne stricte, impaire, quasi identité près de 0', () => {
    for (const x of [-1e6, -50, -3, -0.5, 0, 0.2, 1, 7, 1e6]) {
      expect(Math.abs(softLimit(x, 0.4))).toBeLessThanOrEqual(0.4)
      expect(softLimit(-x, 0.4)).toBeCloseTo(-softLimit(x, 0.4), 12)
    }
    expect(softLimit(0.01, 0.4)).toBeCloseTo(0.01, 4)
    let prev = -Infinity
    for (let x = -3; x <= 3; x += 0.05) {
      const v = softLimit(x, 0.4)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('gestureEnvelope', () => {
  it('vaut 0 hors du geste et aux deux extrémités, 1 sur le plateau, sans saut', () => {
    expect(gestureEnvelope(-0.1, 2)).toBe(0)
    expect(gestureEnvelope(0, 2)).toBe(0)
    expect(gestureEnvelope(2, 2)).toBe(0)
    expect(gestureEnvelope(2.5, 2)).toBe(0)
    expect(gestureEnvelope(1.1, 2)).toBeCloseTo(1, 6)
    let prev = 0
    for (let t = 0; t <= 2; t += 0.002) {
      const v = gestureEnvelope(t, 2)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      expect(Math.abs(v - prev)).toBeLessThan(0.01)
      prev = v
    }
  })

  it('durée nulle ou invalide : jamais NaN', () => {
    expect(gestureEnvelope(0.5, 0)).toBe(0)
    expect(gestureEnvelope(0.5, Number.NaN)).toBe(0)
  })
})

describe('GesturePlanner', () => {
  it('durées dans les bornes de chaque geste, intervalles de 2,5 à 4 s, jamais le même geste deux fois de suite', () => {
    const planner = new GesturePlanner(createRng(7))
    const seen = new Set<string>()
    let last = ''
    for (let i = 0; i < 400; i++) {
      const g = planner.next()
      const range = gestureDurationRange(g.id)
      expect(g.duration).toBeGreaterThanOrEqual(range.min)
      expect(g.duration).toBeLessThanOrEqual(range.max)
      expect(range.min).toBeGreaterThanOrEqual(1.5) // jamais un geste éclair
      expect(range.max).toBeLessThanOrEqual(3.6) // ni un geste qui s'éternise
      expect(g.nextIn).toBeGreaterThanOrEqual(GESTURE_INTERVAL_MIN)
      expect(g.nextIn).toBeLessThanOrEqual(GESTURE_INTERVAL_MAX)
      expect(g.amplitude).toBeGreaterThanOrEqual(0.85)
      expect(g.amplitude).toBeLessThanOrEqual(1)
      expect(g.id).not.toBe(last)
      last = g.id
      seen.add(g.id)
    }
    expect(seen.size).toBe(GESTURE_IDS.length)
    expect(GESTURE_IDS.length).toBeGreaterThanOrEqual(4)
    expect(GESTURE_IDS.length).toBeLessThanOrEqual(6)
  })

  it('délai du premier geste borné ; même graine, même programme ; graine différente, autre programme', () => {
    const a = new GesturePlanner(createRng(11))
    const b = new GesturePlanner(createRng(11))
    const c = new GesturePlanner(createRng(12))
    const delay = a.firstDelay()
    expect(delay).toBeGreaterThanOrEqual(FIRST_GESTURE_DELAY_MIN)
    expect(delay).toBeLessThanOrEqual(FIRST_GESTURE_DELAY_MAX)
    expect(b.firstDelay()).toBe(delay)
    c.firstDelay()
    const plan = (p: GesturePlanner) => Array.from({ length: 30 }, () => p.next())
    expect(plan(a)).toEqual(plan(b))
    expect(plan(c)).not.toEqual(plan(new GesturePlanner(createRng(11))))
  })

  it('les gestes symétriques ne sont jamais retournés ; les autres le sont aux deux côtés', () => {
    const planner = new GesturePlanner(createRng(3))
    const sides = new Map<string, Set<boolean>>()
    for (let i = 0; i < 400; i++) {
      const g = planner.next()
      if (!sides.has(g.id)) sides.set(g.id, new Set())
      sides.get(g.id)!.add(g.mirrored)
    }
    for (const id of ['openPalms', 'openArms', 'weigh'] as const) expect([...sides.get(id)!]).toEqual([false])
    for (const id of ['enumerate', 'heart', 'point'] as const) expect(sides.get(id)!.size).toBe(2)
  })
})

describe('bibliothèque de gestes', () => {
  it('visées unitaires ; le miroir retourne x et change de bras', () => {
    for (const id of GESTURE_IDS) {
      for (const dir of Object.values(gestureAims(id))) expect(Math.hypot(...dir)).toBeCloseTo(1, 5)
    }
    const right = gestureAims('enumerate')
    const left = gestureAims('enumerate', true)
    expect(Object.keys(right).sort()).toEqual(['rightArm', 'rightForeArm'])
    expect(Object.keys(left).sort()).toEqual(['leftArm', 'leftForeArm'])
    expect(left.leftArm![0]).toBeCloseTo(-right.rightArm![0], 6)
    expect(left.leftArm![1]).toBeCloseTo(right.rightArm![1], 6)
    expect(left.leftForeArm![2]).toBeCloseTo(right.rightForeArm![2], 6)
  })

  it('les mains finissent devant le torse : avant-bras vers l\'avant (z > 0) et jamais vers l\'arrière', () => {
    for (const id of GESTURE_IDS) {
      const aims = gestureAims(id)
      for (const seg of AIM_SEGMENTS) {
        const dir = aims[seg]
        if (!dir) continue
        // Aucun segment ne pointe derrière le corps ni vers le haut au-dessus de l'épaule (bras) : pas de bras qui traverse le torse.
        expect(dir[2], `${id} ${seg}`).toBeGreaterThanOrEqual(0)
        if (seg === 'leftArm' || seg === 'rightArm') expect(dir[1], `${id} ${seg}`).toBeLessThan(0)
      }
    }
  })
})

describe('moteur de gestes', () => {
  it('déterministe : même graine et mêmes appels → mêmes poses, à l\'identique', () => {
    const a = createGestureEngine(99)
    const b = createGestureEngine(99)
    const moods: RemiMood[] = ['idle', 'speaking', 'listening', 'speaking', 'thinking', 'speaking']
    for (const mood of moods) {
      run(a, mood, 4)
      run(b, mood, 4)
      expect(copy(a.pose)).toEqual(copy(b.pose))
      expect(copy(a.aim)).toEqual(copy(b.aim))
    }
  })

  it('graine différente → autre chorégraphie', () => {
    const a = createGestureEngine(1)
    const b = createGestureEngine(2)
    run(a, 'speaking', 6)
    run(b, 'speaking', 6)
    expect(copy(a.pose)).not.toEqual(copy(b.pose))
  })

  it('poids d\'humeur continus, somme 1, bascule complète en MOOD_BLEND_SECONDS', () => {
    const engine = createGestureEngine(5)
    run(engine, 'idle', 1)
    expect(engine.weights[0]).toBeCloseTo(1, 6)
    let prev = Array.from(engine.weights)
    for (let i = 0; i < 400; i++) {
      engine.update(DT, i < 200 ? 'speaking' : 'thinking')
      const w = Array.from(engine.weights)
      expect(w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5)
      w.forEach((v, k) => {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1 + 1e-6)
        expect(Math.abs(v - prev[k])).toBeLessThan(0.06)
      })
      prev = w
      if (i === Math.ceil(MOOD_BLEND_SECONDS / DT) + 2) expect(engine.weights[MOODS.indexOf('speaking')]).toBeCloseTo(1, 4)
    }
    expect(engine.weights[MOODS.indexOf('thinking')]).toBeCloseTo(1, 4)
  })

  it('rotations bornées : angles sous les limites de chaque os, poids de visée dans [0, 1], directions unitaires', () => {
    const engine = createGestureEngine(2026)
    const cycle: RemiMood[] = ['speaking', 'listening', 'speaking', 'thinking', 'idle', 'speaking']
    // Marges mesurées sur tout le parcours (un seul `expect` par grandeur : 17 000 images, ce serait trop lent autrement).
    const worst = { angleOverLimit: -Infinity, weightMin: Infinity, weightMax: -Infinity, normError: 0, notFinite: 0 }
    for (const reduced of [false, true]) {
      engine.configure({ reducedMotion: reduced, reach: reduced ? 0.5 : 1 })
      for (const mood of cycle) {
        run(engine, mood, 8, () => {
          DRIVEN_BONES.forEach((bone, b) => {
            for (let axis = 0; axis < 3; axis++) {
              const v = engine.pose[b * 3 + axis]
              if (!Number.isFinite(v)) worst.notFinite++
              worst.angleOverLimit = Math.max(worst.angleOverLimit, Math.abs(v) - BONE_LIMITS[bone][axis])
            }
          })
          for (let s = 0; s < AIM_COUNT; s++) {
            const o = s * AIM_STRIDE
            const w = engine.aim[o + 3]
            worst.weightMin = Math.min(worst.weightMin, w)
            worst.weightMax = Math.max(worst.weightMax, w)
            worst.normError = Math.max(worst.normError, Math.abs(Math.hypot(engine.aim[o], engine.aim[o + 1], engine.aim[o + 2]) - 1))
          }
        })
      }
    }
    expect(worst.notFinite).toBe(0)
    expect(worst.angleOverLimit).toBeLessThan(0) // toujours strictement sous la limite
    expect(worst.weightMin).toBeGreaterThanOrEqual(0)
    expect(worst.weightMax).toBeLessThanOrEqual(1 + 1e-6)
    expect(worst.normError).toBeLessThan(1e-4)
    expect(engine.pose.length).toBe(POSE_LENGTH)
  })

  it('poids continus : aucune cassure sur 80 s de parole, d\'écoute, de réflexion et de repos mêlés', () => {
    const engine = createGestureEngine(314)
    const cycle: RemiMood[] = ['speaking', 'idle', 'speaking', 'thinking', 'listening', 'speaking', 'listening', 'idle']
    engine.update(DT, 'speaking') // première image : la pose passe de zéro à son état de repos, ce n'est pas une cassure
    const prevPose = copy(engine.pose)
    const prevAim = copy(engine.aim)
    let maxPose = 0
    let maxWrist = 0
    let maxAim = 0
    for (const mood of cycle) {
      for (let k = 0; k < 10; k++) {
        run(engine, mood, 1, () => {
          engine.pose.forEach((v, i) => {
            const bone = DRIVEN_BONES[Math.floor(i / 3)]
            // Les poignets sont vifs par nature (battements de ponctuation) : leur vitesse a sa propre borne, plus bas.
            if (bone === 'leftHand' || bone === 'rightHand') maxWrist = Math.max(maxWrist, Math.abs(v - prevPose[i]))
            else maxPose = Math.max(maxPose, Math.abs(v - prevPose[i]))
            prevPose[i] = v
          })
          for (let s = 0; s < AIM_COUNT; s++) {
            const o = s * AIM_STRIDE
            // Ce qui compte à l'écran : le vecteur (direction × poids) ; la direction seule n'a pas de sens à poids nul.
            for (let c = 0; c < 3; c++) {
              const v = engine.aim[o + c] * engine.aim[o + 3]
              maxAim = Math.max(maxAim, Math.abs(v - prevAim[o + c] * prevAim[o + 3]))
              prevAim[o + c] = engine.aim[o + c]
            }
            prevAim[o + 3] = engine.aim[o + 3]
          }
        })
      }
    }
    expect(maxPose).toBeLessThan(0.02) // radians par image
    expect(maxWrist).toBeLessThan(WRIST_MAX_RAD_PER_S * DT) // un poignet, par axe : jamais plus vite que la borne de vitesse
    // Le plus raide : la montée d'un geste de 1,9 s (≈ 0,05) pendant que le poids de parole monte aussi (≈ 0,045).
    // Une vraie cassure vaudrait ≥ 0,2.
    expect(maxAim).toBeLessThan(0.09)
  })

  it('premier geste de bras 0,5 à 1 s après le début de la parole, puis un geste toutes les 2,5 à 4 s', () => {
    const engine = createGestureEngine(77)
    run(engine, 'idle', 3)
    expect(engine.activeGesture).toBeNull()
    const t0 = engine.time
    let firstAt: number | null = null
    const starts: number[] = []
    let lastId = engine.activeGesture
    run(engine, 'speaking', 60, () => {
      if (engine.activeGesture !== null && firstAt === null) firstAt = engine.time - t0
      if (engine.activeGesture !== lastId && engine.activeGesture !== null) starts.push(engine.time)
      lastId = engine.activeGesture
    })
    expect(firstAt).not.toBeNull()
    expect(firstAt!).toBeGreaterThanOrEqual(FIRST_GESTURE_DELAY_MIN)
    expect(firstAt!).toBeLessThanOrEqual(FIRST_GESTURE_DELAY_MAX + 0.4)
    expect(starts.length).toBeGreaterThanOrEqual(14)
    expect(starts.length).toBeLessThanOrEqual(26)
  })

  it('aucun geste de bras hors parole', () => {
    const engine = createGestureEngine(8)
    for (const mood of ['idle', 'listening'] as RemiMood[]) {
      run(engine, mood, 20, () => {
        expect(engine.activeGesture).toBeNull()
        for (let s = 0; s < AIM_COUNT; s++) expect(engine.aim[s * AIM_STRIDE + 3]).toBe(0)
      })
    }
  })

  it('retour au repos en douceur : en quittant la parole, les bras redescendent sans à-coup puis plus rien', () => {
    const engine = createGestureEngine(21)
    const armWeight = () => Math.max(...AIM_SEGMENTS.map((_, s) => engine.aim[s * AIM_STRIDE + 3]))
    for (let i = 0; i < 20 * 60 && armWeight() < 0.9; i++) engine.update(DT, 'speaking') // jusqu'en plein geste
    expect(armWeight()).toBeGreaterThanOrEqual(0.9)
    let prev = armWeight()
    let maxStep = 0
    let weightAtBlendEnd = -1
    run(engine, 'idle', 4, () => {
      const w = armWeight()
      maxStep = Math.max(maxStep, Math.abs(w - prev))
      prev = w
      if (weightAtBlendEnd < 0 && engine.weights[MOODS.indexOf('speaking')] === 0) weightAtBlendEnd = w
    })
    expect(maxStep).toBeLessThan(0.06) // jamais d'à-coup (une cassure vaudrait ≥ 0,2)
    expect(weightAtBlendEnd).toBeCloseTo(0, 6) // au bout de MOOD_BLEND_SECONDS les bras sont revenus au clip
    expect(armWeight()).toBe(0)
    // Les poignets reviennent à leur seule dérive de repos (quelques degrés au plus), plus aucun geste ni battement.
    for (const hand of ['leftHand', 'rightHand'] as const) {
      for (let axis = 0; axis < 3; axis++) expect(Math.abs(engine.pose[poseIndex(hand) + axis])).toBeLessThanOrEqual(WRIST_DRIFT.idle + 1e-6)
    }
  })

  it('prefers-reduced-motion : gestes et micro-mouvements nettement réduits', () => {
    const peak = (reducedMotion: boolean) => {
      const engine = createGestureEngine(55, { reducedMotion })
      let arm = 0
      let head = 0
      run(engine, 'speaking', 40, () => {
        for (let s = 0; s < AIM_COUNT; s++) arm = Math.max(arm, engine.aim[s * AIM_STRIDE + 3])
        head = Math.max(head, Math.abs(engine.pose[poseIndex('head')]))
      })
      return { arm, head }
    }
    const normal = peak(false)
    const reduced = peak(true)
    expect(normal.arm).toBeGreaterThan(0.8)
    expect(reduced.arm).toBeLessThanOrEqual(0.36)
    expect(reduced.head).toBeLessThan(normal.head * 0.6)
  })

  it('reach resserre les gestes vers l\'axe : la composante latérale des visées diminue', () => {
    const lateral = (reach: number) => {
      const engine = createGestureEngine(1, { reach })
      engine.forceGesture('openArms')
      engine.update(DT, 'speaking')
      return Math.abs(engine.aim[AIM_SEGMENTS.indexOf('rightArm') * AIM_STRIDE])
    }
    expect(lateral(0.5)).toBeLessThan(lateral(1))
    expect(lateral(0.4)).toBeGreaterThan(0)
  })

  it('geste forcé : maintenu au sommet, poids 1 sur les segments visés, 0 sur les autres', () => {
    const engine = createGestureEngine(1)
    engine.forceGesture('enumerate')
    run(engine, 'idle', 1)
    expect(engine.activeGesture).toBe('enumerate')
    const w = (seg: (typeof AIM_SEGMENTS)[number]) => engine.aim[AIM_SEGMENTS.indexOf(seg) * AIM_STRIDE + 3]
    expect(w('rightArm')).toBeCloseTo(1, 5)
    expect(w('rightForeArm')).toBeCloseTo(1, 5)
    expect(w('leftArm')).toBe(0)
    engine.forceGesture(null)
    run(engine, 'idle', 1)
    expect(engine.activeGesture).toBeNull()
    expect(w('rightArm')).toBe(0)
  })

  it('pas de temps plafonné : un onglet resté caché ne fait pas sauter la pose', () => {
    const a = createGestureEngine(4)
    const b = createGestureEngine(4)
    run(a, 'speaking', 3)
    run(b, 'speaking', 3)
    a.update(30, 'speaking') // retour d'un onglet resté 30 s en arrière-plan
    b.update(MAX_DT, 'speaking')
    expect(a.time).toBeCloseTo(b.time, 9)
    expect(copy(a.pose)).toEqual(copy(b.pose))
  })
})

// --- Poignets (WEL-927) --------------------------------------------------------------------------

const HANDS = ['leftHand', 'rightHand'] as const
const _euler = new Euler()

/** Rotation du poignet (celle que `bonePose` pose dans le repère de la main) à l'image courante. */
function wristQuat(engine: GestureEngine, hand: (typeof HANDS)[number]): Quaternion {
  const i = poseIndex(hand)
  return new Quaternion().setFromEuler(_euler.set(engine.pose[i], engine.pose[i + 1], engine.pose[i + 2], 'YXZ'))
}

/** Rotation du poignet image par image, après `warmup` secondes que l'on ne garde pas. */
function wristSeries(engine: GestureEngine, hand: (typeof HANDS)[number], mood: RemiMood, seconds: number, warmup = 0): Quaternion[] {
  run(engine, mood, warmup)
  const out: Quaternion[] = []
  run(engine, mood, seconds, () => out.push(wristQuat(engine, hand)))
  return out
}

/**
 * Pour chaque fenêtre de `windowSeconds` (départ toutes les 0,1 s), l'ÉTENDUE de la pose du poignet : le plus grand
 * angle entre deux de ses poses dans la fenêtre. Si c'est ~0, le poing est resté figé pendant toute la fenêtre.
 */
function windowRanges(series: Quaternion[], windowSeconds: number): number[] {
  const length = Math.round(windowSeconds / DT)
  const out: number[] = []
  for (let a = 0; a + length < series.length; a += 6) {
    let range = 0
    for (let i = a; i <= a + length; i += 4) for (let j = i + 4; j <= a + length; j += 4) range = Math.max(range, series[i].angleTo(series[j]))
    out.push(range)
  }
  return out
}

const degrees = (rad: number) => (rad * 180) / Math.PI

describe('poignets', () => {
  it('limites : inclinaison, torsion et flexion bornées à des valeurs vérifiées sur captures rapprochées', () => {
    // Au-delà de ~50° de torsion ou ~40° de flexion, la manche commence à se plisser sur les captures de la page
    // de démonstration (`dev/capture-bust.mjs hands`) : les butées restent en deçà (0,85 rad ≈ 49°, 0,7 ≈ 40°).
    expect(WRIST_LIMIT_TILT).toBeLessThanOrEqual(0.45)
    expect(WRIST_LIMIT_TWIST).toBeLessThanOrEqual(0.85)
    expect(WRIST_LIMIT_FLEX).toBeLessThanOrEqual(0.7)
    for (const hand of HANDS) expect([...BONE_LIMITS[hand]]).toEqual([WRIST_LIMIT_TILT, WRIST_LIMIT_TWIST, WRIST_LIMIT_FLEX])
  })

  it('chaque geste tourne le poignet de la main qui parle, dans une plage sûre (pose tenue + oscillation + battement sous 85 % des butées)', () => {
    const limits = [WRIST_LIMIT_TILT, WRIST_LIMIT_TWIST, WRIST_LIMIT_FLEX]
    for (const id of GESTURE_IDS) {
      for (const mirrored of [false, true]) {
        const wrists = gestureWrists(id, mirrored)
        expect(Object.keys(wrists).length, `${id} : au moins un poignet`).toBeGreaterThan(0)
        for (const [hand, w] of Object.entries(wrists)) {
          for (let axis = 0; axis < 3; axis++) {
            const total = Math.abs(w.hold[axis]) + Math.abs(w.wave[axis]) + Math.abs(w.pulse[axis])
            expect(total, `${id}${mirrored ? ' (miroir)' : ''} ${hand} axe ${axis}`).toBeLessThanOrEqual(0.85 * limits[axis])
          }
          // Un geste qui laisse le poing exactement comme au repos n'apprend rien : torsion ou flexion d'au moins 0,1 rad.
          const reach = Math.max(Math.abs(w.hold[1]) + Math.abs(w.wave[1]) + Math.abs(w.pulse[1]), Math.abs(w.hold[2]) + Math.abs(w.wave[2]) + Math.abs(w.pulse[2]))
          expect(reach, `${id} ${hand}`).toBeGreaterThanOrEqual(0.1)
        }
      }
    }
  })

  it('le miroir d\'un geste retourne la torsion et la flexion (x, −y, −z) et change de main', () => {
    for (const id of ['enumerate', 'heart', 'point'] as const) {
      const right = gestureWrists(id, false).rightHand!
      const left = gestureWrists(id, true).leftHand!
      expect(gestureWrists(id, false).leftHand).toBeUndefined()
      expect(gestureWrists(id, true).rightHand).toBeUndefined()
      for (const key of ['hold', 'wave', 'pulse'] as const) {
        expect(left[key][0]).toBeCloseTo(right[key][0], 6)
        expect(left[key][1]).toBeCloseTo(-right[key][1], 6)
        expect(left[key][2]).toBeCloseTo(-right[key][2], 6)
      }
    }
    for (const id of ['openPalms', 'openArms'] as const) {
      const { leftHand, rightHand } = gestureWrists(id)
      expect(leftHand!.hold[0]).toBeCloseTo(rightHand!.hold[0], 6)
      expect(leftHand!.hold[1]).toBeCloseTo(-rightHand!.hold[1], 6)
      expect(leftHand!.hold[2]).toBeCloseTo(-rightHand!.hold[2], 6)
    }
  })

  it('variété : en parole, le poing ne reste jamais le même plus de 1,5 s (toutes les fenêtres, 4 graines, 2 mains, 2 minutes)', () => {
    const minimums: number[] = []
    const medians: number[] = []
    for (const seed of [1, 2, 3, 4]) {
      for (const hand of HANDS) {
        const ranges = windowRanges(wristSeries(createGestureEngine(seed), hand, 'speaking', 120, 2), 1.5)
        minimums.push(Math.min(...ranges))
        medians.push([...ranges].sort((a, b) => a - b)[Math.floor(ranges.length / 2)])
        // 90 % des fenêtres de 1,5 s voient le poignet bouger d'au moins 8°…
        expect(ranges.filter((r) => degrees(r) >= 8).length / ranges.length, `graine ${seed} ${hand}`).toBeGreaterThanOrEqual(0.9)
      }
    }
    // … et aucune ne le voit bouger de moins de 3,5° (mesuré : pires fenêtres entre 4° et 8°, médiane ~20°).
    expect(degrees(Math.min(...minimums))).toBeGreaterThanOrEqual(3.5)
    expect(degrees(Math.min(...medians))).toBeGreaterThanOrEqual(14)
  })

  it('vitesse angulaire du poignet bornée (aucun à-coup) : toutes humeurs, 4 graines, coupures d\'humeur comprises', () => {
    let worst = 0
    for (const seed of [1, 2, 3, 4]) {
      const engine = createGestureEngine(seed)
      const previous: Quaternion[] = HANDS.map((hand) => wristQuat(engine, hand))
      for (const mood of ['speaking', 'idle', 'speaking', 'thinking', 'listening', 'speaking'] as RemiMood[]) {
        run(engine, mood, 20, () => {
          HANDS.forEach((hand, h) => {
            const q = wristQuat(engine, hand)
            worst = Math.max(worst, previous[h].angleTo(q) / DT)
            previous[h] = q
          })
        })
      }
    }
    expect(worst).toBeLessThan(WRIST_MAX_RAD_PER_S)
    expect(worst).toBeGreaterThan(1) // et la parole bouge bel et bien le poignet : pas une borne atteinte par défaut
  })

  it('au repos et à l\'écoute : de petits mouvements permanents, jamais figé, jamais agité', () => {
    for (const mood of ['idle', 'listening'] as RemiMood[]) {
      for (const hand of HANDS) {
        const series = wristSeries(createGestureEngine(9), hand, mood, 60, 2)
        const rest = new Quaternion()
        const amplitude = Math.max(...series.map((q) => rest.angleTo(q)))
        const range = Math.max(...windowRanges(series, 6))
        expect(degrees(range), `${mood} ${hand} : bouge`).toBeGreaterThan(0.8)
        expect(amplitude, `${mood} ${hand} : petit`).toBeLessThan(WRIST_DRIFT[mood] * 2)
        let fastest = 0
        for (let i = 1; i < series.length; i++) fastest = Math.max(fastest, series[i - 1].angleTo(series[i]) / DT)
        expect(degrees(fastest), `${mood} ${hand} : doux`).toBeLessThan(20) // °/s
      }
    }
  })

  it('en parole le poignet est nettement plus vif qu\'à l\'écoute (battements de ponctuation)', () => {
    const peakSpeed = (mood: RemiMood) => {
      const series = wristSeries(createGestureEngine(5), 'rightHand', mood, 40, 2)
      let fastest = 0
      for (let i = 1; i < series.length; i++) fastest = Math.max(fastest, series[i - 1].angleTo(series[i]) / DT)
      return degrees(fastest)
    }
    expect(peakSpeed('speaking')).toBeGreaterThan(60)
    expect(peakSpeed('listening')).toBeLessThan(20)
    // Les battements se suivent à un rythme de parole : un battement toutes les 0,75 à 1,4 s.
    expect(WRIST_BEAT_INTERVAL_MIN).toBeGreaterThanOrEqual(0.6)
    expect(WRIST_BEAT_INTERVAL_MAX).toBeLessThanOrEqual(1.6)
  })

  it('prefers-reduced-motion : l\'amplitude des poignets est réduite (≤ 45 % de la normale)', () => {
    const amplitude = (reducedMotion: boolean) => {
      const engine = createGestureEngine(55, { reducedMotion })
      const rest = new Quaternion()
      let peak = 0
      run(engine, 'speaking', 1)
      run(engine, 'speaking', 60, () => {
        for (const hand of HANDS) peak = Math.max(peak, rest.angleTo(wristQuat(engine, hand)))
      })
      return peak
    }
    const normal = amplitude(false)
    const reduced = amplitude(true)
    expect(normal).toBeGreaterThan(0.3)
    expect(reduced).toBeLessThanOrEqual(0.45 * normal)
  })

  it('une graine, une chorégraphie de poignets : même graine identique, graine différente autre', () => {
    const a = wristSeries(createGestureEngine(31), 'rightHand', 'speaking', 20)
    const b = wristSeries(createGestureEngine(31), 'rightHand', 'speaking', 20)
    const c = wristSeries(createGestureEngine(32), 'rightHand', 'speaking', 20)
    expect(b.every((q, i) => q.equals(a[i]))).toBe(true)
    expect(c.some((q, i) => !q.equals(a[i]))).toBe(true)
  })
})
