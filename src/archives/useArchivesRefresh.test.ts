import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { SessionArchive } from '../types'
import { useGame } from '../state/gameStore'
import { ARCHIVE_SESSIONS } from '../data/eveningProgram'
import { ARCHIVES_REFRESH_MS, sameArchives, useArchivesRefresh } from './useArchivesRefresh'

const loadPublishedArchives = vi.fn<() => Promise<Record<string, SessionArchive> | null>>()
vi.mock('../data/evening', () => ({ loadPublishedArchives: () => loadPublishedArchives() }))

// Archive manifestement factice, fabriquée pour ce test.
function archive(sessionId: string, fr = '[Test] transcription factice'): SessionArchive {
  return { sessionId, transcript: { fr, en: '' }, archivedAt: '2026-10-06T23:00:00+02:00', published: true }
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('sameArchives', () => {
  it('compare séquences et contenus, pas l’ordre des clés', () => {
    const a = { x: archive('x'), y: archive('y') }
    expect(sameArchives(a, { y: archive('y'), x: archive('x') })).toBe(true)
    expect(sameArchives(a, { x: archive('x') })).toBe(false)
    expect(sameArchives(a, { x: archive('x'), y: archive('y', '[Test] corrigée') })).toBe(false)
  })
})

describe('useArchivesRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    loadPublishedArchives.mockReset()
    useGame.setState({ archives: {}, sessions: ARCHIVE_SESSIONS, currentRoom: 'archives', toast: null })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('relit les archives à l’entrée dans la salle et annonce les nouvelles', async () => {
    loadPublishedArchives.mockResolvedValue({ 'table-ronde-1': archive('table-ronde-1') })
    renderHook(() => useArchivesRefresh(true))
    await flush()
    expect(loadPublishedArchives).toHaveBeenCalledTimes(1)
    expect(Object.keys(useGame.getState().archives)).toEqual(['table-ronde-1'])
    expect(useGame.getState().toast?.text.fr).toContain('Nouvelles transcriptions')
  })

  it('relit périodiquement tant que le joueur reste dans la salle', async () => {
    loadPublishedArchives.mockResolvedValue({})
    renderHook(() => useArchivesRefresh(true))
    await flush()
    await act(async () => {
      vi.advanceTimersByTime(ARCHIVES_REFRESH_MS * 2)
    })
    await flush()
    expect(loadPublishedArchives).toHaveBeenCalledTimes(3)
  })

  it('ne relit rien hors de la salle des Archives, ni hors partie', async () => {
    useGame.setState({ currentRoom: 'hall' })
    renderHook(() => useArchivesRefresh(true))
    renderHook(() => useArchivesRefresh(false))
    await act(async () => {
      vi.advanceTimersByTime(ARCHIVES_REFRESH_MS * 3)
    })
    expect(loadPublishedArchives).not.toHaveBeenCalled()
  })

  it('garde les archives connues si Supabase est injoignable', async () => {
    useGame.setState({ archives: { 'table-ronde-1': archive('table-ronde-1') } })
    loadPublishedArchives.mockResolvedValue(null)
    renderHook(() => useArchivesRefresh(true))
    await flush()
    expect(Object.keys(useGame.getState().archives)).toEqual(['table-ronde-1'])
    expect(useGame.getState().toast).toBeNull()
  })

  it('retire une archive dépubliée, sans annonce', async () => {
    useGame.setState({ archives: { 'table-ronde-1': archive('table-ronde-1'), 'table-ronde-2': archive('table-ronde-2') } })
    loadPublishedArchives.mockResolvedValue({ 'table-ronde-1': archive('table-ronde-1') })
    renderHook(() => useArchivesRefresh(true))
    await flush()
    expect(Object.keys(useGame.getState().archives)).toEqual(['table-ronde-1'])
    expect(useGame.getState().toast).toBeNull()
  })
})
