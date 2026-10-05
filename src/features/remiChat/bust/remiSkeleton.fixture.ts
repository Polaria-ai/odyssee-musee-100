/**
 * Squelette de Rémi (24 os Meshy) tel que le fournit `public/models/characters/remi.glb`, dans la pose du
 * premier instant du clip « idle » : nom, parent, position locale (centimètres : le nœud `Armature` porte
 * l'échelle 0,01) et quaternion local. Sert aux tests de `bonePose` et du cadrage sans charger le GLB ni
 * WebGL. Extrait avec `@gltf-transform` ; à régénérer si le modèle change.
 */
import { Bone, Group } from 'three'

export interface FixtureBone {
  name: string
  parent: string | null
  /** Position locale (cm). */
  t: readonly [number, number, number]
  /** Quaternion local (x, y, z, w), normalisé. */
  r: readonly [number, number, number, number]
}

export const REMI_SKELETON: readonly FixtureBone[] = [
  { name: 'Hips', parent: null, t: [0.625, 78.5, -0.9375], r: [0.085544, -0.101902, 0.703516, 0.698114] },
  { name: 'LeftUpLeg', parent: 'Hips', t: [-5.9492, -7.4727, 6.6992], r: [0.715694, -0.602378, -0.3495, 0.052645] },
  { name: 'LeftLeg', parent: 'LeftUpLeg', t: [0, 30.375, 0], r: [0.276159, 0.038361, 0.028626, 0.959919] },
  { name: 'LeftFoot', parent: 'LeftLeg', t: [0, 32.4375, 0], r: [-0.573169, -0.12122, 0.000702, 0.810421] },
  { name: 'LeftToeBase', parent: 'LeftFoot', t: [0, 13.5547, 0], r: [-0.302529, -0.074434, 0.004028, 0.950221] },
  { name: 'RightUpLeg', parent: 'Hips', t: [-7.3594, 7.8633, 0.8555], r: [-0.568978, 0.703868, -0.180087, -0.385229] },
  { name: 'RightLeg', parent: 'RightUpLeg', t: [0, 30.9844, 0], r: [0.207433, -0.025941, -0.014038, 0.977805] },
  { name: 'RightFoot', parent: 'RightLeg', t: [0, 31.3281, 0], r: [-0.595812, 0.112094, -0.073122, 0.791894] },
  { name: 'RightToeBase', parent: 'RightFoot', t: [0, 13.8438, 0], r: [-0.315683, 0.07709, -0.006287, 0.945707] },
  { name: 'Spine02', parent: 'Hips', t: [13.3125, -0.3906, -3.5469], r: [-0.137242, -0.044435, -0.693627, 0.705742] },
  { name: 'Spine01', parent: 'Spine02', t: [0, 13.7813, 0], r: [-0.011078, 0.045504, 0.018433, 0.998733] },
  { name: 'Spine', parent: 'Spine01', t: [0, 13.7813, 0], r: [-0.040925, -0.000702, -0.00705, 0.999137] },
  { name: 'LeftShoulder', parent: 'Spine', t: [3.8535, 1.7148, -0.3574], r: [0.432078, 0.542676, -0.471477, 0.544538] },
  { name: 'LeftArm', parent: 'LeftShoulder', t: [0, 15.4609, 0], r: [0.498152, 0.716999, 0.314309, 0.372782] },
  { name: 'LeftForeArm', parent: 'LeftArm', t: [0, 27.1094, 0], r: [-0.261113, 0.067842, 0.153872, 0.950548] },
  { name: 'LeftHand', parent: 'LeftForeArm', t: [0, 22.9375, 0], r: [-0.047212, 0.07889, 0.166112, 0.981812] },
  { name: 'RightShoulder', parent: 'Spine', t: [-3.916, 1.4961, -0.416], r: [0.431776, -0.541276, 0.461989, 0.554216] },
  { name: 'RightArm', parent: 'RightShoulder', t: [0, 15.625, 0], r: [0.533855, -0.521373, -0.33036, 0.577954] },
  { name: 'RightForeArm', parent: 'RightArm', t: [0, 26.4219, 0], r: [-0.60793, -0.10007, -0.225898, 0.754571] },
  { name: 'RightHand', parent: 'RightForeArm', t: [0, 22.7813, 0], r: [0.22559, -0.243809, -0.188114, 0.924272] },
  { name: 'neck', parent: 'Spine', t: [0.0625, 12.875, 0.7734], r: [0.029908, 0.07895, 0.012238, 0.996355] },
  { name: 'Head', parent: 'neck', t: [0, 8.4844, 0], r: [0.292058, 0.028931, -0.016175, 0.955826] },
  { name: 'head_end', parent: 'Head', t: [0.1563, 26.2031, -11], r: [-0.197301, 0, -0.002716, 0.980339] },
  { name: 'headfront', parent: 'Head', t: [-0.1484, 4.1953, 10.9922], r: [0.567226, 0, 0.007843, 0.823525] },
]

/**
 * Axes X, Y et Z (dans le monde, pose de liaison en A, normalisés) des os de main, lus dans les matrices de liaison
 * inverses du GLB. Les deux repères sont IDENTIQUES (pas en miroir) : X vers la droite de l'écran, Y le long du bras
 * vers le bas et un peu vers l'avant, Z vers l'arrière. C'est ce qui fixe la règle de symétrie des poignets : la même
 * pose à gauche s'écrit (x, −y, −z) (`gestures.ts`, « Poignets »).
 */
export const REMI_BIND_HAND_AXES = {
  LeftHand: { x: [1, 0, 0], y: [0, -0.92, 0.38], z: [0, -0.38, -0.92] },
  RightHand: { x: [1, -0.02, 0.03], y: [-0.03, -0.93, 0.38], z: [0.02, -0.38, -0.93] },
} as const

/**
 * Échelle et décalage que `getCharacterAssets` donne à Rémi dans le jeu (hauteur visée 1,8 m, pieds à 0),
 * mesurés dans le navigateur : bassin à 0,829 m et bout de tête à 1,776 m, contre 0,785 et 1,681 m bruts.
 */
export const REMI_GAME_SCALE = 1.0565

/** Reconstruit le squelette (os nommés, hiérarchie et pose du clip « idle » à t = 0) à l'échelle du jeu. */
export function makeRemiSkeleton(scale = REMI_GAME_SCALE): { root: Group; bones: Map<string, Bone> } {
  const armature = new Group()
  armature.name = 'Armature'
  armature.scale.setScalar(0.01)
  const bones = new Map<string, Bone>()
  for (const b of REMI_SKELETON) {
    const bone = new Bone()
    bone.name = b.name
    bone.position.set(...b.t)
    bone.quaternion.set(...b.r).normalize() // 6 décimales : la norme n'est pas exactement 1
    bones.set(b.name, bone)
    ;(b.parent ? bones.get(b.parent)! : armature).add(bone)
  }
  const root = new Group()
  root.add(armature)
  root.scale.setScalar(scale)
  root.updateMatrixWorld(true)
  return { root, bones }
}
