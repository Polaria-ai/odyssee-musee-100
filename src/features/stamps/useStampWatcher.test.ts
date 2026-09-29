import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from '../../state/gameStore'
import { generatePlaceholderPeople } from '../../data/placeholder'
import { buildMuseumLayout } from '../../world/layout'
import { useStampWatcher } from './useStampWatcher'

// Découple ce test du contenu réel des dialogues (Rémi et l'Archiviste) : on ne vérifie que le
// comportement de useStampWatcher (attribution, file d'attente, ouverture du carnet).
vi.mock('../../npc/remiScript', () => ({
  remiDialogue: (event: { kind: string }) => ({
    id: event.kind,
    speaker: { fr: 'Rémi Godeau', en: 'Rémi Godeau' },
    lines: [{ text: { fr: event.kind, en: event.kind } }],
  }),
}))
vi.mock('../../archives/archivistScript', () => ({
  archivistDialogue: (event: { kind: string }) => ({
    id: `archivist-${event.kind}`,
    speaker: { fr: "L'Archiviste", en: 'The Archivist' },
    lines: [{ text: { fr: event.kind, en: event.kind } }],
  }),
}))

// Le module audio (stub d'un autre agent) est no-op tant que le son est coupé ; on vérifie ici
// seulement que useStampWatcher l'appelle avec le bon identifiant, pas un comportement sonore.
const playSfxMock = vi.fn()
vi.mock('../../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
}))

describe('useStampWatcher', () => {
  beforeEach(() => {
    playSfxMock.mockClear()
    const people = generatePlaceholderPeople(9) // 3 personnes par aile
    useGame.setState({
      visited: {},
      stamps: {},
      dialogue: null,
      dialogueIndex: 0,
      toast: null,
      stampCardOpen: false,
      sessions: [],
      visitedSessions: {},
    })
    useGame.getState().setMuseum(people, buildMuseumLayout(people), 'placeholder')
  })

  function makeSessions(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      order: i,
      startTime: '18:30',
      durationMin: 5,
      kind: 'keynote' as const,
      title: { fr: `Séquence ${i}`, en: `Session ${i}` },
      speakers: [],
      provisional: true,
    }))
  }

  function visitWing(wing: 'infrastructures' | 'industrialisation' | 'culture') {
    const ids = useGame
      .getState()
      .people.filter((p) => p.wing === wing)
      .map((p) => p.id)
    act(() => {
      for (const id of ids) useGame.getState().markVisited(id)
    })
  }

  it('attribue un tampon, affiche un toast, joue le son et ouvre le dialogue de Rémi quand le seuil est atteint', () => {
    renderHook(() => useStampWatcher())
    visitWing('infrastructures')

    expect(useGame.getState().stamps.infrastructures).toBeTypeOf('number')
    expect(useGame.getState().toast).not.toBeNull()
    expect(useGame.getState().dialogue?.id).toBe('stamp')
    expect(playSfxMock).toHaveBeenCalledWith('stamp')
  })

  it('ne ré-attribue pas un tampon déjà obtenu (persisté au rechargement) et ne rejoue pas le son', () => {
    useGame.setState({ stamps: { infrastructures: 123 } })
    renderHook(() => useStampWatcher())
    visitWing('infrastructures')

    expect(useGame.getState().stamps.infrastructures).toBe(123)
    expect(useGame.getState().dialogue).toBeNull()
    expect(playSfxMock).not.toHaveBeenCalledWith('stamp')
  })

  it('met en file le dialogue de tampon si un dialogue est déjà ouvert, et le rejoue à sa fermeture', () => {
    renderHook(() => useStampWatcher())
    act(() => {
      useGame.getState().startDialogue({ id: 'talk', speaker: { fr: 'M', en: 'M' }, lines: [{ text: { fr: 'a', en: 'a' } }] })
    })

    visitWing('infrastructures')

    // Le dialogue en cours n'est pas interrompu, mais le tampon est déjà attribué.
    expect(useGame.getState().dialogue?.id).toBe('talk')
    expect(useGame.getState().stamps.infrastructures).toBeTypeOf('number')

    act(() => {
      useGame.getState().closeDialogue()
    })
    expect(useGame.getState().dialogue?.id).toBe('stamp')
  })

  it('à la complétion des trois ailes, joue le son « complete », enchaîne le dialogue puis ouvre le carnet', () => {
    renderHook(() => useStampWatcher())
    useGame.setState({ stamps: { infrastructures: 1, industrialisation: 2 } })

    visitWing('culture')

    expect(useGame.getState().dialogue?.id).toBe('stamp')
    expect(useGame.getState().stampCardOpen).toBe(false)
    expect(playSfxMock).toHaveBeenCalledWith('stamp')
    expect(playSfxMock).toHaveBeenCalledWith('complete')

    act(() => {
      useGame.getState().closeDialogue()
    })
    expect(useGame.getState().dialogue?.id).toBe('complete')
    expect(useGame.getState().stampCardOpen).toBe(false)

    act(() => {
      useGame.getState().closeDialogue()
    })
    expect(useGame.getState().stampCardOpen).toBe(true)
  })

  describe('tampon Archives (4e tampon, déduit de visitedSessions)', () => {
    it('attribue le tampon Archives, toast + dialogue de l’Archiviste, au seuil (3 archives)', () => {
      useGame.setState({ sessions: makeSessions(17) })
      renderHook(() => useStampWatcher())

      act(() => {
        useGame.getState().openSession('s0')
        useGame.getState().openSession('s1')
        useGame.getState().openSession('s2')
      })

      expect(useGame.getState().dialogue?.id).toBe('archivist-stampAwarded')
      expect(useGame.getState().toast).not.toBeNull()
      expect(playSfxMock).toHaveBeenCalledWith('stamp')
    })

    it('ne se déclenche pas en dessous du seuil', () => {
      useGame.setState({ sessions: makeSessions(17) })
      renderHook(() => useStampWatcher())

      act(() => {
        useGame.getState().openSession('s0')
      })

      expect(useGame.getState().dialogue).toBeNull()
    })

    it('déjà obtenu avant le montage (persisté) : ne rejoue pas toast ni dialogue', () => {
      useGame.setState({ sessions: makeSessions(17), visitedSessions: { s0: 1, s1: 2, s2: 3 } })
      renderHook(() => useStampWatcher())

      expect(useGame.getState().dialogue).toBeNull()
      expect(useGame.getState().toast).toBeNull()
    })

    it('avec moins de 3 séquences au programme, toutes les consulter suffit', () => {
      useGame.setState({ sessions: makeSessions(2) })
      renderHook(() => useStampWatcher())

      act(() => {
        useGame.getState().openSession('s0')
        useGame.getState().openSession('s1')
      })

      expect(useGame.getState().dialogue?.id).toBe('archivist-stampAwarded')
    })

    it('avec les trois ailes déjà tamponnées, obtenir Archives déclenche « complete » et ouvre le carnet', () => {
      useGame.setState({
        sessions: makeSessions(17),
        stamps: { infrastructures: 1, industrialisation: 2, culture: 3 },
      })
      renderHook(() => useStampWatcher())

      act(() => {
        useGame.getState().openSession('s0')
        useGame.getState().openSession('s1')
        useGame.getState().openSession('s2')
      })

      expect(useGame.getState().dialogue?.id).toBe('archivist-stampAwarded')
      expect(playSfxMock).toHaveBeenCalledWith('complete')

      act(() => {
        useGame.getState().closeDialogue()
      })
      expect(useGame.getState().dialogue?.id).toBe('complete')

      act(() => {
        useGame.getState().closeDialogue()
      })
      expect(useGame.getState().stampCardOpen).toBe(true)
    })
  })
})
