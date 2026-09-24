/**
 * Bulle de dialogue façon jeu cosy : le texte s'écrit lettre par lettre,
 * tap/clic/Entrée/Espace termine la ligne en cours ou fait avancer le dialogue.
 */
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../state/gameStore'
import { useT, usePick } from '../i18n'
import { strings } from './strings'
import './ui.css'

const CHARS_PER_SECOND = 40

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  } catch {
    return false
  }
}

export function DialogueBox() {
  const dialogue = useGame((s) => s.dialogue)
  const dialogueIndex = useGame((s) => s.dialogueIndex)
  const advanceDialogue = useGame((s) => s.advanceDialogue)
  const closeDialogue = useGame((s) => s.closeDialogue)
  const t = useT(strings)
  const p = usePick()

  const line = dialogue?.lines[dialogueIndex] ?? null
  const fullText = line ? p(line.text) : ''
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? fullText.length : 0))

  // Refs pour lire l'état courant depuis le gestionnaire clavier global sans le recréer à chaque frappe.
  const shownRef = useRef(shown)
  shownRef.current = shown
  const fullTextRef = useRef(fullText)
  fullTextRef.current = fullText

  useEffect(() => {
    if (!line) return
    if (prefersReducedMotion()) {
      setShown(fullText.length)
      return
    }
    setShown(0)
    const stepMs = 1000 / CHARS_PER_SECOND
    const id = window.setInterval(() => {
      setShown((n) => (n >= fullText.length ? n : n + 1))
    }, stepMs)
    return () => window.clearInterval(id)
    // La ligne courante est identifiée par le dialogue + son index : c'est ce qui doit relancer la frappe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogue?.id, dialogueIndex])

  const advance = () => {
    if (shownRef.current < fullTextRef.current.length) {
      setShown(fullTextRef.current.length)
      return
    }
    advanceDialogue()
  }

  useEffect(() => {
    if (!dialogue) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogue])

  if (!dialogue || !line) return null

  const complete = shown >= fullText.length
  const displayed = fullText.slice(0, shown)

  return (
    <div className="ui-dialogue" data-testid="dialogue-box" onClick={advance}>
      <div className="ui-dialogue__bubble">
        <span className="ui-dialogue__speaker">{p(dialogue.speaker)}</span>
        <p className="ui-dialogue__text">
          {/* Effet machine à écrire visible, caché des lecteurs d'écran. */}
          <span aria-hidden="true">{displayed}</span>
          {complete && (
            <span className="ui-dialogue__caret" aria-hidden="true">
              ▼
            </span>
          )}
          {/* N'annonce qu'une fois la ligne entièrement affichée, au lieu de réannoncer
              la phrase à chaque lettre (~40 fois/seconde) via `aria-live`. */}
          <span className="ui-sr-only" aria-live="polite">
            {complete ? fullText : ''}
          </span>
        </p>
      </div>
      <button
        type="button"
        className="ui-dialogue__skip"
        onClick={(e) => {
          e.stopPropagation()
          closeDialogue()
        }}
      >
        {t('dialogueSkip')}
      </button>
    </div>
  )
}
