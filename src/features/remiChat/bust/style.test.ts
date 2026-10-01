import { describe, expect, it } from 'vitest'
import { charter3d } from '../../../styles/tokens'
import { haloBackground, rgba } from './style'

describe('style du buste', () => {
  it('rgba convertit un jeton hexadécimal de la charte', () => {
    expect(rgba('#6de4e5', 0.3)).toBe('rgba(109, 228, 229, 0.3)')
    expect(rgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
    expect(rgba(charter3d.base.cyanVif, 0.2)).toBe('rgba(109, 228, 229, 0.2)')
  })

  it('le halo se pose sur la tête, borné au conteneur', () => {
    expect(haloBackground(0.3, charter3d.base.cyanVif)).toContain('at 50% 30.0%')
    expect(haloBackground(-2, '#ffffff')).toContain('at 50% 0.0%')
    expect(haloBackground(7, '#ffffff')).toContain('at 50% 100.0%')
    expect(haloBackground(0.3, '#6de4e5')).toContain('rgba(109, 228, 229, 0.3)')
  })
})
