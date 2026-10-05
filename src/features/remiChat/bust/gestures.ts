/**
 * Cerveau gestuel du buste de Rémi · IA (WEL-919) : planification et interpolation des gestes.
 * Module PUR (aucun import three ni React, aucun `Math.random`) : la graine est injectée, le temps
 * n'avance que par `update(dt, mood)`, donc deux moteurs de même graine reçoivent la même séquence
 * d'appels et produisent exactement les mêmes sorties (tests, captures, rejeu).
 *
 * REPÈRE (jamais le repère local des os, que Meshy oriente de façon quelconque) : +X = droite de
 * l'ÉCRAN (côté du chat sur PC, donc gauche du personnage), +Y = haut, +Z = vers la caméra. Le bras
 * « droit » du personnage est à gauche de l'écran. Les deltas d'Euler sont exprimés dans le repère du
 * corps (qui tourne de trois quarts) ; les visées des bras dans celui de l'écran.
 *
 * Deux sorties, posées par-dessus le clip « idle » du mixeur par `bonePose.ts` :
 *  - `pose` : des DELTAS d'Euler (tangage x, lacet y, roulis z, radians) pour la colonne, le cou, la
 *    tête et les épaules. x > 0 penche un os debout vers l'avant ; y > 0 le tourne vers la droite de
 *    l'écran ; z > 0 le penche vers la gauche de l'écran. Les deux MAINS (os `leftHand`, `rightHand`) sont
 *    à part : leurs trois angles sont ceux du POIGNET, dans le repère propre de l'os de la main (voir
 *    « Poignets » ci-dessous) ;
 *  - `aim` : pour les 4 segments des bras (bras, avant-bras de chaque côté), une DIRECTION CIBLE absolue
 *    dans le repère de l'écran (vecteur unitaire) et un poids 0 à 1. Les bras ne se posent pas en deltas : le clip « idle » de
 *    Meshy n'est pas symétrique (avant-bras gauche en arrière, droit en avant), un même delta donnerait
 *    deux gestes différents. Viser une direction donne le même geste des deux côtés, et place les mains
 *    où on l'a décidé (dans le cadre, devant le torse, jamais à travers lui).
 *
 * POIGNETS (WEL-927). Le GLB n'a pas d'os de doigts : les mains sont des poings fermés, qu'on ne peut
 * qu'orienter. L'angle de la main dans le monde dépend déjà de l'avant-bras visé, mais sans poignet
 * piloté le poing gardait la MÊME orientation par rapport à l'avant-bras : mesuré avant correction, le
 * poignet ne bougeait que de 11° au plus (et seulement dans « paumes ouvertes »). Trois angles par main,
 * dans le repère de l'os (Y = axe de l'avant-bras, identique des deux côtés dans le squelette de Meshy) :
 *  - x : inclinaison latérale (x > 0 vers le côté du petit doigt, x < 0 vers le pouce) ;
 *  - y : torsion autour de l'avant-bras (y > 0 pour la main droite du personnage : la paume se tourne vers
 *    le haut et vers l'avant, supination ; y < 0 : le dos du poing se tourne vers l'interlocuteur) ;
 *  - z : flexion/extension (z < 0 pour la main droite : le poing se ferme vers l'intérieur du poignet).
 * Les deux mains étant des copies miroir : un même geste à gauche s'écrit (x, −y, −z), ce que fait `toPose`.
 * Quatre sources s'additionnent : la pose tenue de chaque geste, une oscillation lente pendant le plateau
 * du geste (`wave`), des battements de ponctuation au rythme de la parole, et une dérive permanente de
 * quelques degrés (toutes humeurs). Amplitudes mesurées : voir `BONE_LIMITS` et `wrists.test.ts`.
 *
 * Calques : humeur (poids lissés qui somment à 1) → pose de base + micro-mouvements ; en `speaking`,
 * une bibliothèque de gestes de bras enchaînés toutes les 2,5 à 4 s et des hochements rythmés. Tout
 * poids est continu ; les angles d'Euler passent par une limite douce (`softLimit`), les poids de visée
 * sont dans [0, 1] et l'amplitude des rotations est bornée côté os (`AIM_MAX_SWING`).
 */
import type { RemiMood } from '../contract'

// --- Os pilotés ----------------------------------------------------------------------------------

/** Os pilotés par deltas d'Euler. Ordre = ordre d'application dans la hiérarchie (parent avant enfant). */
export const DRIVEN_BONES = ['spine02', 'spine01', 'spine', 'leftShoulder', 'leftHand', 'rightShoulder', 'rightHand', 'neck', 'head'] as const

export type DrivenBone = (typeof DRIVEN_BONES)[number]
export const BONE_COUNT = DRIVEN_BONES.length
/** Taille du tampon de pose : 3 angles (x, y, z) par os, dans l'ordre de `DRIVEN_BONES`. */
export const POSE_LENGTH = BONE_COUNT * 3

export const BONE_INDEX = Object.fromEntries(DRIVEN_BONES.map((name, i) => [name, i])) as Record<DrivenBone, number>

/** Limites du poignet (radians) : inclinaison latérale, torsion de l'avant-bras par le poignet, flexion. */
export const WRIST_LIMIT_TILT = 0.45
export const WRIST_LIMIT_TWIST = 0.85
export const WRIST_LIMIT_FLEX = 0.7

/** Limite d'amplitude par os et par axe (radians) : la pose finale n'atteint jamais ces valeurs. */
export const BONE_LIMITS: Readonly<Record<DrivenBone, readonly [number, number, number]>> = {
  spine02: [0.1, 0.12, 0.1],
  spine01: [0.14, 0.16, 0.12],
  spine: [0.18, 0.2, 0.14],
  leftShoulder: [0.25, 0.25, 0.3],
  // Poignets : inclinaison, torsion, flexion. Bornes vérifiées sur captures rapprochées (aucune torsion de la manche).
  leftHand: [WRIST_LIMIT_TILT, WRIST_LIMIT_TWIST, WRIST_LIMIT_FLEX],
  rightShoulder: [0.25, 0.25, 0.3],
  rightHand: [WRIST_LIMIT_TILT, WRIST_LIMIT_TWIST, WRIST_LIMIT_FLEX],
  neck: [0.3, 0.35, 0.25],
  head: [0.45, 0.55, 0.36],
}

/** Segments de bras visés : du bras vers le coude, de l'avant-bras vers le poignet. */
export const AIM_SEGMENTS = ['leftArm', 'leftForeArm', 'rightArm', 'rightForeArm'] as const
export type AimSegment = (typeof AIM_SEGMENTS)[number]
export const AIM_COUNT = AIM_SEGMENTS.length
/** Par segment dans `aim` : x, y, z de la direction cible (unitaire) puis le poids. */
export const AIM_STRIDE = 4
export const AIM_LENGTH = AIM_COUNT * AIM_STRIDE
export const AIM_INDEX = Object.fromEntries(AIM_SEGMENTS.map((name, i) => [name, i])) as Record<AimSegment, number>

/** Rotation maximale (radians) qu'on impose à un segment pour l'amener sur sa cible. */
export const AIM_MAX_SWING: Readonly<Record<AimSegment, number>> = {
  leftArm: 1.9,
  leftForeArm: 2.4,
  rightArm: 1.9,
  rightForeArm: 2.4,
}

const MIRROR_BONE: Readonly<Record<DrivenBone, DrivenBone>> = {
  spine02: 'spine02',
  spine01: 'spine01',
  spine: 'spine',
  leftShoulder: 'rightShoulder',
  leftHand: 'rightHand',
  rightShoulder: 'leftShoulder',
  rightHand: 'leftHand',
  neck: 'neck',
  head: 'head',
}

const MIRROR_AIM: Readonly<Record<AimSegment, AimSegment>> = {
  leftArm: 'rightArm',
  leftForeArm: 'rightForeArm',
  rightArm: 'leftArm',
  rightForeArm: 'leftForeArm',
}

// --- Outils numériques ---------------------------------------------------------------------------

const TAU = Math.PI * 2

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** 0 → 1 avec dérivées première ET seconde nulles aux bornes (pas de saccade au départ ni à l'arrivée). */
export function smootherstep(x: number): number {
  const t = clamp(x, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * Limite douce : `limit · tanh(x / limit)`. Identité à très peu près près de 0, borne STRICTE
 * (|résultat| < limit) et continue partout : jamais de cassure quand une pose approche sa butée.
 */
export function softLimit(x: number, limit: number): number {
  return limit * Math.tanh(x / limit)
}

/** Générateur pseudo-aléatoire à graine (mulberry32) : suite reproductible dans [0, 1). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function between(rng: () => number, lo: number, hi: number): number {
  return lo + (hi - lo) * rng()
}

// --- Bibliothèque de gestes ----------------------------------------------------------------------

export type GestureId = 'openPalms' | 'enumerate' | 'heart' | 'openArms' | 'point' | 'weigh'

/** Montée et retour d'un geste, en part de sa durée (le plateau occupe le reste). */
export const GESTURE_ATTACK_FRACTION = 0.32
export const GESTURE_RELEASE_FRACTION = 0.38

/** Poids d'un geste à l'instant `elapsed` de sa durée : montée, plateau, retour au repos (0 aux deux bouts). */
export function gestureEnvelope(elapsed: number, duration: number): number {
  if (!(duration > 0) || elapsed <= 0 || elapsed >= duration) return 0
  const attack = smootherstep(elapsed / (duration * GESTURE_ATTACK_FRACTION))
  const release = smootherstep((duration - elapsed) / (duration * GESTURE_RELEASE_FRACTION))
  return attack < release ? attack : release
}

type Vec3 = readonly [number, number, number]
type Euler3 = readonly [number, number, number]
type AimSpec = Partial<Record<AimSegment, Vec3>>
type PoseSpec = Partial<Record<DrivenBone, Euler3>>

interface GestureSpec {
  readonly id: GestureId
  /** Bornes de durée (secondes), montée et retour compris. */
  readonly minDuration: number
  readonly maxDuration: number
  /** Écrit des deux côtés (symétrique ou asymétrique voulu) : pas de variante en miroir. Sinon bras DROIT seul. */
  readonly symmetric: boolean
  /** Directions visées au sommet du geste (voir le repère en tête de fichier). */
  readonly aim: AimSpec
  /** Deltas d'Euler au sommet (colonne, cou, tête, épaules). */
  readonly pose?: PoseSpec
  /** Poignets au sommet (angles de la main dans son repère propre, voir « Poignets » en tête de fichier). */
  readonly wrist?: PoseSpec
  /** Oscillation lente des poignets pendant le geste : `wrist` × sin(2π t / période), nulle aux deux bouts. */
  readonly wave?: { readonly period: number; readonly wrist: PoseSpec }
  /** Battements pendant le plateau : le geste glisse `count` fois vers `aim`/`pose`/`wrist` ci-dessous et revient. */
  readonly pulse?: { readonly count: number; readonly aim?: AimSpec; readonly pose?: PoseSpec; readonly wrist?: PoseSpec }
}

/** Poignets des deux mains pour un geste symétrique : la gauche est le miroir (x, −y, −z) de la droite. */
function bothWrists(right: Euler3): PoseSpec {
  return { rightHand: right, leftHand: [right[0], -right[1], -right[2]] }
}

/** Symétrise une visée du bras droit vers le gauche (x change de signe). */
function bothArms(right: AimSpec): AimSpec {
  const out: Partial<Record<AimSegment, Vec3>> = { ...right }
  for (const [seg, v] of Object.entries(right) as [AimSegment, Vec3][]) out[MIRROR_AIM[seg]] = [-v[0], v[1], v[2]]
  return out
}

/**
 * Directions mesurées sur le rendu (captures de `dev/capture-bust.mjs`, WEL-919) : les mains finissent
 * devant la poitrine, entre le menton et le milieu du torse, à moins de ~0,33 m de l'axe (une main avancée
 * paraît plus large : le cadre en tient compte, `framing.ts`). Bras droit du personnage = gauche de l'écran.
 */
const GESTURE_SPECS: readonly GestureSpec[] = [
  {
    // Deux paumes ouvertes vers l'interlocuteur, avant-bras relevés devant la poitrine : les poings se
    // tournent paume vers le haut (torsion), le poignet un peu en extension, et ils se balancent doucement.
    id: 'openPalms',
    minDuration: 2.2,
    maxDuration: 3.2,
    symmetric: true,
    aim: bothArms({ rightArm: [-0.2, -0.74, 0.5], rightForeArm: [0.12, 0.46, 0.88] }),
    pose: { spine: [-0.03, 0, 0] },
    wrist: bothWrists([0, 0.5, 0.1]),
    wave: { period: 1.9, wrist: bothWrists([0.05, 0.16, 0.1]) },
  },
  {
    // Énumération : une main relevée devant la poitrine qui marque trois temps (le poing plonge à chaque temps).
    id: 'enumerate',
    minDuration: 2.4,
    maxDuration: 3.4,
    symmetric: false,
    aim: { rightArm: [-0.22, -0.78, 0.55], rightForeArm: [0.35, 0.48, 0.8] },
    pose: { spine: [0, -0.04, 0] },
    wrist: { rightHand: [0, 0.22, 0.05] },
    wave: { period: 1.6, wrist: { rightHand: [0.04, 0.12, 0.08] } },
    pulse: { count: 3, aim: { rightForeArm: [0.3, 0.18, 0.94] }, wrist: { rightHand: [0.04, -0.08, -0.15] } },
  },
  {
    // Main sur le cœur : le poing se tourne contre la poitrine, poignet fléchi vers l'intérieur.
    id: 'heart',
    minDuration: 2.2,
    maxDuration: 3.0,
    symmetric: false,
    aim: { rightArm: [-0.1, -0.92, 0.38], rightForeArm: [0.75, 0.62, 0.3] },
    pose: { head: [0.05, 0, 0] },
    wrist: { rightHand: [0, -0.3, -0.3] },
    wave: { period: 1.7, wrist: { rightHand: [0.05, 0.14, 0.1] } },
  },
  {
    // Ouverture des deux bras, mesurée : les coudes restent dans le cadre. Les poings s'ouvrent paume vers le haut.
    id: 'openArms',
    minDuration: 2.4,
    maxDuration: 3.4,
    symmetric: true,
    aim: bothArms({ rightArm: [-0.42, -0.66, 0.5], rightForeArm: [0.22, 0.44, 0.87] }),
    pose: { spine: [-0.04, 0, 0], head: [-0.03, 0, 0] },
    wrist: bothWrists([0, 0.45, 0.15]),
    wave: { period: 2.1, wrist: bothWrists([0.04, 0.14, 0.08]) },
  },
  {
    // Légère désignation : l'avant-bras s'ouvre vers l'extérieur, du côté du chat quand c'est le gauche ;
    // le poignet se redresse puis marque d'un petit coup.
    id: 'point',
    minDuration: 1.9,
    maxDuration: 2.8,
    symmetric: false,
    aim: { rightArm: [-0.22, -0.72, 0.6], rightForeArm: [-0.05, 0.4, 0.915] },
    pose: { spine: [0, 0.05, 0], head: [0, 0.06, 0] },
    wrist: { rightHand: [-0.1, 0.3, 0.2] },
    wave: { period: 1.5, wrist: { rightHand: [0.05, 0.13, 0.07] } },
    pulse: { count: 2, wrist: { rightHand: [-0.04, 0.08, -0.14] } },
  },
  {
    // Peser le pour et le contre : une main monte quand l'autre descend, deux fois, les poings qui basculent.
    id: 'weigh',
    minDuration: 2.6,
    maxDuration: 3.5,
    symmetric: true,
    aim: {
      rightArm: [-0.3, -0.72, 0.55],
      rightForeArm: [0.25, 0.6, 0.78],
      leftArm: [0.3, -0.78, 0.5],
      leftForeArm: [-0.3, 0.4, 0.86],
    },
    wrist: { rightHand: [0, 0.4, 0.1], leftHand: [0, 0.3, 0.1] },
    pulse: {
      count: 2,
      aim: { rightForeArm: [0.15, 0.22, 0.96], leftForeArm: [-0.1, 0.2, 0.97] },
      pose: { head: [0, 0, 0.03] },
      wrist: { rightHand: [0, -0.28, -0.08], leftHand: [0, -0.28, -0.08] },
    },
  },
]

/**
 * Réflexion : la main droite du personnage (à gauche de l'écran, côté opposé au chat) se relève devant le
 * buste, le coude avancé, SOUS le menton : mesuré sur le rendu, l'ancienne visée (avant-bras presque vertical)
 * amenait le poing contre le menton, ce que Baptiste a signalé. Le poing reste au niveau de la poitrine,
 * poignet souple, et ne passe jamais devant le visage (test `wrists.test.ts`).
 */
const THINKING_AIM: AimSpec = { rightArm: [-0.12, -0.58, 0.8], rightForeArm: [0.55, 0.5, 0.67] }
/** Poignet pendant la réflexion : le poing légèrement fléchi, qui se tourne de temps à autre (en plus de la dérive). */
const THINKING_WRIST: PoseSpec = { rightHand: [0.03, -0.12, -0.14] }

function normalized(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

interface AimData {
  /** Directions unitaires, `AIM_COUNT` × 3. */
  readonly dir: Float32Array
  /** 1 si le segment est visé par ce geste. */
  readonly has: Uint8Array
}

function toAim(spec: AimSpec | undefined, mirrored: boolean): AimData {
  const dir = new Float32Array(AIM_COUNT * 3)
  const has = new Uint8Array(AIM_COUNT)
  for (const [seg, v] of Object.entries(spec ?? {}) as [AimSegment, Vec3][]) {
    const target = mirrored ? MIRROR_AIM[seg] : seg
    const n = normalized(mirrored ? [-v[0], v[1], v[2]] : v)
    const i = AIM_INDEX[target]
    dir.set(n, i * 3)
    has[i] = 1
  }
  return { dir, has }
}

function toPose(spec: PoseSpec | undefined, mirrored: boolean): Float32Array {
  const out = new Float32Array(POSE_LENGTH)
  for (const [name, angles] of Object.entries(spec ?? {}) as [DrivenBone, Euler3][]) {
    const bone = mirrored ? MIRROR_BONE[name] : name
    const i = BONE_INDEX[bone] * 3
    // Miroir gauche/droite : le tangage ne change pas, lacet et roulis changent de signe.
    out[i] += angles[0]
    out[i + 1] += mirrored ? -angles[1] : angles[1]
    out[i + 2] += mirrored ? -angles[2] : angles[2]
  }
  return out
}

interface GestureVariant {
  readonly aim: AimData
  readonly pose: Float32Array
  readonly wrist: Float32Array
  readonly waveWrist: Float32Array | null
  readonly pulseAim: AimData | null
  readonly pulsePose: Float32Array | null
  readonly pulseWrist: Float32Array | null
}

interface GestureDef {
  readonly spec: GestureSpec
  /** [0] = côté écrit dans le spec, [1] = retourné en miroir. */
  readonly variants: readonly [GestureVariant, GestureVariant]
}

function variantOf(spec: GestureSpec, mirrored: boolean): GestureVariant {
  return {
    aim: toAim(spec.aim, mirrored),
    pose: toPose(spec.pose, mirrored),
    wrist: toPose(spec.wrist, mirrored),
    waveWrist: spec.wave ? toPose(spec.wave.wrist, mirrored) : null,
    pulseAim: spec.pulse?.aim ? toAim(spec.pulse.aim, mirrored) : null,
    pulsePose: spec.pulse?.pose ? toPose(spec.pulse.pose, mirrored) : null,
    pulseWrist: spec.pulse?.wrist ? toPose(spec.pulse.wrist, mirrored) : null,
  }
}

const THINKING = toAim(THINKING_AIM, false)
const THINKING_WRIST_POSE = toPose(THINKING_WRIST, false)

const GESTURES: readonly GestureDef[] = GESTURE_SPECS.map((spec) => ({ spec, variants: [variantOf(spec, false), variantOf(spec, true)] }))

export const GESTURE_IDS: readonly GestureId[] = GESTURE_SPECS.map((s) => s.id)

export function gestureDurationRange(id: GestureId): { min: number; max: number } {
  const spec = GESTURE_SPECS.find((s) => s.id === id)!
  return { min: spec.minDuration, max: spec.maxDuration }
}

/** Visées d'un geste, pour les tests et la vérification du cadrage (directions unitaires par segment, côté non miroir). */
export function gestureAims(id: GestureId, mirrored = false): Partial<Record<AimSegment, Vec3>> {
  const def = GESTURES.find((g) => g.spec.id === id)!
  const data = def.variants[mirrored && !def.spec.symmetric ? 1 : 0].aim
  const out: Partial<Record<AimSegment, Vec3>> = {}
  AIM_SEGMENTS.forEach((seg, i) => {
    if (data.has[i]) out[seg] = [data.dir[i * 3], data.dir[i * 3 + 1], data.dir[i * 3 + 2]]
  })
  return out
}

/**
 * Poignets d'un geste, pour les tests : pose tenue, amplitude de l'oscillation et du battement (les trois en
 * valeur absolue par axe, dans l'ordre inclinaison, torsion, flexion), par main, côté non miroir sauf demande.
 */
export function gestureWrists(id: GestureId, mirrored = false): Partial<Record<'leftHand' | 'rightHand', { hold: Euler3; wave: Euler3; pulse: Euler3 }>> {
  const def = GESTURES.find((g) => g.spec.id === id)!
  const variant = def.variants[mirrored && !def.spec.symmetric ? 1 : 0]
  const out: Partial<Record<'leftHand' | 'rightHand', { hold: Euler3; wave: Euler3; pulse: Euler3 }>> = {}
  for (const hand of ['leftHand', 'rightHand'] as const) {
    const i = BONE_INDEX[hand] * 3
    const read = (src: Float32Array | null): Euler3 => (src ? [src[i], src[i + 1], src[i + 2]] : [0, 0, 0])
    const hold = read(variant.wrist)
    const wave = read(variant.waveWrist)
    const pulse = read(variant.pulseWrist)
    if (hold.some((v) => v !== 0) || wave.some((v) => v !== 0) || pulse.some((v) => v !== 0)) out[hand] = { hold, wave, pulse }
  }
  return out
}

// --- Planification -------------------------------------------------------------------------------

/** Intervalle entre le DÉBUT de deux gestes consécutifs (secondes). */
export const GESTURE_INTERVAL_MIN = 2.5
export const GESTURE_INTERVAL_MAX = 4
/** Délai entre le début de la parole et le premier geste. */
export const FIRST_GESTURE_DELAY_MIN = 0.5
export const FIRST_GESTURE_DELAY_MAX = 0.9

export interface PlannedGesture {
  id: GestureId
  /** Joué avec le bras gauche du personnage (sans effet sur les gestes symétriques). */
  mirrored: boolean
  duration: number
  /** Part de l'amplitude nominale (0,85 à 1) : deux gestes identiques ne sont jamais jumeaux. */
  amplitude: number
  /** Délai jusqu'au début du geste suivant. */
  nextIn: number
}

/** Tire les gestes l'un après l'autre : jamais deux fois de suite le même, tous les gestes tournent. */
export class GesturePlanner {
  private readonly rng: () => number
  private bag: number[] = []
  private last = -1

  constructor(rng: () => number) {
    this.rng = rng
  }

  firstDelay(): number {
    return between(this.rng, FIRST_GESTURE_DELAY_MIN, FIRST_GESTURE_DELAY_MAX)
  }

  next(): PlannedGesture {
    const index = this.drawIndex()
    const spec = GESTURES[index].spec
    return {
      id: spec.id,
      mirrored: spec.symmetric ? false : this.rng() < 0.5,
      duration: between(this.rng, spec.minDuration, spec.maxDuration),
      amplitude: between(this.rng, 0.85, 1),
      nextIn: between(this.rng, GESTURE_INTERVAL_MIN, GESTURE_INTERVAL_MAX),
    }
  }

  /** Sac mélangé (Fisher-Yates) : chaque geste sort une fois avant qu'aucun ne se répète. */
  private drawIndex(): number {
    if (this.bag.length === 0) {
      const all = GESTURES.map((_, i) => i)
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1))
        const tmp = all[i]
        all[i] = all[j]
        all[j] = tmp
      }
      // Pas deux fois le même geste de suite, y compris d'un sac à l'autre (on tire par la fin du tableau).
      if (all[all.length - 1] === this.last && all.length > 1) {
        const tmp = all[0]
        all[0] = all[all.length - 1]
        all[all.length - 1] = tmp
      }
      this.bag = all
    }
    const index = this.bag.pop()!
    this.last = index
    return index
  }
}

// --- Moteur --------------------------------------------------------------------------------------

// --- Poignets : constantes du moteur ------------------------------------------------------------

/**
 * Dérive permanente des poignets (radians, crête de la torsion, l'axe le plus ample ; la flexion en prend 80 %
 * et l'inclinaison 60 %) par humeur. Au repos, ~2° : le clip « idle » de Meshy fait déjà bouger les mains de 8 à
 * 10° sur sa boucle de 2,4 s, on ne fait que la casser. En parole, jusqu'à 9° de torsion : assez pour que le poing
 * ne reste jamais figé plus de 1,5 s entre deux gestes (voir `wrists.test.ts`), trop peu pour qu'on y lise un tic.
 */
export const WRIST_DRIFT: Readonly<Record<RemiMood, number>> = { idle: 0.04, listening: 0.05, thinking: 0.055, speaking: 0.16 }
/** Périodes (secondes) des deux composantes de la dérive pour [inclinaison, torsion, flexion] : une lente, une plus vive. */
const WRIST_DRIFT_PERIODS: readonly (readonly [number, number])[] = [
  [4.3, 2.6],
  [3.1, 1.9],
  [3.7, 2.1],
]
/** Part de l'amplitude de dérive par axe : la torsion se voit le plus, l'inclinaison latérale le moins. */
const WRIST_DRIFT_AXIS: readonly number[] = [0.6, 1, 0.8]
/** Les deux mains ne battent jamais à l'unisson : la droite est 13 % plus lente. */
const WRIST_DRIFT_RIGHT_SLOWER = 1.13

/**
 * Battements de ponctuation du poignet : durée d'un battement, intervalle entre deux. Un battement part aussi à
 * chaque hochement de tête (même rythme de parole), pourvu que le précédent soit terminé sur les deux mains
 * (durée + décalage maximal de la seconde main) : deux battements ne se chevauchent jamais, ce qui ferait sauter la pose.
 */
export const WRIST_BEAT_SECONDS = 0.44
const WRIST_BEAT_SECOND_HAND_DELAY_MAX = 0.14
export const WRIST_BEAT_INTERVAL_MIN = 0.75
export const WRIST_BEAT_INTERVAL_MAX = 1.4

export const MOODS: readonly RemiMood[] = ['idle', 'listening', 'thinking', 'speaking']
const MOOD_INDEX: Readonly<Record<RemiMood, number>> = { idle: 0, listening: 1, thinking: 2, speaking: 3 }

/** Durée d'un changement d'humeur complet (secondes) : la pose passe d'une humeur à l'autre en douceur. */
export const MOOD_BLEND_SECONDS = 0.7
/** Plafond du pas de temps : un onglet resté en arrière-plan ne fait pas sauter la pose. */
export const MAX_DT = 0.1

export interface GestureSettings {
  /** `prefers-reduced-motion` : gestes et micro-mouvements nettement réduits. */
  reducedMotion: boolean
  /** Côté du chat : +1 à droite de l'écran (PC), 0 centré. Penche la tête et le regard vers lui. */
  side: number
  /** Regard vers le bas (0 à 1) : le chat est SOUS le buste sur téléphone. */
  down: number
  /** Rotation du corps entier (lacet, radians) : la tête la compense en partie pour regarder la caméra. */
  bodyYaw: number
  /**
   * 0 à 1 : resserre les gestes vers l'axe du corps quand le cadre est étroit (la composante latérale
   * des visées est multipliée par `reach`) pour que les mains restent dans le cadre.
   */
  reach: number
}

export const DEFAULT_SETTINGS: Readonly<GestureSettings> = { reducedMotion: false, side: 1, down: 0, bodyYaw: 0, reach: 1 }

const REDUCED_MOTION_SCALE = 0.35
const MAX_ACTIVE = 3

interface Slot {
  active: boolean
  def: GestureDef
  side: 0 | 1
  start: number
  duration: number
  amplitude: number
}

export interface GestureEngine {
  /** Deltas d'Euler (`POSE_LENGTH` angles), réécrits à chaque `update`. Ne pas modifier. */
  readonly pose: Float32Array
  /** Visées des bras (`AIM_LENGTH` valeurs : x, y, z unitaires puis poids), réécrites à chaque `update`. */
  readonly aim: Float32Array
  /** Poids lissés des humeurs, dans l'ordre de `MOODS` ; somme = 1. */
  readonly weights: Float32Array
  readonly time: number
  /** Geste de bras le plus avancé en ce moment (null hors parole), pour les tests et le débogage. */
  readonly activeGesture: GestureId | null
  update(dt: number, mood: RemiMood): void
  configure(settings: Partial<GestureSettings>): void
  /** Débogage : maintient `id` au sommet (null relâche), quelle que soit l'humeur. */
  forceGesture(id: GestureId | null, mirrored?: boolean): void
}

export function createGestureEngine(seed: number, initial: Partial<GestureSettings> = {}): GestureEngine {
  const rng = createRng(seed)
  const planner = new GesturePlanner(createRng(Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0))
  const settings: GestureSettings = { ...DEFAULT_SETTINGS, ...initial }

  const pose = new Float32Array(POSE_LENGTH)
  const aim = new Float32Array(AIM_LENGTH)
  const aimSum = new Float32Array(AIM_COUNT * 3)
  const aimWeight = new Float32Array(AIM_COUNT)
  for (let s = 0; s < AIM_COUNT; s++) aim[s * AIM_STRIDE + 1] = -1 // repos : direction « bras le long du corps », poids nul
  const weights = new Float32Array(MOODS.length)
  const raw = new Float32Array(MOODS.length)
  raw[MOOD_INDEX.idle] = 1
  weights[MOOD_INDEX.idle] = 1

  const slots: Slot[] = Array.from({ length: MAX_ACTIVE }, () => ({ active: false, def: GESTURES[0], side: 0 as 0 | 1, start: 0, duration: 1, amplitude: 1 }))
  const phases = Array.from({ length: 16 }, () => rng() * TAU)
  // Poignets : leur propre suite aléatoire, pour que la chorégraphie du reste (hochements, gestes) ne change pas.
  const wristRng = createRng(Math.imul(seed ^ 0x51ed270b, 0x2c1b3c6d) >>> 0)
  const wristPhases = Array.from({ length: 12 }, () => wristRng() * TAU) // main × axe × composante
  const beatStart = [-10, -10] // [main gauche, main droite]
  const beatDepth = [0, 0]
  const beatTwist = [0, 0]
  let nextBeatAt = Infinity
  let lastBeatAt = -10

  let time = 0
  let nextGestureAt = Infinity
  let wasSpeaking = false
  let nextNodAt = 1.2
  let nodStart = -10
  let nodDepth = 0
  let nextListenNodAt = 3
  let listenNodStart = -10
  let forced: { def: GestureDef; side: 0 | 1 } | null = null
  let activeId: GestureId | null = null

  const add = (bone: number, x: number, y: number, z: number, w: number): void => {
    const i = bone * 3
    pose[i] += x * w
    pose[i + 1] += y * w
    pose[i + 2] += z * w
  }
  const addPose = (src: Float32Array, w: number): void => {
    for (let i = 0; i < POSE_LENGTH; i++) pose[i] += src[i] * w
  }
  /** Ajoute au cumul de visée les directions de `data`, glissées vers `pulse` d'un facteur `beat` (0 à 1). */
  const addAim = (data: AimData, w: number, pulse: AimData | null, beat: number): void => {
    for (let s = 0; s < AIM_COUNT; s++) {
      if (!data.has[s]) continue
      const i = s * 3
      let x = data.dir[i]
      let y = data.dir[i + 1]
      let z = data.dir[i + 2]
      if (pulse && pulse.has[s] && beat > 0) {
        x += (pulse.dir[i] - x) * beat
        y += (pulse.dir[i + 1] - y) * beat
        z += (pulse.dir[i + 2] - z) * beat
      }
      x *= settings.reach
      const len = Math.hypot(x, y, z) || 1
      aimSum[i] += (x / len) * w
      aimSum[i + 1] += (y / len) * w
      aimSum[i + 2] += (z / len) * w
      aimWeight[s] += w
    }
  }

  const startGesture = (): void => {
    const planned = planner.next()
    const def = GESTURES.find((g) => g.spec.id === planned.id)!
    // Réutilise un emplacement libre, sinon remplace le plus ancien.
    let slot = slots.find((s) => !s.active)
    if (!slot) slot = slots.reduce((a, b) => (a.start <= b.start ? a : b))
    slot.active = true
    slot.def = def
    slot.side = planned.mirrored ? 1 : 0
    slot.start = time
    slot.duration = planned.duration
    slot.amplitude = planned.amplitude
    nextGestureAt = time + planned.nextIn
  }

  const update = (dtIn: number, mood: RemiMood): void => {
    const dt = clamp(dtIn, 0, MAX_DT)
    time += dt
    const motion = settings.reducedMotion ? REDUCED_MOTION_SCALE : 1

    // Poids d'humeur : glissement linéaire vers la cible puis lissage ; somme normalisée à 1.
    const step = dt / MOOD_BLEND_SECONDS
    let total = 0
    for (let m = 0; m < MOODS.length; m++) {
      const target = m === MOOD_INDEX[mood] ? 1 : 0
      raw[m] += clamp(target - raw[m], -step, step)
      weights[m] = smootherstep(raw[m])
      total += weights[m]
    }
    for (let m = 0; m < MOODS.length; m++) weights[m] = total > 1e-6 ? weights[m] / total : m === MOOD_INDEX[mood] ? 1 : 0
    const wListen = weights[1]
    const wThink = weights[2]
    const wSpeak = weights[3]

    pose.fill(0)
    aimSum.fill(0)
    aimWeight.fill(0)

    // --- Respiration (toutes humeurs) : colonne, épaules, compensation du cou.
    const breath = Math.sin((TAU * time) / 4.4 + phases[0])
    const breathAmp = (0.011 + 0.003 * wSpeak) * motion
    add(BONE_INDEX.spine02, breath * breathAmp * 0.5, 0, 0, 1)
    add(BONE_INDEX.spine01, breath * breathAmp, 0, 0, 1)
    add(BONE_INDEX.spine, breath * breathAmp * 0.8, 0, 0, 1)
    add(BONE_INDEX.neck, -breath * breathAmp * 0.6, 0, 0, 1)
    add(BONE_INDEX.leftShoulder, 0, 0, breath * 0.012 * motion, 1)
    add(BONE_INDEX.rightShoulder, 0, 0, -breath * 0.012 * motion, 1)

    // --- Micro-mouvements de tête (toutes humeurs, un peu plus vifs en parole).
    const lively = (1 + 0.5 * wSpeak) * motion
    const hx = 0.02 * Math.sin((TAU * time) / 6.3 + phases[1]) + 0.008 * Math.sin((TAU * time) / 2.9 + phases[2])
    const hy = 0.035 * Math.sin((TAU * time) / 7.7 + phases[3]) + 0.012 * Math.sin((TAU * time) / 3.1 + phases[4])
    const hz = 0.018 * Math.sin((TAU * time) / 9.1 + phases[5])
    add(BONE_INDEX.head, hx * lively, hy * lively, hz * lively, 1)
    add(BONE_INDEX.neck, hx * 0.3 * lively, hy * 0.3 * lively, 0, 1)

    // --- Poignets : dérive permanente (deux composantes par axe, périodes incommensurables), toutes humeurs.
    const driftAmp = (WRIST_DRIFT.idle * weights[0] + WRIST_DRIFT.listening * weights[1] + WRIST_DRIFT.thinking * weights[2] + WRIST_DRIFT.speaking * weights[3]) * motion
    for (let h = 0; h < 2; h++) {
      const stretch = h === 0 ? 1 : WRIST_DRIFT_RIGHT_SLOWER
      let tilt = 0
      let twist = 0
      let flex = 0
      for (let axis = 0; axis < 3; axis++) {
        const [slowPeriod, quickPeriod] = WRIST_DRIFT_PERIODS[axis]
        const value =
          driftAmp *
          WRIST_DRIFT_AXIS[axis] *
          (0.55 * Math.sin((TAU * time) / (slowPeriod * stretch) + wristPhases[h * 6 + axis * 2]) + 0.45 * Math.sin((TAU * time) / (quickPeriod * stretch) + wristPhases[h * 6 + axis * 2 + 1]))
        if (axis === 0) tilt = value
        else if (axis === 1) twist = value
        else flex = value
      }
      add(h === 0 ? BONE_INDEX.leftHand : BONE_INDEX.rightHand, tilt, twist, flex, 1)
    }

    // --- Le corps est tourné de `bodyYaw` : la tête revient en partie vers la caméra.
    add(BONE_INDEX.head, 0, -0.55 * settings.bodyYaw, 0, 1)

    // --- Écoute : tête inclinée vers le chat, regard attentif, légère avancée du buste, petits hochements.
    if (wListen > 0) {
      const side = settings.side
      const down = settings.down
      add(BONE_INDEX.head, 0.07 + 0.1 * down, 0.16 * side, -0.1 * (side || 0.4), wListen)
      add(BONE_INDEX.neck, 0.03 + 0.04 * down, 0.08 * side, -0.05 * (side || 0.4), wListen)
      add(BONE_INDEX.spine01, 0.03, 0.05 * side, -0.02 * side, wListen)
      add(BONE_INDEX.spine, 0.03, 0.04 * side, 0, wListen)
      if (time >= nextListenNodAt && wListen > 0.5) {
        listenNodStart = time
        nextListenNodAt = time + between(rng, 4, 7)
      }
      const u = (time - listenNodStart) / 0.55
      if (u >= 0 && u < 1) add(BONE_INDEX.head, 0.045 * Math.sin(Math.PI * u) ** 2, 0, 0, wListen * motion)
    }

    // --- Réflexion : tête penchée et levée de côté, léger balancement du buste.
    if (wThink > 0) {
      const side = settings.side || 0.5
      const sway = Math.sin((TAU * time) / 3.6 + phases[6])
      add(BONE_INDEX.head, -0.1, 0.2 * side, -0.24 * side, wThink)
      add(BONE_INDEX.neck, -0.04, 0.08 * side, -0.08 * side, wThink)
      addAim(THINKING, wThink * motion, null, 0)
      addPose(THINKING_WRIST_POSE, wThink * motion)
      add(BONE_INDEX.spine, 0, 0, 0.035 * sway * motion, wThink)
      add(BONE_INDEX.spine01, 0, 0.025 * sway * motion, 0.02 * sway * motion, wThink)
      add(BONE_INDEX.head, 0, 0, 0.03 * Math.sin((TAU * time) / 3.6 + phases[6] + 0.7) * motion, wThink)
      add(BONE_INDEX.rightShoulder, 0, 0, -0.04, wThink)
      add(BONE_INDEX.leftShoulder, 0, 0, 0.04, wThink)
    }

    // --- Parole : gestes de bras et hochements rythmés.
    const speakingNow = mood === 'speaking'
    if (speakingNow && !wasSpeaking) nextGestureAt = time + planner.firstDelay()
    if (!speakingNow && wasSpeaking) nextGestureAt = Infinity
    wasSpeaking = speakingNow
    if (speakingNow && forced === null && time >= nextGestureAt && raw[MOOD_INDEX.speaking] > 0.05) startGesture()

    // Parole : léger regard vers le chat et buste un peu avancé (on s'adresse à quelqu'un).
    if (wSpeak > 0) {
      add(BONE_INDEX.head, -0.02, 0.1 * settings.side, 0, wSpeak)
      add(BONE_INDEX.spine01, 0.015, 0, 0, wSpeak)
    }

    // Hochements rythmés (parole).
    if (speakingNow && time >= nextNodAt) {
      nodStart = time
      nodDepth = between(rng, 0.05, 0.09)
      nextNodAt = time + between(rng, 0.9, 1.9)
    }
    const nodU = (time - nodStart) / 0.5
    if (nodU >= 0 && nodU < 1) {
      const bump = Math.sin(Math.PI * nodU) ** 2
      add(BONE_INDEX.head, nodDepth * bump * motion, 0, 0, wSpeak)
      add(BONE_INDEX.neck, nodDepth * bump * 0.4 * motion, 0, 0, wSpeak)
    }

    // Calque des gestes de bras : poids de parole × enveloppe de chaque geste, normalisé si ça se chevauche.
    activeId = null
    let bestEnvelope = 0
    let sumW = 0
    for (const slot of slots) {
      if (!slot.active) continue
      const elapsed = time - slot.start
      if (elapsed >= slot.duration) {
        slot.active = false
        continue
      }
      sumW += gestureEnvelope(elapsed, slot.duration) * slot.amplitude
    }
    const norm = sumW > 1 ? 1 / sumW : 1
    const armGain = wSpeak * motion
    for (const slot of slots) {
      if (!slot.active) continue
      const elapsed = time - slot.start
      const env = gestureEnvelope(elapsed, slot.duration)
      const w = env * slot.amplitude * norm
      if (w <= 0) continue
      const variant = slot.def.variants[slot.side]
      // Battements pendant le plateau : `count` bosses, nulles aux deux bouts du geste.
      let beat = 0
      const pulse = slot.def.spec.pulse
      if (pulse) {
        const u = elapsed / slot.duration
        const v = clamp((u - GESTURE_ATTACK_FRACTION) / (1 - GESTURE_RELEASE_FRACTION - GESTURE_ATTACK_FRACTION), 0, 1)
        beat = Math.sin(Math.PI * v * pulse.count) ** 2 * Math.sin(Math.PI * v)
      }
      addAim(variant.aim, w * armGain, variant.pulseAim, beat)
      addPose(variant.pose, w * wSpeak)
      if (variant.pulsePose) addPose(variant.pulsePose, w * wSpeak * beat)
      addPose(variant.wrist, w * armGain)
      if (variant.pulseWrist) addPose(variant.pulseWrist, w * armGain * beat)
      if (variant.waveWrist) addPose(variant.waveWrist, w * armGain * Math.sin((TAU * elapsed) / slot.def.spec.wave!.period))
      if (env > bestEnvelope) {
        bestEnvelope = env
        activeId = slot.def.spec.id
      }
    }

    // Geste forcé (débogage) : maintenu au sommet, indépendant de l'humeur.
    if (forced) {
      const variant = forced.def.variants[forced.side]
      const pulse = forced.def.spec.pulse
      const beat = pulse ? Math.sin(Math.PI * ((time * 0.6) % 1) * pulse.count) ** 2 : 0
      addAim(variant.aim, 1, variant.pulseAim, beat)
      addPose(variant.pose, 1)
      if (variant.pulsePose) addPose(variant.pulsePose, beat)
      addPose(variant.wrist, 1)
      if (variant.pulseWrist) addPose(variant.pulseWrist, beat)
      if (variant.waveWrist) addPose(variant.waveWrist, Math.sin((TAU * time) / forced.def.spec.wave!.period))
      activeId = forced.def.spec.id
    }

    // Battements de ponctuation du poignet (parole) : le poing plonge d'un petit coup, au rythme de la parole : sur
    // chaque hochement de tête (`nodStart === time` ne vaut que l'image où le hochement part) et entre deux. La
    // main la plus engagée dans un geste part en premier et plus fort que l'autre.
    if (!speakingNow) nextBeatAt = Infinity
    else if (nextBeatAt === Infinity) nextBeatAt = time + between(wristRng, 0.3, 0.8)
    const nodStartsNow = nodStart === time
    if (speakingNow && raw[MOOD_INDEX.speaking] > 0.05 && (time >= nextBeatAt || (nodStartsNow && time - lastBeatAt >= WRIST_BEAT_SECONDS + WRIST_BEAT_SECOND_HAND_DELAY_MAX))) {
      const lead = wristRng() < 0.5 ? 0 : 1
      const depth = between(wristRng, 0.14, 0.22)
      const twist = (wristRng() < 0.5 ? -1 : 1) * between(wristRng, 0.04, 0.11)
      for (let h = 0; h < 2; h++) {
        beatStart[h] = time + (h === lead ? 0 : between(wristRng, 0.06, WRIST_BEAT_SECOND_HAND_DELAY_MAX))
        beatDepth[h] = h === lead ? depth : depth * 0.55
        beatTwist[h] = twist
      }
      lastBeatAt = time
      nextBeatAt = time + between(wristRng, WRIST_BEAT_INTERVAL_MIN, WRIST_BEAT_INTERVAL_MAX)
    }
    for (let h = 0; h < 2; h++) {
      const u = (time - beatStart[h]) / WRIST_BEAT_SECONDS
      if (u < 0 || u >= 1) continue
      const bump = Math.sin(Math.PI * u) ** 2
      // Plus marqué quand le bras est levé (la main se voit), discret quand il pend.
      const engaged = Math.min(1, aimWeight[AIM_INDEX[h === 0 ? 'leftForeArm' : 'rightForeArm']])
      const gain = wSpeak * motion * (0.5 + 0.5 * engaged) * bump
      const sign = h === 0 ? 1 : -1 // main gauche : miroir de la droite (y et z changent de signe)
      add(h === 0 ? BONE_INDEX.leftHand : BONE_INDEX.rightHand, 0.25 * beatDepth[h], -sign * beatTwist[h], sign * beatDepth[h], gain)
    }

    // Limite douce par os et par axe.
    for (let b = 0; b < BONE_COUNT; b++) {
      const limits = BONE_LIMITS[DRIVEN_BONES[b]]
      const i = b * 3
      pose[i] = softLimit(pose[i], limits[0])
      pose[i + 1] = softLimit(pose[i + 1], limits[1])
      pose[i + 2] = softLimit(pose[i + 2], limits[2])
    }

    // Visées : direction moyenne pondérée, poids total plafonné à 1.
    for (let s = 0; s < AIM_COUNT; s++) {
      const i = s * 3
      const o = s * AIM_STRIDE
      const len = Math.hypot(aimSum[i], aimSum[i + 1], aimSum[i + 2])
      const w = aimWeight[s]
      if (len > 1e-4 && w > 1e-5) {
        aim[o] = aimSum[i] / len
        aim[o + 1] = aimSum[i + 1] / len
        aim[o + 2] = aimSum[i + 2] / len
      }
      // Poids : somme des poids plafonnée à 1, atténuée si les cibles s'annulent presque (moyenne ~ nulle).
      const coherence = w > 1e-5 ? len / w : 0 // 1 : cibles alignées ; proche de 0 : cibles opposées
      aim[o + 3] = Math.min(1, w) * Math.min(1, coherence / 0.3)
    }
  }

  return {
    pose,
    aim,
    weights,
    get time() {
      return time
    },
    get activeGesture() {
      return activeId
    },
    update,
    configure(next) {
      Object.assign(settings, next)
    },
    forceGesture(id, mirrored = false) {
      if (id === null) {
        forced = null
        return
      }
      const def = GESTURES.find((g) => g.spec.id === id)
      if (def) forced = { def, side: mirrored && !def.spec.symmetric ? 1 : 0 }
    },
  }
}
