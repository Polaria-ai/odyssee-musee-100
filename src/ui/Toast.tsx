/** Bulle éphémère en haut de l'écran. */
import { useEffect } from 'react'
import { useGame } from '../state/gameStore'
import { usePick } from '../i18n'
import './ui.css'

export function Toast() {
  const toast = useGame((s) => s.toast)
  const clearToast = useGame((s) => s.clearToast)
  const p = usePick()

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => clearToast(), toast.duration)
    return () => window.clearTimeout(id)
  }, [toast, clearToast])

  if (!toast) return null

  return (
    <div className="ui-toast" data-testid="toast" role="status" aria-live="polite">
      {p(toast.text)}
    </div>
  )
}
