import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from '../state/gameStore'
import { WAVE_COOLDOWN_MS } from '../npc/remiBehavior'
import { useArchivistGreeting } from './useArchivistGreeting'

describe('useArchivistGreeting', () => {
  let now = 0
  const approach = () => act(() => useGame.setState({ nearArchivist: true }))
  const leave = () => act(() => useGame.setState({ nearArchivist: false }))

  beforeEach(() => {
    now = 5_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    useGame.setState({ nearArchivist: false, nearCurator: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useGame.setState({ nearArchivist: false, nearCurator: false })
  })

  it('ne salue pas tant que le joueur n’est pas à portée', () => {
    const { result } = renderHook(() => useArchivistGreeting())
    expect(result.current.waving).toBe(false)
  })

  it('salue quand nearArchivist passe à vrai, puis revient au repos à la fin du geste', () => {
    const { result } = renderHook(() => useArchivistGreeting())
    approach()
    expect(result.current.waving).toBe(true)
    act(() => result.current.onWaveDone())
    expect(result.current.waving).toBe(false)
  })

  it('ne réagit pas à la proximité de Rémi (nearCurator)', () => {
    const { result } = renderHook(() => useArchivistGreeting())
    act(() => useGame.setState({ nearCurator: true }))
    expect(result.current.waving).toBe(false)
  })

  it('ne salue pas plus d’une fois toutes les 20 s, même si le joueur va et vient', () => {
    const { result } = renderHook(() => useArchivistGreeting())
    approach()
    act(() => result.current.onWaveDone())

    now += 8_000
    leave()
    approach()
    expect(result.current.waving).toBe(false)

    now += WAVE_COOLDOWN_MS - 8_000 - 1
    leave()
    approach()
    expect(result.current.waving).toBe(false)

    now += 1
    leave()
    approach()
    expect(result.current.waving).toBe(true)
  })

  it('ne salue pas un joueur déjà à portée quand le composant se monte (seul le front montant compte)', () => {
    useGame.setState({ nearArchivist: true })
    const { result } = renderHook(() => useArchivistGreeting())
    expect(result.current.waving).toBe(false)
  })

  it('cesse d’écouter le store quand il est démonté', () => {
    const { result, unmount } = renderHook(() => useArchivistGreeting())
    unmount()
    approach()
    expect(result.current.waving).toBe(false)
  })
})
