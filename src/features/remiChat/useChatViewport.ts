/**
 * Mesures de la fenêtre utiles au chat (V5, WEL-920) : mise en page (PC coupé en deux ou téléphone plein
 * écran) et zone réellement visible quand le clavier virtuel est ouvert. Propriétaire : agent chat-ui.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'

/** Écran assez large ET en paysage : Rémi à gauche, chat à droite. Tout le reste : Rémi plein écran. */
export const SPLIT_QUERY = '(min-width: 900px) and (orientation: landscape)'

function subscribeSplit(onChange: () => void): () => void {
  try {
    const mq = window.matchMedia?.(SPLIT_QUERY)
    mq?.addEventListener('change', onChange)
    return () => mq?.removeEventListener('change', onChange)
  } catch {
    return () => {}
  }
}

function splitSnapshot(): boolean {
  try {
    return window.matchMedia?.(SPLIT_QUERY).matches === true
  } catch {
    return false
  }
}

/** Vrai pour la mise en page « PC coupé en deux » ; se met à jour à la rotation et au redimensionnement. */
export function useSplitLayout(): boolean {
  return useSyncExternalStore(subscribeSplit, splitSnapshot, () => false)
}

/** Un clavier virtuel prend au moins ~150 px : en dessous, la différence vient d'une barre d'adresse qui se replie. */
const KEYBOARD_MIN_PX = 120

export interface VisibleFrame {
  /** Clavier virtuel ouvert : le chat doit tenir dans la zone visible (`top`, `height`). */
  keyboard: boolean
  top: number
  height: number
}

export interface VisualViewportLike {
  height: number
  offsetTop: number
  scale: number
}

export const NO_KEYBOARD: VisibleFrame = { keyboard: false, top: 0, height: 0 }

/**
 * Zone visible du chat, d'après `visualViewport`. Sur iOS comme sur Android, le clavier ne redimensionne pas la
 * page : il réduit seulement la fenêtre visuelle (et iOS la décale en `offsetTop` pour montrer le champ).
 * Pure : testée sans navigateur.
 */
export function visibleFrame(viewport: VisualViewportLike | null | undefined, innerHeight: number): VisibleFrame {
  if (!viewport) return NO_KEYBOARD
  // Page zoomée au pincement : la fenêtre visuelle est plus petite sans qu'il y ait de clavier.
  if (viewport.scale > 1.01) return NO_KEYBOARD
  if (innerHeight - viewport.height < KEYBOARD_MIN_PX) return NO_KEYBOARD
  return { keyboard: true, top: Math.max(0, Math.round(viewport.offsetTop)), height: Math.round(viewport.height) }
}

/** Zone visible suivie en continu tant que `active` est vrai (chat ouvert). */
export function useVisibleFrame(active: boolean): VisibleFrame {
  const [frame, setFrame] = useState<VisibleFrame>(NO_KEYBOARD)

  useEffect(() => {
    if (!active) return
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      const next = visibleFrame(viewport, window.innerHeight)
      setFrame((prev) => (prev.keyboard === next.keyboard && prev.top === next.top && prev.height === next.height ? prev : next))
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      setFrame(NO_KEYBOARD)
    }
  }, [active])

  return active ? frame : NO_KEYBOARD
}
