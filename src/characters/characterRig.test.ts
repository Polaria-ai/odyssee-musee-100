import { AnimationMixer, Box3, MeshLambertMaterial, MeshStandardMaterial, Vector3, VectorKeyframeTrack } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { describe, expect, it } from 'vitest'
import { CULLING_MARGIN, alignRootToReference, findSkinnedMesh, fitToHeight, getCharacterAssets, makeMatteMaterial } from './characterRig'
import { CHARACTERS, type CharacterDef } from './models'
import { FIXTURE_MAP, makeTestRig, positionClip } from './rig.fixture'

const DEF: CharacterDef = { path: '/test.glb', height: 1, clips: { idle: 'idle', wave: 'wave', walk: 'walk' } }

function meanOf(values: ArrayLike<number>, component: number) {
  let sum = 0
  let n = 0
  for (let i = component; i < values.length; i += 3) {
    sum += values[i]
    n++
  }
  return sum / n
}

describe('fitToHeight', () => {
  it('amène la boîte à la hauteur visée, pieds à y = 0', () => {
    const box = new Box3(new Vector3(-1, 0.25, -1), new Vector3(1, 2.25, 1))
    const { scale, offsetY } = fitToHeight(box, 1)
    expect(scale).toBeCloseTo(0.5)
    expect(offsetY).toBeCloseTo(-0.125)
    // Le point le plus bas de la boîte, une fois à l'échelle et décalé, est à 0 ; le plus haut à la hauteur visée.
    expect(box.min.y * scale + offsetY).toBeCloseTo(0)
    expect(box.max.y * scale + offsetY).toBeCloseTo(1)
  })

  it('ne casse rien sur une boîte vide ou une hauteur invalide', () => {
    expect(fitToHeight(new Box3(), 1.5)).toEqual({ scale: 1, offsetY: 0 })
    expect(fitToHeight(new Box3(new Vector3(0, 1, 0), new Vector3(1, 1, 1)), 1.5)).toEqual({ scale: 1, offsetY: 0 })
    expect(fitToHeight(new Box3(new Vector3(0, 0, 0), new Vector3(1, 2, 1)), 0)).toEqual({ scale: 1, offsetY: 0 })
  })
})

describe('alignRootToReference', () => {
  it('recale la moyenne X/Z de la racine sur celle du clip de référence, sans toucher Y ni l\'original', () => {
    const idle = positionClip('idle', 1, [2, 0.5, -1, 2, 0.5, -1])
    const wave = positionClip('wave', 1, [5, 0.8, 4, 7, 0.9, 6])
    const before = Array.from(wave.tracks[0].values)
    const aligned = alignRootToReference(wave, idle)
    const values = aligned.tracks[0].values
    expect(meanOf(values, 0)).toBeCloseTo(2)
    expect(meanOf(values, 2)).toBeCloseTo(-1)
    // Le balancement propre au clip est conservé (écart de 2 entre les deux images en X et en Z).
    expect(values[3] - values[0]).toBeCloseTo(2)
    expect(values[5] - values[2]).toBeCloseTo(2)
    // Y intact.
    expect(values[1]).toBeCloseTo(0.8)
    expect(values[4]).toBeCloseTo(0.9)
    // L'original (partagé avec le cache de useGLTF) n'est pas muté.
    expect(Array.from(wave.tracks[0].values)).toEqual(before)
    expect(aligned).not.toBe(wave)
  })

  it('rend une simple copie quand la piste de racine manque', () => {
    const idle = positionClip('idle', 1, [0, 0, 0, 0, 0, 0])
    const other = positionClip('x', 1, [3, 3, 3, 3, 3, 3])
    other.tracks[0].name = 'Spine.position'
    const out = alignRootToReference(other, idle)
    expect(Array.from(out.tracks[0].values)).toEqual([3, 3, 3, 3, 3, 3])
  })
})

describe('makeMatteMaterial', () => {
  it('reprend la texture de couleur d\'un matériau brillant dans un Lambert mat', () => {
    const shiny = new MeshStandardMaterial({ map: FIXTURE_MAP, metalness: 1, roughness: 0.2 })
    const matte = makeMatteMaterial(shiny)
    expect(matte).toBeInstanceOf(MeshLambertMaterial)
    expect(matte.map).toBe(FIXTURE_MAP)
    expect(matte).not.toHaveProperty('metalness')
    expect(matte).not.toHaveProperty('roughness')
  })

  it('reprend la couleur quand il n\'y a pas de texture', () => {
    const plain = new MeshStandardMaterial({ color: '#ff0000' })
    expect(makeMatteMaterial(plain).color.getHexString()).toBe('ff0000')
    expect(() => makeMatteMaterial(undefined)).not.toThrow()
  })
})

describe('getCharacterAssets', () => {
  it('met le personnage à la hauteur visée, mesurée dans la pose idle, pieds posés à y = 0', () => {
    const { scene, animations } = makeTestRig()
    const assets = getCharacterAssets(scene, animations, DEF)
    // Pose de liaison : 2 m. Pose idle à t = 0 : 2 m aussi, mais levée de 0,25 (bassin à 0,75).
    expect(assets.scale).toBeCloseTo(0.5)
    expect(assets.offsetY).toBeCloseTo(-0.125)

    // Contre-épreuve sur une instance réelle : mêmes échelle et décalage, pose idle à t = 0.
    const instance = cloneSkinned(scene)
    instance.scale.setScalar(assets.scale)
    instance.position.set(0, assets.offsetY, 0)
    const mixer = new AnimationMixer(instance)
    mixer.clipAction(assets.clips.idle!).play()
    mixer.setTime(0)
    instance.updateMatrixWorld(true)
    const skinned = findSkinnedMesh(instance)!
    skinned.skeleton.update()
    skinned.computeBoundingBox()
    const box = new Box3().setFromObject(instance)
    expect(box.min.y).toBeCloseTo(0, 5)
    expect(box.max.y).toBeCloseTo(DEF.height, 5)
  })

  it('mesure la pose idle, pas la pose de liaison du fichier', () => {
    const { scene, animations } = makeTestRig()
    // Ici l'animation étire le corps de 50 % en hauteur (comme les clips Meshy, ~12 % plus hauts que leur
    // liaison) : 3 m dans la pose idle (de −0,25 à 2,75) contre 2 m en liaison.
    const stretched = new VectorKeyframeTrack('Hips.scale', [0, 1], [1, 1.5, 1, 1, 1.5, 1])
    const idle = animations[0]
    idle.tracks.push(stretched)
    const assets = getCharacterAssets(scene, animations, DEF)
    expect(assets.scale).toBeCloseTo(1 / 3, 5) // et non 0,5 (liaison)
    expect(assets.offsetY).toBeCloseTo(0, 5) // bassin levé de 0,25 : le pied de la pose étirée reste à 0
  })

  it('partage un seul matériau Lambert mat entre toutes les instances, avec la texture d\'origine', () => {
    const { scene, animations } = makeTestRig()
    const assets = getCharacterAssets(scene, animations, DEF)
    expect(assets.material).toBeInstanceOf(MeshLambertMaterial)
    expect(assets.material.map).toBe(FIXTURE_MAP)
    expect(getCharacterAssets(scene, animations, DEF)).toBe(assets)
  })

  it('recale les clips non idle sur la racine du clip idle, et laisse idle tel quel', () => {
    const { scene, animations } = makeTestRig()
    const assets = getCharacterAssets(scene, animations, DEF)
    expect(assets.clips.idle).toBe(animations[0])
    const wave = assets.clips.wave!
    expect(wave).not.toBe(animations[1])
    expect(meanOf(wave.tracks[0].values, 0)).toBeCloseTo(0)
    expect(meanOf(wave.tracks[0].values, 2)).toBeCloseTo(0)
    // Les clips d'origine (cache de useGLTF) ne sont pas mutés.
    expect(animations[1].tracks[0].values[0]).toBe(1)
  })

  it('recale aussi le clip « talk » de l’Archiviste, avec la définition réelle du personnage (squelette de Rémi)', () => {
    const { scene, animations } = makeTestRig()
    const assets = getCharacterAssets(scene, animations, CHARACTERS.archiviste)
    // Hauteur de jeu de l'Archiviste atteinte exactement (la fixture mesure 2 m en pose idle).
    expect(assets.scale).toBeCloseTo(CHARACTERS.archiviste.height / 2, 5)
    expect(Object.keys(assets.clips).sort()).toEqual(['idle', 'talk', 'wave'])
    const talk = assets.clips.talk!
    expect(talk).not.toBe(animations[3])
    expect(meanOf(talk.tracks[0].values, 0)).toBeCloseTo(0)
    expect(meanOf(talk.tracks[0].values, 2)).toBeCloseTo(0)
    // Le rebond vertical (Y) du clip est intact, et le clip d'origine n'est pas muté.
    expect(talk.tracks[0].values[1]).toBeCloseTo(0.5)
    expect(animations[3].tracks[0].values[0]).toBe(-0.5)
  })

  it('donne une sphère de culling plus large que celle de la pose idle', () => {
    const { scene, animations } = makeTestRig()
    const assets = getCharacterAssets(scene, animations, DEF)
    const probe = cloneSkinned(scene)
    const skinned = findSkinnedMesh(probe)!
    skinned.skeleton.update()
    skinned.computeBoundingSphere()
    expect(assets.boundingSphere.radius).toBeGreaterThan(skinned.boundingSphere.radius * 1.2)
  })

  it('applique la marge de culling propre au personnage : 1,6 par défaut, plus serrée pour l’Archiviste (sans passer sous la pose idle)', () => {
    const { scene, animations } = makeTestRig()
    const probe = cloneSkinned(scene)
    const skinned = findSkinnedMesh(probe)!
    skinned.skeleton.update()
    skinned.computeBoundingSphere()
    const idleRadius = skinned.boundingSphere.radius

    const byDefault = getCharacterAssets(scene, animations, DEF).boundingSphere.radius
    expect(byDefault).toBeCloseTo(idleRadius * CULLING_MARGIN, 5)

    const { scene: s2, animations: a2 } = makeTestRig()
    const archivist = getCharacterAssets(s2, a2, CHARACTERS.archiviste).boundingSphere.radius
    expect(archivist).toBeCloseTo(idleRadius * CHARACTERS.archiviste.cullMargin, 5)
    expect(archivist).toBeGreaterThan(idleRadius * 1.1)
    expect(archivist).toBeLessThan(byDefault)
  })

  it('échoue clairement quand un clip déclaré manque dans le fichier', () => {
    const { scene, animations } = makeTestRig()
    expect(() => getCharacterAssets(scene, animations, { ...DEF, clips: { idle: 'idle', wave: 'absent' } })).toThrow(/absent/)
    const { scene: s2, animations: a2 } = makeTestRig()
    expect(() => getCharacterAssets(s2, a2, { ...DEF, clips: { idle: 'repos' } })).toThrow(/repos/)
  })

  it('ne mute pas la scène source (clonée par instance, jamais modifiée)', () => {
    const { scene, animations } = makeTestRig()
    const skinned = findSkinnedMesh(scene)!
    const material = skinned.material
    getCharacterAssets(scene, animations, DEF)
    expect(scene.scale.x).toBe(1)
    expect(scene.position.y).toBe(0)
    expect(skinned.material).toBe(material)
  })
})

describe('clones par instance (SkeletonUtils)', () => {
  it('donnent à chaque instance ses propres os et son propre squelette, sur la même géométrie', () => {
    const { scene } = makeTestRig()
    const a = findSkinnedMesh(cloneSkinned(scene))!
    const b = findSkinnedMesh(cloneSkinned(scene))!
    expect(a.skeleton).not.toBe(b.skeleton)
    expect(a.skeleton.bones[0]).not.toBe(b.skeleton.bones[0])
    expect(a.geometry).toBe(b.geometry)
    // Animer une instance ne bouge pas l'autre.
    a.skeleton.bones[0].position.y = 9
    expect(b.skeleton.bones[0].position.y).toBeCloseTo(0.5)
  })
})
