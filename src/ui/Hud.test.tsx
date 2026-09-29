import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { isOverlayOpen, useGame } from '../state/gameStore'
import { generatePlaceholderPeople } from '../data/placeholder'
import { buildMuseumLayout } from '../world/layout'
import { Hud } from './Hud'

// Module audio : stub d'un autre agent, no-op tant que le son est coupé. On vérifie ici seulement
// que Hud l'appelle avec le bon identifiant, pas un comportement sonore réel.
const playSfxMock = vi.fn()
vi.mock('../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
}))
vi.mock('../audio/SoundToggle', () => ({ SoundToggle: () => null }))

describe('Hud', () => {
  beforeEach(() => {
    playSfxMock.mockClear()
    try {
      localStorage.clear()
    } catch {
      // jsdom fournit toujours localStorage en test ; ignoré par cohérence avec le code applicatif.
    }
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
      stampCardOpen: false,
      visited: {},
      mapOpen: false,
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

  it('montre « Parler à Rémi » et démarre un dialogue quand le comptoir est à portée', () => {
    useGame.setState({ nearbyPersonId: null, nearCurator: true })
    render(<Hud />)

    const button = screen.getByTestId('action-button')
    expect(button.textContent).toMatch(/Rémi/)

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

  it('joue un clic sur les boutons du HUD', () => {
    useGame.setState({ nearCurator: true })
    render(<Hud />)

    fireEvent.click(screen.getByTestId('hud-lang'))
    fireEvent.click(screen.getByTestId('stamps-button'))
    fireEvent.click(screen.getByTestId('action-button'))
    expect(playSfxMock).toHaveBeenCalledWith('click')
    expect(playSfxMock.mock.calls.filter((c) => c[0] === 'click')).toHaveLength(3)
  })

  it('ouvre le plan du musée (état partagé isOverlayOpen), et le ferme via ✕ puis Échap', () => {
    render(<Hud />)

    expect(screen.queryByTestId('museum-map')).not.toBeInTheDocument()
    expect(isOverlayOpen(useGame.getState())).toBe(false)
    fireEvent.click(screen.getByTestId('map-button'))

    const map = screen.getByTestId('museum-map')
    expect(map).toBeInTheDocument()
    expect(map).toHaveAttribute('role', 'dialog')
    // `mapOpen` vit dans `src/state/gameStore.ts` et compte dans `isOverlayOpen` : `App` s'appuie
    // là-dessus pour couper `useKeyboardControls` et démonter `TouchJoystick` pendant l'ouverture.
    expect(useGame.getState().mapOpen).toBe(true)
    expect(isOverlayOpen(useGame.getState())).toBe(true)

    fireEvent.click(screen.getByTestId('map-close'))
    expect(screen.queryByTestId('museum-map')).not.toBeInTheDocument()
    expect(useGame.getState().mapOpen).toBe(false)
    expect(isOverlayOpen(useGame.getState())).toBe(false)

    fireEvent.click(screen.getByTestId('map-button'))
    expect(screen.getByTestId('museum-map')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('museum-map')).not.toBeInTheDocument()
    expect(useGame.getState().mapOpen).toBe(false)
  })

  it('le plan affiche les ailes et les portraits vus par aile', () => {
    const people = useGame.getState().people
    useGame.setState({ visited: { [people[0].id]: Date.now() } })
    render(<Hud />)

    fireEvent.click(screen.getByTestId('map-button'))
    const map = screen.getByTestId('museum-map')
    // 6 fiches d'attente réparties ~2/2/2 sur les trois ailes (voir generatePlaceholderPeople).
    expect(map.textContent).toMatch(/1\/2/)
  })
})
