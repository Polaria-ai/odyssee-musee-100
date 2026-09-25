import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'odyssee-musee-100:sound'

type GlobalWithAudioContext = Omit<typeof globalThis, 'AudioContext'> & { AudioContext?: unknown }

async function freshEngine() {
  vi.resetModules()
  return import('./engine')
}

describe('engine (persistance, valeur par défaut, no-op sans AudioContext)', () => {
  const g = globalThis as GlobalWithAudioContext
  const originalAudioContext = g.AudioContext

  beforeEach(() => {
    localStorage.clear()
    delete g.AudioContext
  })

  afterEach(() => {
    if (originalAudioContext) g.AudioContext = originalAudioContext
    else delete g.AudioContext
  })

  it('le son est coupé par défaut quand rien n’est persisté', async () => {
    const engine = await freshEngine()
    expect(engine.isSoundEnabled()).toBe(false)
  })

  it('une valeur persistée invalide ou absente retombe sur « coupé »', async () => {
    localStorage.setItem(STORAGE_KEY, 'n’importe quoi')
    const engine = await freshEngine()
    expect(engine.isSoundEnabled()).toBe(false)
  })

  it('persiste l’état on/off en localStorage et le relit au prochain chargement', async () => {
    const engine = await freshEngine()
    engine.setSoundEnabled(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('on')

    const reloaded = await freshEngine()
    expect(reloaded.isSoundEnabled()).toBe(true)

    reloaded.setSoundEnabled(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('off')

    const reloadedAgain = await freshEngine()
    expect(reloadedAgain.isSoundEnabled()).toBe(false)
  })

  it('toggleSoundEnabled bascule l’état', async () => {
    const engine = await freshEngine()
    engine.toggleSoundEnabled()
    expect(engine.isSoundEnabled()).toBe(true)
    engine.toggleSoundEnabled()
    expect(engine.isSoundEnabled()).toBe(false)
  })

  it('sans AudioContext disponible : aucune fonction ne lève, tout reste null/inactif', async () => {
    const engine = await freshEngine()
    expect(() => engine.unlockAudio()).not.toThrow()
    expect(engine.getAudioContext()).toBeNull()
    expect(engine.getMasterGain()).toBeNull()
    // Sans contexte créable, le déblocage ne peut pas réellement avoir lieu.
    expect(engine.isAudioUnlocked()).toBe(false)
    expect(() => engine.setSoundEnabled(true)).not.toThrow()
    expect(() => engine.toggleSoundEnabled()).not.toThrow()
  })

  it('avertit les abonnés à chaque changement d’état, jamais si la valeur ne change pas', async () => {
    const engine = await freshEngine()
    const listener = vi.fn()
    const unsubscribe = engine.subscribeSound(listener)

    engine.setSoundEnabled(true)
    expect(listener).toHaveBeenCalledTimes(1)

    engine.setSoundEnabled(true)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    engine.setSoundEnabled(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
