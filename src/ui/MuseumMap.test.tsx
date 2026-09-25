import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { generatePlaceholderPeople } from '../data/placeholder'
import { buildMuseumLayout } from '../world/layout'
import { player } from '../state/runtime'
import { MuseumMap } from './MuseumMap'

const playSfxMock = vi.fn()
vi.mock('../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
}))

describe('MuseumMap', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    playSfxMock.mockClear()
    const people = generatePlaceholderPeople(9) // 3 par aile
    useGame.setState({ lang: 'fr', people, layout: buildMuseumLayout(people), visited: {} })
    player.x = 0
    player.z = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ne rend rien quand `open` est faux', () => {
    render(<MuseumMap open={false} onClose={() => {}} />)
    expect(screen.queryByTestId('museum-map')).not.toBeInTheDocument()
  })

  it('rend une salle par aile (plus le hall), lecture seule', () => {
    render(<MuseumMap open onClose={() => {}} />)
    const map = screen.getByTestId('museum-map')
    expect(map).toBeInTheDocument()
    // Hall + 3 ailes = 4 salles : un <rect> par salle dans le <svg>.
    expect(map.querySelectorAll('svg rect').length).toBeGreaterThanOrEqual(4)
    expect(map.querySelector('svg circle')).not.toBeNull() // point du joueur
  })

  it('rafraîchit la position du joueur pendant l’ouverture (4 fois/s)', () => {
    render(<MuseumMap open onClose={() => {}} />)
    const map = screen.getByTestId('museum-map')
    const circleBefore = map.querySelector('svg circle')
    expect(circleBefore?.getAttribute('cx')).toBe('0')

    player.x = 5
    player.z = -3
    act(() => {
      vi.advanceTimersByTime(250)
    })

    const circleAfter = map.querySelector('svg circle')
    expect(circleAfter?.getAttribute('cx')).toBe('5')
    expect(circleAfter?.getAttribute('cy')).toBe('-3')
  })

  it('affiche le nom de chaque aile et les portraits vus/total', () => {
    // 9 fiches d'attente réparties 3/3/3 (voir generatePlaceholderPeople) ; indices 0 et 3
    // sont tous deux dans l'aile Infrastructures (i % 3 === 0).
    const people = useGame.getState().people
    useGame.setState({ visited: { [people[0].id]: Date.now(), [people[3].id]: Date.now() } })
    render(<MuseumMap open onClose={() => {}} />)
    const map = screen.getByTestId('museum-map')
    expect(map.textContent).toMatch(/Infrastructures/)
    expect(map.textContent).toMatch(/Industrialisation/)
    expect(map.textContent).toMatch(/Culture/)
    expect(map.textContent).toMatch(/2\/3/)
  })

  it('le bouton ✕ joue un clic et ferme', () => {
    const onClose = vi.fn()
    render(<MuseumMap open onClose={onClose} />)
    screen.getByTestId('map-close').click()
    expect(playSfxMock).toHaveBeenCalledWith('click')
    expect(onClose).toHaveBeenCalled()
  })
})
