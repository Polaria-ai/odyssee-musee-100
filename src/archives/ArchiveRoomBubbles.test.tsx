import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { OrthographicCamera, type Camera } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EveningSession, SessionArchive } from '../types'
import { useGame } from '../state/gameStore'
import { input, placePlayer, resetInput } from '../state/runtime'
import { ArchiveBubbleGroups, ArchiveRoomBubbles } from './ArchiveRoomBubbles'
import { buildArchivesLayout } from './layout'
import {
  ARCHIVE_CLOUD_ANCHOR_Y,
  archivePublicationStats,
  avoidArchiveCloudBody,
  buildArchiveBubbleGroups,
  clampArchiveCloudRect,
  compactArchiveCounterRect,
  nearestArchiveBubbleGroup,
} from './archiveBubbleCloud'

const frame = vi.hoisted(() => ({ callback: null as null | ((state: { camera: Camera; size: { width: number; height: number } }, delta: number) => void) }))
vi.mock('@react-three/fiber', () => ({ useFrame: (callback: typeof frame.callback) => { frame.callback = callback } }))
vi.mock('@react-three/drei', () => ({ Html: ({ children }: { children: ReactNode }) => children }))
vi.mock('../audio', () => ({ playSfx: vi.fn() }))

// Corpus fictif : seules les dimensions 7/8/7 et les identifiants de tables sont ceux du contrat.
const sessions: EveningSession[] = [7, 8, 7].map((_, index) => ({
  id: `table-ronde-${index + 1}`,
  order: index + 1,
  startTime: '10:00',
  durationMin: 10,
  kind: 'table-ronde',
  title: { fr: `Table fictive ${index + 1}`, en: `Fictional panel ${index + 1}` },
  speakers: [],
  provisional: false,
}))
const layout = buildArchivesLayout(sessions, { minX: -10, maxX: 10, minZ: -10, maxZ: 10 })
const records: Record<string, SessionArchive> = Object.fromEntries(sessions.map((session, tableIndex) => {
  const highlights = Array.from({ length: [7, 8, 7][tableIndex] }, (_, index) => ({
    id: `fixture-${tableIndex}-${index}`,
    title: { fr: `Idée fictive ${tableIndex}.${index}`, en: index === 1 ? '' : `Fictional idea ${tableIndex}.${index}` },
    body: { fr: 'Résumé fictif.', en: 'Fictional summary.' },
    source: { excerpt: `Passage fictif ${tableIndex}.${index}.` },
  }))
  return [session.id, { sessionId: session.id, published: true, archivedAt: '2026-10-07T08:00:00.000Z', transcript: { fr: highlights.map((highlight) => highlight.source.excerpt).join('\n'), en: '' }, highlights }]
}))
const groups = buildArchiveBubbleGroups(layout, sessions, records)

beforeEach(() => {
  useGame.setState({
    lang: 'fr', screen: 'play', currentRoom: 'archives', sessions, archives: records,
    openSessionId: null, openArchiveHighlightId: null, openPersonId: null,
    dialogue: null, stampCardOpen: false, mapOpen: false, remiChatOpen: false,
  })
  resetInput()
  placePlayer(layout.slots[0].viewPoint.x, layout.slots[0].viewPoint.z)
})

describe('données et placement des bulles', () => {
  it('réutilise les trois positions et garde 7/8/7 thèmes sans changer les collisions', () => {
    const original = JSON.stringify(layout)
    expect(groups.map((group) => group.highlights.length)).toEqual([7, 8, 7])
    expect(groups.map((group) => group.sessionId)).toEqual(sessions.map((session) => session.id))
    groups.forEach((group, index) => expect(group.position).toEqual([layout.slots[index].position[0], ARCHIVE_CLOUD_ANCHOR_Y, layout.slots[index].position[2]]))
    expect(JSON.stringify(layout)).toBe(original)
  })

  it('ne révèle aucun brouillon, aucune ancienne archive sans thème ni séquence hors tables rondes', () => {
    expect(buildArchiveBubbleGroups(layout, sessions, { ...records, [sessions[0].id]: { ...records[sessions[0].id], published: false } })).toHaveLength(2)
    expect(buildArchiveBubbleGroups(layout, sessions, { ...records, [sessions[0].id]: { ...records[sessions[0].id], highlights: undefined } })).toHaveLength(2)
    expect(buildArchiveBubbleGroups(layout, sessions.map((session) => ({ ...session, kind: 'keynote' })), records)).toHaveLength(0)
    expect(buildArchiveBubbleGroups(layout, [], records)).toHaveLength(0)
  })

  it('le panneau compte uniquement les archives publiées des vitrines existantes', () => {
    expect(archivePublicationStats(layout, records)).toEqual({ panels: 3, highlights: 22 })
    expect(archivePublicationStats(layout, { ...records, outside: { ...records[sessions[0].id], sessionId: 'outside' }, [sessions[1].id]: { ...records[sessions[1].id], published: false } })).toEqual({ panels: 2, highlights: 14 })
    expect(archivePublicationStats(layout, {})).toEqual({ panels: 0, highlights: 0 })
  })

  it('déploie la vitrine la plus proche et aucune à distance', () => {
    expect(nearestArchiveBubbleGroup(groups, groups[1].viewPoint)).toBe(sessions[1].id)
    expect(nearestArchiveBubbleGroup(groups, { x: 99, z: 99 })).toBeNull()
  })

  it.each([{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 1440, height: 900 }])('garde le nuage dans le viewport $width×$height et sous le HUD', (viewport) => {
    const height = Math.min(160, viewport.height - 100 - (viewport.width <= 440 ? 180 : 64))
    const rect = clampArchiveCloudRect(-500, -50, 296, height, viewport)
    expect(rect.left).toBeGreaterThanOrEqual(12)
    expect(rect.left + rect.width).toBeLessThanOrEqual(viewport.width - 12)
    expect(rect.top).toBeGreaterThanOrEqual(viewport.width <= 440 ? 180 : 64)
    expect(rect.top + rect.height).toBeLessThanOrEqual(viewport.height - 100)
  })

  it('sépare les deux compteurs repliés sur un écran de320px', () => {
    const viewport = { width: 320, height: 568 }
    const rect = { left: 12, top: 180, width: 128, height: 52 }
    const first = compactArchiveCounterRect(rect, 0, viewport)
    const second = compactArchiveCounterRect(rect, 1, viewport)
    expect(first.top).toBe(116)
    expect(first.left + first.width).toBeLessThan(second.left)
    expect(second.left + second.width).toBe(308)
  })

  it('remonte un compteur qui couvrirait les boutons du nuage actif', () => {
    const rect = { left: 100, top: 220, width: 128, height: 52 }
    const active = { left: 80, top: 150, width: 300, height: 300 }
    expect(avoidArchiveCloudBody(rect, active).top + rect.height).toBeLessThan(active.top)
    expect(avoidArchiveCloudBody(rect, null)).toBe(rect)
  })
})

describe('ArchiveBubbleGroups — vrais boutons DOM', () => {
  it('garde les22 boutons dans le DOM, avec une seule liste visible et des ids stables', () => {
    render(<ArchiveBubbleGroups groups={groups} expandedSessionId={sessions[1].id} onSelectGroup={vi.fn()} onOpenHighlight={vi.fn()} />)
    expect(screen.getAllByTestId('archive-world-bubble')).toHaveLength(22)
    const panels = screen.getAllByTestId('archive-world-group')
    panels.forEach((panel, index) => {
      const toggle = within(panel).getByTestId('archive-world-group-toggle')
      expect(toggle).toHaveAttribute('data-session-id', sessions[index].id)
      expect(toggle).toHaveAttribute('aria-expanded', String(index === 1))
      const list = document.getElementById(toggle.getAttribute('aria-controls')!)!
      expect(list.hidden).toBe(index !== 1)
    })
    expect(within(panels[1]).getByRole('list')).toHaveAccessibleName('Table fictive 2')
  })

  it('envoie uniquement la table et le thème du bouton choisi', () => {
    const open = vi.fn()
    render(<ArchiveBubbleGroups groups={groups} expandedSessionId={sessions[2].id} onSelectGroup={vi.fn()} onOpenHighlight={open} />)
    fireEvent.click(screen.getByRole('button', { name: 'Idée fictive 2.4' }))
    expect(open).toHaveBeenCalledExactlyOnceWith('table-ronde-3', 'fixture-2-4')
  })

  it('conserve Entrée et Espace natifs sans propager keydown au contrôle du jeu, et libère keyup', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    const keyDown = vi.fn()
    const keyUp = vi.fn()
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    try {
      render(<ArchiveBubbleGroups groups={groups} expandedSessionId={null} onSelectGroup={select} onOpenHighlight={vi.fn()} />)
      await user.tab()
      keyDown.mockClear()
      await user.keyboard('{Enter}')
      await user.keyboard(' ')
      expect(select).toHaveBeenCalledTimes(2)
      expect(select).toHaveBeenLastCalledWith(sessions[0].id)
      expect(keyDown).not.toHaveBeenCalled()
      expect(keyUp).toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
    }
  })

  it('localise les titres en anglais avec repli français', () => {
    useGame.setState({ lang: 'en' })
    render(<ArchiveBubbleGroups groups={groups} expandedSessionId={sessions[0].id} onSelectGroup={vi.fn()} onOpenHighlight={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Fictional idea 0.0' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Idée fictive 0.1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Panel 1 · 7 key ideas' })).toBeInTheDocument()
  })
})

describe('ArchiveRoomBubbles — salle et proximité', () => {
  const camera = new OrthographicCamera(-12, 12, 8, -8, 0.1, 100)
  camera.position.set(0, 20, layout.slots[0].position[2])
  camera.lookAt(0, 0, layout.slots[0].position[2])
  camera.updateMatrixWorld()
  const tick = () => act(() => frame.callback?.({ camera, size: { width: 800, height: 600 } }, 0.13))

  it('déploie à proximité sans ouvrir de fiche ; le choix manuel persiste puis revient à la proximité après déplacement', () => {
    render(<ArchiveRoomBubbles archives={layout} />)
    tick()
    const toggles = screen.getAllByTestId('archive-world-group-toggle')
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true')
    input.moveX = 1
    input.tapTarget = { x: 1, z: 1 }
    fireEvent.click(toggles[1])
    tick()
    tick()
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'true')
    expect(useGame.getState().openSessionId).toBeNull()
    expect(input.moveX).toBe(0)
    expect(input.tapTarget).toBeNull()
    placePlayer(layout.slots[0].viewPoint.x + 1, layout.slots[0].viewPoint.z)
    tick()
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true')
  })

  it('ouvre la fiche du thème via le vrai bouton puis retire tous les boutons derrière la fiche', () => {
    render(<ArchiveRoomBubbles archives={layout} />)
    tick()
    fireEvent.click(screen.getByRole('button', { name: 'Idée fictive 0.2' }))
    expect(useGame.getState().openSessionId).toBe(sessions[0].id)
    expect(useGame.getState().openArchiveHighlightId).toBe('fixture-0-2')
    expect(screen.queryByTestId('archive-room-bubbles')).not.toBeInTheDocument()
  })

  it('retire une sélection manuelle dont les thèmes ne sont plus publiés après rafraîchissement', () => {
    render(<ArchiveRoomBubbles archives={layout} />)
    tick()
    fireEvent.click(screen.getAllByTestId('archive-world-group-toggle')[1])
    expect(screen.getAllByTestId('archive-world-group-toggle')[1]).toHaveAttribute('aria-expanded', 'true')
    act(() => useGame.setState({ archives: { ...records, [sessions[1].id]: { ...records[sessions[1].id], published: false } } }))
    tick()
    expect(screen.getAllByTestId('archive-world-group-toggle')).toHaveLength(2)
    expect(screen.getAllByTestId('archive-world-group-toggle')[0]).toHaveAttribute('aria-expanded', 'true')
  })

  it.each([
    { screen: 'title' as const }, { currentRoom: 'hall' as const }, { mapOpen: true },
    { stampCardOpen: true }, { remiChatOpen: true }, { openPersonId: 'fixture-person' },
    { openSessionId: sessions[0].id }, { dialogue: { id: 'fixture', speaker: { fr: 'Test', en: 'Test' }, lines: [] } },
  ])('supprime les cibles tactiles/clavier quand une autre interface est ouverte : %o', (state) => {
    useGame.setState(state)
    render(<ArchiveRoomBubbles archives={layout} />)
    expect(screen.queryByTestId('archive-room-bubbles')).not.toBeInTheDocument()
  })
})
