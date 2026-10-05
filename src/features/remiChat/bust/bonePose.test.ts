import { describe, expect, it } from 'vitest'
import { Euler, Group, Quaternion, Vector3, type Object3D } from 'three'
import { BonePoseDriver } from './bonePose'
import { AIM_COUNT, AIM_INDEX, AIM_LENGTH, AIM_MAX_SWING, AIM_STRIDE, BONE_INDEX, POSE_LENGTH, type AimSegment } from './gestures'
import { REMI_BIND_HAND_AXES, makeRemiSkeleton } from './remiSkeleton.fixture'

const CHILD: Record<AimSegment, string> = { leftArm: 'LeftForeArm', leftForeArm: 'LeftHand', rightArm: 'RightForeArm', rightForeArm: 'RightHand' }
const BONE: Record<AimSegment, string> = { leftArm: 'LeftArm', leftForeArm: 'LeftForeArm', rightArm: 'RightArm', rightForeArm: 'RightForeArm' }

const _a = new Vector3()
const _b = new Vector3()

/** Direction monde du segment (os → enfant). */
function direction(bones: Map<string, Object3D>, seg: AimSegment, out = new Vector3()): Vector3 {
  const bone = bones.get(BONE[seg])!
  const child = bones.get(CHILD[seg])!
  bone.getWorldPosition(_a)
  child.getWorldPosition(_b)
  return out.subVectors(_b, _a).normalize()
}

function setup(yaw = 0) {
  const { root, bones } = makeRemiSkeleton()
  const scene = new Group()
  scene.rotation.y = yaw
  scene.add(root)
  scene.updateMatrixWorld(true)
  const driver = new BonePoseDriver(root, scene)
  const pose = new Float32Array(POSE_LENGTH)
  const aim = new Float32Array(AIM_LENGTH)
  const aimAt = (seg: AimSegment, dir: [number, number, number], weight: number) => {
    const o = AIM_INDEX[seg] * AIM_STRIDE
    const len = Math.hypot(...dir)
    aim.set([dir[0] / len, dir[1] / len, dir[2] / len, weight], o)
  }
  const apply = () => {
    driver.apply(pose, aim)
    scene.updateMatrixWorld(true)
  }
  return { root, bones, scene, driver, pose, aim, aimAt, apply }
}

const quats = (bones: Map<string, Object3D>) => [...bones.values()].map((b) => b.quaternion.clone())

describe('BonePoseDriver', () => {
  it('trouve les 13 os pilotés du squelette de Rémi ; un squelette sans ces os est ignoré sans erreur', () => {
    expect(setup().driver.found).toBe(13)
    const empty = new BonePoseDriver(new Group())
    expect(empty.found).toBe(0)
    expect(() => empty.apply(new Float32Array(POSE_LENGTH), new Float32Array(AIM_LENGTH))).not.toThrow()
  })

  it('pose et visées nulles : aucun os ne bouge', () => {
    const { bones, apply } = setup()
    const before = quats(bones)
    apply()
    expect(quats(bones).every((q, i) => q.equals(before[i]))).toBe(true)
  })

  it('refuse un tampon trop court sans rien casser', () => {
    const { bones, driver } = setup()
    const before = quats(bones)
    driver.apply(new Float32Array(3), new Float32Array(3))
    expect(quats(bones).every((q, i) => q.equals(before[i]))).toBe(true)
  })

  for (const seg of ['leftArm', 'leftForeArm', 'rightArm', 'rightForeArm'] as const) {
    it(`visée de ${seg} : le segment finit exactement dans la direction demandée`, () => {
      const { bones, aimAt, apply } = setup()
      // Cible de la famille des gestes : bras le long du corps, un peu en avant ; avant-bras relevé devant la poitrine.
      const side = seg.startsWith('left') ? 1 : -1
      const target = (seg.endsWith('ForeArm') ? new Vector3(0.1 * side, 0.6, 0.75) : new Vector3(0.25 * side, -0.75, 0.55)).normalize()
      aimAt(seg, [target.x, target.y, target.z], 1)
      apply()
      expect(direction(bones, seg).angleTo(target)).toBeLessThan(1e-4)
    })
  }

  it('poids partiel : la rotation est la même fraction de l\'arc total (glissement continu)', () => {
    const full = setup()
    const half = setup()
    const start = direction(full.bones, 'rightArm')
    full.aimAt('rightArm', [-0.2, 0.1, 0.95], 1)
    half.aimAt('rightArm', [-0.2, 0.1, 0.95], 0.5)
    full.apply()
    half.apply()
    const total = start.angleTo(direction(full.bones, 'rightArm'))
    const part = start.angleTo(direction(half.bones, 'rightArm'))
    expect(total).toBeGreaterThan(0.5)
    expect(part).toBeCloseTo(total / 2, 3)
  })

  it('rotation bornée par segment : un ordre plus grand que la limite est tronqué à AIM_MAX_SWING', () => {
    const { bones, aimAt, apply } = setup()
    const start = direction(bones, 'leftArm')
    aimAt('leftArm', [-start.x, -start.y, -start.z + 1e-3], 1) // quasiment l'opposé : ~ 180°
    apply()
    const moved = start.angleTo(direction(bones, 'leftArm'))
    expect(moved).toBeCloseTo(AIM_MAX_SWING.leftArm, 4)
    expect(moved).toBeLessThan(Math.PI)
  })

  it('les visées sont dans le repère de l\'écran : la rotation du corps (trois quarts) ne les dévie pas', () => {
    const target = new Vector3(0.25, -0.5, 0.8).normalize()
    for (const yaw of [0, 0.2, -0.5]) {
      const { bones, aimAt, apply } = setup(yaw)
      aimAt('leftArm', [target.x, target.y, target.z], 1)
      apply()
      expect(direction(bones, 'leftArm').angleTo(target)).toBeLessThan(1e-4)
    }
  })

  it('delta d\'Euler : tourne l\'os autour des axes du PERSONNAGE (ici tourné de 0,5 rad), du bon angle', () => {
    const yaw = 0.5
    const { bones, scene, pose, apply } = setup(yaw)
    const head = bones.get('Head')!
    const before = head.getWorldQuaternion(new Quaternion())
    pose[BONE_INDEX.head * 3] = 0.25 // tangage : autour de l'axe gauche-droite du personnage
    apply()
    const after = head.getWorldQuaternion(new Quaternion())
    const delta = after.multiply(before.invert()) // rotation monde appliquée à la tête
    const angle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)))
    expect(angle).toBeCloseTo(0.25, 5)
    const axis = new Vector3(delta.x, delta.y, delta.z).normalize()
    if (delta.w < 0) axis.negate()
    const frameX = new Vector3(1, 0, 0).applyQuaternion(scene.getWorldQuaternion(new Quaternion()))
    expect(axis.angleTo(frameX)).toBeLessThan(1e-5)
  })

  it('pas d\'accumulation : la même consigne rejouée 200 fois (mixeur muet) donne toujours la même pose', () => {
    const { bones, pose, aimAt, apply } = setup()
    pose[BONE_INDEX.head * 3 + 2] = 0.2
    pose[BONE_INDEX.spine01 * 3] = 0.1
    aimAt('rightArm', [-0.3, -0.2, 0.9], 0.7)
    aimAt('rightForeArm', [0.2, 0.5, 0.8], 0.7)
    apply()
    const first = quats(bones)
    for (let i = 0; i < 200; i++) apply()
    quats(bones).forEach((q, i) => expect(q.angleTo(first[i])).toBeLessThan(1e-6))
  })

  it('quand le mixeur réécrit un os, la consigne repart de sa nouvelle rotation', () => {
    const { bones, pose, apply } = setup()
    const neck = bones.get('neck')!
    pose[BONE_INDEX.neck * 3 + 1] = 0.3
    apply()
    // Le mixeur écrit une nouvelle rotation d'animation.
    const animated = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.4).multiply(neck.quaternion).normalize()
    neck.quaternion.copy(animated)
    apply()
    const afterTwo = neck.quaternion.clone()
    // Même consigne sur la même base : résultat identique, qu'on parte de l'os déjà modifié ou d'une réécriture.
    neck.quaternion.copy(animated)
    apply()
    expect(neck.quaternion.angleTo(afterTwo)).toBeLessThan(1e-6)
    expect(neck.quaternion.angleTo(animated)).toBeGreaterThan(0.1)
  })

  it('restore() rend aux os leur rotation d\'animation, à l\'identique', () => {
    const { bones, pose, aimAt, apply, driver } = setup()
    const before = quats(bones)
    pose[BONE_INDEX.head * 3] = 0.3
    aimAt('leftArm', [0.5, 0, 0.8], 1)
    apply()
    expect(quats(bones).some((q, i) => !q.equals(before[i]))).toBe(true)
    driver.restore()
    expect(quats(bones).every((q, i) => q.equals(before[i]))).toBe(true)
  })

  it('compte de visées et tampons cohérents', () => {
    expect(AIM_LENGTH).toBe(AIM_COUNT * AIM_STRIDE)
  })
})

describe('poignets : rotation dans le repère propre de la main', () => {
  const HAND = { leftHand: 'LeftHand', rightHand: 'RightHand' } as const
  const worldAxisY = (bones: Map<string, Object3D>, name: string) => new Vector3(0, 1, 0).transformDirection(bones.get(name)!.matrixWorld)
  const worldQuat = (bones: Map<string, Object3D>, name: string) => bones.get(name)!.getWorldQuaternion(new Quaternion())

  for (const hand of ['leftHand', 'rightHand'] as const) {
    const name = HAND[hand]
    const at = BONE_INDEX[hand] * 3

    it(`${hand} : la torsion (y) tourne le poing autour de l'axe de l'avant-bras, sans le déplacer, du bon angle`, () => {
      const { bones, pose, apply } = setup(0.3)
      apply()
      const axisBefore = worldAxisY(bones, name)
      const quatBefore = worldQuat(bones, name)
      pose[at + 1] = 0.6
      apply()
      expect(worldAxisY(bones, name).angleTo(axisBefore)).toBeLessThan(1e-6)
      expect(worldQuat(bones, name).angleTo(quatBefore)).toBeCloseTo(0.6, 5)
    })

    it(`${hand} : la flexion (z) et l'inclinaison (x) inclinent l'axe du poing de l'angle demandé, dans le plan de la main`, () => {
      for (const axis of [0, 2]) {
        const { bones, pose, apply } = setup(-0.4)
        apply()
        const axisBefore = worldAxisY(bones, name)
        pose[at + axis] = 0.5
        apply()
        expect(worldAxisY(bones, name).angleTo(axisBefore), `axe ${axis}`).toBeCloseTo(0.5, 5)
      }
    })

    it(`${hand} : le même ordre donne la même rotation de poignet quelles que soient la visée du bras et la rotation du corps`, () => {
      // Rotation RELATIVE de la main par rapport à l'avant-bras : c'est elle qu'on commande, pas l'orientation dans le monde.
      const relative = (yaw: number, armed: boolean) => {
        const { bones, pose, aimAt, apply } = setup(yaw)
        if (armed) {
          aimAt('rightForeArm', [0.3, 0.6, 0.75], 1)
          aimAt('leftForeArm', [-0.3, 0.6, 0.75], 1)
        }
        apply()
        const parent = bones.get(hand === 'leftHand' ? 'LeftForeArm' : 'RightForeArm')!
        const rest = parent.getWorldQuaternion(new Quaternion()).invert().multiply(worldQuat(bones, name))
        pose[at] = 0.2
        pose[at + 1] = -0.4
        pose[at + 2] = 0.3
        apply()
        const turned = parent.getWorldQuaternion(new Quaternion()).invert().multiply(worldQuat(bones, name))
        return rest.invert().multiply(turned) // rotation ajoutée, dans le repère de l'avant-bras avant rotation
      }
      const reference = relative(0, false)
      for (const [yaw, armed] of [[0.2, false], [-0.5, true], [0.9, true]] as const) expect(relative(yaw, armed).angleTo(reference)).toBeLessThan(1e-5)
      expect(reference.angleTo(new Quaternion())).toBeGreaterThan(0.4)
    })

    it(`${hand} : pas d'accumulation (200 applications de la même consigne) et restore() rend la rotation d'animation`, () => {
      const { bones, driver, pose, apply } = setup()
      const before = bones.get(name)!.quaternion.clone()
      pose[at] = 0.2
      pose[at + 1] = 0.5
      pose[at + 2] = -0.3
      apply()
      const first = bones.get(name)!.quaternion.clone()
      for (let i = 0; i < 200; i++) apply()
      expect(bones.get(name)!.quaternion.angleTo(first)).toBeLessThan(1e-6)
      expect(first.angleTo(before)).toBeGreaterThan(0.3)
      driver.restore()
      expect(bones.get(name)!.quaternion.equals(before)).toBe(true)
    })
  }

  it('les deux mains ont le MÊME repère en pose de liaison : le miroir d\'un poignet est (x, −y, −z)', () => {
    // Données du GLB (matrices de liaison inverses) : axes X, Y, Z des deux os de main alignés à moins de 0,06 rad.
    const { LeftHand, RightHand } = REMI_BIND_HAND_AXES
    for (const axis of ['x', 'y', 'z'] as const) expect(new Vector3(...LeftHand[axis]).angleTo(new Vector3(...RightHand[axis]))).toBeLessThan(0.06)
    // Le maillage de la main gauche est le symétrique de la droite (x → −x) : en coordonnées locales, une réflexion
    // diag(−1, 1, 1). Une rotation (x, y, z) devient alors (x, −y, −z) : le quaternion perd le signe de y et de z.
    const right = new Quaternion().setFromEuler(new Euler(0.2, 0.5, -0.3, 'YXZ'))
    const reflected = new Quaternion(right.x, -right.y, -right.z, right.w)
    expect(new Quaternion().setFromEuler(new Euler(0.2, -0.5, 0.3, 'YXZ')).angleTo(reflected)).toBeLessThan(1e-5)
  })
})
