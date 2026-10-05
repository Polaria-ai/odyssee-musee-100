import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useGame } from '../../state/gameStore'
import { generatePlaceholderPeople } from '../../data/placeholder'
import { ARCHIVE_SESSIONS } from '../../data/eveningProgram'
import type { SessionArchive } from '../../types'
import { archivisteStrings, strings } from './strings'
import { PERSONAS, personaConfig } from './personas'
import { AiChats, ArchivisteChat, RemiChat } from './RemiChat'
import { chatContext, fallbackText, greetingText, type RemiChatProgress } from './useRemiChat'
import type { RemiBustProps, RemiChatRequest, RemiChatResult, RemiStreamHandlers } from './contract'

/**
 * Le chat de l'Archiviste · IA (WEL-929) : le MÊME composant que celui de Rémi, configuré par `PERSONAS`.
 * Le vrai buste a son propre <Canvas> (WebGL), absent de jsdom : on ne garde que ses propriétés.
 */
vi.mock('../../audio', () => ({ playSfx: () => undefined }))
vi.mock('./RemiBust', () => ({
  RemiBust: ({ mood, variant, character }: RemiBustProps) => (
    <div data-testid="remi-bust" data-mood={mood} data-variant={variant} data-character={character ?? 'remi'} />
  ),
}))

const streamMock = vi.fn<(request: RemiChatRequest, handlers: RemiStreamHandlers) => Promise<RemiChatResult>>()
vi.mock('./client', () => ({
  streamRemiReply: (request: RemiChatRequest, handlers: RemiStreamHandlers) => streamMock(request, handlers),
}))

function instantClient(text: string): void {
  streamMock.mockImplementation(async (_request, handlers) => {
    handlers.onDelta(text)
    return { ok: true, text }
  })
}

const input = () => screen.getByTestId('remi-chat-input') as HTMLTextAreaElement
const send = () => screen.getByTestId('remi-chat-send') as HTMLButtonElement
const bubbles = () => screen.queryAllByTestId('remi-chat-message')
const openArchiviste = () => act(() => useGame.getState().openChat('archiviste'))
const openRemi = () => act(() => useGame.getState().openRemiChat())

async function ask(text: string) {
  fireEvent.change(input(), { target: { value: text } })
  await act(async () => {
    fireEvent.click(send())
  })
}

const archive = (sessionId: string): SessionArchive => ({
  sessionId,
  transcript: { fr: 'Transcription intégrale.', en: 'Full transcript.' },
  archivedAt: '2026-10-06T23:00:00+02:00',
  published: true,
})

beforeEach(() => {
  streamMock.mockReset()
  window.matchMedia = undefined as never
  useGame.setState({
    lang: 'fr',
    visitorId: 'v-test',
    visited: {},
    stamps: {},
    people: generatePlaceholderPeople(12),
    sessions: ARCHIVE_SESSIONS,
    archives: {},
    visitedSessions: {},
    remiChatOpen: false,
    chatPersona: 'remi',
    dialogue: null,
    mapOpen: false,
    stampCardOpen: false,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('configuration des personas', () => {
  it('l’Archiviste : nom « Archiviste · IA », mention IA, cyan, buste de l’Archiviste', () => {
    const c = PERSONAS.archiviste
    expect(c.title).toEqual({ fr: 'Archiviste · IA', en: 'Archivist · AI' })
    expect(c.aiNotice.fr).toBe('Réponses générées par une IA')
    expect(c.accent).toBe('cyan')
    expect(c.character).toBe('archiviste')
  })

  it('Rémi garde ses textes validés et son accent corail, buste de Rémi', () => {
    const c = PERSONAS.remi
    expect(c.title).toBe(strings.title)
    expect(c.greeting).toBe(strings.greeting)
    expect(c.suggestions).toEqual([strings.suggestionHow, strings.suggestionWho, strings.suggestionArchives, strings.suggestionProgram])
    expect(c.accent).toBe('corail')
    expect(c.character).toBe('remi')
  })

  it('les puces de l’Archiviste, en FR et en EN', () => {
    expect(PERSONAS.archiviste.suggestions.map((s) => s.fr)).toEqual([
      'Que contiennent les Archives ?',
      'Les trois tables rondes',
      'Qui êtes-vous ?',
      "Que s'est-il dit ce soir ?",
    ])
    expect(PERSONAS.archiviste.suggestions.map((s) => s.en)).toEqual([
      'What do the Archives contain?',
      'The three panel discussions',
      'Who are you?',
      'What was said tonight?',
    ])
  })

  it('personaConfig : Rémi pour une valeur absente', () => {
    expect(personaConfig(undefined)).toBe(PERSONAS.remi)
    expect(personaConfig('archiviste')).toBe(PERSONAS.archiviste)
  })

  it('l’accueil de l’Archiviste vouvoie, ne promet rien et ne dit rien de la soirée', () => {
    const tutoiement = /(^|[^\p{L}])(?:(?:tu|toi|ton|ta|tes|te)(?![\p{L}])|t')|-toi(?![\p{L}])/iu
    for (const key of ['greeting', 'fallbackPreface', 'inputLabel', 'inputPlaceholder', 'suggestionWho'] as const) {
      expect(archivisteStrings[key].fr, key).not.toMatch(tutoiement)
    }
    expect(archivisteStrings.greeting.fr).toMatch(/Interrogez-moi/)
    expect(archivisteStrings.greeting.fr).not.toMatch(/[«»“”]/)
  })
})

describe('chat de l’Archiviste · IA', () => {
  it('ne rend rien tant qu’aucun chat n’est ouvert', () => {
    render(<AiChats />)
    expect(screen.queryByTestId('remi-chat')).not.toBeInTheDocument()
    expect(screen.queryByTestId('remi-bust')).not.toBeInTheDocument()
  })

  it('s’ouvre avec son nom, la mention IA, le buste de l’Archiviste et l’accent cyan', () => {
    render(<AiChats />)
    openArchiviste()
    const dialog = screen.getByTestId('remi-chat')
    expect(dialog).toHaveAttribute('data-persona', 'archiviste')
    expect(dialog).toHaveAttribute('data-accent', 'cyan')
    expect(dialog).toHaveAttribute('role', 'dialog')
    const title = screen.getByRole('heading', { name: 'Archiviste · IA' })
    expect(dialog).toHaveAttribute('aria-labelledby', title.id)
    expect(screen.getByText('Réponses générées par une IA')).toBeInTheDocument()
    expect(screen.getByTestId('remi-bust')).toHaveAttribute('data-character', 'archiviste')
    expect(input()).toHaveAccessibleName(archivisteStrings.inputLabel.fr)
    expect(input()).toHaveAttribute('placeholder', archivisteStrings.inputPlaceholder.fr)
  })

  it('un seul chat à la fois : celui de Rémi reste fermé', () => {
    render(<AiChats />)
    openArchiviste()
    expect(screen.getAllByTestId('remi-chat')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Rémi · IA' })).not.toBeInTheDocument()
  })

  it('affiche son court message d’accueil et les quatre puces, sans appel réseau', () => {
    render(<AiChats />)
    openArchiviste()
    expect(bubbles()).toHaveLength(1)
    expect(bubbles()[0]).toHaveTextContent(archivisteStrings.greeting.fr)
    expect(screen.getAllByTestId('remi-chat-suggestion').map((c) => c.textContent)).toEqual(PERSONAS.archiviste.suggestions.map((s) => s.fr))
    expect(streamMock).not.toHaveBeenCalled()
  })

  it('en anglais : titre, accueil et puces traduits', () => {
    useGame.setState({ lang: 'en' })
    render(<AiChats />)
    openArchiviste()
    expect(screen.getByRole('heading', { name: 'Archivist · AI' })).toBeInTheDocument()
    expect(bubbles()[0]).toHaveTextContent(archivisteStrings.greeting.en)
    expect(screen.getAllByTestId('remi-chat-suggestion')[0]).toHaveTextContent('What do the Archives contain?')
  })

  it('envoie la requête avec persona « archiviste » et la progression des vitrines, puis affiche la réponse', async () => {
    instantClient('Les vitrines se remplissent après la soirée.')
    useGame.setState({ visitedSessions: { 'keynote-ouverture': 1, 'table-ronde-1': 2 }, stamps: { culture: 1 } })
    render(<AiChats />)
    openArchiviste()
    await ask('Que contiennent les Archives ?')

    expect(streamMock).toHaveBeenCalledTimes(1)
    const request = streamMock.mock.calls[0][0]
    expect(request.persona).toBe('archiviste')
    expect(request.messages.at(-1)).toEqual({ role: 'user', content: 'Que contiennent les Archives ?' })
    expect(request.context).toEqual({ visitedCount: 1, stampsCount: 1, total: ARCHIVE_SESSIONS.length })
    expect(request.visitorId).toBe('v-test')
    expect(bubbles().map((b) => b.getAttribute('data-role'))).toEqual(['assistant', 'user', 'assistant'])
    expect(bubbles().at(-1)).toHaveTextContent('Les vitrines se remplissent après la soirée.')
  })

  it('une puce envoie son texte tel quel', async () => {
    instantClient('Oui.')
    render(<AiChats />)
    openArchiviste()
    await act(async () => {
      fireEvent.click(screen.getAllByTestId('remi-chat-suggestion')[3])
    })
    expect(streamMock.mock.calls[0][0].messages.at(-1)).toEqual({ role: 'user', content: "Que s'est-il dit ce soir ?" })
  })

  it('Rémi envoie toujours la progression des portraits, sa persona est « remi »', async () => {
    instantClient('Bienvenue.')
    useGame.setState({ visited: { a: 1, b: 2, c: 3 } })
    render(<AiChats />)
    openRemi()
    await ask('Bonjour')
    const request = streamMock.mock.calls[0][0]
    expect(request.persona).toBe('remi')
    expect(request.context).toEqual({ visitedCount: 3, stampsCount: 0, total: 12 })
  })

  it('repli : service indisponible → l’état des archives de l’Archiviste, au vouvoiement', async () => {
    streamMock.mockResolvedValue({ ok: false, code: 'unavailable', partialText: '' })
    render(<AiChats />)
    openArchiviste()
    await ask('Que s’est-il dit ?')
    const last = bubbles().at(-1)!
    expect(last).toHaveAttribute('data-fallback')
    expect(last.textContent).toContain(archivisteStrings.fallbackPreface.fr)
    expect(last.textContent).toMatch(/transcriptions|tables rondes/i)
    expect(last.textContent).not.toMatch(/Reviens|Regarde|Approche-toi/)
  })

  it('historique séparé par persona, conservé pendant la session', async () => {
    instantClient('Réponse.')
    render(<AiChats />)

    openRemi()
    await ask('Question à Rémi')
    expect(bubbles()).toHaveLength(3)
    act(() => useGame.getState().closeRemiChat())

    openArchiviste()
    expect(bubbles()).toHaveLength(1) // son seul accueil : rien de la conversation avec Rémi
    expect(bubbles()[0]).toHaveTextContent(archivisteStrings.greeting.fr)
    await ask('Question à l’Archiviste')
    expect(bubbles()).toHaveLength(3)
    // Rémi ne reçoit jamais l'historique de l'Archiviste, ni l'inverse.
    expect(streamMock.mock.calls[1][0].messages.map((m) => m.content)).not.toContain('Question à Rémi')
    act(() => useGame.getState().closeRemiChat())

    openRemi()
    expect(bubbles().map((b) => b.textContent!.slice(0, 12))).toEqual([strings.greeting.fr.slice(0, 12), 'Question à R', 'Réponse.'])
    act(() => useGame.getState().closeRemiChat())
    openArchiviste()
    expect(bubbles().map((b) => b.textContent!.slice(0, 12))).toEqual([archivisteStrings.greeting.fr.slice(0, 12), 'Question à l', 'Réponse.'])
  })

  it('Échap ferme le chat et rend le musée', () => {
    render(<AiChats />)
    openArchiviste()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useGame.getState().remiChatOpen).toBe(false)
    expect(screen.queryByTestId('remi-chat')).not.toBeInTheDocument()
  })

  it('RemiChat seul ne s’ouvre pas pour l’Archiviste, ArchivisteChat seul ne s’ouvre pas pour Rémi', () => {
    const remiOnly = render(<RemiChat />)
    openArchiviste()
    expect(screen.queryByTestId('remi-chat')).not.toBeInTheDocument()
    remiOnly.unmount()
    act(() => useGame.getState().closeRemiChat())

    render(<ArchivisteChat />)
    openRemi()
    expect(screen.queryByTestId('remi-chat')).not.toBeInTheDocument()
    openArchiviste()
    expect(screen.getByTestId('remi-chat')).toHaveAttribute('data-persona', 'archiviste')
  })
})

describe('textes et progression par persona', () => {
  const progress: RemiChatProgress = {
    visitedCount: 4,
    stampsCount: 1,
    total: 100,
    archivesToVisit: false,
    archives: { consulted: 2, total: 3, published: 0 },
  }

  it('greetingText : le texte de la persona, FR et EN', () => {
    expect(greetingText('fr')).toBe(strings.greeting.fr)
    expect(greetingText('en', 'archiviste')).toBe(archivisteStrings.greeting.en)
  })

  it('fallbackText : Rémi inchangé, Archiviste = préambule + son état des archives', () => {
    expect(fallbackText('fr', progress, 0)).toBe(fallbackText('fr', progress, 0, 'remi'))
    const text = fallbackText('fr', progress, 0, 'archiviste')
    expect(text.startsWith(archivisteStrings.fallbackPreface.fr)).toBe(true)
    expect(text).toMatch(/transcriptions|déposées après la soirée/)
    // Une fois des archives publiées, le repli change de palier.
    const published = fallbackText('fr', { ...progress, archives: { consulted: 3, total: 3, published: 3 } }, 0, 'archiviste')
    expect(published).toMatch(/trois transcriptions|trois tables rondes/)
  })

  it('fallbackText de l’Archiviste sans état des archives : traité comme « rien de publié »', () => {
    const { archives: _omitted, ...bare } = progress
    expect(fallbackText('fr', bare, 0, 'archiviste')).toMatch(/transcriptions|déposées après la soirée/)
  })

  it('chatContext : portraits pour Rémi, vitrines pour l’Archiviste', () => {
    expect(chatContext(progress, 'remi')).toEqual({ visitedCount: 4, stampsCount: 1, total: 100 })
    expect(chatContext(progress, 'archiviste')).toEqual({ visitedCount: 2, stampsCount: 1, total: 3 })
    const { archives: _omitted, ...bare } = progress
    expect(chatContext(bare, 'archiviste')).toEqual({ visitedCount: 4, stampsCount: 1, total: 100 })
  })

  it('l’état des archives publiées vient du store : published = archives publiées reçues', async () => {
    streamMock.mockResolvedValue({ ok: false, code: 'unavailable', partialText: '' })
    useGame.setState({ archives: Object.fromEntries(ARCHIVE_SESSIONS.map((s) => [s.id, archive(s.id)])) })
    render(<AiChats />)
    openArchiviste()
    await ask('Question')
    // Les trois transcriptions publiées : palier complet.
    expect(bubbles().at(-1)!.textContent).toMatch(/trois transcriptions|trois tables rondes/)
  })
})
