/**
 * Les textures de la salle des Archives se dessinent sur un canvas 2D (absent de jsdom) : on ne teste ici
 * que ce qui est pur — la dérivation des bouts transparents de dégradé depuis les jetons de la charte.
 */
import { describe, expect, it } from 'vitest'
import { charter3d } from '../../styles/tokens'
import { withAlpha } from './textures'

describe('withAlpha', () => {
  it('garde la teinte du jeton et ne change que l’opacité', () => {
    expect(withAlpha('rgba(5,11,30,0.45)', 0)).toBe('rgba(5, 11, 30, 0)')
    expect(withAlpha(charter3d.archives.floor.nodeGlow, 0)).toBe('rgba(109, 228, 229, 0)')
    expect(withAlpha(charter3d.archives.floor.vignetteEdge, 0.2)).toBe('rgba(5, 11, 30, 0.2)')
  })

  it('refuse une couleur qui n’est pas un rgba()', () => {
    expect(() => withAlpha('#ffffff', 0)).toThrow()
  })
})
