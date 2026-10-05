import { describe, expect, it } from 'vitest'
import { Color, MeshLambertMaterial, Texture } from 'three'
import { CHARACTER_SELF_LIGHT } from '../../../characters/characterRig'
import { RIM_POWER, RIM_STRENGTH, createBustMaterial, injectRim } from './material'

const SHADER = `void main() {
	vec3 totalEmissiveRadiance = emissive;
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_fragment_begin>
}`

describe('injectRim', () => {
  it('ajoute le liseré de Fresnel juste après l\'émissif, une seule fois, avec la couleur donnée', () => {
    const out = injectRim(SHADER, new Color(0.25, 0.5, 0.75))
    expect(out.match(/float remiRim/g)!.length).toBe(1)
    expect(out.indexOf('#include <emissivemap_fragment>')).toBeLessThan(out.indexOf('float remiRim'))
    expect(out.indexOf('float remiRim')).toBeLessThan(out.indexOf('#include <lights_fragment_begin>'))
    expect(out).toContain('vec3( 0.2500, 0.5000, 0.7500 )')
    expect(out).toContain(RIM_POWER.toFixed(2))
    expect(out).toContain(RIM_STRENGTH.toFixed(2))
    expect(out.match(/#include <emissivemap_fragment>/g)!.length).toBe(1)
  })

  it('sans le repère attendu (version de three changée), le shader reste intact', () => {
    expect(injectRim('void main() {}')).toBe('void main() {}')
  })
})

describe('createBustMaterial', () => {
  it('Lambert mat avec la texture en couleur et en lueur propre ; le shader reçoit le liseré à la compilation', () => {
    const map = new Texture()
    const material = createBustMaterial(map)
    expect(material).toBeInstanceOf(MeshLambertMaterial)
    expect(material.map).toBe(map)
    expect(material.emissiveMap).toBe(map)
    expect(material.emissiveIntensity).toBe(CHARACTER_SELF_LIGHT)
    const shader = { fragmentShader: SHADER } as Parameters<typeof material.onBeforeCompile>[0]
    material.onBeforeCompile(shader, null as never)
    expect(shader.fragmentShader).toContain('float remiRim')
    // Clé de programme propre : jamais mêlé aux Lambert ordinaires du musée.
    expect(material.customProgramCacheKey()).toBe('remi-bust-rim')
  })

  it('sans texture, reprend la couleur de repli', () => {
    const material = createBustMaterial(null, new Color(0.1, 0.2, 0.3))
    expect(material.map).toBeNull()
    expect(material.color.r).toBeCloseTo(0.1, 6)
    expect(material.color.b).toBeCloseTo(0.3, 6)
  })
})
