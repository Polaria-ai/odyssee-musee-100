import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import type { EveningSession, SessionArchive } from '../types'
import { ArchiveCard } from './ArchiveCard'

// Module audio : stub d'un autre agent, no-op tant que le son est coupé. On vérifie ici seulement
// que ArchiveCard l'appelle avec le bon identifiant, pas un comportement sonore réel.
const playSfxMock = vi.fn()
vi.mock('../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
}))

// Programme manifestement fictif, fabriqué uniquement pour ce test : jamais de vrai nom, jamais
// une vraie citation (voir RÈGLES DE CONTENU du chantier « Archives de 2040 »).
const fictionalSessions: EveningSession[] = [
  {
    id: 'fixture-session-un',
    order: 1,
    startTime: '10:00',
    durationMin: 5,
    kind: 'table-ronde',
    title: { fr: 'Ouverture de test', en: 'Test opening' },
    speakers: [],
    provisional: true,
  },
  {
    id: 'fixture-session-deux',
    order: 2,
    startTime: '10:10',
    durationMin: 14,
    kind: 'table-ronde',
    title: { fr: 'Table ronde de test', en: 'Test panel' },
    theme: { fr: 'Un thème fabriqué pour le test.', en: 'A theme made up for the test.' },
    speakers: [
      { name: 'Personne Testeau', organization: 'Exemple SA' },
      { name: 'Autre Testeur', organization: 'Exemple SA', moderator: true },
    ],
    provisional: true,
  },
  {
    id: 'fixture-session-trois',
    order: 3,
    startTime: '10:30',
    durationMin: 10,
    kind: 'table-ronde',
    title: { fr: 'Keynote de test', en: 'Test keynote' },
    speakers: [{ name: 'Cléa Fictive', role: { fr: 'Testeuse', en: 'Tester' }, organization: 'Studio Exemple' }],
    provisional: false,
  },
]

const publishedArchive: SessionArchive = {
  sessionId: 'fixture-session-deux',
  transcript: {
    fr: 'Personne Testeau — Première prise de parole fabriquée pour le test.\n\nAutre Testeur — Deuxième prise de parole fabriquée pour le test.',
    en: 'Personne Testeau — First test contribution.\n\nAutre Testeur — Second test contribution.',
  },
  archivedAt: '2026-10-06T20:00:00.000Z',
  published: true,
}

describe('ArchiveCard', () => {
  beforeEach(() => {
    playSfxMock.mockClear()
    useGame.setState({ lang: 'fr', sessions: fictionalSessions, archives: {}, openSessionId: null })
  })

  it('ne rend rien sans séquence ouverte', () => {
    render(<ArchiveCard />)
    expect(screen.queryByTestId('archive-card')).not.toBeInTheDocument()
  })

  it("affiche l'encart d'attente quand aucune archive n'a été déposée", () => {
    useGame.setState({ openSessionId: 'fixture-session-un' })
    render(<ArchiveCard />)

    expect(screen.getByTestId('archive-card')).toBeInTheDocument()
    expect(screen.getByTestId('archive-pending')).toBeInTheDocument()
    expect(screen.getByText('Transcription en attente')).toBeInTheDocument()
    expect(screen.getByText("La transcription de cette table ronde sera déposée après la soirée, puis relue avant publication.")).toBeInTheDocument()
    expect(screen.queryByTestId('archive-transcript')).not.toBeInTheDocument()
  })

  it("affiche l'encart d'attente quand une archive existe mais n'est pas publiée", () => {
    useGame.setState({
      openSessionId: 'fixture-session-deux',
      archives: { 'fixture-session-deux': { ...publishedArchive, published: false } },
    })
    render(<ArchiveCard />)

    expect(screen.getByTestId('archive-pending')).toBeInTheDocument()
    expect(screen.queryByTestId('archive-transcript')).not.toBeInTheDocument()
  })

  it('affiche la mention « Programme provisoire » pour une séquence provisoire', () => {
    useGame.setState({ openSessionId: 'fixture-session-un' })
    render(<ArchiveCard />)
    expect(screen.getByText(/Programme provisoire, susceptible d'évoluer/)).toBeInTheDocument()
  })

  it('n’affiche pas la mention « Programme provisoire » quand la séquence est confirmée', () => {
    useGame.setState({ openSessionId: 'fixture-session-trois' })
    render(<ArchiveCard />)
    expect(screen.queryByText(/Programme provisoire/)).not.toBeInTheDocument()
  })

  it('affiche heure, durée, thème et intervenant·es, avec la modération signalée', () => {
    useGame.setState({ openSessionId: 'fixture-session-deux' })
    render(<ArchiveCard />)

    expect(screen.getByRole('heading', { name: 'Table ronde de test' })).toBeInTheDocument()
    expect(screen.getByText('10:10 · 14 min')).toBeInTheDocument()
    expect(screen.getByText('Un thème fabriqué pour le test.')).toBeInTheDocument()
    expect(screen.getByText('Personne Testeau')).toBeInTheDocument()
    expect(screen.getByText('Autre Testeur')).toBeInTheDocument()
    expect(screen.getByText('(modération)')).toBeInTheDocument()
  })

  it('affiche la transcription intégrale d’une table ronde publiée', () => {
    useGame.setState({
      openSessionId: 'fixture-session-deux',
      archives: { 'fixture-session-deux': publishedArchive },
    })
    render(<ArchiveCard />)

    expect(screen.queryByTestId('archive-pending')).not.toBeInTheDocument()
    expect(screen.getByText('Transcription intégrale')).toBeInTheDocument()
    expect(screen.getByTestId('archive-transcript')).toHaveTextContent('Personne Testeau — Première prise de parole fabriquée pour le test.')
    expect(screen.getByTestId('archive-transcript')).toHaveTextContent('Autre Testeur — Deuxième prise de parole fabriquée pour le test.')
  })

  it('joue un son à l’ouverture, à la fermeture et à la navigation (même famille que la fiche portrait)', () => {
    useGame.setState({ openSessionId: 'fixture-session-un' })
    render(<ArchiveCard />)
    expect(playSfxMock).toHaveBeenCalledWith('open')
    playSfxMock.mockClear()

    // Navigation : un clic, jamais un ré-déclenchement du son d'ouverture/fermeture (la fiche
    // reste ouverte, seule la séquence affichée change) — voir `PortraitCard.tsx` (même pattern).
    fireEvent.click(screen.getByTestId('archive-next'))
    expect(playSfxMock).toHaveBeenCalledWith('click')
    expect(playSfxMock).not.toHaveBeenCalledWith('open')
    expect(playSfxMock).not.toHaveBeenCalledWith('close')
    playSfxMock.mockClear()

    fireEvent.click(screen.getByTestId('archive-close'))
    expect(playSfxMock).toHaveBeenCalledWith('close')
  })

  it('navigue précédent/suivant dans le programme (ordonné par `order`)', () => {
    useGame.setState({ openSessionId: 'fixture-session-un' })
    render(<ArchiveCard />)

    expect(screen.getByTestId('archive-prev')).toBeDisabled()
    fireEvent.click(screen.getByTestId('archive-next'))
    expect(useGame.getState().openSessionId).toBe('fixture-session-deux')

    fireEvent.click(screen.getByTestId('archive-next'))
    expect(useGame.getState().openSessionId).toBe('fixture-session-trois')
    expect(screen.getByTestId('archive-next')).toBeDisabled()

    fireEvent.click(screen.getByTestId('archive-prev'))
    expect(useGame.getState().openSessionId).toBe('fixture-session-deux')
  })

  it('Échap ferme la fiche', () => {
    useGame.setState({ openSessionId: 'fixture-session-un' })
    render(<ArchiveCard />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useGame.getState().openSessionId).toBeNull()
  })

  it('donne le focus au titre sans faire défiler la feuille', () => {
    const focusSpy = vi.spyOn(HTMLHeadingElement.prototype, 'focus')
    useGame.setState({ openSessionId: 'fixture-session-un' })
    render(<ArchiveCard />)

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
    focusSpy.mockRestore()
  })
})
