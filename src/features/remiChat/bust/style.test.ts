import { describe, expect, it } from 'vitest'
import { charter3d } from '../../../styles/tokens'
import { rgba } from './style'

describe('style du buste', () => {
  it('rgba convertit un jeton hexadécimal de la charte', () => {
    expect(rgba('#6de4e5', 0.3)).toBe('rgba(109, 228, 229, 0.3)')
    expect(rgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
    expect(rgba(charter3d.base.cyanVif, 0.2)).toBe('rgba(109, 228, 229, 0.2)')
  })
})
