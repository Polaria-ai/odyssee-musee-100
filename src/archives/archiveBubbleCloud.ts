/** Données et placement des nuages de thèmes. Pur : aucun changement du programme ou des collisions. */
import type { ArchiveHighlight, ArchivesLayout, EveningSession, SessionArchive, Vec2 } from '../types'

export const ARCHIVE_CLOUD_NEAR_DISTANCE = 4.5
export const ARCHIVE_CLOUD_MANUAL_MOVE_DISTANCE = 0.9
export const ARCHIVE_CLOUD_ANCHOR_Y = 2.6

export interface ArchiveBubbleGroup {
  sessionId: string
  number: number
  session: EveningSession
  position: [number, number, number]
  viewPoint: Vec2
  highlights: readonly ArchiveHighlight[]
}

export function buildArchiveBubbleGroups(
  layout: ArchivesLayout,
  sessions: readonly EveningSession[],
  archives: Readonly<Record<string, SessionArchive>>,
): ArchiveBubbleGroup[] {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  return layout.slots.flatMap((slot, index) => {
    const archive = archives[slot.sessionId]
    const session = sessionById.get(slot.sessionId)
    if (!session || session.kind !== 'table-ronde' || !archive?.published || !archive.highlights?.length) return []
    return [{
      sessionId: slot.sessionId,
      number: index + 1,
      session,
      position: [slot.position[0], ARCHIVE_CLOUD_ANCHOR_Y, slot.position[2]],
      viewPoint: slot.viewPoint,
      highlights: archive.highlights,
    }]
  })
}

export function nearestArchiveBubbleGroup(groups: readonly ArchiveBubbleGroup[], point: Vec2): string | null {
  let nearest: string | null = null
  let distance = ARCHIVE_CLOUD_NEAR_DISTANCE
  for (const group of groups) {
    const candidate = Math.hypot(point.x - group.position[0], point.z - group.position[2])
    if (candidate < distance) {
      distance = candidate
      nearest = group.sessionId
    }
  }
  return nearest
}

export interface CloudRect { left: number; top: number; width: number; height: number }

/** Place le panneau lisible au-dessus du joystick, sous le HUD, sans dépasser l'écran. */
export function clampArchiveCloudRect(
  centerX: number,
  anchorY: number,
  width: number,
  height: number,
  viewport: { width: number; height: number },
): CloudRect {
  const margin = 12
  // Sur les petits portraits, la pastille de salle occupe 68–104 px sous la barre du HUD.
  const top = viewport.width <= 440 ? 180 : 64
  const bottom = 100
  const safeWidth = Math.min(width, viewport.width - margin * 2)
  const left = Math.min(Math.max(margin, centerX - safeWidth / 2), viewport.width - safeWidth - margin)
  const latestTop = Math.max(top, viewport.height - bottom - height)
  return { left, top: Math.min(Math.max(top, anchorY - 24), latestTop), width: safeWidth, height }
}

/** Deux compteurs repliés au-dessus du nuage sur mobile : tous restent touchables sans se couvrir. */
export function compactArchiveCounterRect(rect: CloudRect, index: number, viewport: { width: number; height: number }): CloudRect {
  return {
    ...rect,
    left: index === 0 ? 12 : viewport.width - rect.width - 12,
    top: 116,
  }
}

/** Les pastilles d'autres tables restent accessibles au-dessus d'un nuage qui les recouvrirait. */
export function avoidArchiveCloudBody(rect: CloudRect, expanded: CloudRect | null): CloudRect {
  if (!expanded) return rect
  const intersectsBody = rect.left < expanded.left + expanded.width && rect.left + rect.width > expanded.left &&
    rect.top < expanded.top + expanded.height && rect.top + rect.height > expanded.top + 56
  return intersectsBody ? { ...rect, top: Math.max(64, expanded.top - rect.height - 8) } : rect
}

export function archivePublicationStats(layout: ArchivesLayout, archives: Readonly<Record<string, SessionArchive>>) {
  const published = layout.slots.flatMap((slot) => archives[slot.sessionId]?.published ? [archives[slot.sessionId]] : [])
  return { panels: published.length, highlights: published.reduce((count, archive) => count + (archive.highlights?.length ?? 0), 0) }
}
