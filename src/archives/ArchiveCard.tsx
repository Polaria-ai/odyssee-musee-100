/**
 * Fiche de la séquence ouverte (`openSessionId`) : programme de la soirée, puis synthèse de
 * l'Archiviste et citations une fois l'archive déposée et publiée. Même famille que la fiche
 * portrait (`src/ui/PortraitCard.tsx`, feuille qui monte du bas, glisser pour fermer), habillage
 * « archive de 2040 » (bandeau bleu nuit, liseré cyan, tampon).
 *
 * Tant qu'aucune archive publiée n'existe pour la séquence, aucun contenu n'est inventé : un
 * encart d'attente est affiché à la place de la synthèse et des citations.
 */
import { useEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react'
import { useGame } from '../state/gameStore'
import { useT, usePick } from '../i18n'
import { cardStrings } from './cardStrings'
import { splitParagraphs } from '../ui/format'
import type { EveningSession, SessionKind } from '../types'
import { playSfx } from '../audio'
import './archives.css'

const SWIPE_CLOSE_THRESHOLD = 90

/** Pictogramme par type de séquence. Purement décoratif : le libellé accessible vient de `cardStrings`. */
const KIND_ICON: Record<SessionKind, string> = {
  ouverture: '✨',
  film: '🎬',
  presentation: '🎤',
  keynote: '🎙️',
  les100: '💯',
  magneto: '📊',
  'table-ronde': '🗣️',
  'face-a-face': '🤝',
  final: '🚀',
  cloture: '👋',
}

const KIND_LABEL_KEY: Record<SessionKind, keyof typeof cardStrings> = {
  ouverture: 'archiveKindOuverture',
  film: 'archiveKindFilm',
  presentation: 'archiveKindPresentation',
  keynote: 'archiveKindKeynote',
  les100: 'archiveKindLes100',
  magneto: 'archiveKindMagneto',
  'table-ronde': 'archiveKindTableRonde',
  'face-a-face': 'archiveKindFaceAFace',
  final: 'archiveKindFinal',
  cloture: 'archiveKindCloture',
}

export function ArchiveCard() {
  const openSessionId = useGame((s) => s.openSessionId)
  const sessions = useGame((s) => s.sessions)
  const archives = useGame((s) => s.archives)
  const closeSession = useGame((s) => s.closeSession)
  const openSession = useGame((s) => s.openSession)
  const t = useT(cardStrings)
  const p = usePick()

  const titleRef = useRef<HTMLHeadingElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ startY: 0, active: false })
  const wasOpenRef = useRef(false)

  const session: EveningSession | null = openSessionId ? (sessions.find((s) => s.id === openSessionId) ?? null) : null

  useEffect(() => {
    // Même précaution que la fiche portrait : `preventScroll` évite que le focus natif ne fasse
    // défiler la feuille pour amener le titre dans le viewport (écran paysage bas, voir WEL-863).
    if (session) titleRef.current?.focus({ preventScroll: true })
    // Ne réagit qu'au changement de séquence affichée, pas à chaque nouvelle référence de `session`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  // Son d'ouverture/fermeture sur la transition fermé↔ouvert, pas sur la navigation précédent/suivant.
  useEffect(() => {
    const isOpen = session !== null
    if (isOpen && !wasOpenRef.current) playSfx('open')
    if (!isOpen && wasOpenRef.current) playSfx('close')
    wasOpenRef.current = isOpen
  }, [session])

  useEffect(() => {
    if (!session) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSession()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, closeSession])

  if (!session) return null

  const ordered = [...sessions].sort((a, b) => a.order - b.order)
  const idx = ordered.findIndex((s) => s.id === session.id)
  const prevSession = idx > 0 ? ordered[idx - 1] : null
  const nextSession = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null

  const archive = archives[session.id]
  const published = archive?.published === true
  const summaryParagraphs = published && archive ? splitParagraphs(p(archive.summary)) : []

  function handleTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    if ((sheetRef.current?.scrollTop ?? 0) > 0) {
      dragRef.current.active = false
      return
    }
    dragRef.current = { startY: e.touches[0].clientY, active: true }
  }

  function handleTouchMove(e: ReactTouchEvent<HTMLDivElement>) {
    if (!dragRef.current.active || !sheetRef.current) return
    const delta = e.touches[0].clientY - dragRef.current.startY
    if (delta > 0) sheetRef.current.style.transform = `translateY(${Math.min(delta, 240)}px)`
  }

  function handleTouchEnd(e: ReactTouchEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return
    const delta = e.changedTouches[0].clientY - dragRef.current.startY
    if (sheetRef.current) sheetRef.current.style.transform = ''
    dragRef.current.active = false
    if (delta > SWIPE_CLOSE_THRESHOLD) closeSession()
  }

  return (
    <div className="archive-card" data-testid="archive-card" role="dialog" aria-modal="true" aria-labelledby="archive-card-title">
      <button type="button" className="archive-card__backdrop" aria-label={t('archiveClose')} onClick={closeSession} />
      <div
        className="archive-card__sheet"
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="archive-card__handle" aria-hidden="true" />

        <div className="archive-card__band">
          <span className="archive-card__stamp">{t('archiveStamp')}</span>
        </div>

        <button
          type="button"
          className="archive-card__close"
          data-testid="archive-close"
          aria-label={t('archiveClose')}
          onClick={() => {
            playSfx('click')
            closeSession()
          }}
        >
          ✕
        </button>

        <p className="archive-card__meta">
          <span className="archive-card__kind">
            <span aria-hidden="true">{KIND_ICON[session.kind]}</span> {t(KIND_LABEL_KEY[session.kind])}
          </span>
          <span className="archive-card__time">{t('archiveTime', { time: session.startTime, duration: session.durationMin })}</span>
        </p>

        <h2 id="archive-card-title" className="archive-card__title" ref={titleRef} tabIndex={-1}>
          {p(session.title)}
        </h2>

        {session.theme && <p className="archive-card__theme">{p(session.theme)}</p>}

        {session.provisional && <p className="archive-card__provisional">{t('archiveProvisional')}</p>}

        {session.speakers.length > 0 && (
          <div className="archive-card__speakers">
            <h3 className="archive-card__section-title">{t('archiveSpeakersTitle')}</h3>
            <ul>
              {session.speakers.map((speaker, i) => (
                // Intervenant·es d'une séquence fixe (programme), jamais réordonnés : la clé d'index est stable.
                <li key={`${session.id}-speaker-${i}`}>
                  <span className="archive-card__speaker-name">{speaker.name}</span>
                  {(speaker.role || speaker.organization) && (
                    <span className="archive-card__speaker-role">
                      {' · '}
                      {speaker.role ? p(speaker.role) : null}
                      {speaker.role && speaker.organization ? ' · ' : null}
                      {speaker.organization}
                    </span>
                  )}
                  {speaker.moderator && <span className="archive-card__speaker-moderator"> {t('archiveModerator')}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {published && archive ? (
          <>
            {summaryParagraphs.length > 0 && (
              <div className="archive-card__summary">
                <h3 className="archive-card__section-title">{t('archiveSummaryTitle')}</h3>
                {summaryParagraphs.map((paragraph, i) => (
                  <p key={`${session.id}-summary-${i}`}>{paragraph}</p>
                ))}
              </div>
            )}
            {archive.quotes.length > 0 && (
              <div className="archive-card__quotes">
                <h3 className="archive-card__section-title">{t('archiveQuotesTitle')}</h3>
                {archive.quotes.map((quote, i) => (
                  <blockquote className="archive-card__quote" key={`${session.id}-quote-${i}`}>
                    <p>“{p(quote.text)}”</p>
                    <footer>
                      {quote.author}
                      {quote.verified && <span className="archive-card__quote-verified">{t('archiveQuoteVerified')}</span>}
                    </footer>
                  </blockquote>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="archive-card__pending" data-testid="archive-pending">
            <p className="archive-card__pending-title">{t('archivePendingTitle')}</p>
            <p>{t('archivePendingBody')}</p>
          </div>
        )}

        <div className="archive-card__nav">
          <button
            type="button"
            data-testid="archive-prev"
            aria-label={t('archivePrevLabel')}
            disabled={!prevSession}
            onClick={() => {
              if (!prevSession) return
              playSfx('click')
              openSession(prevSession.id)
            }}
          >
            {t('archivePrev')}
          </button>
          <button
            type="button"
            data-testid="archive-next"
            aria-label={t('archiveNextLabel')}
            disabled={!nextSession}
            onClick={() => {
              if (!nextSession) return
              playSfx('click')
              openSession(nextSession.id)
            }}
          >
            {t('archiveNext')}
          </button>
        </div>
      </div>
    </div>
  )
}
