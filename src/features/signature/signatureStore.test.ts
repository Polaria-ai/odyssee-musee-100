import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCloseClickGuarded, useSignature } from './signatureStore'

describe('signatureStore', () => {
  afterEach(() => {
    useSignature.setState({ cardOpen: false, ignoreClicksUntil: 0 })
    vi.restoreAllMocks()
  })

  it('part fermée', () => {
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('ouvre puis ferme la carte', () => {
    useSignature.getState().openCard()
    expect(useSignature.getState().cardOpen).toBe(true)
    useSignature.getState().closeCard()
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('une ouverture sans garde ne bloque aucun clic de fermeture (badge)', () => {
    useSignature.getState().openCard()
    expect(isCloseClickGuarded(useSignature.getState())).toBe(false)
  })

  it('une ouverture avec garde bloque les clics de fermeture le temps demandé (plaque)', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    useSignature.getState().openCard({ guardMs: 350 })
    expect(useSignature.getState().ignoreClicksUntil).toBe(1350)

    now.mockReturnValue(1200)
    expect(isCloseClickGuarded(useSignature.getState())).toBe(true)
    now.mockReturnValue(1351)
    expect(isCloseClickGuarded(useSignature.getState())).toBe(false)
  })

  it('fermer remet la garde à zéro', () => {
    useSignature.getState().openCard({ guardMs: 10_000 })
    useSignature.getState().closeCard()
    expect(useSignature.getState().ignoreClicksUntil).toBe(0)
    expect(isCloseClickGuarded(useSignature.getState())).toBe(false)
  })
})
