/**
 * Chargement des textures de sol (WEL-923) : chargement unique par matière, libération propre, repli sur le sol
 * uni sans erreur, branchement sur le matériau. Le chargeur est simulé (pas de réseau ni de WebGL en test).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MeshLambertMaterial, NoColorSpace, RepeatWrapping, Texture, TextureLoader } from 'three'
import { FLOOR_KINDS, FLOOR_SPECS } from './floorSpec'
import { acquireFloorTextures, bindFloorTextures, createFloorMaterial, floorAnisotropy, floorTextureCacheSize, releaseFloorTextures } from './floorTextures'

let created: Texture[] = []
let failing = false
let loadAsync: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  created = []
  failing = false
  loadAsync = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () => {
    if (failing) throw new Error('réseau coupé')
    const t = new Texture() as Texture<HTMLImageElement>
    created.push(t)
    return t
  })
})

afterEach(() => {
  // Vide le cache entre les tests.
  for (const kind of FLOOR_KINDS) for (let i = 0; i < 5; i++) releaseFloorTextures(kind)
  vi.restoreAllMocks()
})

describe('anisotropie', () => {
  it('plafonnée à 4 sur écran tactile, à 8 ailleurs, jamais au-dessus de ce que le GPU supporte', () => {
    expect(floorAnisotropy(16, true)).toBe(4)
    expect(floorAnisotropy(16, false)).toBe(8)
    expect(floorAnisotropy(2, true)).toBe(2)
    expect(floorAnisotropy(0, false)).toBe(1)
  })
})

describe('cache des textures de sol', () => {
  it('charge une matière UNE fois, quel que soit le nombre de salles qui s’en servent', async () => {
    const [a, b] = await Promise.all([acquireFloorTextures('marble', 4), acquireFloorTextures('marble', 4)])
    expect(a).toBe(b)
    expect(loadAsync).toHaveBeenCalledTimes(2) // détail + normales, une seule fois
    expect(floorTextureCacheSize()).toBe(1)
  })

  it('configure les cartes : données (pas de couleur), répétées, mipmaps, anisotropie demandée', async () => {
    const set = await acquireFloorTextures('terrazzo', 4)
    expect(set).not.toBeNull()
    for (const t of [set!.detail, set!.normal]) {
      expect(t.colorSpace).toBe(NoColorSpace)
      expect(t.wrapS).toBe(RepeatWrapping)
      expect(t.wrapT).toBe(RepeatWrapping)
      expect(t.generateMipmaps).toBe(true)
      expect(t.anisotropy).toBe(4)
    }
    expect(loadAsync).toHaveBeenCalledWith(FLOOR_SPECS.terrazzo.detailUrl)
    expect(loadAsync).toHaveBeenCalledWith(FLOOR_SPECS.terrazzo.normalUrl)
  })

  it('libère les cartes quand la dernière salle part, pas avant', async () => {
    await Promise.all([acquireFloorTextures('carpet', 1), acquireFloorTextures('carpet', 1)])
    const disposed = created.map((t) => vi.spyOn(t, 'dispose'))
    releaseFloorTextures('carpet')
    expect(disposed.every((d) => d.mock.calls.length === 0)).toBe(true)
    releaseFloorTextures('carpet')
    expect(disposed.every((d) => d.mock.calls.length === 1)).toBe(true)
    expect(floorTextureCacheSize()).toBe(0)
  })

  it('un démontage pendant le chargement libère les cartes dès qu’elles arrivent', async () => {
    const pending = acquireFloorTextures('microcement', 1)
    releaseFloorTextures('microcement')
    expect(await pending).toBeNull()
    expect(created.length).toBe(2)
    // Texture.dispose() ne laisse pas de trace observable sans GPU : on vérifie que le cache est vide et qu'un
    // nouvel appel recharge bien.
    expect(floorTextureCacheSize()).toBe(0)
    await acquireFloorTextures('microcement', 1)
    expect(created.length).toBe(4)
  })

  it('une carte qui échoue donne null, sans exception ni erreur console', async () => {
    failing = true
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(acquireFloorTextures('marble', 1)).resolves.toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })
})

describe('matériau de sol', () => {
  it('commence uni : couleurs de sommet seules, éclairage Lambert, gain 1', () => {
    const m = createFloorMaterial()
    expect(m).toBeInstanceOf(MeshLambertMaterial)
    expect(m.vertexColors).toBe(true)
    expect(m.map).toBeNull()
    expect(m.normalMap).toBeNull()
    expect(m.color.r).toBe(1)
  })

  it('une fois les cartes chargées : détail en map, normales, gain 1 / moyenne (la couleur moyenne reste celle de la charte)', async () => {
    const m = createFloorMaterial()
    const unbind = bindFloorTextures(m, 'marble', 4)
    expect(m.map).toBeNull() // jamais bloquant : rien tant que ça n'est pas chargé
    await acquireFloorTextures('marble', 4) // laisse le chargement se terminer
    await Promise.resolve()
    expect(m.map).not.toBeNull()
    expect(m.normalMap).not.toBeNull()
    expect(m.normalScale.x).toBe(FLOOR_SPECS.marble.normalScale)
    expect(m.color.r).toBeCloseTo(1 / FLOOR_SPECS.marble.detailMean, 6)
    expect(m.vertexColors).toBe(true)
    unbind()
    releaseFloorTextures('marble') // le acquire de contrôle ci-dessus
  })

  it('échec de chargement : le matériau reste uni, sans erreur', async () => {
    failing = true
    const m = createFloorMaterial()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unbind = bindFloorTextures(m, 'carpet', 1)
    await Promise.resolve()
    await Promise.resolve()
    expect(m.map).toBeNull()
    expect(m.normalMap).toBeNull()
    expect(m.color.r).toBe(1)
    expect(consoleError).not.toHaveBeenCalled()
    unbind()
  })

  it('au démontage : retour au sol uni et références rendues', async () => {
    const m = createFloorMaterial()
    const unbind = bindFloorTextures(m, 'terrazzo', 1)
    await vi.waitFor(() => expect(m.map).not.toBeNull())
    unbind()
    expect(m.map).toBeNull()
    expect(m.normalMap).toBeNull()
    expect(m.color.r).toBe(1)
    expect(floorTextureCacheSize()).toBe(0)
  })

  it('sol qui a déjà sa texture (frise des Archives) : la map est conservée, le détail se multiplie par-dessus', async () => {
    const base = new Texture()
    const m = createFloorMaterial(false)
    m.map = base
    const unbind = bindFloorTextures(m, 'marble', 1, true)
    await vi.waitFor(() => expect(m.normalMap).not.toBeNull())
    expect(m.map).toBe(base)
    expect(Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile')).toBe(true)
    expect(m.customProgramCacheKey()).toBe('floor-detail-multiply')
    // Le fragment multiplie bien par la carte de détail, avec les UV de la géométrie.
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <map_fragment>',
    }
    m.onBeforeCompile(shader as never, undefined as never)
    expect(shader.uniforms.detailMap.value).toBeInstanceOf(Texture)
    expect(shader.vertexShader).toContain('vDetailUv = uv;')
    expect(shader.fragmentShader).toContain('diffuseColor.rgb *= texture2D(detailMap, vDetailUv).rgb;')
    unbind()
    expect(m.map).toBe(base)
    expect(Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile')).toBe(false)
    expect(m.customProgramCacheKey()).not.toBe('floor-detail-multiply')
  })
})
