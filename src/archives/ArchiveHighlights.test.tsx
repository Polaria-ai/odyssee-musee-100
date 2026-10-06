import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ArchiveHighlight } from '../types'
import { useGame } from '../state/gameStore'
import { ArchiveHighlights, formatRecordingTime } from './ArchiveHighlights'
import { cardStrings } from './cardStrings'

// Contenus entièrement fictifs, uniquement pour vérifier les bulles et leur passage source.
const highlights: ArchiveHighlight[] = [
  {
    id: 'fixture-infrastructures',
    title: { fr: 'Une idée de test', en: 'A test idea' },
    body: { fr: 'Un résumé fabriqué pour ce test.', en: 'A summary made up for this test.' },
    source: {
      excerpt: 'Ce passage source de test reste exact.\nSa deuxième ligne aussi.',
      startSec: 70.9,
      endSec: 93,
    },
  },
  {
    id: 'fixture-culture',
    title: { fr: 'Une autre idée de test', en: '' },
    body: { fr: 'Un deuxième résumé fictif.', en: '' },
    source: { excerpt: 'Un autre passage source de test, sans repère temporel.' },
  },
]

describe('formatRecordingTime', () => {
  it.each([
    [0, '00:00:00'],
    [8, '00:00:08'],
    [70.9, '00:01:10'],
    [3600, '01:00:00'],
    [6597, '01:49:57'],
  ])('formate %s secondes depuis le début de l’enregistrement', (seconds, expected) => {
    expect(formatRecordingTime(seconds)).toBe(expected)
  })
})

describe('ArchiveHighlights', () => {
  beforeEach(() => useGame.setState({ lang: 'fr' }))

  it('ne crée pas de section pour une ancienne archive sans bulles', () => {
    const { rerender } = render(<ArchiveHighlights />)
    expect(screen.queryByTestId('archive-highlights')).not.toBeInTheDocument()
    rerender(<ArchiveHighlights highlights={[]} />)
    expect(screen.queryByTestId('archive-highlights')).not.toBeInTheDocument()
  })

  it('affiche plusieurs bulles avec leurs titres et résumés', () => {
    render(<ArchiveHighlights highlights={highlights} />)
    expect(screen.getByRole('heading', { name: 'À retenir', level: 3 })).toBeInTheDocument()
    expect(screen.getAllByTestId('archive-highlight')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Une idée de test', level: 4 })).toBeInTheDocument()
    expect(screen.getByText('Un résumé fabriqué pour ce test.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Une autre idée de test', level: 4 })).toBeInTheDocument()
  })

  it('ouvre et referme un extrait exact indépendamment des autres bulles', () => {
    render(<ArchiveHighlights highlights={highlights} />)
    const [first, second] = screen.getAllByTestId('archive-highlight')
    const firstSource = within(first).getByTestId('archive-highlight-source')
    const secondSource = within(second).getByTestId('archive-highlight-source')
    const firstButton = within(first).getByRole('button', { name: 'Voir le passage source' })
    expect(firstSource).not.toBeVisible()
    expect(firstButton).toHaveAttribute('aria-expanded', 'false')
    expect(firstButton).toHaveAttribute('aria-controls', firstSource.id)

    fireEvent.click(firstButton)
    expect(firstSource).toBeVisible()
    expect(firstSource.textContent).toBe(highlights[0].source.excerpt)
    expect(firstSource).toHaveAttribute('lang', 'fr')
    expect(firstButton).toHaveAttribute('aria-expanded', 'true')
    expect(secondSource).not.toBeVisible()

    fireEvent.click(within(second).getByRole('button', { name: 'Voir le passage source' }))
    expect(secondSource).toBeVisible()
    fireEvent.click(within(first).getByRole('button', { name: 'Masquer le passage source' }))
    expect(firstSource).not.toBeVisible()
    expect(secondSource).toBeVisible()
  })

  it('ouvre un passage au clavier avec Entrée puis le ferme avec Espace', async () => {
    const user = userEvent.setup()
    render(<ArchiveHighlights highlights={[highlights[0]]} />)
    const button = screen.getByRole('button', { name: 'Voir le passage source' })
    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('archive-highlight-source')).toBeVisible()
    await user.keyboard(' ')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('indique les repères alignés depuis le début audio sans inventer les absents', () => {
    render(<ArchiveHighlights highlights={highlights} />)
    expect(screen.getAllByTestId('archive-highlight-time')).toHaveLength(1)
    expect(screen.getByTestId('archive-highlight-time')).toHaveTextContent('Dans l’enregistrement · 00:01:10 – 00:01:33')
    const second = screen.getAllByTestId('archive-highlight')[1]
    expect(within(second).queryByTestId('archive-highlight-time')).not.toBeInTheDocument()
  })

  it('affiche un repère au début audio même lorsqu’il vaut zéro', () => {
    render(<ArchiveHighlights highlights={[{ ...highlights[0], source: { excerpt: 'Extrait de test.', startSec: 0 } }]} />)
    expect(screen.getByTestId('archive-highlight-time')).toHaveTextContent('Dans l’enregistrement · 00:00:00')
  })

  it('ne crée pas de repères depuis des données temporelles invalides', () => {
    render(<ArchiveHighlights highlights={[
      { ...highlights[0], id: 'fixture-negative', source: { excerpt: 'Extrait de test.', startSec: -1 } },
      { ...highlights[0], id: 'fixture-non-finite', source: { excerpt: 'Extrait de test.', startSec: Number.NaN } },
      { ...highlights[0], id: 'fixture-end-only', source: { excerpt: 'Extrait de test.', endSec: 30 } },
    ]} />)
    expect(screen.queryByTestId('archive-highlight-time')).not.toBeInTheDocument()
  })

  it('bascule en anglais avec repli FR pour le contenu non traduit, en conservant la source française', () => {
    useGame.setState({ lang: 'en' })
    render(<ArchiveHighlights highlights={highlights} />)
    expect(screen.getByRole('heading', { name: 'Key takeaways' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'A test idea' })).toBeInTheDocument()
    expect(screen.getByText('A summary made up for this test.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Une autre idée de test' })).toBeInTheDocument()
    expect(screen.getByText('Un deuxième résumé fictif.')).toBeInTheDocument()
    expect(screen.getByTestId('archive-highlight-time')).toHaveTextContent('In the recording · 00:01:10 – 00:01:33')
    fireEvent.click(screen.getAllByRole('button', { name: 'Show the source passage' })[0])
    expect(screen.getAllByTestId('archive-highlight-source')[0].textContent).toBe(highlights[0].source.excerpt)
    expect(screen.getByRole('button', { name: 'Hide the source passage' })).toBeInTheDocument()
  })

  it('rend le contenu comme du texte sans interpréter du HTML', () => {
    const content = '<img src=x onerror=alert(1)>'
    const { container } = render(<ArchiveHighlights highlights={[{
      ...highlights[0],
      title: { fr: content, en: '' },
      body: { fr: content, en: '' },
      source: { excerpt: content },
    }]} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('heading', { name: content })).toBeInTheDocument()
    expect(screen.getByTestId('archive-highlight-source').textContent).toBe(content)
  })

  it('déclare les nouveaux textes dans les deux langues', () => {
    for (const key of ['archiveHighlightsTitle', 'archiveHighlightShowSource', 'archiveHighlightHideSource', 'archiveHighlightSourceTime'] as const) {
      expect(cardStrings[key].fr.trim()).not.toBe('')
      expect(cardStrings[key].en.trim()).not.toBe('')
    }
  })
})
