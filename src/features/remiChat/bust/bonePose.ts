/**
 * Pose procédurale des os (couche posée APRÈS la mise à jour du mixeur). three seul, aucun React,
 * aucune allocation à l'image : testable sans Canvas.
 *
 * Les os Meshy ont des repères locaux quelconques (rotations de liaison de 90° et plus) : les ordres du
 * moteur de gestes (`gestures.ts`) sont donc convertis ici en rotation locale de chaque os :
 * `local' = P⁻¹ · D · P · local`, où `P` est l'orientation monde du parent et `D` un delta exprimé dans
 * le monde. Deux sortes d'ordres :
 *  - delta d'Euler (colonne, cou, tête, épaules, mains), dans le repère du PERSONNAGE (celui de `frame`,
 *    tourné de trois quarts avec le corps) : `D = R · d · R⁻¹` avec `d` = rotation YXZ ;
 *  - visée (bras, avant-bras), dans le repère de l'ÉCRAN (le monde de la scène : la caméra regarde vers
 *    −Z) : `D` = plus court arc qui amène la direction ACTUELLE du segment (de l'os à son enfant, après
 *    animation) sur la direction cible, pris sur la fraction `poids` et borné par `AIM_MAX_SWING`. Le geste
 *    est le même des deux côtés quelle que soit la pose du clip, et ne dépend pas de la rotation du corps :
 *    ce qu'on règle à l'écran (mains dans le cadre) est ce qu'on obtient.
 *
 * Piège évité : le mixeur n'écrit un os que si la valeur interpolée a changé depuis l'image précédente.
 * Une piste constante laisserait donc notre delta de l'image d'avant en place, et il s'accumulerait.
 * On mémorise la rotation « de base » de chaque os et celle qu'on y a écrite ; si l'os porte encore
 * notre écriture, le mixeur n'y a pas touché et on repart de la base mémorisée.
 */
import { Euler, Quaternion, Vector3, type Object3D } from 'three'
import {
  AIM_INDEX,
  AIM_MAX_SWING,
  AIM_STRIDE,
  BONE_INDEX,
  POSE_LENGTH,
  AIM_LENGTH,
  type AimSegment,
  type DrivenBone,
} from './gestures'

/** Noms des os dans le GLB de Rémi (squelette Meshy à 24 os). */
export const GLB_BONE_NAMES: Readonly<Record<DrivenBone | 'leftArm' | 'leftForeArm' | 'rightArm' | 'rightForeArm', string>> = {
  spine02: 'Spine02',
  spine01: 'Spine01',
  spine: 'Spine',
  leftShoulder: 'LeftShoulder',
  leftArm: 'LeftArm',
  leftForeArm: 'LeftForeArm',
  leftHand: 'LeftHand',
  rightShoulder: 'RightShoulder',
  rightArm: 'RightArm',
  rightForeArm: 'RightForeArm',
  rightHand: 'RightHand',
  neck: 'neck',
  head: 'Head',
}

/** Étapes dans l'ordre de la hiérarchie : chaque os est traité après son parent. */
type Step = { readonly euler: DrivenBone } | { readonly aim: AimSegment; readonly name: keyof typeof GLB_BONE_NAMES; readonly child: keyof typeof GLB_BONE_NAMES }

const STEPS: readonly Step[] = [
  { euler: 'spine02' },
  { euler: 'spine01' },
  { euler: 'spine' },
  { euler: 'leftShoulder' },
  { aim: 'leftArm', name: 'leftArm', child: 'leftForeArm' },
  { aim: 'leftForeArm', name: 'leftForeArm', child: 'leftHand' },
  { euler: 'leftHand' },
  { euler: 'rightShoulder' },
  { aim: 'rightArm', name: 'rightArm', child: 'rightForeArm' },
  { aim: 'rightForeArm', name: 'rightForeArm', child: 'rightHand' },
  { euler: 'rightHand' },
  { euler: 'neck' },
  { euler: 'head' },
]

/** Delta ou poids en dessous duquel un os n'est pas touché (évite des recalculs inutiles au repos). */
const EPSILON = 1e-6

const _euler = new Euler()
const _delta = new Quaternion()
const _frame = new Quaternion()
const _frameInv = new Quaternion()
const _parent = new Quaternion()
const _local = new Quaternion()
const _swing = new Quaternion()
const _part = new Quaternion()
const _from = new Vector3()
const _to = new Vector3()
const _dir = new Vector3()
const _target = new Vector3()

interface Slot {
  readonly step: Step
  readonly bone: Object3D | null
  readonly child: Object3D | null
  readonly base: Quaternion
  readonly written: Quaternion
  hasWritten: boolean
}

export class BonePoseDriver {
  private readonly slots: Slot[]
  private readonly frame: Object3D

  /** `frame` : l'objet dont les axes sont ceux du personnage (la racine du clone, qui regarde vers +Z). */
  constructor(root: Object3D, frame: Object3D = root) {
    this.frame = frame
    this.slots = STEPS.map((step) => {
      const key = 'euler' in step ? step.euler : step.name
      return {
        step,
        bone: root.getObjectByName(GLB_BONE_NAMES[key]) ?? null,
        child: 'aim' in step ? (root.getObjectByName(GLB_BONE_NAMES[step.child]) ?? null) : null,
        base: new Quaternion(),
        written: new Quaternion(),
        hasWritten: false,
      }
    })
  }

  /** Os trouvés dans le squelette (les autres sont ignorés sans erreur). */
  get found(): number {
    return this.slots.filter((s) => s.bone).length
  }

  bone(name: keyof typeof GLB_BONE_NAMES): Object3D | null {
    const slot = this.slots.find((s) => ('euler' in s.step ? s.step.euler : s.step.name) === name)
    return slot?.bone ?? null
  }

  /**
   * À appeler après `mixer.update`. `pose` : deltas d'Euler (`POSE_LENGTH`, ordre de `DRIVEN_BONES`) ;
   * `aim` : visées des bras (`AIM_LENGTH`, voir `gestures.ts`).
   */
  apply(pose: ArrayLike<number>, aim: ArrayLike<number>): void {
    if (pose.length < POSE_LENGTH || aim.length < AIM_LENGTH) return
    this.frame.getWorldQuaternion(_frame)
    _frameInv.copy(_frame).invert()

    for (const slot of this.slots) {
      const bone = slot.bone
      if (!bone || !bone.parent) continue

      // Repart de la rotation d'animation : celle du mixeur, ou la dernière connue s'il n'a rien réécrit.
      if (slot.hasWritten && bone.quaternion.equals(slot.written)) bone.quaternion.copy(slot.base)
      else slot.base.copy(bone.quaternion)
      slot.hasWritten = false

      const step = slot.step
      let moved = false
      if ('euler' in step) {
        const i = BONE_INDEX[step.euler] * 3
        const x = pose[i]
        const y = pose[i + 1]
        const z = pose[i + 2]
        if (Math.abs(x) >= EPSILON || Math.abs(y) >= EPSILON || Math.abs(z) >= EPSILON) {
          _part.setFromEuler(_euler.set(x, y, z, 'YXZ'))
          _delta.copy(_frame).multiply(_part).multiply(_frameInv) // delta du repère du personnage → monde
          moved = true
        }
      } else if (slot.child) {
        const o = AIM_INDEX[step.aim] * AIM_STRIDE
        const weight = aim[o + 3]
        if (weight >= EPSILON) {
          // Direction actuelle du segment (os → enfant), dans le repère de l'ÉCRAN (le monde de la scène).
          bone.getWorldPosition(_from)
          slot.child.getWorldPosition(_to)
          _dir.subVectors(_to, _from).normalize()
          _target.set(aim[o], aim[o + 1], aim[o + 2]).normalize()
          _swing.setFromUnitVectors(_dir, _target)
          const angle = 2 * Math.acos(Math.min(1, Math.max(-1, _swing.w)))
          const limit = AIM_MAX_SWING[step.aim]
          const fraction = angle * weight > limit ? limit / angle : weight // rotation bornée par segment
          _delta.identity().slerp(_swing, fraction)
          moved = true
        }
      }
      if (!moved) continue

      bone.parent.getWorldQuaternion(_parent) // inclut déjà les rotations des os parents (application du haut vers le bas)
      _local.copy(_parent).invert().multiply(_delta).multiply(_parent)
      bone.quaternion.premultiply(_local)
      slot.written.copy(bone.quaternion)
      slot.hasWritten = true
    }
  }

  /** Rend aux os leur rotation d'animation (fin de vie du driver). */
  restore(): void {
    for (const slot of this.slots) {
      if (slot.bone && slot.hasWritten && slot.bone.quaternion.equals(slot.written)) slot.bone.quaternion.copy(slot.base)
      slot.hasWritten = false
    }
  }
}
