import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { NO_KEYBOARD, SPLIT_QUERY, useSplitLayout, useVisibleFrame, visibleFrame } from './useChatViewport'

describe('visibleFrame', () => {
  it('pas de visualViewport : rien à corriger', () => {
    expect(visibleFrame(null, 844)).toEqual(NO_KEYBOARD)
    expect(visibleFrame(undefined, 844)).toEqual(NO_KEYBOARD)
  })

  it('fenêtre visuelle de la taille de la page : pas de clavier', () => {
    expect(visibleFrame({ height: 844, offsetTop: 0, scale: 1 }, 844)).toEqual(NO_KEYBOARD)
  })

  it('barre d’adresse qui se replie (quelques dizaines de pixels) : pas de clavier', () => {
    expect(visibleFrame({ height: 780, offsetTop: 0, scale: 1 }, 844)).toEqual(NO_KEYBOARD)
  })

  it('clavier virtuel ouvert : la fenêtre visuelle devient la zone du chat', () => {
    expect(visibleFrame({ height: 480, offsetTop: 0, scale: 1 }, 844)).toEqual({ keyboard: true, top: 0, height: 480 })
  })

  it('iOS décale la fenêtre visuelle pour montrer le champ : le chat la suit', () => {
    expect(visibleFrame({ height: 470.4, offsetTop: 62.6, scale: 1 }, 844)).toEqual({ keyboard: true, top: 63, height: 470 })
  })

  it('page zoomée au pincement : ce n’est pas un clavier', () => {
    expect(visibleFrame({ height: 400, offsetTop: 0, scale: 2 }, 844)).toEqual(NO_KEYBOARD)
  })
})

describe('useVisibleFrame', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'visualViewport')

  afterEach(() => {
    if (original) Object.defineProperty(window, 'visualViewport', original)
    else Reflect.deleteProperty(window, 'visualViewport')
  })

  function fakeViewport(initial: { height: number; offsetTop: number; scale: number }) {
    const listeners = new Map<string, Set<() => void>>()
    const viewport = {
      ...initial,
      addEventListener: (type: string, fn: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(fn)
      },
      removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
      emit: (type: string) => listeners.get(type)?.forEach((fn) => fn()),
    }
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    return viewport
  }

  it('suit l’ouverture et la fermeture du clavier tant que le chat est ouvert', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    const viewport = fakeViewport({ height: 800, offsetTop: 0, scale: 1 })
    const { result } = renderHook(({ active }) => useVisibleFrame(active), { initialProps: { active: true } })
    expect(result.current.keyboard).toBe(false)

    act(() => {
      viewport.height = 460
      viewport.emit('resize')
    })
    expect(result.current).toEqual({ keyboard: true, top: 0, height: 460 })

    act(() => {
      viewport.height = 800
      viewport.emit('resize')
    })
    expect(result.current.keyboard).toBe(false)
  })

  it('inactif : aucune écoute, aucune mesure', () => {
    const viewport = fakeViewport({ height: 400, offsetTop: 0, scale: 1 })
    const add = vi.spyOn(viewport, 'addEventListener')
    const { result } = renderHook(() => useVisibleFrame(false))
    expect(result.current).toEqual(NO_KEYBOARD)
    expect(add).not.toHaveBeenCalled()
  })

  it('sans visualViewport, ne casse pas', () => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })
    const { result } = renderHook(() => useVisibleFrame(true))
    expect(result.current).toEqual(NO_KEYBOARD)
  })
})

describe('useSplitLayout', () => {
  const original = window.matchMedia

  afterEach(() => {
    window.matchMedia = original
  })

  it('sans matchMedia (jsdom) : mise en page téléphone', () => {
    window.matchMedia = undefined as never
    const { result } = renderHook(() => useSplitLayout())
    expect(result.current).toBe(false)
  })

  it('interroge « largeur ≥ 900 px ET paysage » et suit les changements', () => {
    let matches = false
    const listeners = new Set<() => void>()
    window.matchMedia = ((query: string) => {
      expect(query).toBe(SPLIT_QUERY)
      return {
        get matches() {
          return matches
        },
        media: query,
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      }
    }) as never
    expect(SPLIT_QUERY).toBe('(min-width: 900px) and (orientation: landscape)')

    const { result } = renderHook(() => useSplitLayout())
    expect(result.current).toBe(false)
    act(() => {
      matches = true
      listeners.forEach((fn) => fn())
    })
    expect(result.current).toBe(true)
  })
})
