/**
 * Bulles thématiques d'une table ronde. Les résumés sont accompagnés d'un passage exact de la
 * transcription française ; les repères facultatifs sont comptés depuis le début de l'enregistrement.
 * La fiche parente ne monte ce composant que pour une archive publiée.
 */
import { useId, useState } from 'react'
import type { ArchiveHighlight } from '../types'
import { usePick, useT } from '../i18n'
import { cardStrings } from './cardStrings'

/** Repère de lecture, sans arrondir une seconde vers le passage suivant. */
export function formatRecordingTime(seconds: number): string {
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remaining = total % 60
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, '0')).join(':')
}

export function ArchiveHighlights({ highlights }: { highlights?: readonly ArchiveHighlight[] }) {
  const t = useT(cardStrings)
  const p = usePick()
  const idPrefix = useId()
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set())

  if (!highlights?.length) return null

  function toggle(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="archive-highlights" data-testid="archive-highlights" aria-labelledby={`${idPrefix}-title`}>
      <h3 id={`${idPrefix}-title`} className="archive-card__section-title">{t('archiveHighlightsTitle')}</h3>
      <ol className="archive-highlights__list">
        {highlights.map((highlight, index) => {
          const expanded = expandedIds.has(highlight.id)
          const sourceId = `${idPrefix}-source-${index}`
          const titleId = `${idPrefix}-highlight-${index}`
          const { startSec, endSec } = highlight.source
          const hasStart = typeof startSec === 'number' && Number.isFinite(startSec) && startSec >= 0
          const hasEnd = hasStart && typeof endSec === 'number' && Number.isFinite(endSec) && endSec >= startSec
          const time = hasStart
            ? `${formatRecordingTime(startSec)}${hasEnd ? ` – ${formatRecordingTime(endSec)}` : ''}`
            : null

          return (
            <li className="archive-highlights__bubble" key={highlight.id} data-testid="archive-highlight">
              <article aria-labelledby={titleId}>
                <div className="archive-highlights__heading">
                  <span className="archive-highlights__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <h4 id={titleId} className="archive-highlights__title">{p(highlight.title)}</h4>
                </div>
                <p className="archive-highlights__body">{p(highlight.body)}</p>
                {time !== null && (
                  <p className="archive-highlights__time" data-testid="archive-highlight-time">
                    {t('archiveHighlightSourceTime', { time })}
                  </p>
                )}
                <button
                  type="button"
                  className="archive-highlights__source-toggle"
                  aria-expanded={expanded}
                  aria-controls={sourceId}
                  onClick={() => toggle(highlight.id)}
                >
                  {t(expanded ? 'archiveHighlightHideSource' : 'archiveHighlightShowSource')}
                  <span aria-hidden="true">{expanded ? '−' : '+'}</span>
                </button>
                <blockquote
                  id={sourceId}
                  className="archive-highlights__source"
                  data-testid="archive-highlight-source"
                  lang="fr"
                  hidden={!expanded}
                >
                  {highlight.source.excerpt}
                </blockquote>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
