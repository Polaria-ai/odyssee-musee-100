/**
 * Nuages DOM projetés au-dessus des trois vitrines. Texte lisible, clavier et vraies cibles tactiles,
 * sans appel de dessin supplémentaire. Un nuage se déploie à proximité ou au clic sur sa pastille.
 */
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'
import type { ArchivesLayout } from '../types'
import { usePick, useT } from '../i18n'
import { isOverlayOpen, useGame } from '../state/gameStore'
import { player, resetInput } from '../state/runtime'
import { playSfx } from '../audio'
import { cardStrings } from './cardStrings'
import {
  ARCHIVE_CLOUD_MANUAL_MOVE_DISTANCE,
  avoidArchiveCloudBody,
  buildArchiveBubbleGroups,
  clampArchiveCloudRect,
  compactArchiveCounterRect,
  nearestArchiveBubbleGroup,
  type ArchiveBubbleGroup,
  type CloudRect,
} from './archiveBubbleCloud'
import './archives.css'

interface BubbleGroupsProps {
  groups: readonly ArchiveBubbleGroup[]
  expandedSessionId: string | null
  onSelectGroup: (id: string) => void
  onOpenHighlight: (sessionId: string, highlightId: string) => void
  onGroupRef?: (id: string, element: HTMLDivElement | null) => void
}

/** Vue DOM séparée du Canvas pour tester clavier, publication et sélection sans simuler WebGL. */
export function ArchiveBubbleGroups({ groups, expandedSessionId, onSelectGroup, onOpenHighlight, onGroupRef }: BubbleGroupsProps) {
  const t = useT(cardStrings)
  const p = usePick()
  return (
    <section
      className="archive-room-bubbles"
      data-testid="archive-room-bubbles"
      aria-label={t('archiveRoomBubblesLabel')}
      // WINDOW pilote aussi Entrée/Espace : le bouton DOM conserve son activation native.
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      {groups.map((group) => {
        const expanded = expandedSessionId === group.sessionId
        const listId = `archive-room-list-${group.sessionId}`
        return (
          <div
            key={group.sessionId}
            className={`archive-world-group${expanded ? ' archive-world-group--expanded' : ''}`}
            data-testid="archive-world-group"
            data-session-id={group.sessionId}
            ref={(element) => onGroupRef?.(group.sessionId, element)}
          >
            <button
              type="button"
              className="archive-world-group__toggle"
              data-testid="archive-world-group-toggle"
              data-session-id={group.sessionId}
              aria-expanded={expanded}
              aria-controls={listId}
              aria-label={`${t('archiveBubblePanel', { number: group.number })} · ${t('archiveBubbleCount', { count: group.highlights.length })}`}
              onClick={() => onSelectGroup(group.sessionId)}
            >
              <span>{t('archiveBubblePanel', { number: group.number })}</span>
              <span className="archive-world-group__count">{t('archiveBubbleCount', { count: group.highlights.length })}</span>
            </button>
            <div id={listId} className="archive-world-group__body" hidden={!expanded}>
              <p className="archive-world-group__instruction">{t('archiveBubbleInstruction')}</p>
              <ul className="archive-world-group__list" aria-label={p(group.session.title)}>
                {group.highlights.map((highlight, index) => (
                  <li key={highlight.id}>
                    <button
                      type="button"
                      className="archive-world-group__bubble"
                      data-testid="archive-world-bubble"
                      data-session-id={group.sessionId}
                      data-highlight-id={highlight.id}
                      onClick={() => onOpenHighlight(group.sessionId, highlight.id)}
                    >
                      <span className="archive-world-group__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                      <span>{p(highlight.title)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })}
    </section>
  )
}

const projected = new Vector3()

export function ArchiveRoomBubbles({ archives }: { archives: ArchivesLayout }) {
  const sessions = useGame((state) => state.sessions)
  const records = useGame((state) => state.archives)
  const visible = useGame((state) => state.screen === 'play' && state.currentRoom === 'archives' && !isOverlayOpen(state))
  const groups = useMemo(() => buildArchiveBubbleGroups(archives, sessions, records), [archives, sessions, records])
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const expandedRef = useRef<string | null>(null)
  const groupElements = useRef<Record<string, HTMLDivElement | null>>({})
  const manualRef = useRef<{ sessionId: string; x: number; z: number } | null>(null)
  const timer = useRef(0)

  function expand(id: string | null) {
    if (expandedRef.current === id) return
    expandedRef.current = id
    setExpandedSessionId(id)
  }

  useFrame(({ camera, size }, delta) => {
    if (!visible) return
    timer.current += delta
    if (timer.current >= 0.12) {
      timer.current = 0
      const manual = manualRef.current
      if (manual && (!groups.some((group) => group.sessionId === manual.sessionId) || Math.hypot(player.x - manual.x, player.z - manual.z) > ARCHIVE_CLOUD_MANUAL_MOVE_DISTANCE)) manualRef.current = null
      expand(manualRef.current?.sessionId ?? nearestArchiveBubbleGroup(groups, player))
    }

    // Les dimensions DOM restent fixes et lisibles ; seules les positions suivent la caméra.
    let expandedRect: CloudRect | null = null
    const active = groups.find((group) => group.sessionId === expandedRef.current)
    if (active) {
      const element = groupElements.current[active.sessionId]
      if (element) {
        projected.set(...active.position).project(camera)
        const x = (projected.x + 1) * size.width / 2
        const y = (1 - projected.y) * size.height / 2
        expandedRect = clampArchiveCloudRect(x, y, element.offsetWidth, element.offsetHeight, size)
      }
    }
    let collapsedIndex = 0
    for (const group of groups) {
      const element = groupElements.current[group.sessionId]
      if (!element) continue
      projected.set(...group.position).project(camera)
      const x = (projected.x + 1) * size.width / 2
      const y = (1 - projected.y) * size.height / 2
      const inView = projected.z > -1 && projected.z < 1 && x > -64 && x < size.width + 64 && y > -64 && y < size.height + 64
      element.style.visibility = inView ? 'visible' : 'hidden'
      let rect = group.sessionId === expandedRef.current && expandedRect
        ? expandedRect
        : avoidArchiveCloudBody(clampArchiveCloudRect(x, y, element.offsetWidth, element.offsetHeight, size), expandedRect)
      if (size.width <= 440 && expandedRect && group.sessionId !== expandedRef.current) {
        rect = compactArchiveCounterRect(rect, collapsedIndex++, size)
      }
      element.style.left = `${rect.left}px`
      element.style.top = `${rect.top}px`
    }
  })

  if (!visible || groups.length === 0) return null
  return (
    <Html
      fullscreen
      zIndexRange={[14, 12]}
      style={{ pointerEvents: 'none' }}
      calculatePosition={(_object, _camera, size) => [size.width / 2, size.height / 2]}
    >
      <ArchiveBubbleGroups
        groups={groups}
        expandedSessionId={expandedSessionId}
        onGroupRef={(id, element) => { groupElements.current[id] = element }}
        onSelectGroup={(id) => {
          resetInput()
          playSfx('click')
          manualRef.current = { sessionId: id, x: player.x, z: player.z }
          expand(id)
        }}
        onOpenHighlight={(sessionId, highlightId) => {
          resetInput()
          playSfx('click')
          useGame.getState().openArchiveHighlight(sessionId, highlightId)
        }}
      />
    </Html>
  )
}
