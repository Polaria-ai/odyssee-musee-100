import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type GlobalWithAudioContext = Omit<typeof globalThis, 'AudioContext'> & { AudioContext?: unknown }

/** Petit `AudioContext` factice : juste assez de surface pour que `sfx.ts` puisse s'y brancher. */
function makeFakeAudioContext() {
  const audioParam = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  })
  const baseNode = () => ({ connect: vi.fn(), disconnect: vi.fn() })

  const createOscillator = vi.fn(() => ({
    ...baseNode(),
    type: 'sine' as OscillatorType,
    frequency: audioParam(),
    start: vi.fn(),
    stop: vi.fn(),
  }))

  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running' as AudioContextState,
    destination: baseNode(),
    createOscillator,
    createGain: vi.fn(() => ({ ...baseNode(), gain: audioParam() })),
    createBiquadFilter: vi.fn(() => ({ ...baseNode(), type: 'lowpass', frequency: audioParam() })),
    createBuffer: vi.fn((channels: number, length: number) => ({
      numberOfChannels: channels,
      getChannelData: () => new Float32Array(length),
      copyToChannel: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({ ...baseNode(), buffer: null, start: vi.fn(), stop: vi.fn() })),
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
  }

  return { ctx, createOscillator }
}

describe('playSfx — limiteur de polyphonie (blip)', () => {
  const g = globalThis as GlobalWithAudioContext
  const originalAudioContext = g.AudioContext

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalAudioContext) g.AudioContext = originalAudioContext
    else delete g.AudioContext
  })

  it('ne crée jamais plus de 6 blips simultanés, puis en accepte à nouveau une fois libérés', async () => {
    vi.resetModules()
    const { ctx, createOscillator } = makeFakeAudioContext()
    // Une fonction fléchée n'est pas constructible (`new`) : un vrai `function` s'y prête.
    g.AudioContext = function FakeAudioContext() {
      return ctx
    }

    const engine = await import('./engine')
    engine.setSoundEnabled(true)
    const { playSfx } = await import('./sfx')

    for (let i = 0; i < 10; i++) playSfx('blip')
    expect(createOscillator).toHaveBeenCalledTimes(6)

    // Les 6 premiers blips libèrent leur créneau après leur durée : la place se rouvre.
    vi.advanceTimersByTime(60)
    playSfx('blip')
    expect(createOscillator).toHaveBeenCalledTimes(7)
  })

  it('reste un no-op silencieux quand le son est coupé (pas de nœud audio créé)', async () => {
    vi.resetModules()
    const { ctx, createOscillator } = makeFakeAudioContext()
    g.AudioContext = function FakeAudioContext() {
      return ctx
    }

    const engine = await import('./engine')
    expect(engine.isSoundEnabled()).toBe(false)
    const { playSfx } = await import('./sfx')

    expect(() => playSfx('blip')).not.toThrow()
    expect(() => playSfx('stamp')).not.toThrow()
    expect(createOscillator).not.toHaveBeenCalled()
  })
})
