import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { TitleScreen } from './TitleScreen'

describe('TitleScreen', () => {
  beforeEach(() => {
    useGame.setState({ screen: 'title', lang: 'fr', dataSource: 'placeholder' })
  })

  it('affiche le titre et entre au musée au clic', () => {
    render(<TitleScreen />)
    expect(screen.getByTestId('title-screen')).toBeInTheDocument()
    expect(screen.getByText('Le Musée des 100')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('enter-button'))
    expect(useGame.getState().screen).toBe('customize')
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
