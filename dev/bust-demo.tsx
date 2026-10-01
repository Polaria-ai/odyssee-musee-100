/**
 * Page de démonstration du buste de Rémi · IA (WEL-919) : voir les commentaires de `bust-demo.html`.
 * Hors build de production (Vite ne construit que index.html). Expose `window.__bustDemo` pour les
 * captures Playwright et le test d'ouverture/fermeture répétée (fuites de contexte, de géométrie, de texture).
 */
import { Fragment, StrictMode, useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { WebGLRenderer } from 'three'
import type { RemiBustVariant, RemiMood } from '../src/features/remiChat/contract'
import { RemiBustView } from '../src/features/remiChat/RemiBust'
import { GESTURE_IDS, type GestureId } from '../src/features/remiChat/bust/gestures'

const MOODS: RemiMood[] = ['idle', 'listening', 'thinking', 'speaking']
const VARIANTS: RemiBustVariant[] = ['split', 'fullscreen']
/** Tailles de référence des captures : PC (moitié de l'écran) et iPhone portrait. */
const FRAME_SIZE: Record<RemiBustVariant, { width: number; height: number }> = {
  split: { width: 720, height: 900 },
  fullscreen: { width: 390, height: 844 },
}

const params = new URLSearchParams(location.search)
const pick = <T extends string>(value: string | null, all: readonly T[], fallback: T): T => (all.includes(value as T) ? (value as T) : fallback)
const num = (value: string | null): number | undefined => (value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined)

let cyclesStarted = false

interface LeakSample {
  cycle: number
  ready: boolean
  geometries: number
  textures: number
  programs: number
  geometriesAfterUnmount: number | null
  texturesAfterUnmount: number | null
  contextLostAfterUnmount: boolean | null
  canvasesInDom: number
}

declare global {
  interface Window {
    __bustDemo: {
      setMood: (m: RemiMood) => void
      setVariant: (v: RemiBustVariant) => void
      setShown: (shown: boolean) => void
      setGesture: (g: GestureId | undefined, mirrored?: boolean) => void
      runCycles: (count: number) => Promise<LeakSample[]>
      samples: LeakSample[]
    }
  }
}

function Demo() {
  const [variant, setVariant] = useState<RemiBustVariant>(pick(params.get('variant'), VARIANTS, 'split'))
  const [mood, setMood] = useState<RemiMood>(pick(params.get('mood'), MOODS, 'idle'))
  const [gesture, setGesture] = useState<GestureId | undefined>(GESTURE_IDS.includes(params.get('gesture') as GestureId) ? (params.get('gesture') as GestureId) : undefined)
  const [mirrored, setMirrored] = useState(params.get('mirrored') === '1')
  const [shown, setShown] = useState(true)
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null)
  const [report, setReport] = useState('')
  const showPanel = params.get('controls') !== '0'

  const onRenderer = useCallback((gl: WebGLRenderer) => {
    ;(window as unknown as { __bustGl: WebGLRenderer }).__bustGl = gl // vérifications (images rendues, ressources)
    setRenderer(gl)
  }, [])
  const debug = useMemo(
    () => ({
      seed: num(params.get('seed')),
      startAt: num(params.get('at')),
      speed: num(params.get('speed')),
      forceGesture: gesture,
      mirrored,
      zoomOut: num(params.get('zoomOut')),
      modelPath: params.get('model') ?? undefined,
      onRenderer,
      onProbe: (fn: unknown) => {
        ;(window as unknown as { __bustProject: unknown }).__bustProject = fn
      },
      onMetrics: (m: unknown, f: unknown) => {
        ;(window as unknown as { __bustMetrics: unknown }).__bustMetrics = { metrics: m, framing: f }
      },
    }),
    [gesture, mirrored, onRenderer],
  )

  // Dernier moteur de rendu créé (le test de cycles le lit pendant que le buste est ouvert).
  const latest = useMemo(() => ({ current: null as WebGLRenderer | null }), [])
  latest.current = renderer

  useEffect(() => {
    const samples: LeakSample[] = []
    window.__bustDemo = {
      setMood,
      setVariant,
      setShown,
      setGesture: (g, m = false) => {
        setGesture(g)
        setMirrored(m)
      },
      samples,
      // Ouvre puis ferme le buste `count` fois ; relève, pour chaque moteur de rendu, les ressources
      // vivantes avant la fermeture puis ce qu'il en reste après (attendu : 0 géométrie, 0 texture).
      async runCycles(count) {
        const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))
        for (let i = 0; i < count; i++) {
          setShown(true)
          let waited = 0
          while (document.querySelector('[data-testid="remi-bust"]')?.getAttribute('data-state') !== 'ready' && waited < 15000) {
            await tick(100)
            waited += 100
          }
          await tick(300)
          const gl = latest.current
          const sample: LeakSample = {
            cycle: i + 1,
            ready: document.querySelector('[data-testid="remi-bust"]')?.getAttribute('data-state') === 'ready',
            geometries: gl?.info.memory.geometries ?? -1,
            textures: gl?.info.memory.textures ?? -1,
            programs: gl?.info.programs?.length ?? -1,
            geometriesAfterUnmount: null,
            texturesAfterUnmount: null,
            contextLostAfterUnmount: null,
            canvasesInDom: document.querySelectorAll('canvas').length,
          }
          const ctx = gl?.getContext() ?? null
          setShown(false)
          await tick(400) // le démontage de R3F libère le moteur de rendu dans un setTimeout
          sample.geometriesAfterUnmount = gl?.info.memory.geometries ?? null
          sample.texturesAfterUnmount = gl?.info.memory.textures ?? null
          sample.contextLostAfterUnmount = ctx ? ctx.isContextLost() : null
          sample.canvasesInDom = document.querySelectorAll('canvas').length
          samples.push(sample)
        }
        setShown(true)
        return samples
      },
    }
  }, [latest])

  useEffect(() => {
    const cycles = num(params.get('cycles'))
    if (cycles && !cyclesStarted) {
      cyclesStarted = true // StrictMode monte deux fois les effets en développement
      void window.__bustDemo.runCycles(cycles).then((s) => setReport(JSON.stringify(s, null, 1)))
    }
  }, [])

  const size = FRAME_SIZE[variant]
  return (
    <>
      <div id="frame" style={{ width: size.width, height: size.height }} data-testid="frame">
        {shown && <RemiBustView mood={mood} variant={variant} debug={debug} />}
      </div>
      {showPanel && (
        <div id="panel">
          <label>
            variante
            <select value={variant} onChange={(e) => setVariant(e.target.value as RemiBustVariant)}>
              {VARIANTS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            humeur
            <select value={mood} onChange={(e) => setMood(e.target.value as RemiMood)}>
              {MOODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            geste forcé
            <select value={gesture ?? ''} onChange={(e) => setGesture((e.target.value || undefined) as GestureId | undefined)}>
              <option value="">(aucun)</option>
              {GESTURE_IDS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <button onClick={() => setShown((s) => !s)}>{shown ? 'fermer' : 'ouvrir'} le buste</button>
          <button onClick={() => void window.__bustDemo.runCycles(20).then((s) => setReport(JSON.stringify(s, null, 1)))}>20 ouvertures/fermetures</button>
          {report && <pre>{report}</pre>}
        </div>
      )}
    </>
  )
}

// StrictMode comme en développement du jeu ; `?strict=0` reproduit le comportement de production.
const Mode = params.get('strict') === '0' ? Fragment : StrictMode
createRoot(document.getElementById('root')!).render(
  <Mode>
    <Demo />
  </Mode>,
)
