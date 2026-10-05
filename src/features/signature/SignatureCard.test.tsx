import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useGame } from '../../state/gameStore'
import { input } from '../../state/runtime'
import { useSignature } from './signatureStore'
import { SignatureCard } from './SignatureCard'

// Module audio : no-op tant que le son est coupé ; on vérifie seulement que la carte appelle `playSfx('click')`.
const playSfxMock = vi.fn()
vi.mock('../../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
}))

function openCard(guardMs?: number) {
  useSignature.getState().openCard(guardMs ? { guardMs } : undefined)
}

describe('SignatureCard', () => {
  beforeEach(() => {
    playSfxMock.mockClear()
    useGame.setState({ lang: 'fr' })
    useSignature.setState({ cardOpen: false, ignoreClicksUntil: 0 })
    input.moveX = 0
    input.moveY = 0
    input.run = false
    input.tapTarget = null
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('ne rend rien tant que la carte est fermée', () => {
    const { container } = render(<SignatureCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('s’ouvre en dialogue modal nommé par son titre, avec les crédits demandés', () => {
    openCard()
    render(<SignatureCard />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBe(screen.getByTestId('signature-card'))
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const title = screen.getByRole('heading', { name: 'Le Musée des 100 — une création Polaria' })
    expect(dialog).toHaveAttribute('aria-labelledby', title.id)
    expect(screen.getByText("Conçu et développé par Polaria pour L'Odyssée de l'IA (L'Opinion × Polaria), 6 octobre 2026")).toBeInTheDocument()
    expect(screen.getByText('© 2026 Polaria. Tous droits réservés.')).toBeInTheDocument()
    expect(screen.getByAltText('Polaria')).toHaveAttribute('src', '/brand/polaria-logo.webp')
  })

  it('le lien ouvre polaria.ai dans un nouvel onglet, sans donner window.opener', () => {
    openCard()
    render(<SignatureCard />)
    const link = screen.getByTestId('signature-link')
    expect(link).toHaveAttribute('href', 'https://www.polaria.ai')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link).toHaveTextContent('polaria.ai')
  })

  it('est bilingue : en anglais, tout change de langue', () => {
    useGame.setState({ lang: 'en' })
    openCard()
    render(<SignatureCard />)
    expect(screen.getByRole('heading', { name: 'The Museum of the 100 — a Polaria creation' })).toBeInTheDocument()
    expect(screen.getByText(/Designed and developed by Polaria for The AI Odyssey/)).toBeInTheDocument()
    expect(screen.getByText('© 2026 Polaria. All rights reserved.')).toBeInTheDocument()
    expect(screen.getByTestId('signature-close')).toHaveAccessibleName('Close')
  })

  it('met le focus dans la carte à l’ouverture', () => {
    openCard()
    render(<SignatureCard />)
    expect(screen.getByTestId('signature-card')).toHaveFocus()
  })

  it('se ferme par le bouton ✕ (avec le clic sonore)', () => {
    openCard()
    render(<SignatureCard />)
    expect(screen.getByTestId('signature-close')).toHaveAccessibleName('Fermer')
    fireEvent.click(screen.getByTestId('signature-close'))
    expect(useSignature.getState().cardOpen).toBe(false)
    expect(playSfxMock).toHaveBeenCalledWith('click')
  })

  it('se ferme par un tap sur le fond, pas par un tap dans la carte', () => {
    openCard()
    render(<SignatureCard />)
    fireEvent.click(screen.getByTestId('signature-card'))
    expect(useSignature.getState().cardOpen).toBe(true)
    fireEvent.click(screen.getByTestId('signature-backdrop'))
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('se ferme par Échap', () => {
    openCard()
    render(<SignatureCard />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('Échap ne ferme que la carte : le jeu (écouteur sur window) ne le reçoit pas', () => {
    const gameListener = vi.fn()
    window.addEventListener('keydown', gameListener)
    openCard()
    render(<SignatureCard />)
    fireEvent.keyDown(document.body, { code: 'Escape', key: 'Escape' })
    window.removeEventListener('keydown', gameListener)
    expect(gameListener).not.toHaveBeenCalled()
  })

  it('tant qu’elle est ouverte, ni déplacement ni action ne parviennent au jeu', () => {
    const gameListener = vi.fn()
    window.addEventListener('keydown', gameListener)
    openCard()
    render(<SignatureCard />)
    for (const code of ['KeyW', 'ArrowUp', 'Enter', 'Space', 'KeyE', 'ShiftLeft']) fireEvent.keyDown(document.body, { code, key: code })
    window.removeEventListener('keydown', gameListener)
    expect(gameListener).not.toHaveBeenCalled()
  })

  it('une fois fermée, le clavier du jeu fonctionne de nouveau', () => {
    const gameListener = vi.fn()
    window.addEventListener('keydown', gameListener)
    openCard()
    const { rerender } = render(<SignatureCard />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    rerender(<SignatureCard />)
    fireEvent.keyDown(document.body, { code: 'KeyW', key: 'w' })
    window.removeEventListener('keydown', gameListener)
    expect(gameListener).toHaveBeenCalledTimes(1)
  })

  it('remet l’entrée de déplacement à zéro à l’ouverture (cible de marche, joystick)', () => {
    input.moveX = 0.8
    input.moveY = -0.5
    input.run = true
    input.tapTarget = { x: 3, z: -4 }
    openCard()
    render(<SignatureCard />)
    expect(input.moveX).toBe(0)
    expect(input.moveY).toBe(0)
    expect(input.run).toBe(false)
    expect(input.tapTarget).toBeNull()
  })

  it('boucle Tab dans la carte (✕ → lien → ✕, et Maj+Tab à l’envers)', () => {
    openCard()
    render(<SignatureCard />)
    const close = screen.getByTestId('signature-close')
    const link = screen.getByTestId('signature-link')

    link.focus()
    fireEvent.keyDown(document.body, { key: 'Tab' })
    expect(close).toHaveFocus()

    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true })
    expect(link).toHaveFocus()
  })

  it('ignore les clics de fermeture pendant la garde posée par la plaque (clic fantôme), puis les accepte', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(5000)
    openCard(350)
    render(<SignatureCard />)

    now.mockReturnValue(5100)
    fireEvent.click(screen.getByTestId('signature-backdrop'))
    fireEvent.click(screen.getByTestId('signature-close'))
    expect(useSignature.getState().cardOpen).toBe(true)

    now.mockReturnValue(5400)
    fireEvent.click(screen.getByTestId('signature-backdrop'))
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('Échap passe même pendant la garde (le clic fantôme ne concerne que la souris et le doigt)', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(5000)
    openCard(350)
    render(<SignatureCard />)
    now.mockReturnValue(5010)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('rend le focus à l’élément qui l’avait avant l’ouverture', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    openCard()
    const { rerender } = render(<SignatureCard />)
    expect(screen.getByTestId('signature-card')).toHaveFocus()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    rerender(<SignatureCard />)
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
