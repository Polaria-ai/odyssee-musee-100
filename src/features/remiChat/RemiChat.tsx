/**
 * Chat avec Rémi · IA (V5, WEL-920) et avec l'Archiviste · IA (WEL-929) : surimpression plein écran qui remplace le
 * dialogue scripté de Rémi au comptoir (« Parler à Rémi ») ou celui de l'Archiviste (« Parler à l'Archiviste »).
 * L'accueil de l'entrée reste la bulle scriptée en bas de l'écran (`App.tsx`). Propriétaire : agent chat-ui.
 *
 * UN SEUL composant pour les deux personnages : `PersonaChat` lit sa configuration dans `PERSONAS` (`personas.ts` :
 * nom, mention IA, accueil, puces, personnage du buste, accent de couleur). `RemiChat` et `ArchivisteChat` n'en
 * sont que deux instances ; `AiChats` les monte ensemble pour que chacune garde son fil pendant toute la partie.
 *
 * Le chat est translucide : le musée (le canvas du jeu, figé pendant le chat) reste visible derrière le buste et derrière
 * les bulles, sous un voile sombre léger qui garantit la lisibilité (voir `remiChat.css`).
 *
 * - PC (largeur ≥ 900 px ET paysage) : écran coupé en deux, le buste à gauche, le chat à droite.
 * - Téléphone (tout le reste) : le buste en fond plein écran, les bulles par-dessus sur le bas,
 *   la saisie en bas. Le clavier virtuel est géré par `visualViewport` (la saisie reste au-dessus).
 *
 * Chaque instance reste montée pendant la partie et ne rend rien tant que SON chat est fermé : le fil de messages
 * (état de `useRemiChat`) survit donc aux fermetures. Ouvrir/fermer : `openChat(persona)` (ou `openRemiChat`) et
 * `closeRemiChat` (`src/state/gameStore.ts`) ; un seul chat est ouvert à la fois, donc les `data-testid` `remi-chat*`
 * désignent toujours celui de la persona ouverte (`data-persona` sur la racine dit laquelle). Le buste est `RemiBust`
 * (autre module) ; son humeur suit la conversation.
 */
import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { useGame } from '../../state/gameStore'
import { usePick, useT } from '../../i18n'
import { playSfx } from '../../audio'
import { MAX_USER_MESSAGE_CHARS, type ChatPersona } from './contract'
import { PERSONAS } from './personas'
import { RemiBust } from './RemiBust'
import { strings } from './strings'
import { useRemiChat, type ChatEntry } from './useRemiChat'
import { useSplitLayout, useVisibleFrame } from './useChatViewport'
import type { Localized } from '../../types'
import './remiChat.css'

/** Hauteur maximale (px) du champ de saisie avant qu'il ne défile. */
const MAX_INPUT_HEIGHT = 128
/** Marge (px) sous laquelle le fil est considéré comme collé en bas. */
const STICK_THRESHOLD = 64

const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

/** Le chat d'une persona : ouvert quand un chat est ouvert (`remiChatOpen`) ET que c'est le sien (`chatPersona`). */
export function PersonaChat({ persona }: { persona: ChatPersona }) {
  const config = PERSONAS[persona]
  const open = useGame((s) => s.remiChatOpen && s.chatPersona === persona)
  const closeRemiChat = useGame((s) => s.closeRemiChat)
  const t = useT(strings)
  const text = usePick()
  const split = useSplitLayout()
  const frame = useVisibleFrame(open)
  const chat = useRemiChat(open, persona)
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

  // Ouverture : focus sur la saisie, sauf sur téléphone devant un fil vide (le clavier ne doit pas surgir sur le
  // premier message de Rémi et les suggestions, ni cacher le musée) ; à la fermeture, le focus retourne où il était.
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

  // Échap ferme le chat. Écouteur posé dans le même cycle que l'affichage (useLayoutEffect) : avec un
  // useEffect, sur un appareil lent, un Échap pressé dès l'apparition du chat arrivait avant l'écouteur
  // et restait sans effet (reproduit sous processeur ralenti ×6 : 3 échecs sur 5, CI Android).
  useLayoutEffect(() => {
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
      data-persona={persona}
      data-accent={config.accent}
      data-layout={split ? 'split' : 'overlay'}
      data-mood={chat.mood}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onRootKeyDown}
    >
      <div className="remi-chat__stage" data-testid="remi-chat-stage" aria-hidden="true">
        <RemiBust mood={chat.mood} variant={split ? 'split' : 'fullscreen'} character={config.character} />
      </div>

      <div className="remi-chat__frame" data-testid="remi-chat-frame" data-keyboard={frame.keyboard} style={frameStyle}>
        <header className="remi-chat__header">
          <div className="remi-chat__heading">
            <h2 id={titleId} className="remi-chat__title">
              {text(config.title)}
            </h2>
            <p className="remi-chat__notice">{text(config.aiNotice)}</p>
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
            aria-label={text(config.threadLabel)}
            tabIndex={0}
            onScroll={onScroll}
          >
            <ul className="remi-chat__list" aria-busy={busy}>
              {entries.map((entry) => (
                <ChatBubble key={entry.id} entry={entry} author={config.author} last={entry.id === lastId} busy={busy} onRetry={retry} />
              ))}
            </ul>
            {busy && (
              <div className="remi-chat__typing" data-testid="remi-chat-typing">
                <span className="remi-chat__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {text(config.typing)}
              </div>
            )}
          </div>

          {/* Annonce un message de Rémi une fois terminé, jamais à chaque morceau du flux. */}
          <div className="remi-chat__sr" aria-live="polite" aria-atomic="true" data-testid="remi-chat-live">
            {chat.announcement?.text ?? ''}
          </div>

          {chat.showSuggestions && (
            <div className="remi-chat__suggestions" role="group" aria-label={t('suggestionsLabel')}>
              {config.suggestions.map((suggestion) => (
                <button
                  key={suggestion.fr}
                  type="button"
                  className="remi-chat__chip"
                  data-testid="remi-chat-suggestion"
                  onClick={() => submit(text(suggestion))}
                >
                  {text(suggestion)}
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
                aria-label={text(config.inputLabel)}
                aria-describedby={counterId}
                aria-invalid={chat.overLimit}
                placeholder={chat.ended ? t('inputPlaceholderEnded') : text(config.inputPlaceholder)}
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

function ChatBubble({
  entry,
  author,
  last,
  busy,
  onRetry,
}: {
  entry: ChatEntry
  author: Localized
  last: boolean
  busy: boolean
  onRetry: () => void
}) {
  const t = useT(strings)
  const text = usePick()
  return (
    <li className="remi-chat__item" data-role={entry.role} data-kind={entry.kind} data-last={last || undefined}>
      <span className="remi-chat__sr">{entry.role === 'user' ? t('authorUser') : text(author)}</span>
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

/** Le chat de Rémi · IA (au comptoir du hall). */
export function RemiChat() {
  return <PersonaChat persona="remi" />
}

/** Le chat de l'Archiviste · IA (dans les Archives de 2040). */
export function ArchivisteChat() {
  return <PersonaChat persona="archiviste" />
}

/** Les chats de la partie, montés ensemble : chacun garde son fil (état de son `useRemiChat`) jusqu'à la fin de la session. */
export function AiChats() {
  return (
    <>
      <RemiChat />
      <ArchivisteChat />
    </>
  )
}
