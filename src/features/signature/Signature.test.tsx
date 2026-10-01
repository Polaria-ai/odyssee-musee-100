import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useGame } from '../../state/gameStore'
import { useSignature } from './signatureStore'
import { Signature } from './Signature'
import { SignatureBadge } from './SignatureBadge'

const playSfxMock = vi.fn()
vi.mock('../../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
}))

const NO_OVERLAY = {
  openPersonId: null,
  openSessionId: null,
  dialogue: null,
  stampCardOpen: false,
  mapOpen: false,
} as const

describe('SignatureBadge', () => {
  beforeEach(() => {
    playSfxMock.mockClear()
    useGame.setState({ lang: 'fr', ...NO_OVERLAY })
    useSignature.setState({ cardOpen: false, ignoreClicksUntil: 0 })
  })
  afterEach(cleanup)

  it('est un bouton nommé, avec le logo seul (décoratif) à 16 px de haut', () => {
    render(<SignatureBadge />)
    const badge = screen.getByTestId('signature-badge')
    expect(badge.tagName).toBe('BUTTON')
    expect(badge).toHaveAccessibleName('Crédits : une création Polaria')
    expect(badge).toHaveAttribute('aria-haspopup', 'dialog')
    const logo = badge.querySelector('img')
    expect(logo).not.toBeNull()
    expect(logo).toHaveAttribute('src', '/brand/polaria-logo.webp')
    expect(logo).toHaveAttribute('height', '16')
    expect(logo).toHaveAttribute('alt', '')
  })

  it('un tap ouvre la carte de crédits (avec le clic sonore)', () => {
    render(<SignatureBadge />)
    fireEvent.click(screen.getByTestId('signature-badge'))
    expect(useSignature.getState().cardOpen).toBe(true)
    expect(playSfxMock).toHaveBeenCalledWith('click')
  })

  it('ouvre sans garde de clic fantôme (le badge s’ouvre sur le click lui-même)', () => {
    render(<SignatureBadge />)
    fireEvent.click(screen.getByTestId('signature-badge'))
    expect(useSignature.getState().ignoreClicksUntil).toBe(0)
  })

  it('son nom suit la langue', () => {
    useGame.setState({ lang: 'en' })
    render(<SignatureBadge />)
    expect(screen.getByTestId('signature-badge')).toHaveAccessibleName('Credits: a Polaria creation')
  })
})

describe('Signature (badge + carte)', () => {
  beforeEach(() => {
    useGame.setState({ lang: 'fr', ...NO_OVERLAY })
    useSignature.setState({ cardOpen: false, ignoreClicksUntil: 0 })
  })
  afterEach(cleanup)

  it('montre le badge et pas la carte au repos', () => {
    render(<Signature />)
    expect(screen.getByTestId('signature-badge')).toBeInTheDocument()
    expect(screen.queryByTestId('signature-card')).not.toBeInTheDocument()
  })

  it('badge → carte → Échap : le parcours complet', () => {
    render(<Signature />)
    fireEvent.click(screen.getByTestId('signature-badge'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([
    ['une fiche portrait', { openPersonId: 'p1' }],
    ['une fiche d’archive', { openSessionId: 's1' }],
    ['le carnet de tampons', { stampCardOpen: true }],
    ['le plan', { mapOpen: true }],
  ])('masque le badge quand %s est ouvert(e)', (_name, overlay) => {
    useGame.setState(overlay)
    render(<Signature />)
    expect(screen.queryByTestId('signature-badge')).not.toBeInTheDocument()
  })

  it('masque le badge pendant un dialogue (la bulle pleine largeur le recouvrirait)', () => {
    useGame.setState({ dialogue: { id: 'd', lines: [] } as never })
    render(<Signature />)
    expect(screen.queryByTestId('signature-badge')).not.toBeInTheDocument()
  })

  it('le badge revient quand la surimpression se ferme', () => {
    useGame.setState({ stampCardOpen: true })
    render(<Signature />)
    expect(screen.queryByTestId('signature-badge')).not.toBeInTheDocument()
    act(() => useGame.setState({ stampCardOpen: false }))
    // Le sélecteur de Signature réagit au store : le badge est de retour sans remontage.
    expect(screen.getByTestId('signature-badge')).toBeInTheDocument()
  })
})
