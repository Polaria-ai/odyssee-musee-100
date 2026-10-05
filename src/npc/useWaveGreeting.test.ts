import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from '../state/gameStore'
import { WAVE_COOLDOWN_MS } from './remiBehavior'
import { useWaveGreeting } from './useWaveGreeting'

describe('useWaveGreeting', () => {
  let now = 0
  const arriveAtCounter = () => act(() => useGame.setState({ nearCurator: true }))
  const leaveCounter = () => act(() => useGame.setState({ nearCurator: false }))

  beforeEach(() => {
    now = 5_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    useGame.setState({ nearCurator: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useGame.setState({ nearCurator: false })
  })

  it('ne salue pas tant que le joueur n’est pas à portée du comptoir', () => {
    const { result } = renderHook(() => useWaveGreeting())
    expect(result.current.waving).toBe(false)
  })

  it('salue quand nearCurator passe à vrai, puis revient au repos à la fin du geste', () => {
    const { result } = renderHook(() => useWaveGreeting())
    arriveAtCounter()
    expect(result.current.waving).toBe(true)
    act(() => result.current.onWaveDone())
    expect(result.current.waving).toBe(false)
  })

  it('ne salue pas plus d’une fois toutes les 20 s, même si le joueur va et vient', () => {
    const { result } = renderHook(() => useWaveGreeting())
    arriveAtCounter()
    act(() => result.current.onWaveDone())

    now += 8_000
    leaveCounter()
    arriveAtCounter()
    expect(result.current.waving).toBe(false)

    now += WAVE_COOLDOWN_MS - 8_000 - 1
    leaveCounter()
    arriveAtCounter()
    expect(result.current.waving).toBe(false)

    now += 1
    leaveCounter()
    arriveAtCounter()
    expect(result.current.waving).toBe(true)
  })

  it('ne salue pas un joueur déjà au comptoir quand le composant se monte (seul le front montant compte)', () => {
    useGame.setState({ nearCurator: true })
    const { result } = renderHook(() => useWaveGreeting())
    expect(result.current.waving).toBe(false)
  })

  it('cesse d’écouter le store quand il est démonté', () => {
    const { result, unmount } = renderHook(() => useWaveGreeting())
    unmount()
    arriveAtCounter()
    expect(result.current.waving).toBe(false)
  })
})
