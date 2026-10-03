import { useEffect } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BustCanvasProps } from './BustCanvas'

// Le vrai <Canvas> a besoin de WebGL : on le remplace par un faux pilotable, et on décide si « WebGL existe ».
const mocks = vi.hoisted(() => ({
  webgl: false,
  canvas: null as null | ((props: unknown) => unknown),
  mounts: 0,
}))

vi.mock('./env', async (importOriginal) => ({ ...(await importOriginal<typeof import('./env')>()), hasWebGL: () => mocks.webgl }))
vi.mock('./BustCanvas', async () => {
  const React = await import('react')
  return {
    default: function FakeBustCanvas(props: unknown) {
      React.useEffect(() => {
        mocks.mounts++
      }, [])
      return mocks.canvas?.(props) ?? null
    },
  }
})

import { RemiBust } from '../RemiBust'

/** Faux buste 3D qui signale « prêt » (et le cadre) dès son montage. */
function ReadyOnMount({ onReady, onFraming }: { onReady?: () => void; onFraming?: () => void }) {
  useEffect(() => {
    onFraming?.()
    onReady?.()
  }, [onReady, onFraming])
  return null
}

/** Faux buste 3D dont le modèle ne charge pas. */
function FailOnMount({ onError }: { onError?: (error: unknown) => void }) {
  useEffect(() => {
    onError?.(new Error('GLTF introuvable'))
  }, [onError])
  return null
}

const root = () => screen.getByTestId('remi-bust')
const silhouette = () => screen.getByTestId('remi-bust-silhouette')

beforeEach(() => {
  mocks.webgl = false
  mocks.canvas = null
  mocks.mounts = 0
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('RemiBust sans WebGL (jsdom)', () => {
  it('garde la signature du bouchon : data-testid, data-mood, data-variant ; décoratif', () => {
    render(<RemiBust mood="thinking" variant="fullscreen" />)
    expect(root()).toHaveAttribute('data-mood', 'thinking')
    expect(root()).toHaveAttribute('data-variant', 'fullscreen')
    expect(root()).toHaveAttribute('aria-hidden', 'true')
  })

  it('personnage : Rémi par défaut, l\'Archiviste sur demande (data-character), même data-testid', () => {
    const { rerender } = render(<RemiBust mood="idle" variant="split" />)
    expect(root()).toHaveAttribute('data-character', 'remi')
    rerender(<RemiBust mood="idle" variant="split" character="archiviste" />)
    expect(root()).toHaveAttribute('data-testid', 'remi-bust')
    expect(root()).toHaveAttribute('data-character', 'archiviste')
  })

  it('repli : silhouette stylisée visible, jamais d\'écran vide, aucune erreur ni avertissement console', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<RemiBust mood="idle" variant="split" />)
    expect(root()).toHaveAttribute('data-state', 'fallback')
    expect(silhouette()).toBeInTheDocument()
    expect(silhouette()).toHaveStyle({ opacity: '1' })
    expect(root().querySelector('canvas')).toBeNull()
    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('suit les props sans se remonter', () => {
    const { rerender } = render(<RemiBust mood="idle" variant="split" />)
    const node = root()
    rerender(<RemiBust mood="speaking" variant="fullscreen" />)
    expect(root()).toBe(node)
    expect(root()).toHaveAttribute('data-mood', 'speaking')
    expect(root()).toHaveAttribute('data-variant', 'fullscreen')
  })

  it('le conteneur remplit son parent (c\'est RemiChat qui décide de la taille)', () => {
    render(<RemiBust mood="idle" variant="split" />)
    expect(root()).toHaveStyle({ width: '100%', height: '100%', position: 'relative' })
  })
})

describe('RemiBust avec WebGL', () => {
  beforeEach(() => {
    mocks.webgl = true
  })

  it('silhouette d\'attente pendant le chargement, puis disparition quand le buste 3D est prêt', async () => {
    let received: Record<string, unknown> = {}
    mocks.canvas = (props) => {
      received = props as Record<string, unknown>
      return <ReadyOnMount onReady={(props as BustCanvasProps).onReady} />
    }
    render(<RemiBust mood="listening" variant="split" />)
    await waitFor(() => expect(root()).toHaveAttribute('data-state', 'ready'))
    expect(silhouette()).toHaveStyle({ opacity: '0' })
    expect(received.mood).toBe('listening')
    expect(received.variant).toBe('split')
    expect(received.character).toBe('remi') // Rémi par défaut
    expect(mocks.mounts).toBe(1)
  })

  it('transmet le personnage demandé au rendu 3D (GLB et mesures de l\'Archiviste)', async () => {
    let received: Record<string, unknown> = {}
    mocks.canvas = (props) => {
      received = props as Record<string, unknown>
      return <ReadyOnMount onReady={(props as BustCanvasProps).onReady} />
    }
    render(<RemiBust mood="idle" variant="fullscreen" character="archiviste" />)
    await waitFor(() => expect(root()).toHaveAttribute('data-state', 'ready'))
    expect(received.character).toBe('archiviste')
  })

  it('reste en attente tant que le modèle n\'est pas là', async () => {
    mocks.canvas = () => null
    render(<RemiBust mood="idle" variant="split" />)
    await waitFor(() => expect(mocks.mounts).toBe(1))
    expect(root()).toHaveAttribute('data-state', 'loading')
    expect(silhouette()).toHaveStyle({ opacity: '1' })
  })

  it('contexte perdu puis restauré : silhouette en attendant, buste de retour, sans remontage', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let props: BustCanvasProps | null = null
    mocks.canvas = (p) => {
      props = p as BustCanvasProps
      return <ReadyOnMount onReady={props.onReady} />
    }
    render(<RemiBust mood="idle" variant="split" />)
    await waitFor(() => expect(root()).toHaveAttribute('data-state', 'ready'))
    act(() => props!.onContextLost?.())
    expect(root()).toHaveAttribute('data-state', 'loading')
    expect(silhouette()).toHaveStyle({ opacity: '1' })
    act(() => props!.onContextRestored?.())
    expect(root()).toHaveAttribute('data-state', 'ready')
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(mocks.mounts).toBe(1) // la restauration a annulé le remontage prévu
  })

  it('contexte perdu pour de bon : deux remontages au plus, puis silhouette définitive', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let props: BustCanvasProps | null = null
    mocks.canvas = (p) => {
      props = p as BustCanvasProps
      return <ReadyOnMount onReady={props.onReady} />
    }
    render(<RemiBust mood="idle" variant="split" />)
    await waitFor(() => expect(root()).toHaveAttribute('data-state', 'ready'))
    for (let attempt = 1; attempt <= 2; attempt++) {
      act(() => props!.onContextLost?.())
      await act(async () => {
        vi.advanceTimersByTime(1600)
      })
      await waitFor(() => expect(mocks.mounts).toBe(attempt + 1))
      await waitFor(() => expect(root()).toHaveAttribute('data-state', 'ready'))
    }
    act(() => props!.onContextLost?.())
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    expect(root()).toHaveAttribute('data-state', 'fallback')
    expect(silhouette()).toHaveStyle({ opacity: '1' })
    expect(mocks.mounts).toBe(3)
  })

  it('modèle introuvable (signalé par la scène, sans exception React) : repli, un avertissement', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.canvas = (props) => <FailOnMount onError={(props as BustCanvasProps).onError} />
    render(<RemiBust mood="idle" variant="split" />)
    await waitFor(() => expect(root()).toHaveAttribute('data-state', 'fallback'))
    expect(silhouette()).toHaveStyle({ opacity: '1' })
    expect(root().querySelector('canvas')).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('modèle 3D indisponible')
    expect(error).not.toHaveBeenCalled() // aucune exception ne remonte à React
  })

  it('erreur pendant le rendu 3D (modèle introuvable…) : repli propre, un avertissement, pas d\'exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}) // React journalise l'erreur attrapée
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.canvas = () => {
      throw new Error('GLTF introuvable')
    }
    render(<RemiBust mood="idle" variant="split" />)
    await waitFor(() => expect(root()).toHaveAttribute('data-state', 'fallback'))
    expect(silhouette()).toHaveStyle({ opacity: '1' })
    expect(root().querySelector('canvas')).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('Rémi · buste')
  })

  it('démonté pendant l\'attente d\'une restauration : plus aucun minuteur, plus de mise à jour', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    let props: BustCanvasProps | null = null
    mocks.canvas = (p) => {
      props = p as BustCanvasProps
      return <ReadyOnMount onReady={props.onReady} />
    }
    const { unmount } = render(<RemiBust mood="idle" variant="split" />)
    await waitFor(() => expect(root()).toHaveAttribute('data-state', 'ready'))
    act(() => props!.onContextLost?.())
    unmount()
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(vi.getTimerCount()).toBe(0)
    expect(error).not.toHaveBeenCalled()
  })
})

