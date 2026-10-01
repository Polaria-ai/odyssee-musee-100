import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGame } from '../../state/gameStore'
import { remiDialogue } from '../../npc/remiScript'
import {
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGES_PER_VISITOR,
  MAX_USER_MESSAGE_CHARS,
  type RemiChatRequest,
  type RemiChatResult,
  type RemiStreamHandlers,
} from './contract'
import { strings } from './strings'
import { SPEAKING_TAIL_MS, buildHistory, fallbackText, greetingText, useRemiChat, type ChatEntry } from './useRemiChat'

const streamMock = vi.fn<(request: RemiChatRequest, handlers: RemiStreamHandlers) => Promise<RemiChatResult>>()
vi.mock('./client', () => ({
  streamRemiReply: (request: RemiChatRequest, handlers: RemiStreamHandlers) => streamMock(request, handlers),
}))

interface Call {
  request: RemiChatRequest
  handlers: RemiStreamHandlers
  resolve: (result: RemiChatResult) => void
}

/** Un client dont chaque appel reste en attente jusqu'à ce que le test le résolve. */
function pendingClient(): Call[] {
  const calls: Call[] = []
  streamMock.mockImplementation(
    (request, handlers) =>
      new Promise<RemiChatResult>((resolve) => {
        calls.push({ request, handlers, resolve })
      }),
  )
  return calls
}

/** Un client qui répond tout de suite. */
function instantClient(text = 'Réponse de Rémi.'): void {
  streamMock.mockImplementation(async (_request, handlers) => {
    handlers.onDelta(text)
    return { ok: true, text }
  })
}

function failingClient(code: 'unavailable' | 'rate_limited' | 'limit_reached' | 'bad_request', partialText = ''): void {
  streamMock.mockImplementation(async () => ({ ok: false, code, partialText }))
}

const t = (key: keyof typeof strings, lang: 'fr' | 'en' = 'fr') => strings[key][lang]

function setup(open = true) {
  return renderHook(({ open }) => useRemiChat(open), { initialProps: { open } })
}

describe('useRemiChat', () => {
  beforeEach(() => {
    streamMock.mockReset()
    useGame.setState({
      lang: 'fr',
      visitorId: 'v-test',
      visited: {},
      stamps: {},
      people: [],
      sessions: [],
      visitedSessions: {},
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('ouverture', () => {
    it('ne garnit rien tant que le chat est fermé', () => {
      const { result } = setup(false)
      expect(result.current.entries).toEqual([])
    })

    it('à l’ouverture : le message d’accueil de Rémi est déjà là, sans appel réseau', () => {
      const { result } = setup()
      expect(streamMock).not.toHaveBeenCalled()
      expect(result.current.entries).toHaveLength(1)
      const first = result.current.entries[0]
      expect(first.role).toBe('assistant')
      const welcome = remiDialogue({ kind: 'welcome' }).lines.map((l) => l.text.fr)
      for (const line of welcome) expect(first.content).toContain(line)
      expect(result.current.openedEmpty).toBe(true)
    })

    it('le message d’accueil suit la langue', () => {
      useGame.setState({ lang: 'en' })
      const { result } = setup()
      expect(result.current.entries[0].content).toContain('Welcome to the Museum of the 100')
    })

    it('un visiteur qui a déjà avancé retrouve la conversation de comptoir, pas l’accueil', () => {
      useGame.setState({ visited: { a: 1, b: 2 } })
      const { result } = setup()
      const text = result.current.entries[0].content
      expect(text).not.toContain('Bienvenue au Musée des 100')
      expect(text).toBe(greetingText('fr', { visitedCount: 2, stampsCount: 0, total: 0, archivesToVisit: false }))
    })

    it('rouvrir le chat garde l’historique et n’ajoute pas un second accueil', async () => {
      instantClient('Voici.')
      const { result, rerender } = setup()
      await act(async () => {
        result.current.send('Bonjour')
      })
      const before = result.current.entries
      expect(before.map((e) => e.role)).toEqual(['assistant', 'user', 'assistant'])
      rerender({ open: false })
      rerender({ open: true })
      expect(result.current.entries).toEqual(before)
      expect(result.current.openedEmpty).toBe(false)
    })
  })

  describe('envoi et flux', () => {
    it('envoie le brouillon avec la langue, le visiteur, la progression et l’historique', async () => {
      const calls = pendingClient()
      useGame.setState({ lang: 'en', visited: { a: 1, b: 2, c: 3 }, stamps: { culture: 1 }, people: new Array(100).fill(null) as never })
      const { result } = setup()
      act(() => result.current.setDraft('  Who are the 100?  '))
      act(() => {
        expect(result.current.send()).toBe(true)
      })
      expect(result.current.draft).toBe('')
      expect(calls).toHaveLength(1)
      const { request } = calls[0]
      expect(request.lang).toBe('en')
      expect(request.visitorId).toBe('v-test')
      expect(request.context).toEqual({ visitedCount: 3, stampsCount: 1, total: 100 })
      expect(request.messages.at(-1)).toEqual({ role: 'user', content: 'Who are the 100?' })
      // L'accueil de Rémi fait partie de l'historique envoyé.
      expect(request.messages[0].role).toBe('assistant')
      await act(async () => calls[0].resolve({ ok: true, text: 'x' }))
    })

    it('thinking jusqu’au premier morceau, puis le texte s’écrit au fil du flux', async () => {
      const calls = pendingClient()
      const { result } = setup()
      act(() => {
        result.current.send('Bonjour')
      })
      expect(result.current.phase).toBe('thinking')
      expect(result.current.entries.map((e) => e.role)).toEqual(['assistant', 'user'])

      act(() => calls[0].handlers.onDelta('Bon'))
      expect(result.current.phase).toBe('streaming')
      expect(result.current.entries.at(-1)).toMatchObject({ role: 'assistant', content: 'Bon', streaming: true })

      act(() => calls[0].handlers.onDelta('jour !'))
      expect(result.current.entries.at(-1)?.content).toBe('Bonjour !')

      await act(async () => calls[0].resolve({ ok: true, text: 'Bonjour !' }))
      expect(result.current.phase).toBe('idle')
      expect(result.current.entries.at(-1)).toMatchObject({ content: 'Bonjour !' })
      expect(result.current.entries.at(-1)?.streaming).toBeFalsy()
    })

    it('n’annonce un message qu’une fois terminé, jamais à chaque morceau', async () => {
      const calls = pendingClient()
      const { result } = setup()
      act(() => {
        result.current.send('Bonjour')
      })
      act(() => calls[0].handlers.onDelta('Bon'))
      act(() => calls[0].handlers.onDelta('jour !'))
      expect(result.current.announcement).toBeNull()
      await act(async () => calls[0].resolve({ ok: true, text: 'Bonjour !' }))
      expect(result.current.announcement?.text).toBe('Bonjour !')
    })

    it('une réponse sans flux (texte seul dans le résultat) s’affiche quand même', async () => {
      streamMock.mockResolvedValue({ ok: true, text: 'Tout d’un coup.' })
      const { result } = setup()
      await act(async () => {
        result.current.send('Salut')
      })
      expect(result.current.entries.at(-1)).toMatchObject({ role: 'assistant', content: 'Tout d’un coup.' })
    })

    it('un seul envoi à la fois : pendant la réponse, send refuse', async () => {
      const calls = pendingClient()
      const { result } = setup()
      act(() => {
        result.current.send('Un')
      })
      act(() => {
        expect(result.current.send('Deux')).toBe(false)
      })
      expect(calls).toHaveLength(1)
      expect(result.current.canSend).toBe(false)
      await act(async () => calls[0].resolve({ ok: true, text: 'ok' }))
    })

    it('un message vide ou blanc ne part pas', () => {
      const { result } = setup()
      act(() => {
        expect(result.current.send('   ')).toBe(false)
        expect(result.current.send()).toBe(false)
      })
      expect(streamMock).not.toHaveBeenCalled()
    })

    it('n’envoie que les MAX_HISTORY_MESSAGES derniers messages, le dernier étant la nouvelle question', async () => {
      instantClient('Réponse.')
      const { result } = setup()
      for (let i = 1; i <= 8; i++) {
        await act(async () => {
          result.current.send(`Question ${i}`)
        })
      }
      // accueil + 8 questions + 8 réponses = 17 messages ; la requête de la 8e question en portait 16.
      expect(result.current.entries).toHaveLength(17)
      const last = streamMock.mock.calls.at(-1)![0].messages
      expect(last).toHaveLength(MAX_HISTORY_MESSAGES)
      expect(last.at(-1)).toEqual({ role: 'user', content: 'Question 8' })
    })

    it('les suggestions disparaissent dès le premier envoi', async () => {
      instantClient()
      const { result } = setup()
      expect(result.current.showSuggestions).toBe(true)
      await act(async () => {
        result.current.send('Comment ça marche ?')
      })
      expect(result.current.showSuggestions).toBe(false)
    })

    it('envoyer une suggestion garde le brouillon en cours de saisie', async () => {
      instantClient()
      const { result } = setup()
      act(() => result.current.setDraft('à moitié écrit'))
      await act(async () => {
        result.current.send('Qui sont les 100 ?')
      })
      expect(result.current.draft).toBe('à moitié écrit')
    })
  })

  describe('plafonds du contrat', () => {
    it('désactive l’envoi au-delà de MAX_USER_MESSAGE_CHARS, l’autorise pile au plafond', () => {
      const { result } = setup()
      act(() => result.current.setDraft('a'.repeat(MAX_USER_MESSAGE_CHARS)))
      expect(result.current.overLimit).toBe(false)
      expect(result.current.canSend).toBe(true)
      act(() => result.current.setDraft('a'.repeat(MAX_USER_MESSAGE_CHARS + 1)))
      expect(result.current.draftLength).toBe(MAX_USER_MESSAGE_CHARS + 1)
      expect(result.current.overLimit).toBe(true)
      expect(result.current.canSend).toBe(false)
      act(() => {
        expect(result.current.send()).toBe(false)
      })
      expect(streamMock).not.toHaveBeenCalled()
    })

    it('après MAX_MESSAGES_PER_VISITOR messages : message de fin aimable, plus d’envoi', async () => {
      instantClient('Réponse.')
      const { result } = setup()
      for (let i = 1; i <= MAX_MESSAGES_PER_VISITOR; i++) {
        expect(result.current.ended).toBe(false)
        await act(async () => {
          expect(result.current.send(`Question ${i}`)).toBe(true)
        })
      }
      expect(streamMock).toHaveBeenCalledTimes(MAX_MESSAGES_PER_VISITOR)
      expect(result.current.ended).toBe(true)
      expect(result.current.entries.at(-1)).toMatchObject({ kind: 'notice', content: t('limitReached') })
      expect(result.current.canSend).toBe(false)
      expect(result.current.showSuggestions).toBe(false)
      await act(async () => {
        expect(result.current.send('Encore une')).toBe(false)
      })
      expect(streamMock).toHaveBeenCalledTimes(MAX_MESSAGES_PER_VISITOR)
    })
  })

  describe('erreurs', () => {
    it('unavailable : repli scripté précédé d’une phrase courte, gardé dans l’historique', async () => {
      failingClient('unavailable')
      const { result } = setup()
      await act(async () => {
        result.current.send('Bonjour')
      })
      const reply = result.current.entries.at(-1)!
      const talk = remiDialogue({ kind: 'talk', visitedCount: 0, stampsCount: 0, total: 0 }).lines.map((l) => l.text.fr)
      expect(reply).toMatchObject({ role: 'assistant', kind: 'message', fallback: true })
      expect(reply.content.startsWith(`${t('fallbackPreface')} `)).toBe(true)
      expect(reply.content).toBe(`${t('fallbackPreface')} ${talk.join(' ')}`)
      expect(result.current.phase).toBe('idle')
      expect(result.current.announcement?.text).toBe(reply.content)
      expect(buildHistory(result.current.entries).at(-1)?.content).toBe(reply.content)
    })

    it('unavailable : le repli est en anglais en anglais, et varie d’un repli à l’autre', async () => {
      useGame.setState({ lang: 'en', visited: { a: 1, b: 2 } })
      failingClient('unavailable')
      const { result } = setup()
      await act(async () => {
        result.current.send('Hello')
      })
      await act(async () => {
        result.current.send('Hello again')
      })
      const fallbacks = result.current.entries.filter((e) => e.fallback)
      expect(fallbacks).toHaveLength(2)
      expect(fallbacks[0].content.startsWith(t('fallbackPreface', 'en'))).toBe(true)
      expect(fallbacks[0].content).not.toBe(fallbacks[1].content)
    })

    it('une exception du client vaut « indisponible » : repli scripté', async () => {
      streamMock.mockRejectedValue(new Error('réseau coupé'))
      const { result } = setup()
      await act(async () => {
        result.current.send('Bonjour')
      })
      expect(result.current.entries.at(-1)).toMatchObject({ fallback: true })
      expect(result.current.phase).toBe('idle')
    })

    it('une réponse vide vaut « indisponible »', async () => {
      streamMock.mockResolvedValue({ ok: true, text: '   ' })
      const { result } = setup()
      await act(async () => {
        result.current.send('Bonjour')
      })
      expect(result.current.entries.at(-1)).toMatchObject({ fallback: true })
    })

    it('rate_limited : attente aimable avec « Réessayer », la question reste', async () => {
      failingClient('rate_limited')
      const { result } = setup()
      await act(async () => {
        result.current.send('Bonjour')
      })
      const notice = result.current.entries.at(-1)!
      expect(notice).toMatchObject({ role: 'assistant', kind: 'notice', retry: true, content: t('rateLimited') })
      expect(notice.content).toContain('Un instant, beaucoup de visiteurs me parlent en même temps')
      expect(result.current.entries.at(-2)).toMatchObject({ role: 'user', content: 'Bonjour' })
      // La notice n'est jamais renvoyée au serveur.
      expect(buildHistory(result.current.entries).some((m) => m.content === notice.content)).toBe(false)
    })

    it('rate_limited puis « Réessayer » : la même question repart, sans doublon, la notice disparaît', async () => {
      failingClient('rate_limited')
      const { result } = setup()
      await act(async () => {
        result.current.send('Bonjour')
      })
      instantClient('Me revoilà.')
      await act(async () => {
        result.current.retry()
      })
      const roles = result.current.entries.map((e) => `${e.role}:${e.kind}`)
      expect(roles).toEqual(['assistant:message', 'user:message', 'assistant:message'])
      expect(result.current.entries.at(-1)?.content).toBe('Me revoilà.')
      const retried = streamMock.mock.calls.at(-1)![0].messages
      expect(retried.at(-1)).toEqual({ role: 'user', content: 'Bonjour' })
      expect(retried.filter((m) => m.content === 'Bonjour')).toHaveLength(1)
    })

    it('rate_limited puis une autre question : l’attente « Réessayer » disparaît', async () => {
      failingClient('rate_limited')
      const { result } = setup()
      await act(async () => {
        result.current.send('Bonjour')
      })
      instantClient()
      await act(async () => {
        result.current.send('Autre question')
      })
      expect(result.current.entries.some((e) => e.retry)).toBe(false)
    })

    it('limit_reached : message de fin aimable, la saisie est fermée', async () => {
      failingClient('limit_reached')
      const { result } = setup()
      await act(async () => {
        result.current.send('Bonjour')
      })
      expect(result.current.ended).toBe(true)
      expect(result.current.entries.at(-1)).toMatchObject({ kind: 'notice', content: t('limitReached') })
      expect(result.current.canSend).toBe(false)
    })

    it('bad_request : message court, la question refusée n’est plus renvoyée', async () => {
      failingClient('bad_request')
      const { result } = setup()
      await act(async () => {
        result.current.send('???')
      })
      expect(result.current.entries.at(-1)).toMatchObject({ kind: 'notice', content: t('badRequest') })
      expect(result.current.entries.find((e) => e.content === '???')?.excluded).toBe(true)
      instantClient('Voici.')
      await act(async () => {
        result.current.send('Une vraie question')
      })
      const sent = streamMock.mock.calls.at(-1)![0].messages
      expect(sent.map((m) => m.content)).not.toContain('???')
      expect(sent.at(-1)?.content).toBe('Une vraie question')
    })

    it('une réponse coupée en route garde son texte : pas de repli par-dessus', async () => {
      const calls = pendingClient()
      const { result } = setup()
      act(() => {
        result.current.send('Bonjour')
      })
      act(() => calls[0].handlers.onDelta('Le musée a trois'))
      await act(async () => calls[0].resolve({ ok: false, code: 'unavailable', partialText: 'Le musée a trois' }))
      expect(result.current.entries.at(-1)).toMatchObject({ role: 'assistant', content: 'Le musée a trois' })
      expect(result.current.entries.some((e) => e.fallback)).toBe(false)
      expect(result.current.phase).toBe('idle')
    })
  })

  describe('fermeture', () => {
    it('annule la requête en cours (AbortController) et rend la question au champ', async () => {
      const calls = pendingClient()
      const { result, rerender } = setup()
      act(() => {
        result.current.send('Ma question')
      })
      expect(calls[0].handlers.signal?.aborted).toBe(false)
      rerender({ open: false })
      expect(calls[0].handlers.signal?.aborted).toBe(true)
      expect(result.current.phase).toBe('idle')
      expect(result.current.entries.some((e) => e.role === 'user')).toBe(false)
      expect(result.current.draft).toBe('Ma question')
      // Le client répond après l'annulation : rien ne s'ajoute au fil.
      await act(async () => calls[0].resolve({ ok: false, code: 'unavailable', partialText: '' }))
      expect(result.current.entries).toHaveLength(1)
    })

    it('ne remplace pas ce que le visiteur a déjà retapé dans le champ', () => {
      pendingClient()
      const { result, rerender } = setup()
      act(() => {
        result.current.send('Ma question')
      })
      act(() => result.current.setDraft('Autre chose'))
      rerender({ open: false })
      expect(result.current.draft).toBe('Autre chose')
    })

    it('garde le texte déjà reçu d’une réponse interrompue', () => {
      const calls = pendingClient()
      const { result, rerender } = setup()
      act(() => {
        result.current.send('Ma question')
      })
      act(() => calls[0].handlers.onDelta('Début de réponse'))
      rerender({ open: false })
      expect(result.current.entries.at(-1)).toMatchObject({ role: 'assistant', content: 'Début de réponse' })
      expect(result.current.entries.at(-1)?.streaming).toBeFalsy()
      expect(result.current.entries.some((e) => e.role === 'user')).toBe(true)
      expect(result.current.phase).toBe('idle')
    })

    it('un morceau reçu après la fermeture est ignoré', () => {
      const calls = pendingClient()
      const { result, rerender } = setup()
      act(() => {
        result.current.send('Ma question')
      })
      rerender({ open: false })
      act(() => calls[0].handlers.onDelta('trop tard'))
      expect(result.current.entries.some((e) => e.content === 'trop tard')).toBe(false)
    })

    it('le démontage annule aussi la requête', () => {
      const calls = pendingClient()
      const { result, unmount } = setup()
      act(() => {
        result.current.send('Ma question')
      })
      unmount()
      expect(calls[0].handlers.signal?.aborted).toBe(true)
    })
  })

  describe('humeur du buste', () => {
    it('idle au repos ; listening quand le champ a le focus ou du texte', () => {
      vi.useFakeTimers()
      const { result } = setup()
      // Rémi vient de s'adresser au visiteur : il reste « en parole » un instant.
      expect(result.current.mood).toBe('speaking')
      act(() => {
        vi.advanceTimersByTime(SPEAKING_TAIL_MS)
      })
      expect(result.current.mood).toBe('idle')
      act(() => result.current.setFocused(true))
      expect(result.current.mood).toBe('listening')
      act(() => result.current.setFocused(false))
      expect(result.current.mood).toBe('idle')
      act(() => result.current.setDraft('Bonjour'))
      expect(result.current.mood).toBe('listening')
    })

    it('thinking entre l’envoi et le premier morceau, speaking pendant le flux et ~1,5 s après', async () => {
      vi.useFakeTimers()
      const calls = pendingClient()
      const { result } = setup()
      act(() => {
        vi.advanceTimersByTime(SPEAKING_TAIL_MS)
      })
      act(() => result.current.setFocused(true))
      expect(result.current.mood).toBe('listening')

      act(() => {
        result.current.send('Bonjour')
      })
      expect(result.current.mood).toBe('thinking')

      act(() => calls[0].handlers.onDelta('Bon'))
      expect(result.current.mood).toBe('speaking')
      act(() => calls[0].handlers.onDelta('jour'))
      expect(result.current.mood).toBe('speaking')

      await act(async () => calls[0].resolve({ ok: true, text: 'Bonjour' }))
      expect(result.current.mood).toBe('speaking')
      act(() => {
        vi.advanceTimersByTime(SPEAKING_TAIL_MS - 1)
      })
      expect(result.current.mood).toBe('speaking')
      act(() => {
        vi.advanceTimersByTime(1)
      })
      // Le champ a toujours le focus : Rémi écoute de nouveau.
      expect(result.current.mood).toBe('listening')
      act(() => result.current.setFocused(false))
      expect(result.current.mood).toBe('idle')
    })

    it('les erreurs parlées par Rémi (repli, attente) font aussi parler le buste un instant', async () => {
      vi.useFakeTimers()
      failingClient('unavailable')
      const { result } = setup()
      act(() => {
        vi.advanceTimersByTime(SPEAKING_TAIL_MS)
      })
      await act(async () => {
        result.current.send('Bonjour')
      })
      expect(result.current.mood).toBe('speaking')
      act(() => {
        vi.advanceTimersByTime(SPEAKING_TAIL_MS)
      })
      expect(result.current.mood).toBe('idle')
    })

    it('fermer le chat remet le buste au repos (plus d’écoute)', () => {
      vi.useFakeTimers()
      const { result, rerender } = setup()
      act(() => {
        vi.advanceTimersByTime(SPEAKING_TAIL_MS)
      })
      act(() => result.current.setFocused(true))
      rerender({ open: false })
      expect(result.current.mood).toBe('idle')
    })
  })
})

describe('buildHistory', () => {
  const e = (partial: Partial<ChatEntry> & Pick<ChatEntry, 'id' | 'role' | 'content'>): ChatEntry => ({ kind: 'message', ...partial })

  it('écarte les notices, les questions refusées et les messages vides', () => {
    const list: ChatEntry[] = [
      e({ id: 1, role: 'assistant', content: 'Accueil' }),
      e({ id: 2, role: 'user', content: 'Q1' }),
      e({ id: 3, role: 'assistant', content: 'Un instant…', kind: 'notice' }),
      e({ id: 4, role: 'user', content: 'Refusée', excluded: true }),
      e({ id: 5, role: 'assistant', content: '  ' }),
    ]
    expect(buildHistory(list)).toEqual([
      { role: 'assistant', content: 'Accueil' },
      { role: 'user', content: 'Q1' },
    ])
  })
})

describe('textes', () => {
  const progress = { visitedCount: 0, stampsCount: 0, total: 100, archivesToVisit: false }

  it('greetingText : paragraphes séparés par une ligne vide, une phrase par réplique', () => {
    const text = greetingText('fr', progress)
    const lines = remiDialogue({ kind: 'welcome' }).lines
    expect(text.split('\n\n')).toHaveLength(lines.length)
  })

  it('fallbackText : lignes de la conversation de comptoir concaténées derrière le préambule, en FR et en EN', () => {
    for (const lang of ['fr', 'en'] as const) {
      const lines = remiDialogue({ kind: 'talk', ...progress }).lines.map((l) => l.text[lang])
      expect(fallbackText(lang, progress, 0)).toBe(`${t('fallbackPreface', lang)} ${lines.join(' ')}`)
    }
  })

  it('fallbackText : sans progression, une seule conversation possible (pas de variante hors sujet)', () => {
    expect(fallbackText('fr', progress, 0)).toBe(fallbackText('fr', progress, 5))
  })

  it('fallbackText : avec de la progression, les variantes tournent', () => {
    const advanced = { ...progress, visitedCount: 4, stampsCount: 1 }
    const texts = new Set([0, 1, 2].map((served) => fallbackText('fr', advanced, served)))
    expect(texts.size).toBeGreaterThan(1)
  })
})
