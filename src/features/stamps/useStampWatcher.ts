// Propriétaire : agent avatar+tampons.
import { useCallback, useEffect, useRef } from 'react'
import { useGame } from '../../state/gameStore'
import { minerveDialogue } from '../../npc/minerveScript'
import { archivistDialogue } from '../../archives/archivistScript'
import type { ExhibitWingId, Localized } from '../../types'
import { format, pick } from '../../i18n'
import { playSfx } from '../../audio'
import { hasArchivesStamp, isCardComplete, stampsToAward } from './stamps'
import { strings, wingNames } from './strings'

type QueueEvent = { kind: 'stamp'; wing: ExhibitWingId } | { kind: 'complete' } | { kind: 'archives-stamp' }

function stampToastText(wing: ExhibitWingId): Localized {
  return {
    fr: format(pick(strings.stampToast, 'fr'), { wing: pick(wingNames[wing], 'fr') }),
    en: format(pick(strings.stampToast, 'en'), { wing: pick(wingNames[wing], 'en') }),
  }
}

function archivesStampToastText(): Localized {
  return {
    fr: format(pick(strings.stampToast, 'fr'), { wing: pick(wingNames.archives, 'fr') }),
    en: format(pick(strings.stampToast, 'en'), { wing: pick(wingNames.archives, 'en') }),
  }
}

/**
 * Surveille les visites, attribue les tampons (les trois ailes, plus le 4e tampon « Archives »,
 * déduit de `visitedSessions` — voir `hasArchivesStamp`), déclenche toast et dialogue.
 * Les dialogues de tampon ne coupent jamais un dialogue déjà ouvert : ils sont mis en file
 * et rejoués à sa fermeture. À la complétion des quatre tampons, le dialogue « complete » précède
 * l'ouverture du carnet.
 */
export function useStampWatcher(): void {
  const visited = useGame((s) => s.visited)
  const people = useGame((s) => s.people)
  const sessions = useGame((s) => s.sessions)
  const visitedSessions = useGame((s) => s.visitedSessions)
  const dialogue = useGame((s) => s.dialogue)
  const queueRef = useRef<QueueEvent[]>([])
  const activeKindRef = useRef<QueueEvent['kind'] | null>(null)
  // `null` = pas encore de référence (premier passage : sert seulement de base, ne déclenche rien,
  // pour ne jamais rejouer le tampon Archives déjà obtenu lors d'une session précédente).
  const hadArchivesStampRef = useRef<boolean | null>(null)

  const playNext = useCallback(() => {
    if (useGame.getState().dialogue !== null) return
    const next = queueRef.current.shift()
    if (!next) {
      activeKindRef.current = null
      return
    }
    activeKindRef.current = next.kind
    if (next.kind === 'archives-stamp') {
      useGame.getState().startDialogue(archivistDialogue({ kind: 'stampAwarded' }))
    } else {
      useGame.getState().startDialogue(minerveDialogue(next))
    }
  }, [])

  useEffect(() => {
    if (people.length === 0 && sessions.length === 0) return
    const g = useGame.getState()

    const toAward = stampsToAward(people, visited, g.stamps)

    const archivesObtainedNow = hasArchivesStamp(visitedSessions, sessions.length)
    const previouslyObtained = hadArchivesStampRef.current
    hadArchivesStampRef.current = archivesObtainedNow
    const archivesJustAwarded = previouslyObtained === false && archivesObtainedNow

    if (toAward.length === 0 && !archivesJustAwarded) return

    for (const wing of toAward) {
      g.awardStamp(wing)
      g.showToast(stampToastText(wing))
      playSfx('stamp')
      queueRef.current.push({ kind: 'stamp', wing })
    }
    if (archivesJustAwarded) {
      g.showToast(archivesStampToastText())
      playSfx('stamp')
      queueRef.current.push({ kind: 'archives-stamp' })
    }
    const archives = { visitedSessions, totalSessions: sessions.length }
    if (isCardComplete(useGame.getState().stamps, people, archives)) {
      playSfx('complete')
      queueRef.current.push({ kind: 'complete' })
    }
    playNext()
  }, [visited, people, sessions, visitedSessions, playNext])

  useEffect(() => {
    if (dialogue !== null) return
    const finishedKind = activeKindRef.current
    activeKindRef.current = null
    if (finishedKind === 'complete') {
      useGame.getState().setStampCardOpen(true)
    }
    playNext()
  }, [dialogue, playNext])
}
