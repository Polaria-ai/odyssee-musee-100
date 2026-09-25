import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGame } from '../../state/gameStore'
import { generatePlaceholderPeople } from '../../data/placeholder'
import { buildMuseumLayout } from '../../world/layout'
import { StampCard } from './StampCard'

const THREE_WINGS = { infrastructures: 1, industrialisation: 2, culture: 3 }

describe('StampCard', () => {
  beforeEach(() => {
    const people = generatePlaceholderPeople(9)
    useGame.setState({
      visited: {},
      stamps: {},
      stampCardOpen: false,
      sessions: [],
      visitedSessions: {},
      lang: 'fr',
      avatar: { ...useGame.getState().avatar, name: 'Ada' },
    })
    useGame.getState().setMuseum(people, buildMuseumLayout(people), 'placeholder')
  })

  it("ne rend rien quand le carnet n'est pas ouvert", () => {
    const { container } = render(<StampCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche le carnet avec les quatre tampons (trois ailes + Archives) quand ouvert', () => {
    useGame.setState({ stampCardOpen: true })
    render(<StampCard />)
    const card = screen.getByTestId('stamp-card')
    expect(card).toHaveAttribute('role', 'dialog')
    expect(card.querySelectorAll('.stamp-card__slot')).toHaveLength(4)
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

  it('affiche le bouton de partage quand les trois ailes sont complètes et le programme pas encore chargé', () => {
    useGame.setState({ stampCardOpen: true, stamps: THREE_WINGS, sessions: [] })
    render(<StampCard />)
    expect(screen.getByTestId('stamp-share')).toBeInTheDocument()
  })

  it("n'affiche pas le bouton de partage si les ailes sont complètes mais pas les Archives (programme chargé)", () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      order: i,
      startTime: '18:30',
      durationMin: 5,
      kind: 'keynote' as const,
      title: { fr: `Séquence ${i}`, en: `Session ${i}` },
      speakers: [],
      provisional: true,
    }))
    useGame.setState({ stampCardOpen: true, stamps: THREE_WINGS, sessions, visitedSessions: {} })
    render(<StampCard />)
    expect(screen.queryByTestId('stamp-share')).not.toBeInTheDocument()
    expect(screen.getByText('Archives de 2040')).toBeInTheDocument()
    expect(screen.getByText('0/5 archives')).toBeInTheDocument()
  })

  it('affiche le bouton de partage quand les quatre tampons sont obtenus', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      order: i,
      startTime: '18:30',
      durationMin: 5,
      kind: 'keynote' as const,
      title: { fr: `Séquence ${i}`, en: `Session ${i}` },
      speakers: [],
      provisional: true,
    }))
    useGame.setState({
      stampCardOpen: true,
      stamps: THREE_WINGS,
      sessions,
      visitedSessions: { s0: 1, s1: 2, s2: 3 },
    })
    render(<StampCard />)
    expect(screen.getByTestId('stamp-share')).toBeInTheDocument()
  })
})
