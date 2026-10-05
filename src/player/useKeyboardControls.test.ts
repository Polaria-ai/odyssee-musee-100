import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useGame } from '../state/gameStore'
import { input, resetInput } from '../state/runtime'
import { useKeyboardControls } from './useKeyboardControls'

function press(code: string, key = code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true }))
}

function release(code: string, key = code) {
  window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true, cancelable: true }))
}

describe('useKeyboardControls', () => {
  beforeEach(() => {
    resetInput()
    useGame.setState({
      openPersonId: null,
      dialogue: null,
      stampCardOpen: false,
      nearbyPersonId: null,
      nearCurator: false,
      visited: {},
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('flèches : met à jour moveX/moveY, remet à zéro au relâchement', () => {
    renderHook(() => useKeyboardControls(true))
    press('ArrowRight')
    expect(input.moveX).toBe(1)
    expect(input.moveY).toBe(0)
    release('ArrowRight')
    expect(input.moveX).toBe(0)

    press('ArrowDown')
    expect(input.moveY).toBe(1)
    release('ArrowDown')
    expect(input.moveY).toBe(0)
  })

  it('WASD (QWERTY) pilote le déplacement', () => {
    renderHook(() => useKeyboardControls(true))
    press('KeyW')
    expect(input.moveY).toBe(-1)
    release('KeyW')
    press('KeyD')
    expect(input.moveX).toBe(1)
    release('KeyD')
  })

  it('ZQSD (AZERTY) pilote le déplacement via les mêmes positions physiques que WASD', () => {
    renderHook(() => useKeyboardControls(true))
    // Sur un clavier AZERTY, la touche physique W (code KeyW) produit le caractère "z".
    press('KeyW', 'z')
    expect(input.moveY).toBe(-1)
    release('KeyW', 'z')
    press('KeyA', 'q')
    expect(input.moveX).toBe(-1)
    release('KeyA', 'q')
    press('KeyD', 'd')
    expect(input.moveX).toBe(1)
    release('KeyD', 'd')
  })

  it('déplacement diagonal : les deux axes sont actifs en même temps', () => {
    renderHook(() => useKeyboardControls(true))
    press('ArrowUp')
    press('ArrowRight')
    expect(input.moveX).toBe(1)
    expect(input.moveY).toBe(-1)
    release('ArrowUp')
    release('ArrowRight')
  })

  it('un mouvement clavier efface une cible de tap au sol en cours', () => {
    renderHook(() => useKeyboardControls(true))
    input.tapTarget = { x: 1, z: 2 }
    press('ArrowLeft')
    expect(input.tapTarget).toBeNull()
    release('ArrowLeft')
  })

  it('Shift active la course, la relâche l’arrête', () => {
    renderHook(() => useKeyboardControls(true))
    expect(input.run).toBe(false)
    press('ShiftLeft')
    expect(input.run).toBe(true)
    release('ShiftLeft')
    expect(input.run).toBe(false)
  })

  it('Entrée / E / Espace déclenchent interact()', () => {
    renderHook(() => useKeyboardControls(true))
    useGame.setState({ nearbyPersonId: 'p1' })
    press('Enter')
    expect(useGame.getState().openPersonId).toBe('p1')

    useGame.getState().closePerson()
    useGame.setState({ nearbyPersonId: 'p2' })
    press('KeyE')
    expect(useGame.getState().openPersonId).toBe('p2')

    useGame.getState().closePerson()
    useGame.setState({ nearbyPersonId: 'p3' })
    press('Space')
    expect(useGame.getState().openPersonId).toBe('p3')
  })

  it('quand `enabled` est faux, le déplacement et l’interaction sont ignorés', () => {
    renderHook(() => useKeyboardControls(false))
    useGame.setState({ nearbyPersonId: 'p1' })
    press('ArrowRight')
    expect(input.moveX).toBe(0)
    press('Enter')
    expect(useGame.getState().openPersonId).toBeNull()
  })

  it('passer `enabled` à faux remet immédiatement l’entrée à zéro, même touche tenue', () => {
    const { rerender } = renderHook(({ enabled }) => useKeyboardControls(enabled), {
      initialProps: { enabled: true },
    })
    press('ArrowUp')
    expect(input.moveY).toBe(-1)
    rerender({ enabled: false })
    expect(input.moveY).toBe(0)
    expect(input.moveX).toBe(0)
  })

  it('Échap ferme fiche, dialogue et carnet même quand `enabled` est faux', () => {
    renderHook(() => useKeyboardControls(false))
    useGame.setState({
      openPersonId: 'p1',
      dialogue: { id: 'd', speaker: { fr: 'M', en: 'M' }, lines: [{ text: { fr: 'x', en: 'x' } }] },
      stampCardOpen: true,
    })
    press('Escape')
    const s = useGame.getState()
    expect(s.openPersonId).toBeNull()
    expect(s.dialogue).toBeNull()
    expect(s.stampCardOpen).toBe(false)
  })

  it('le blur de la fenêtre remet les touches à zéro', () => {
    renderHook(() => useKeyboardControls(true))
    press('ArrowRight')
    press('ShiftLeft')
    expect(input.moveX).toBe(1)
    expect(input.run).toBe(true)
    window.dispatchEvent(new Event('blur'))
    expect(input.moveX).toBe(0)
    expect(input.run).toBe(false)
    // Un relâchement tardif de la touche déjà oubliée ne doit rien casser.
    release('ArrowRight')
    expect(input.moveX).toBe(0)
  })

  it('le démontage retire les écouteurs et remet l’entrée à zéro', () => {
    const { unmount } = renderHook(() => useKeyboardControls(true))
    press('ArrowRight')
    expect(input.moveX).toBe(1)
    unmount()
    expect(input.moveX).toBe(0)
    press('ArrowRight')
    expect(input.moveX).toBe(0)
  })
})
