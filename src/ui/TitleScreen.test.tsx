import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { TitleScreen } from './TitleScreen'

// Module audio : stub d'un autre agent, no-op tant que le son est coupé. On vérifie ici seulement
// que TitleScreen appelle `unlockAudio` (avant `setScreen`) et `playSfx('click')`.
const playSfxMock = vi.fn()
const unlockAudioMock = vi.fn()
vi.mock('../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
  unlockAudio: () => unlockAudioMock(),
}))

describe('TitleScreen', () => {
  beforeEach(() => {
    playSfxMock.mockClear()
    unlockAudioMock.mockClear()
    useGame.setState({ screen: 'title', lang: 'fr', dataSource: 'placeholder' })
  })

  it('affiche le titre et entre directement au musée au clic (plus d’écran de personnalisation)', () => {
    render(<TitleScreen />)
    expect(screen.getByTestId('title-screen')).toBeInTheDocument()
    expect(screen.getByText('Le Musée des 100')).toBeInTheDocument()

    const visited: string[] = []
    const unsubscribe = useGame.subscribe((s) => visited.push(s.screen))
    fireEvent.click(screen.getByTestId('enter-button'))
    unsubscribe()

    expect(useGame.getState().screen).toBe('play')
    expect(visited).toEqual(['play']) // aucun écran intermédiaire
  })

  it('débloque l’audio avant de quitter l’écran titre', () => {
    render(<TitleScreen />)
    const order: string[] = []
    unlockAudioMock.mockImplementation(() => order.push('unlock'))
    const unsubscribe = useGame.subscribe((s) => {
      if (s.screen === 'play') order.push('screen')
    })

    fireEvent.click(screen.getByTestId('enter-button'))
    unsubscribe()

    expect(order).toEqual(['unlock', 'screen'])
    expect(playSfxMock).toHaveBeenCalledWith('click')
  })

  it('bascule la langue au clic sur lang-toggle', () => {
    render(<TitleScreen />)
    expect(useGame.getState().lang).toBe('fr')

    fireEvent.click(screen.getByTestId('lang-toggle'))
    expect(useGame.getState().lang).toBe('en')
    expect(screen.getByText('The Museum of the 100')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('lang-toggle'))
    expect(useGame.getState().lang).toBe('fr')
    expect(screen.getByText('Le Musée des 100')).toBeInTheDocument()
  })

  it('affiche le bandeau d’aperçu seulement pour une liste placeholder', () => {
    useGame.setState({ dataSource: 'placeholder' })
    const { rerender } = render(<TitleScreen />)
    expect(screen.getByText(/Aperçu/)).toBeInTheDocument()

    useGame.setState({ dataSource: 'static' })
    rerender(<TitleScreen />)
    expect(screen.queryByText(/Aperçu/)).not.toBeInTheDocument()
  })

  describe('signature Polaria', () => {
    it('affiche « Une création » + le logo Polaria sous le pied existant', () => {
      render(<TitleScreen />)
      const footer = screen.getByText(/L'Opinion × Polaria/)
      const signature = screen.getByTestId('title-signature')
      expect(signature).toHaveTextContent('Une création')
      const logo = screen.getByAltText('Polaria')
      expect(logo).toBeInTheDocument()
      expect(logo).toHaveAttribute('src', '/brand/polaria-logo.webp')
      // Sous le pied : dans le même conteneur, après lui dans l'ordre du document.
      expect(footer.compareDocumentPosition(signature) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(footer.parentElement).toBe(signature.parentElement)
    })

    it('le logo fait 20 à 24 px de haut et garde ses proportions', () => {
      render(<TitleScreen />)
      const logo = screen.getByAltText('Polaria')
      const height = Number(logo.getAttribute('height'))
      expect(height).toBeGreaterThanOrEqual(20)
      expect(height).toBeLessThanOrEqual(24)
      expect(Number(logo.getAttribute('width')) / height).toBeCloseTo(480 / 105, 1)
    })

    it('le lien va sur polaria.ai dans un nouvel onglet, sans window.opener', () => {
      render(<TitleScreen />)
      const link = screen.getByTestId('title-signature-link')
      expect(link).toHaveAttribute('href', 'https://www.polaria.ai')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link).toHaveAccessibleName('Une création Polaria (nouvel onglet)')
    })

    it('affiche « © 2026 Polaria » discret', () => {
      render(<TitleScreen />)
      expect(screen.getByText('© 2026 Polaria')).toBeInTheDocument()
    })

    it('suit la langue : « Created by » en anglais, le logo et la mention de droits restent', () => {
      render(<TitleScreen />)
      fireEvent.click(screen.getByTestId('lang-toggle'))
      expect(screen.getByTestId('title-signature')).toHaveTextContent('Created by')
      expect(screen.getByTestId('title-signature-link')).toHaveAccessibleName('Created by Polaria (opens in a new tab)')
      expect(screen.getByAltText('Polaria')).toBeInTheDocument()
      expect(screen.getByText('© 2026 Polaria')).toBeInTheDocument()
    })

    it('n’ajoute aucun bouton : entrer et changer de langue restent les seules actions', () => {
      render(<TitleScreen />)
      expect(screen.getByTestId('enter-button')).toBeInTheDocument()
      expect(screen.getByTestId('lang-toggle')).toBeInTheDocument()
      expect(screen.getByTestId('title-signature').querySelector('button')).toBeNull()
    })
  })
})
