import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from '../../state/gameStore'
import { generatePlaceholderPeople } from '../../data/placeholder'
import { buildMuseumLayout } from '../../world/layout'
import { useStampWatcher } from './useStampWatcher'

// Découple ce test du contenu réel des dialogues de Minerve (module d'un autre agent, en chantier) :
// on ne vérifie que le comportement de useStampWatcher (attribution, file d'attente, ouverture du carnet).
vi.mock('../../npc/minerveScript', () => ({
  minerveDialogue: (event: { kind: string }) => ({
    id: event.kind,
    speaker: { fr: 'Minerve', en: 'Minerva' },
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
    })
    useGame.getState().setMuseum(people, buildMuseumLayout(people), 'placeholder')
  })

  function visitWing(wing: 'infrastructures' | 'industrialisation' | 'culture') {
    const ids = useGame
      .getState()
      .people.filter((p) => p.wing === wing)
      .map((p) => p.id)
    act(() => {
      for (const id of ids) useGame.getState().markVisited(id)
    })
  }

  it('attribue un tampon, affiche un toast, joue le son et ouvre le dialogue de Minerve quand le seuil est atteint', () => {
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
})
