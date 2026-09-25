import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { generatePlaceholderPeople } from '../data/placeholder'
import { buildMuseumLayout } from '../world/layout'
import { buildArchivesLayout, mergeArchivesIntoLayout } from '../archives/layout'
import { player } from '../state/runtime'
import type { EveningSession } from '../types'
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

  describe('indice de défilement (légende coupée en paysage bas, sans indice — WEL-863)', () => {
    // jsdom ne fait pas de mise en page réelle : scrollHeight/clientHeight valent 0 par défaut.
    // On simule un débordement (ou son absence) en définissant ces propriétés sur l'élément.
    function setSheetMetrics(sheet: Element, { scrollHeight, clientHeight, scrollTop = 0 }: { scrollHeight: number; clientHeight: number; scrollTop?: number }) {
      Object.defineProperty(sheet, 'scrollHeight', { configurable: true, value: scrollHeight })
      Object.defineProperty(sheet, 'clientHeight', { configurable: true, value: clientHeight })
      Object.defineProperty(sheet, 'scrollTop', { configurable: true, value: scrollTop, writable: true })
    }

    it("n'affiche pas l'indice quand tout le contenu tient déjà (portrait)", () => {
      render(<MuseumMap open onClose={() => {}} />)
      const sheet = screen.getByTestId('museum-map').querySelector('.ui-map__sheet') as HTMLElement
      setSheetMetrics(sheet, { scrollHeight: 400, clientHeight: 400 })
      fireEvent.scroll(sheet)
      expect(screen.queryByTestId('map-scroll-hint')).not.toBeInTheDocument()
    })

    it("affiche l'indice quand la légende est coupée sous le bas visible (paysage bas)", () => {
      render(<MuseumMap open onClose={() => {}} />)
      const sheet = screen.getByTestId('museum-map').querySelector('.ui-map__sheet') as HTMLElement
      setSheetMetrics(sheet, { scrollHeight: 600, clientHeight: 300 })
      fireEvent.scroll(sheet)
      expect(screen.getByTestId('map-scroll-hint')).toBeInTheDocument()
    })

    it("masque l'indice une fois défilé jusqu'au vrai bas", () => {
      render(<MuseumMap open onClose={() => {}} />)
      const sheet = screen.getByTestId('museum-map').querySelector('.ui-map__sheet') as HTMLElement
      setSheetMetrics(sheet, { scrollHeight: 600, clientHeight: 300, scrollTop: 0 })
      fireEvent.scroll(sheet)
      expect(screen.getByTestId('map-scroll-hint')).toBeInTheDocument()

      setSheetMetrics(sheet, { scrollHeight: 600, clientHeight: 300, scrollTop: 300 })
      fireEvent.scroll(sheet)
      expect(screen.queryByTestId('map-scroll-hint')).not.toBeInTheDocument()
    })
  })

  describe('encart des Archives de 2040 (WEL-884)', () => {
    // Programme manifestement fictif, fabriqué uniquement pour ce test.
    const fictionalSessions: EveningSession[] = [
      { id: 'fixture-a', order: 1, startTime: '10:00', durationMin: 5, kind: 'ouverture', title: { fr: 'A', en: 'A' }, speakers: [], provisional: true },
      { id: 'fixture-b', order: 2, startTime: '10:10', durationMin: 5, kind: 'keynote', title: { fr: 'B', en: 'B' }, speakers: [], provisional: true },
    ]

    beforeEach(() => {
      const people = generatePlaceholderPeople(9)
      const museumLayout = buildMuseumLayout(people)
      const archivesLayout = buildArchivesLayout(fictionalSessions)
      useGame.setState({
        lang: 'fr',
        people,
        layout: mergeArchivesIntoLayout(museumLayout, archivesLayout),
        visited: {},
        sessions: fictionalSessions,
        archivesLayout,
        visitedSessions: {},
        currentRoom: null,
      })
      player.x = 0
      player.z = 0
    })

    it("n'ajoute pas la salle des Archives au plan principal : l'échelle du hall reste celle du musée", () => {
      render(<MuseumMap open onClose={() => {}} />)
      const map = screen.getByTestId('museum-map')
      // Hall + 3 ailes = 4 salles dans le plan principal, jamais 5 : la salle des Archives (loin
      // dans le monde, voir `ARCHIVES_ORIGIN`) casserait l'échelle si elle y entrait — voir
      // `MuseumMap.tsx`, `mainRooms`/`mainBounds`. Elle est affichée à part, plus bas.
      expect(map.querySelectorAll('.ui-map__plan svg .ui-map__room').length).toBe(4)
    })

    it('relie le plan principal à l’encart par un pictogramme à la position de la Porte de 2040', () => {
      render(<MuseumMap open onClose={() => {}} />)
      expect(screen.getByTestId('map-portal-marker')).toBeInTheDocument()
      expect(screen.getByText('Porte de 2040')).toBeInTheDocument()
    })

    it("affiche l'encart des Archives avec son titre et le compteur d'archives consultées", () => {
      useGame.setState({ visitedSessions: { 'fixture-a': Date.now() } })
      render(<MuseumMap open onClose={() => {}} />)

      expect(screen.getByTestId('map-archives')).toBeInTheDocument()
      expect(screen.getByText('Les Archives de 2040 · par la Porte de 2040')).toBeInTheDocument()
      expect(screen.getByTestId('map-archives-count')).toHaveTextContent('1/2 archives consultées')
    })

    it("n'affiche pas l'encart quand le plan des Archives n'est pas encore chargé", () => {
      useGame.setState({ archivesLayout: null })
      render(<MuseumMap open onClose={() => {}} />)
      expect(screen.queryByTestId('map-archives')).not.toBeInTheDocument()
      expect(screen.queryByTestId('map-portal-marker')).not.toBeInTheDocument()
    })

    it("affiche le point du joueur dans l'encart seulement quand il est dans les Archives", () => {
      render(<MuseumMap open onClose={() => {}} />)
      expect(screen.queryByTestId('map-archives-player-dot')).not.toBeInTheDocument()

      act(() => {
        useGame.setState({ currentRoom: 'archives' })
      })
      expect(screen.getByTestId('map-archives-player-dot')).toBeInTheDocument()
    })
  })
})
