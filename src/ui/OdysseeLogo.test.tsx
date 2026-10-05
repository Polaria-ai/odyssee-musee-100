import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { OdysseeLogo, discBars } from './OdysseeLogo'

describe('logo de l’Odyssée', () => {
  it('garde la géométrie de la charte : barres dans le viewBox, 3 barres corail', () => {
    const bars = discBars()
    expect(bars.filter((b) => b.coral)).toHaveLength(3)
    for (const b of bars) {
      expect(b.width).toBeGreaterThan(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.y + b.height).toBeLessThanOrEqual(100)
      expect(b.x + b.width).toBeLessThanOrEqual(112)
    }
  })
  it('affiche le logotype avec le « IA » en corail', () => {
    const { container } = render(<OdysseeLogo />)
    expect(container.querySelector('.od-logo__ia')?.textContent).toBe('IA')
    expect(container.querySelectorAll('rect').length).toBe(discBars().length)
  })
})
