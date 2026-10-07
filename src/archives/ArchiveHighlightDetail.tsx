import type { ArchiveHighlight } from '../types'
import { usePick, useT } from '../i18n'
import { cardStrings } from './cardStrings'
import { formatRecordingTime } from './ArchiveHighlights'

/** Le thème choisi est présenté en premier, avec son passage exact immédiatement lisible. */
export function ArchiveHighlightDetail({ sessionId, highlight, onShowAll }: {
  sessionId: string
  highlight: ArchiveHighlight
  onShowAll: () => void
}) {
  const t = useT(cardStrings)
  const p = usePick()
  const { startSec, endSec } = highlight.source
  const hasStart = startSec !== undefined && Number.isFinite(startSec) && startSec >= 0
  const hasEnd = hasStart && endSec !== undefined && Number.isFinite(endSec) && endSec >= startSec
  const time = hasStart
    ? `${formatRecordingTime(startSec)}${hasEnd ? ` – ${formatRecordingTime(endSec)}` : ''}`
    : null
  return (
    <section data-testid="archive-highlight-detail" data-session-id={sessionId} data-highlight-id={highlight.id} className="archive-highlight-detail">
      <p className="archive-highlight-detail__body">{p(highlight.body)}</p>
      <h3 className="archive-card__section-title">{t('archiveFocusedSourceTitle')}</h3>
      {time !== null && <p className="archive-highlights__time">{t('archiveHighlightSourceTime', { time })}</p>}
      <blockquote data-testid="archive-focused-source" lang="fr" className="archive-highlights__source">{highlight.source.excerpt}</blockquote>
      <button type="button" data-testid="archive-all-highlights" className="archive-highlight-detail__all" onClick={onShowAll}>
        {t('archiveAllHighlights')}
      </button>
    </section>
  )
}
