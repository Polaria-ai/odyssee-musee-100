/**
 * Salle des Archives de 2040 : rendu 3D complet (voir `docs/DESIGN.md`, `docs/ARCHITECTURE.md`).
 * Assemble l'ambiance fixe (`room/RoomShell.tsx`), la Porte de 2040 aller/retour (`room/Portal.tsx`) et
 * une vitrine par séquence (`room/Vitrine.tsx`). Propriétaire : workflow « Archives de 2040 » (module
 * salle 3D, WEL-881). Contrat (signature) : voir `docs/ARCHITECTURE.md`.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { ArchivesLayout } from '../types'
import { useGame } from '../state/gameStore'
import { player } from '../state/runtime'
import { dims } from '../styles/tokens'
import { pointInAabb } from '../world/collision'
import { RoomShell } from './room/RoomShell'
import { ArchivesPortals } from './room/Portal'
import { Vitrine, pulseIdleCapsule } from './room/Vitrine'
import { PROXIMITY_CHECK_INTERVAL } from './room/constants'
import { Archivist } from './Archivist'

/**
 * Vitrine proche (bouton « Consulter ») : détection toutes les ~120 ms sur `runtime.player`, seulement
 * quand le joueur est dans la salle (jamais calculé pour rien ailleurs dans le musée). Aucune
 * allocation : coordonnées lues directement sur `player`.
 *
 * La proximité de l'Archiviste (`store.nearArchivist`) n'est PAS calculée ici : `Archivist.tsx` (autre
 * phase de ce workflow) la détecte déjà elle-même — un second calcul ferait doublon.
 */
function useVitrineProximity(archives: ArchivesLayout) {
  const timer = useRef(0)
  useFrame((_state, delta) => {
    timer.current += delta
    if (timer.current < PROXIMITY_CHECK_INTERVAL) return
    timer.current = 0

    const g = useGame.getState()
    if (!pointInAabb({ x: player.x, z: player.z }, archives.room.bounds, dims.playerRadius)) {
      if (g.nearbySessionId !== null) g.setNearbySession(null)
      return
    }

    let nearestId: string | null = null
    let nearestDist: number = dims.interactRadius
    for (const slot of archives.slots) {
      const d = Math.hypot(player.x - slot.viewPoint.x, player.z - slot.viewPoint.z)
      if (d <= nearestDist) {
        nearestDist = d
        nearestId = slot.sessionId
      }
    }
    g.setNearbySession(nearestId)
  })
}

export function ArchivesRoom({ archives }: { archives: ArchivesLayout }) {
  const sessions = useGame((s) => s.sessions)
  const archiveRecords = useGame((s) => s.archives)
  const lang = useGame((s) => s.lang)

  useVitrineProximity(archives)
  // Pulse partagée des capsules « en attente » (voir `Vitrine.tsx::pulseIdleCapsule`) : une seule
  // mutation par image pour toutes les vitrines, jamais une par instance.
  useFrame(({ clock }) => pulseIdleCapsule(clock.elapsedTime))

  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions])

  return (
    <group>
      <RoomShell archives={archives} lang={lang} />
      <ArchivesPortals archives={archives} />
      <Archivist placement={archives.archivist} />
      {archives.slots.map((slot) => {
        const session = sessionById.get(slot.sessionId)
        if (!session) return null
        return <Vitrine key={slot.sessionId} slot={slot} session={session} archive={archiveRecords[slot.sessionId]} />
      })}
    </group>
  )
}
