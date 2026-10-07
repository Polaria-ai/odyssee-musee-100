import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchiveHighlight } from '../types'
import { useGame } from '../state/gameStore'
import { ArchiveHighlightDetail } from './ArchiveHighlightDetail'

const highlight: ArchiveHighlight = {
  id: 'fixture-detail',
  title: { fr: 'Idée fictive', en: 'Fictional idea' },
  body: { fr: 'Résumé fictif de test.', en: 'Fictional test summary.' },
  source: { excerpt: 'Passage source fictif exact.\nDeuxième ligne conservée.', startSec: 0, endSec: 70.9 },
}

describe('ArchiveHighlightDetail', () => {
  beforeEach(() => useGame.setState({ lang: 'fr' }))

  it('présente le résumé et la source exacte immédiatement, sans bouton de déploiement', () => {
    const showAll = vi.fn()
    render(<ArchiveHighlightDetail sessionId="fixture-panel" highlight={highlight} onShowAll={showAll} />)
    expect(screen.getByText(highlight.body.fr)).toBeInTheDocument()
    expect(screen.getByTestId('archive-highlight-detail')).toHaveAttribute('data-session-id', 'fixture-panel')
    const source = screen.getByTestId('archive-focused-source')
    expect(source).toBeVisible()
    expect(source.textContent).toBe(highlight.source.excerpt)
    expect(source).toHaveAttribute('lang', 'fr')
    expect(screen.getByText('Dans l’enregistrement · 00:00:00 – 00:01:10')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tous les thèmes et la transcription' }))
    expect(showAll).toHaveBeenCalledOnce()
  })

  it('traduit le résumé et annonce la source française, avec repli français pour un résumé non traduit', () => {
    useGame.setState({ lang: 'en' })
    const { rerender } = render(<ArchiveHighlightDetail sessionId="fixture" highlight={highlight} onShowAll={vi.fn()} />)
    expect(screen.getByText(highlight.body.en)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Source passage · FR' })).toBeInTheDocument()
    expect(screen.getByTestId('archive-focused-source').textContent).toBe(highlight.source.excerpt)
    rerender(<ArchiveHighlightDetail sessionId="fixture" highlight={{ ...highlight, body: { ...highlight.body, en: '' } }} onShowAll={vi.fn()} />)
    expect(screen.getByText(highlight.body.fr)).toBeInTheDocument()
  })

  it.each([{}, { startSec: -1 }, { startSec: Number.NaN }, { endSec: 30 }])('ne fabrique pas de repère temporel à partir de %o', (time) => {
    render(<ArchiveHighlightDetail sessionId="fixture" highlight={{ ...highlight, source: { excerpt: highlight.source.excerpt, ...time } }} onShowAll={vi.fn()} />)
    expect(screen.queryByText(/Dans l’enregistrement/)).not.toBeInTheDocument()
  })

  it('rend le corps et le passage comme du texte sans interpréter de HTML', () => {
    const content = '<img src=x onerror=alert(1)>'
    const { container } = render(<ArchiveHighlightDetail sessionId="fixture" highlight={{ ...highlight, body: { fr: content, en: '' }, source: { excerpt: content } }} onShowAll={vi.fn()} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByTestId('archive-focused-source').textContent).toBe(content)
  })
})
