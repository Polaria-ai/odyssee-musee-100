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

  it('affiche le titre et entre au musée au clic', () => {
    render(<TitleScreen />)
    expect(screen.getByTestId('title-screen')).toBeInTheDocument()
    expect(screen.getByText('Le Musée des 100')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('enter-button'))
    expect(useGame.getState().screen).toBe('customize')
  })

  it('débloque l’audio avant de quitter l’écran titre', () => {
    render(<TitleScreen />)
    const order: string[] = []
    unlockAudioMock.mockImplementation(() => order.push('unlock'))
    const unsubscribe = useGame.subscribe((s) => {
      if (s.screen === 'customize') order.push('screen')
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
})
