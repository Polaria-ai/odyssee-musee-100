import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { generatePlaceholderPeople } from '../data/placeholder'
import { buildMuseumLayout } from '../world/layout'
import { Hud } from './Hud'

describe('Hud', () => {
  beforeEach(() => {
    const people = generatePlaceholderPeople(6)
    useGame.setState({
      screen: 'play',
      lang: 'fr',
      people,
      layout: buildMuseumLayout(people),
      nearbyPersonId: null,
      nearCurator: false,
      currentRoom: null,
      stamps: {},
      peersCount: 0,
      dialogue: null,
      openPersonId: null,
    })
  })

  it('ne montre pas de bouton d’action sans cible à portée', () => {
    render(<Hud />)
    expect(screen.queryByTestId('action-button')).not.toBeInTheDocument()
  })

  it('montre « Regarder » et ouvre la fiche quand un portrait est à portée', () => {
    const target = useGame.getState().people[2]
    useGame.setState({ nearbyPersonId: target.id })
    render(<Hud />)

    const button = screen.getByTestId('action-button')
    expect(button.textContent).toMatch(/Regarder/)

    fireEvent.click(button)
    expect(useGame.getState().openPersonId).toBe(target.id)
  })

  it('montre « Parler à Minerve » et démarre un dialogue quand le comptoir est à portée', () => {
    useGame.setState({ nearbyPersonId: null, nearCurator: true })
    render(<Hud />)

    const button = screen.getByTestId('action-button')
    expect(button.textContent).toMatch(/Minerve/)

    fireEvent.click(button)
    expect(useGame.getState().dialogue).not.toBeNull()
  })

  it('affiche le carnet de tampons et masque les visiteurs à zéro', () => {
    useGame.setState({ stamps: { culture: Date.now() }, peersCount: 0 })
    render(<Hud />)
    expect(screen.getByTestId('stamps-button').textContent).toBe('1/3')
    expect(screen.queryByTestId('peers-count')).not.toBeInTheDocument()

    useGame.setState({ peersCount: 4 })
    render(<Hud />)
    expect(screen.getAllByTestId('peers-count')[0].textContent).toBe('4')
  })
})
