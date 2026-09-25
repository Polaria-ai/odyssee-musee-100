// Propriétaire : agent avatar+tampons.
import { useCallback, useEffect, useRef } from 'react'
import { useGame } from '../../state/gameStore'
import { minerveDialogue } from '../../npc/minerveScript'
import type { ExhibitWingId, Localized } from '../../types'
import { format, pick } from '../../i18n'
import { playSfx } from '../../audio'
import { isCardComplete, stampsToAward } from './stamps'
import { strings, wingNames } from './strings'

type QueueEvent = { kind: 'stamp'; wing: ExhibitWingId } | { kind: 'complete' }

function stampToastText(wing: ExhibitWingId): Localized {
  return {
    fr: format(pick(strings.stampToast, 'fr'), { wing: pick(wingNames[wing], 'fr') }),
    en: format(pick(strings.stampToast, 'en'), { wing: pick(wingNames[wing], 'en') }),
  }
}

/**
 * Surveille les visites, attribue les tampons, déclenche toast et dialogue de Minerve.
 * Les dialogues de tampon ne coupent jamais un dialogue déjà ouvert : ils sont mis en file
 * et rejoués à sa fermeture. À la complétion, le dialogue « complete » précède l'ouverture du carnet.
 */
export function useStampWatcher(): void {
  const visited = useGame((s) => s.visited)
  const people = useGame((s) => s.people)
  const dialogue = useGame((s) => s.dialogue)
  const queueRef = useRef<QueueEvent[]>([])
  const activeKindRef = useRef<QueueEvent['kind'] | null>(null)

  const playNext = useCallback(() => {
    if (useGame.getState().dialogue !== null) return
    const next = queueRef.current.shift()
    if (!next) {
      activeKindRef.current = null
      return
    }
    activeKindRef.current = next.kind
    useGame.getState().startDialogue(minerveDialogue(next))
  }, [])

  useEffect(() => {
    if (people.length === 0) return
    const g = useGame.getState()
    const toAward = stampsToAward(people, visited, g.stamps)
    if (toAward.length === 0) return
    for (const wing of toAward) {
      g.awardStamp(wing)
      g.showToast(stampToastText(wing))
      playSfx('stamp')
      queueRef.current.push({ kind: 'stamp', wing })
    }
    if (isCardComplete(useGame.getState().stamps, people)) {
      playSfx('complete')
      queueRef.current.push({ kind: 'complete' })
    }
    playNext()
  }, [visited, people, playNext])

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
