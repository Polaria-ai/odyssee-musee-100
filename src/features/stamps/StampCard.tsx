// Propriétaire : agent avatar+tampons.
import { useEffect, useRef } from 'react'
import { useGame } from '../../state/gameStore'
import { useT, usePick } from '../../i18n'
import { EXHIBIT_WINGS } from '../../types'
import { strings, wingNames } from './strings'
import { archivesProgress, hasArchivesStamp, isCardComplete, wingProgress } from './stamps'
import { StampIcon } from './StampIcon'
import { shareCard } from './shareCard'
import './StampCard.css'

/** Carnet de tampons en surimpression (ouvert depuis le HUD, ou automatiquement à la complétion). */
export function StampCard() {
  const open = useGame((s) => s.stampCardOpen)
  const stamps = useGame((s) => s.stamps)
  const people = useGame((s) => s.people)
  const visited = useGame((s) => s.visited)
  const sessions = useGame((s) => s.sessions)
  const visitedSessions = useGame((s) => s.visitedSessions)
  const avatarName = useGame((s) => s.avatar.name)
  const lang = useGame((s) => s.lang)
  const setStampCardOpen = useGame((s) => s.setStampCardOpen)
  const t = useT(strings)
  const p = usePick()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setStampCardOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, setStampCardOpen])

  if (!open) return null

  const progress = wingProgress(people, visited)
  const totalSessions = sessions.length
  const archivesObtained = hasArchivesStamp(visitedSessions, totalSessions)
  const archivesWp = archivesProgress(visitedSessions, totalSessions)
  const complete = isCardComplete(stamps, people, { visitedSessions, totalSessions })

  return (
    <div className="stamp-card-backdrop" onClick={() => setStampCardOpen(false)}>
      <div
        className="stamp-card"
        data-testid="stamp-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stamp-card-title"
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="stamp-card__close"
          data-testid="stamp-close"
          aria-label={t('close')}
          onClick={() => setStampCardOpen(false)}
        >
          ✕
        </button>
        <h2 id="stamp-card-title" className="stamp-card__title">
          {t('title')}
        </h2>
        <div className="stamp-card__grid">
          {EXHIBIT_WINGS.map((wing) => {
            const obtained = Boolean(stamps[wing])
            const wp = progress[wing]
            return (
              <div className="stamp-card__slot" key={wing}>
                <StampIcon wing={wing} obtained={obtained} />
                <span className="stamp-card__wing-name">{p(wingNames[wing])}</span>
                <span className="stamp-card__progress">
                  {obtained ? t('obtained') : t('progress', { seen: wp.seen, total: wp.total })}
                </span>
              </div>
            )
          })}
          <div className="stamp-card__slot" key="archives">
            <StampIcon wing="archives" obtained={archivesObtained} />
            <span className="stamp-card__wing-name">{p(wingNames.archives)}</span>
            <span className="stamp-card__progress">
              {archivesObtained
                ? t('obtained')
                : totalSessions > 0
                  ? t('progressArchives', { seen: archivesWp.seen, total: archivesWp.total })
                  : t('archivesPending')}
            </span>
          </div>
        </div>
        {complete && (
          <button
            type="button"
            className="stamp-card__share"
            data-testid="stamp-share"
            onClick={() => {
              void shareCard({ avatarName, stamps, archivesObtained, lang })
            }}
          >
            {t('share')}
          </button>
        )}
      </div>
    </div>
  )
}
