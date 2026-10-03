/**
 * Buste 3D animé de Rémi · IA, ou de l'Archiviste · IA (prop `character`, Rémi par défaut), dans le chat (son propre
 * `<Canvas>`, WEL-919, WEL-929). Le parent (`PersonaChat`) décide de la taille : le buste remplit son conteneur (moitié
 * gauche de l'écran sur PC, plein écran derrière les bulles sur téléphone). Signature et `data-testid="remi-bust"`
 * inchangés depuis le bouchon, pour les deux personnages (`data-character` dit lequel).
 *
 * Le rendu 3D (`bust/BustCanvas`) est chargé à la demande : les tests jsdom du chat et le premier
 * chargement du jeu n'embarquent pas ce code. Partout où la 3D ne peut pas s'afficher (WebGL absent,
 * modèle introuvable, contexte perdu pour de bon) la silhouette en scanlines prend le relais : jamais
 * d'écran vide, jamais d'exception qui remonte au chat.
 *
 * `data-state` : `loading` (silhouette en attendant le modèle), `ready` (buste 3D à l'écran) ou
 * `fallback` (silhouette définitive).
 */
import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { DEFAULT_PERSONA, type RemiBustProps, type RemiBustVariant } from './contract'
import type { BustDebug } from './bust/BustScene'
import { Silhouette } from './bust/Silhouette'
import { hasWebGL } from './bust/env'
import { fadeMask, type Framing } from './bust/framing'

const BustCanvas = lazy(() => import('./bust/BustCanvas'))

/** Contexte WebGL perdu : on attend sa restauration, puis on remonte un nouveau `<Canvas>` (2 fois au plus). */
const CONTEXT_RESTORE_WAIT_MS = 1500
const MAX_REMOUNTS = 2

/** Position du fondu avant que le modèle ne soit mesuré (puis remplacée par le vrai cadre). */
const DEFAULT_LAYOUT: Record<RemiBustVariant, { cut: number; fadeEnd: number }> = {
  split: { cut: 0.86, fadeEnd: 1 },
  fullscreen: { cut: 0.5, fadeEnd: 0.6 },
}

/** Attrape toute erreur de rendu autour du bloc 3D (chargement de son code, création du contexte WebGL) : repli propre. */
class BustBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.warn('[Rémi · buste] rendu 3D indisponible, silhouette de repli', error)
    this.props.onFail()
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

/** Réglages de mise au point de la page `dev/bust-demo.html` ; absents en production. */
export interface RemiBustViewProps extends RemiBustProps {
  debug?: BustDebug
}

export function RemiBust({ mood, variant, character }: RemiBustProps) {
  return <RemiBustView mood={mood} variant={variant} character={character} />
}

export function RemiBustView({ mood, variant, character = DEFAULT_PERSONA, debug }: RemiBustViewProps) {
  const [supported] = useState(hasWebGL)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [lost, setLost] = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  const [framing, setFraming] = useState<Framing | null>(null)
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remounts = useRef(0)

  const clearRestoreTimer = useCallback(() => {
    if (restoreTimer.current !== null) clearTimeout(restoreTimer.current)
    restoreTimer.current = null
  }, [])
  useEffect(() => clearRestoreTimer, [clearRestoreTimer])

  const onReady = useCallback(() => setReady(true), [])
  const onFail = useCallback(() => setFailed(true), [])
  const onModelError = useCallback((error: unknown) => {
    console.warn('[Rémi · buste] modèle 3D indisponible, silhouette de repli', error)
    setFailed(true)
  }, [])
  const onContextLost = useCallback(() => {
    setLost(true)
    clearRestoreTimer()
    restoreTimer.current = setTimeout(() => {
      restoreTimer.current = null
      if (remounts.current >= MAX_REMOUNTS) {
        setFailed(true)
        return
      }
      remounts.current += 1
      setReady(false)
      setLost(false)
      setCanvasKey((k) => k + 1)
    }, CONTEXT_RESTORE_WAIT_MS)
  }, [clearRestoreTimer])
  const onContextRestored = useCallback(() => {
    clearRestoreTimer()
    setLost(false)
  }, [clearRestoreTimer])

  const state = !supported || failed ? 'fallback' : ready && !lost ? 'ready' : 'loading'
  const defaults = DEFAULT_LAYOUT[variant]
  const mask = fadeMask(framing ?? { cutFraction: defaults.cut, fadeEndFraction: defaults.fadeEnd })

  const root: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    // Aucun fond ni halo : le canvas du buste est transparent, c'est le musée du jeu qui passe derrière Rémi.
    // Seul le liseré cyan du contre-jour (matériau du modèle) reste sur le personnage.
  }
  // Le corps s'estompe sous la coupe à mi-torse (masque CSS : le canvas reste transparent).
  const layer: CSSProperties = { position: 'absolute', inset: 0, maskImage: mask, WebkitMaskImage: mask }

  return (
    <div data-testid="remi-bust" data-character={character} data-mood={mood} data-variant={variant} data-state={state} aria-hidden="true" style={root}>
      {supported && !failed && (
        <div style={layer}>
          <BustBoundary key={canvasKey} onFail={onFail}>
            <Suspense fallback={null}>
              <BustCanvas
                mood={mood}
                variant={variant}
                character={character}
                debug={debug}
                onFraming={setFraming}
                onReady={onReady}
                onError={onModelError}
                onContextLost={onContextLost}
                onContextRestored={onContextRestored}
              />
            </Suspense>
          </BustBoundary>
        </div>
      )}
      <Silhouette variant={variant} mask={mask} hidden={state === 'ready'} />
    </div>
  )
}
