/**
 * Capacités de l'environnement du buste : WebGL disponible, onglet visible, `prefers-reduced-motion`.
 * Tout est protégé (jsdom, navigateurs anciens, contextes bloqués) : aucune exception ne sort d'ici.
 */
import { useSyncExternalStore } from 'react'

let webglOk = false

/**
 * Un contexte WebGL2 (celui qu'exige three) peut-il être créé ? Sonde jetable, libérée aussitôt pour
 * ne pas entamer le quota de contextes du navigateur. Les constructeurs WebGL absents (jsdom) répondent
 * « non » sans appeler `getContext`, qui y journaliserait une erreur « Not implemented ».
 * Seul un « oui » est mémorisé : un « non » est resondé au prochain montage.
 */
export function hasWebGL(): boolean {
  if (webglOk) return true
  if (typeof document === 'undefined' || typeof WebGL2RenderingContext === 'undefined') return false
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    webglOk = true
  } catch {
    return false
  }
  return true
}

function subscribeMedia(query: string, onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const list = window.matchMedia(query)
  list.addEventListener?.('change', onChange)
  return () => list.removeEventListener?.('change', onChange)
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** `prefers-reduced-motion: reduce`, à jour si le réglage change pendant la session. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeMedia(REDUCED_MOTION_QUERY, onChange),
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches === true,
    () => false,
  )
}

/** L'onglet est-il visible ? Quand il est caché, la boucle de rendu du buste est suspendue. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof document === 'undefined') return () => {}
      document.addEventListener('visibilitychange', onChange)
      return () => document.removeEventListener('visibilitychange', onChange)
    },
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    () => true,
  )
}
