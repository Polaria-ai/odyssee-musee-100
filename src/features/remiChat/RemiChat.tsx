/**
 * Chat avec Rémi · IA (V5, WEL-920) : surimpression plein écran qui remplace le dialogue scripté de Rémi.
 * Propriétaire : agent chat-ui.
 *
 * - PC (largeur ≥ 900 px ET paysage) : écran coupé en deux, le buste de Rémi à gauche, le chat à droite.
 * - Téléphone (tout le reste) : le buste de Rémi en fond plein écran, les bulles par-dessus sur le bas,
 *   la saisie en bas. Le clavier virtuel est géré par `visualViewport` (la saisie reste au-dessus).
 *
 * Le composant reste monté pendant la partie et ne rend rien tant que le chat est fermé : le fil de messages
 * (état de `useRemiChat`) survit donc aux fermetures. Ouvrir/fermer : `openRemiChat` / `closeRemiChat`
 * (`src/state/gameStore.ts`). Le buste est `RemiBust` (autre module) ; son humeur suit la conversation.
 */
import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { useGame } from '../../state/gameStore'
import { useT } from '../../i18n'
import { playSfx } from '../../audio'
import { MAX_USER_MESSAGE_CHARS } from './contract'
import { RemiBust } from './RemiBust'
import { strings } from './strings'
import { useRemiChat, type ChatEntry } from './useRemiChat'
import { useSplitLayout, useVisibleFrame } from './useChatViewport'
import './remiChat.css'

const SUGGESTION_KEYS = ['suggestionHow', 'suggestionWho', 'suggestionArchives', 'suggestionProgram'] as const

/** Hauteur maximale (px) du champ de saisie avant qu'il ne défile. */
const MAX_INPUT_HEIGHT = 128
/** Marge (px) sous laquelle le fil est considéré comme collé en bas. */
const STICK_THRESHOLD = 64

const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function RemiChat() {
  const open = useGame((s) => s.remiChatOpen)
  const closeRemiChat = useGame((s) => s.closeRemiChat)
  const t = useT(strings)
  const split = useSplitLayout()
  const frame = useVisibleFrame(open)
  const chat = useRemiChat(open)
  const { entries, phase, draft, send, retry } = chat
  const busy = phase !== 'idle'

  const titleId = useId()
  const counterId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  /** Le fil suit le bas tant que le visiteur ne l'a pas remonté à la main. */
  const stickRef = useRef(true)

  const close = () => {
    playSfx('click')
    closeRemiChat()
  }

  // Ouverture : focus sur la saisie, sauf à l'ouverture automatique de bienvenue sur téléphone (le clavier
  // ne doit pas surgir sur le message d'accueil) ; à la fermeture, le focus retourne où il était.
  useEffect(() => {
    if (!open) return
    stickRef.current = true
    const previous = document.activeElement
    if (!split && chat.openedEmpty) rootRef.current?.focus({ preventScroll: true })
    else inputRef.current?.focus({ preventScroll: true })
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
    // La mise en page (`split`) ne doit pas refaire le focus en cours de discussion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Échap ferme le chat.
  useEffect(() => {
    if (!open) return
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') closeRemiChat()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeRemiChat])

  // Le champ grandit avec le texte (jusqu'à MAX_INPUT_HEIGHT), puis défile.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    if (el.scrollHeight > 0) el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`
  }, [draft, open])

  // Le fil descend avec les nouveaux morceaux, sans jamais faire passer le début d'un long message
  // (l'accueil, une longue réponse) au-dessus du haut visible.
  useLayoutEffect(() => {
    const el = threadRef.current
    if (!el || !stickRef.current) return
    const last = el.querySelector<HTMLElement>('[data-last]')
    const bottom = el.scrollHeight - el.clientHeight
    const top = last ? last.offsetTop - 8 : bottom
    el.scrollTop = Math.max(0, Math.min(bottom, top))
  }, [entries, phase, open, frame.height])

  if (!open) return null

  const onScroll = () => {
    const el = threadRef.current
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
  }

  const submit = (text?: string) => {
    stickRef.current = true
    if (send(text)) playSfx('click')
  }

  // Entrée envoie (Maj+Entrée : retour à la ligne) ; la touche « envoyer » d'un clavier virtuel aussi.
  const onInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    submit()
  }

  // Le focus reste dans la boîte de dialogue (aria-modal).
  const onRootKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const nodes = rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!nodes || nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const frameStyle = frame.keyboard
    ? ({ '--chat-top': `${frame.top}px`, '--chat-height': `${frame.height}px` } as CSSProperties)
    : undefined

  const counterText = t(chat.overLimit ? 'counterOver' : 'counter', { n: chat.draftLength, max: MAX_USER_MESSAGE_CHARS })
  const lastId = entries.length > 0 ? entries[entries.length - 1].id : null

  return (
    <div
      ref={rootRef}
      className="remi-chat"
      data-testid="remi-chat"
      data-layout={split ? 'split' : 'overlay'}
      data-mood={chat.mood}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onRootKeyDown}
    >
      <div className="remi-chat__stage" data-testid="remi-chat-stage" aria-hidden="true">
        <RemiBust mood={chat.mood} variant={split ? 'split' : 'fullscreen'} />
      </div>

      <div className="remi-chat__frame" data-testid="remi-chat-frame" data-keyboard={frame.keyboard} style={frameStyle}>
        <header className="remi-chat__header">
          <div className="remi-chat__heading">
            <h2 id={titleId} className="remi-chat__title">
              {t('title')}
            </h2>
            <p className="remi-chat__notice">{t('aiNotice')}</p>
          </div>
          <button type="button" className="remi-chat__close" data-testid="remi-chat-close" aria-label={t('close')} onClick={close}>
            ✕
          </button>
        </header>

        <div className="remi-chat__panel">
          {/* Région défilante : focalisable au clavier (flèches, PageHaut/Bas) pour relire l'historique. */}
          <div
            ref={threadRef}
            className="remi-chat__thread"
            data-testid="remi-chat-thread"
            role="region"
            aria-label={t('threadLabel')}
            tabIndex={0}
            onScroll={onScroll}
          >
            <ul className="remi-chat__list" aria-busy={busy}>
              {entries.map((entry) => (
                <ChatBubble key={entry.id} entry={entry} last={entry.id === lastId} busy={busy} onRetry={retry} />
              ))}
            </ul>
            {busy && (
              <div className="remi-chat__typing" data-testid="remi-chat-typing">
                <span className="remi-chat__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {t('typing')}
              </div>
            )}
          </div>

          {/* Annonce un message de Rémi une fois terminé, jamais à chaque morceau du flux. */}
          <div className="remi-chat__sr" aria-live="polite" aria-atomic="true" data-testid="remi-chat-live">
            {chat.announcement?.text ?? ''}
          </div>

          {chat.showSuggestions && (
            <div className="remi-chat__suggestions" role="group" aria-label={t('suggestionsLabel')}>
              {SUGGESTION_KEYS.map((key) => (
                <button key={key} type="button" className="remi-chat__chip" data-testid="remi-chat-suggestion" onClick={() => submit(t(key))}>
                  {t(key)}
                </button>
              ))}
            </div>
          )}

          <form
            className="remi-chat__composer"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <div className="remi-chat__field">
              <textarea
                ref={inputRef}
                className="remi-chat__input"
                data-testid="remi-chat-input"
                data-over={chat.overLimit}
                aria-label={t('inputLabel')}
                aria-describedby={counterId}
                aria-invalid={chat.overLimit}
                placeholder={t(chat.ended ? 'inputPlaceholderEnded' : 'inputPlaceholder')}
                rows={1}
                enterKeyHint="send"
                autoComplete="off"
                disabled={chat.ended}
                value={draft}
                onChange={(e) => chat.setDraft(e.target.value)}
                onFocus={() => chat.setFocused(true)}
                onBlur={() => chat.setFocused(false)}
                onKeyDown={onInputKeyDown}
              />
              <span id={counterId} className="remi-chat__counter" data-testid="remi-chat-counter" data-empty={chat.draftLength === 0} data-over={chat.overLimit}>
                {counterText}
              </span>
            </div>
            {/* Le bouton ne prend pas le focus au toucher : le clavier virtuel reste ouvert après l'envoi. */}
            <button
              type="submit"
              className="remi-chat__send"
              data-testid="remi-chat-send"
              aria-label={t('send')}
              disabled={!chat.canSend}
              onPointerDown={(e) => e.preventDefault()}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function ChatBubble({ entry, last, busy, onRetry }: { entry: ChatEntry; last: boolean; busy: boolean; onRetry: () => void }) {
  const t = useT(strings)
  return (
    <li className="remi-chat__item" data-role={entry.role} data-kind={entry.kind} data-last={last || undefined}>
      <span className="remi-chat__sr">{t(entry.role === 'user' ? 'authorUser' : 'authorRemi')}</span>
      <p
        className="remi-chat__bubble"
        data-testid="remi-chat-message"
        data-role={entry.role}
        data-kind={entry.kind}
        data-fallback={entry.fallback || undefined}
        data-streaming={entry.streaming || undefined}
      >
        {entry.content}
      </p>
      {entry.retry && (
        <button type="button" className="remi-chat__retry" data-testid="remi-chat-retry" disabled={busy} onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </li>
  )
}
