/**
 * Conversation avec Rémi · IA (V5, WEL-920) : fil de messages, envoi, flux, erreurs, plafonds, humeur du buste.
 * Propriétaire : agent chat-ui.
 *
 * Le fil vit dans l'état React du composant `RemiChat`, qui reste monté pendant toute la partie (il ne rend
 * rien quand le chat est fermé) : l'historique est donc conservé tant que la page reste ouverte, sans rien
 * écrire sur le disque ni sur le réseau.
 *
 * - Ouverture : le fil se garnit d'un premier message de Rémi, court, instantané et sans réseau (`greetingText`) :
 *   l'accueil complet est déjà passé dans la bulle du jeu à l'entrée dans le musée.
 * - Envoi : les `MAX_HISTORY_MESSAGES` derniers messages partent avec la langue, le `visitorId` et la progression.
 * - Erreurs (`RemiChatErrorCode`) : `unavailable` → repli scripté (réponse de comptoir de Rémi), `rate_limited` →
 *   attente avec « Réessayer », `limit_reached` → message de fin, `bad_request` → message court.
 * - Fermeture : la requête en cours est annulée (`AbortController`) ; sans texte reçu, la question revient dans le champ.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../../state/gameStore'
import { pick, translate } from '../../i18n'
import { remiDialogue } from '../../npc/remiScript'
import type { Lang } from '../../types'
import { streamRemiReply } from './client'
import {
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGES_PER_VISITOR,
  MAX_USER_MESSAGE_CHARS,
  type ChatMessage,
  type ChatRole,
  type RemiChatErrorCode,
  type RemiChatResult,
  type RemiMood,
} from './contract'
import { strings } from './strings'

/** Durée pendant laquelle Rémi reste en train de « parler » (gestes) après le dernier morceau de texte. */
export const SPEAKING_TAIL_MS = 1500

export type ChatPhase = 'idle' | 'thinking' | 'streaming'

export interface ChatEntry {
  id: number
  role: ChatRole
  content: string
  /**
   * `message` : fait partie de l'historique envoyé au serveur.
   * `notice` : phrase de l'interface prononcée par Rémi (attente, fin, message illisible) : jamais renvoyée.
   */
  kind: 'message' | 'notice'
  /** Réponse de repli scripté (service indisponible) : affichée comme les autres, gardée dans l'historique. */
  fallback?: boolean
  /** Question refusée par le serveur (`bad_request`) : affichée, jamais renvoyée. */
  excluded?: boolean
  /** Notice avec un bouton « Réessayer » (`rate_limited`). */
  retry?: boolean
  /** Réponse en cours de flux. */
  streaming?: boolean
}

export interface RemiChatProgress {
  visitedCount: number
  stampsCount: number
  total: number
  archivesToVisit: boolean
}

/** Progression de la partie, lue à la demande (jamais figée dans une fermeture). */
function readProgress(): RemiChatProgress {
  const g = useGame.getState()
  return {
    visitedCount: Object.keys(g.visited).length,
    stampsCount: Object.keys(g.stamps).length,
    total: g.people.length,
    archivesToVisit: g.sessions.length > 0 && Object.keys(g.visitedSessions).length === 0,
  }
}

function joinLines(lines: readonly { text: { fr: string; en: string } }[], lang: Lang, separator: string): string {
  return lines.map((l) => pick(l.text, lang)).join(separator)
}

/**
 * Premier message du fil : une ou deux phrases qui disent qui parle et ce qu'on peut demander. Le visiteur a déjà
 * eu l'accueil complet dans la bulle du jeu (`remiDialogue` welcome) : le chat ne le répète pas.
 */
export function greetingText(lang: Lang): string {
  return translate(strings, lang)('greeting')
}

/**
 * Réponse de repli quand le service est indisponible : « Je vous réponds brièvement : » suivi des lignes
 * de la conversation de comptoir (`remiDialogue` talk), concaténées. `served` (nombre de replis déjà donnés)
 * fait tourner les variantes pour que deux replis de suite ne soient pas identiques.
 */
export function fallbackText(lang: Lang, progress: RemiChatProgress, served: number): string {
  const visitedCount = progress.visitedCount > 0 ? progress.visitedCount + served : 0
  const dialogue = remiDialogue({ kind: 'talk', ...progress, visitedCount })
  const preface = translate(strings, lang)('fallbackPreface')
  return `${preface} ${joinLines(dialogue.lines, lang, ' ')}`
}

/** Messages envoyés au serveur : ni notices, ni questions refusées, les plus récents d'abord retenus. */
export function buildHistory(entries: readonly ChatEntry[]): ChatMessage[] {
  return entries
    .filter((e) => e.kind === 'message' && !e.excluded && e.content.trim() !== '')
    .map((e) => ({ role: e.role, content: e.content }))
    .slice(-MAX_HISTORY_MESSAGES)
}

/** Requête en vol : annulable, avec le texte déjà reçu. */
interface Pending {
  controller: AbortController
  userId: number
  assistantId: number | null
  text: string
  cancelled: boolean
}

export interface RemiChatController {
  entries: ChatEntry[]
  draft: string
  setDraft: (value: string) => void
  /** Le champ de saisie a (ou perd) le focus : fait passer le buste en écoute. */
  setFocused: (focused: boolean) => void
  /** Envoie le brouillon, ou `text` (puce de suggestion). Renvoie vrai si un envoi est parti. */
  send: (text?: string) => boolean
  /** Renvoie la dernière question restée sans réponse (après `rate_limited`). */
  retry: () => void
  phase: ChatPhase
  mood: RemiMood
  /** Caractères du brouillon, plafond du contrat. */
  draftLength: number
  overLimit: boolean
  canSend: boolean
  /** `MAX_MESSAGES_PER_VISITOR` atteint (ou refusé par le serveur) : plus d'envoi possible. */
  ended: boolean
  /** Les puces de départ : tant que le visiteur n'a rien envoyé. */
  showSuggestions: boolean
  /** Dernier message terminé de Rémi, pour la région `aria-live` (jamais le texte en cours de flux). */
  announcement: { id: number; text: string } | null
  /** Vrai si la dernière ouverture a démarré un fil vide (première discussion de la partie). */
  openedEmpty: boolean
}

export function useRemiChat(open: boolean): RemiChatController {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [draft, setDraftState] = useState('')
  const [focused, setFocused] = useState(false)
  const [phase, setPhase] = useState<ChatPhase>('idle')
  const [tail, setTail] = useState(false)
  const [ended, setEnded] = useState(false)
  const [announcement, setAnnouncement] = useState<{ id: number; text: string } | null>(null)
  // « Le fil était-il vide à l'ouverture ? » : décidé au rendu qui voit `open` changer (schéma officiel
  // « ajuster l'état quand une prop change »), donc avant que l'effet d'ouverture ne garnisse le fil, et sans
  // être faussé par le double passage des effets de React en développement (StrictMode).
  const [openState, setOpenState] = useState({ open: false, empty: true })
  if (open !== openState.open) setOpenState({ open, empty: open ? entries.length === 0 : openState.empty })

  // Miroirs synchrones : les rappels asynchrones (flux, annulation) lisent toujours l'état courant.
  const entriesRef = useRef<ChatEntry[]>([])
  const draftRef = useRef('')
  const phaseRef = useRef<ChatPhase>('idle')
  const endedRef = useRef(false)
  const pendingRef = useRef<Pending | null>(null)
  const tailTimerRef = useRef<number | null>(null)
  const idRef = useRef(0)

  const nextId = () => ++idRef.current

  const commit = useCallback((updater: (list: ChatEntry[]) => ChatEntry[]) => {
    entriesRef.current = updater(entriesRef.current)
    setEntries(entriesRef.current)
  }, [])

  const setDraft = useCallback((value: string) => {
    draftRef.current = value
    setDraftState(value)
  }, [])

  const changePhase = useCallback((next: ChatPhase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const stopTail = useCallback(() => {
    if (tailTimerRef.current !== null) window.clearTimeout(tailTimerRef.current)
    tailTimerRef.current = null
    setTail(false)
  }, [])

  /** Rémi garde les gestes de la parole encore un instant après son dernier morceau de texte. */
  const startTail = useCallback(() => {
    if (tailTimerRef.current !== null) window.clearTimeout(tailTimerRef.current)
    setTail(true)
    tailTimerRef.current = window.setTimeout(() => {
      tailTimerRef.current = null
      setTail(false)
    }, SPEAKING_TAIL_MS)
  }, [])

  const announce = useCallback((text: string) => {
    setAnnouncement({ id: ++idRef.current, text })
  }, [])

  const endChat = useCallback(() => {
    const t = translate(strings, useGame.getState().lang)
    endedRef.current = true
    setEnded(true)
    commit((list) => [...list, { id: nextId(), role: 'assistant', content: t('limitReached'), kind: 'notice' }])
    startTail()
  }, [commit, startTail])

  /** Termine une requête (réussie ou non) : met à jour le fil, l'annonce et l'humeur. */
  const finish = useCallback(
    (pending: Pending, result: RemiChatResult) => {
      const t = translate(strings, useGame.getState().lang)
      const text = result.ok ? result.text : result.partialText.length > 0 ? result.partialText : pending.text
      const hasText = text.trim() !== ''
      const code: RemiChatErrorCode | null = result.ok ? (hasText ? null : 'unavailable') : result.code
      pendingRef.current = null
      changePhase('idle')

      // Du texte est arrivé (réponse entière, ou tronquée mais lisible) : il devient un message normal.
      if (hasText) {
        const id = pending.assistantId ?? nextId()
        commit((list) =>
          list.some((e) => e.id === id)
            ? list.map((e) => (e.id === id ? { ...e, content: text, streaming: false } : e))
            : [...list, { id, role: 'assistant', content: text, kind: 'message' }],
        )
        announce(text)
        const sent = entriesRef.current.filter((e) => e.role === 'user').length
        if (code === 'limit_reached' || (code === null && sent >= MAX_MESSAGES_PER_VISITOR)) endChat()
        else startTail()
        return
      }

      // Aucun texte : la bulle vide disparaît, puis chaque code a sa réponse.
      const emptyId = pending.assistantId
      if (emptyId !== null) commit((list) => list.filter((e) => e.id !== emptyId))
      if (code === 'limit_reached') {
        endChat()
        return
      }
      if (code === 'rate_limited') {
        commit((list) => [...list, { id: nextId(), role: 'assistant', content: t('rateLimited'), kind: 'notice', retry: true }])
      } else if (code === 'bad_request') {
        commit((list) => [
          ...list.map((e) => (e.id === pending.userId ? { ...e, excluded: true } : e)),
          { id: nextId(), role: 'assistant', content: t('badRequest'), kind: 'notice' },
        ])
      } else {
        const served = entriesRef.current.filter((e) => e.fallback).length
        const reply = fallbackText(useGame.getState().lang, readProgress(), served)
        commit((list) => [...list, { id: nextId(), role: 'assistant', content: reply, kind: 'message', fallback: true }])
        announce(reply)
      }
      startTail()
    },
    [announce, changePhase, commit, endChat, startTail],
  )

  /** Lance la requête pour la question `userId` (déjà dans le fil). */
  const run = useCallback(
    async (userId: number) => {
      const controller = new AbortController()
      const pending: Pending = { controller, userId, assistantId: null, text: '', cancelled: false }
      pendingRef.current = pending
      stopTail()
      changePhase('thinking')

      const g = useGame.getState()
      const progress = readProgress()
      const request = {
        messages: buildHistory(entriesRef.current),
        lang: g.lang,
        visitorId: g.visitorId,
        context: { visitedCount: progress.visitedCount, stampsCount: progress.stampsCount, total: progress.total },
      }

      let result: RemiChatResult
      try {
        result = await streamRemiReply(request, {
          signal: controller.signal,
          onDelta: (chunk) => {
            if (pending.cancelled || chunk === '') return
            pending.text += chunk
            const id = pending.assistantId ?? (pending.assistantId = nextId())
            commit((list) =>
              list.some((e) => e.id === id)
                ? list.map((e) => (e.id === id ? { ...e, content: pending.text } : e))
                : [...list, { id, role: 'assistant', content: pending.text, kind: 'message', streaming: true }],
            )
            if (phaseRef.current !== 'streaming') changePhase('streaming')
          },
        })
      } catch {
        // Le client renvoie un résultat typé ; une exception inattendue vaut « indisponible ».
        result = { ok: false, code: 'unavailable', partialText: pending.text }
      }
      if (pending.cancelled) return
      finish(pending, result)
    },
    [changePhase, commit, finish, stopTail],
  )

  /** Annule la requête en cours (fermeture du chat) : sans texte reçu, la question revient dans le champ. */
  const cancelPending = useCallback(() => {
    const pending = pendingRef.current
    if (!pending) return
    pending.cancelled = true
    pending.controller.abort()
    pendingRef.current = null
    changePhase('idle')
    if (pending.text.trim() === '') {
      const question = entriesRef.current.find((e) => e.id === pending.userId)
      commit((list) => list.filter((e) => e.id !== pending.userId && e.id !== pending.assistantId))
      if (question && draftRef.current === '') setDraft(question.content)
    } else {
      commit((list) => list.map((e) => (e.id === pending.assistantId ? { ...e, streaming: false } : e)))
    }
  }, [changePhase, commit, setDraft])

  // Ouverture : premier message de Rémi si le fil est vide. Fermeture : requête annulée, focus oublié.
  useEffect(() => {
    if (!open) return
    if (entriesRef.current.length === 0) {
      commit(() => [
        { id: nextId(), role: 'assistant', content: greetingText(useGame.getState().lang), kind: 'message' },
      ])
      startTail()
    }
    return () => {
      cancelPending()
      setFocused(false)
    }
    // `commit`, `startTail` et `cancelPending` sont stables ; seule l'ouverture relance l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Démontage : plus de minuteur ni de requête en vol.
  useEffect(
    () => () => {
      if (tailTimerRef.current !== null) window.clearTimeout(tailTimerRef.current)
      tailTimerRef.current = null
      setTail(false)
      pendingRef.current?.controller.abort()
    },
    [],
  )

  const send = useCallback(
    (text?: string): boolean => {
      const content = (text ?? draftRef.current).trim()
      if (content === '' || content.length > MAX_USER_MESSAGE_CHARS) return false
      if (phaseRef.current !== 'idle' || endedRef.current) return false
      if (entriesRef.current.filter((e) => e.role === 'user').length >= MAX_MESSAGES_PER_VISITOR) return false
      const userId = nextId()
      // Une nouvelle question remplace l'attente « Réessayer » restée affichée.
      commit((list) => [...list.filter((e) => !e.retry), { id: userId, role: 'user', content, kind: 'message' }])
      if (text === undefined) setDraft('')
      void run(userId)
      return true
    },
    [commit, run, setDraft],
  )

  const retry = useCallback(() => {
    if (phaseRef.current !== 'idle' || endedRef.current) return
    const list = entriesRef.current
    const lastUser = [...list].reverse().find((e) => e.role === 'user' && !e.excluded)
    if (!lastUser) return
    commit((current) => current.filter((e) => !e.retry))
    void run(lastUser.id)
  }, [commit, run])

  const mood: RemiMood =
    phase === 'thinking' ? 'thinking' : phase === 'streaming' || tail ? 'speaking' : focused || draft.length > 0 ? 'listening' : 'idle'

  const draftLength = draft.length
  const overLimit = draftLength > MAX_USER_MESSAGE_CHARS
  const busy = phase !== 'idle'
  const canSend = !busy && !ended && draft.trim() !== '' && !overLimit
  const showSuggestions = !ended && !busy && !entries.some((e) => e.role === 'user')

  return useMemo(
    () => ({
      entries,
      draft,
      setDraft,
      setFocused,
      send,
      retry,
      phase,
      mood,
      draftLength,
      overLimit,
      canSend,
      ended,
      showSuggestions,
      announcement,
      openedEmpty: openState.empty,
    }),
    [entries, draft, setDraft, send, retry, phase, mood, draftLength, overLimit, canSend, ended, showSuggestions, announcement, openState.empty],
  )
}
