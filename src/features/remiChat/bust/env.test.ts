import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

async function loadEnv() {
  vi.resetModules() // `hasWebGL` mémorise un « oui » : chaque test repart d'un module neuf
  return import('./env')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('hasWebGL', () => {
  it('jsdom (aucun constructeur WebGL) : non, sans jamais appeler getContext (qui y journalise une erreur)', async () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    const { hasWebGL } = await loadEnv()
    expect(hasWebGL()).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('contexte WebGL2 disponible : oui, et la sonde est libérée aussitôt (quota de contextes)', async () => {
    const loseContext = vi.fn()
    const gl = { getExtension: vi.fn(() => ({ loseContext })) }
    vi.stubGlobal('WebGL2RenderingContext', class {})
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => (kind === 'webgl2' ? gl : null)) as never)
    const { hasWebGL } = await loadEnv()
    expect(hasWebGL()).toBe(true)
    expect(loseContext).toHaveBeenCalledTimes(1)
    expect(hasWebGL()).toBe(true) // « oui » mémorisé : pas de seconde sonde
    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('WebGL2 refusé ou qui lève : non, jamais d\'exception ; un « non » est resondé au montage suivant', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {})
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as never)
    const { hasWebGL } = await loadEnv()
    expect(hasWebGL()).toBe(false)
    getContext.mockImplementation(() => {
      throw new Error('contexte bloqué')
    })
    expect(hasWebGL()).toBe(false)
    getContext.mockImplementation((() => ({ getExtension: () => null })) as never)
    expect(hasWebGL()).toBe(true)
  })
})

describe('useReducedMotion', () => {
  function mockMatchMedia(initial: boolean) {
    let matches = initial
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return matches
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }))
    return {
      set(next: boolean) {
        matches = next
        listeners.forEach((fn) => fn())
      },
      listeners,
    }
  }

  it('suit la préférence, y compris quand elle change en cours de session, et se désabonne', async () => {
    const media = mockMatchMedia(false)
    const { useReducedMotion } = await loadEnv()
    const { result, unmount } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
    act(() => media.set(true))
    expect(result.current).toBe(true)
    unmount()
    expect(media.listeners.size).toBe(0)
  })

  it('sans matchMedia : faux, sans erreur', async () => {
    vi.stubGlobal('matchMedia', undefined)
    const { useReducedMotion } = await loadEnv()
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false)
  })
})

describe('usePageVisible', () => {
  it('suit la visibilité de l\'onglet (la boucle de rendu est suspendue quand il est caché)', async () => {
    const { usePageVisible } = await loadEnv()
    let state: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state)
    const { result } = renderHook(() => usePageVisible())
    expect(result.current).toBe(true)
    act(() => {
      state = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(false)
    act(() => {
      state = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(true)
  })
})
