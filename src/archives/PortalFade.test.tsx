import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { player, input } from '../state/runtime'
import type { ArchivesLayout } from '../types'
import { PortalFade } from './PortalFade'

const playSfxMock = vi.fn()
vi.mock('../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
}))

const FADE_MS = 350

// Plan des Archives manifestement fabriqué pour ce test (pas les vraies coordonnées du jeu).
const archivesLayoutFixture: ArchivesLayout = {
  room: {
    id: 'archives',
    bounds: { minX: -12, maxX: 12, minZ: 70, maxZ: 90 },
    label: { fr: 'Archives de test', en: 'Test archives' },
    floorColor: '#111111',
    wallColor: '#222222',
    accentColor: '#333333',
  },
  colliders: [],
  slots: [],
  arrival: { position: { x: 1.5, z: 86 }, rotationY: Math.PI },
  hallPortal: { position: { x: 7.8, z: 5.6 }, rotationY: 0 },
  returnPortal: { position: { x: 0, z: 88.5 }, rotationY: 0 },
  archivist: { position: { x: 0, z: 77 }, rotationY: 0 },
}

describe('PortalFade', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    playSfxMock.mockClear()
    player.x = -999
    player.z = -999
    player.rotY = -999
    input.moveX = 1
    input.moveY = 1
    useGame.setState({ lang: 'fr', portalTransition: null, archivesLayout: archivesLayoutFixture })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ne rend rien tant qu’aucune transition n’est en cours', () => {
    render(<PortalFade />)
    expect(screen.queryByTestId('portal-fade')).not.toBeInTheDocument()
  })

  it('coupe l’entrée dès le départ du fondu', () => {
    render(<PortalFade />)
    act(() => {
      useGame.getState().setPortalTransition('to-archives')
    })
    expect(input.moveX).toBe(0)
    expect(input.moveY).toBe(0)
  })

  it('« to-archives » : téléporte vers `archivesLayout.arrival` une fois l’écran noirci, puis referme la transition', () => {
    render(<PortalFade />)
    act(() => {
      useGame.getState().setPortalTransition('to-archives')
    })
    expect(screen.getByTestId('portal-fade')).toHaveAttribute('data-phase', 'in')
    expect(screen.getByText('Voyage vers 2040…')).toBeInTheDocument()

    // Pas encore téléporté avant la fin du fondu vers le noir.
    expect(player.x).toBe(-999)

    act(() => {
      vi.advanceTimersByTime(FADE_MS)
    })
    expect(player.x).toBe(1.5)
    expect(player.z).toBe(86)
    expect(player.rotY).toBe(Math.PI)
    expect(playSfxMock).toHaveBeenCalledWith('room')
    expect(screen.getByTestId('portal-fade')).toHaveAttribute('data-phase', 'out')
    // Toujours en place pendant le fondu inverse : la transition n'est pas encore effacée.
    expect(useGame.getState().portalTransition).toBe('to-archives')

    act(() => {
      vi.advanceTimersByTime(FADE_MS)
    })
    expect(useGame.getState().portalTransition).toBeNull()
    expect(screen.queryByTestId('portal-fade')).not.toBeInTheDocument()
  })

  it('« to-hall » : arrive 1,6 m au sud de la Porte de 2040, face au nord', () => {
    render(<PortalFade />)
    act(() => {
      useGame.getState().setPortalTransition('to-hall')
    })
    expect(screen.getByText('Retour en 2026…')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(FADE_MS)
    })
    expect(player.x).toBe(7.8)
    expect(player.z).toBeCloseTo(5.6 + 1.6)
    expect(player.rotY).toBe(Math.PI)

    act(() => {
      vi.advanceTimersByTime(FADE_MS)
    })
    expect(useGame.getState().portalTransition).toBeNull()
  })
})
