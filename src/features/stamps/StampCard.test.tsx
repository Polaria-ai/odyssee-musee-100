import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGame } from '../../state/gameStore'
import { generatePlaceholderPeople } from '../../data/placeholder'
import { buildMuseumLayout } from '../../world/layout'
import { StampCard } from './StampCard'

describe('StampCard', () => {
  beforeEach(() => {
    const people = generatePlaceholderPeople(9)
    useGame.setState({
      visited: {},
      stamps: {},
      stampCardOpen: false,
      avatar: { ...useGame.getState().avatar, name: 'Ada' },
    })
    useGame.getState().setMuseum(people, buildMuseumLayout(people), 'placeholder')
  })

  it("ne rend rien quand le carnet n'est pas ouvert", () => {
    const { container } = render(<StampCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche le carnet avec les trois ailes quand ouvert', () => {
    useGame.setState({ stampCardOpen: true })
    render(<StampCard />)
    const card = screen.getByTestId('stamp-card')
    expect(card).toHaveAttribute('role', 'dialog')
    expect(card.querySelectorAll('.stamp-card__slot')).toHaveLength(3)
  })

  it('se ferme via le bouton close', () => {
    useGame.setState({ stampCardOpen: true })
    render(<StampCard />)
    fireEvent.click(screen.getByTestId('stamp-close'))
    expect(useGame.getState().stampCardOpen).toBe(false)
  })

  it('se ferme via Échap', () => {
    useGame.setState({ stampCardOpen: true })
    render(<StampCard />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useGame.getState().stampCardOpen).toBe(false)
  })

  it("n'affiche pas le bouton de partage tant que la carte n'est pas complète", () => {
    useGame.setState({ stampCardOpen: true, stamps: { infrastructures: 1 } })
    render(<StampCard />)
    expect(screen.queryByTestId('stamp-share')).not.toBeInTheDocument()
  })

  it('affiche le bouton de partage quand la carte est complète', () => {
    useGame.setState({ stampCardOpen: true, stamps: { infrastructures: 1, industrialisation: 2, culture: 3 } })
    render(<StampCard />)
    expect(screen.getByTestId('stamp-share')).toBeInTheDocument()
  })
})
