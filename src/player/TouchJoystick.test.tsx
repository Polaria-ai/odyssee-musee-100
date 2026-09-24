import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bridges, input } from '../state/runtime'
import { TouchJoystick } from './TouchJoystick'

function pointerDown(target: Element, opts: Partial<PointerEventInit> & { clientX: number; clientY: number }) {
  fireEvent(target, new PointerEvent('pointerdown', { pointerId: 1, bubbles: true, cancelable: true, ...opts }))
}
function pointerMove(target: Element, opts: Partial<PointerEventInit> & { clientX: number; clientY: number }) {
  fireEvent(target, new PointerEvent('pointermove', { pointerId: 1, bubbles: true, cancelable: true, ...opts }))
}
function pointerUp(target: Element, opts: Partial<PointerEventInit> & { clientX: number; clientY: number }) {
  fireEvent(target, new PointerEvent('pointerup', { pointerId: 1, bubbles: true, cancelable: true, ...opts }))
}
function pointerCancel(target: Element, opts: Partial<PointerEventInit> & { clientX: number; clientY: number } = { clientX: 0, clientY: 0 }) {
  fireEvent(target, new PointerEvent('pointercancel', { pointerId: 1, bubbles: true, cancelable: true, ...opts }))
}

describe('TouchJoystick', () => {
  beforeEach(() => {
    input.moveX = 0
    input.moveY = 0
    input.run = false
    input.tapTarget = null
    bridges.screenToFloor = null
  })

  afterEach(() => {
    cleanup()
    bridges.screenToFloor = null
  })

  it('affiche la zone de capture mais pas le bouton avant le premier contact', () => {
    const { getByTestId, queryByTestId } = render(<TouchJoystick />)
    expect(getByTestId('joystick-zone')).toBeInTheDocument()
    expect(queryByTestId('joystick-knob')).not.toBeInTheDocument()
  })

  it('fait apparaître le joystick au premier contact', () => {
    const { getByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 100, clientY: 200 }))
    expect(getByTestId('joystick-knob')).toBeInTheDocument()
  })

  it('un glissement vers le bas-droite écrit moveX > 0 et moveY > 0', () => {
    const { getByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 100, clientY: 100 }))
    act(() => pointerMove(zone, { clientX: 140, clientY: 140 }))
    expect(input.moveX).toBeGreaterThan(0)
    expect(input.moveY).toBeGreaterThan(0)
  })

  it('vers le haut de l’écran donne un moveY négatif', () => {
    const { getByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 100, clientY: 100 }))
    act(() => pointerMove(zone, { clientX: 100, clientY: 40 }))
    expect(input.moveY).toBeLessThan(0)
    expect(input.moveX).toBeCloseTo(0)
  })

  it('reste à zéro dans la zone morte (12 %)', () => {
    const { getByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 100, clientY: 100 }))
    // 5 px de déplacement sur un rayon max de 60 px = 8 % : sous la zone morte de 12 %.
    act(() => pointerMove(zone, { clientX: 105, clientY: 100 }))
    expect(input.moveX).toBe(0)
    expect(input.moveY).toBe(0)
  })

  it('un poussé à fond (100 %) sature à ±1 et active la course', () => {
    const { getByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 100, clientY: 100 }))
    act(() => pointerMove(zone, { clientX: 100 + 200, clientY: 100 })) // très au-delà du rayon max (clampé)
    expect(input.moveX).toBeCloseTo(1)
    expect(input.run).toBe(true)
  })

  it('un poussé léger (au-delà de la zone morte, sous 90 %) ne déclenche pas la course', () => {
    const { getByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 100, clientY: 100 }))
    act(() => pointerMove(zone, { clientX: 100 + 30, clientY: 100 })) // 30/60 = 50 %
    expect(input.run).toBe(false)
    expect(input.moveX).toBeGreaterThan(0)
    expect(input.moveX).toBeLessThan(1)
  })

  it('relâcher remet moveX/moveY/run à zéro et masque le joystick', () => {
    const { getByTestId, queryByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 100, clientY: 100 }))
    act(() => pointerMove(zone, { clientX: 160, clientY: 100 }))
    expect(input.moveX).toBeGreaterThan(0)
    act(() => pointerUp(zone, { clientX: 160, clientY: 100 }))
    expect(input.moveX).toBe(0)
    expect(input.moveY).toBe(0)
    expect(input.run).toBe(false)
    expect(queryByTestId('joystick-knob')).not.toBeInTheDocument()
  })

  it('pointercancel remet l’entrée à zéro', () => {
    const { getByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 100, clientY: 100 }))
    act(() => pointerMove(zone, { clientX: 160, clientY: 100 }))
    act(() => pointerCancel(zone, { clientX: 160, clientY: 100 }))
    expect(input.moveX).toBe(0)
  })

  it('un second doigt est ignoré : seul le premier pilote', () => {
    const { getByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 100, clientY: 100, pointerId: 1 }))
    act(() => pointerDown(zone, { clientX: 300, clientY: 300, pointerId: 2 }))
    act(() => pointerMove(zone, { clientX: 350, clientY: 300, pointerId: 2 }))
    // Le second doigt n'a rien changé : toujours à zéro (le premier n'a pas bougé).
    expect(input.moveX).toBe(0)
    expect(input.moveY).toBe(0)
    act(() => pointerMove(zone, { clientX: 160, clientY: 100, pointerId: 1 }))
    expect(input.moveX).toBeGreaterThan(0)
  })

  it('un tap court pose une cible via bridges.screenToFloor et affiche un marqueur', () => {
    const screenToFloor = vi.fn().mockReturnValue({ x: 3, z: 4 })
    bridges.screenToFloor = screenToFloor
    const { getByTestId, container } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 50, clientY: 60 }))
    act(() => pointerUp(zone, { clientX: 52, clientY: 61 }))
    expect(screenToFloor).toHaveBeenCalledWith(52, 61)
    expect(input.tapTarget).toEqual({ x: 3, z: 4 })
    expect(container.querySelector('.joystick-tap-marker')).not.toBeNull()
  })

  it('le marqueur de tap disparaît tout seul même sans `animationend` (prefers-reduced-motion coupe l’animation)', () => {
    vi.useFakeTimers()
    try {
      const screenToFloor = vi.fn().mockReturnValue({ x: 3, z: 4 })
      bridges.screenToFloor = screenToFloor
      const { getByTestId, container } = render(<TouchJoystick />)
      const zone = getByTestId('joystick-zone')
      act(() => pointerDown(zone, { clientX: 50, clientY: 60 }))
      act(() => pointerUp(zone, { clientX: 52, clientY: 61 }))
      expect(container.querySelector('.joystick-tap-marker')).not.toBeNull()
      // jsdom ne déclenche jamais `animationend` : seul le filet de sécurité (setTimeout) peut retirer le marqueur.
      act(() => {
        vi.advanceTimersByTime(600)
      })
      expect(container.querySelector('.joystick-tap-marker')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('un glissement trop long n’est pas un tap : pas de tapTarget', () => {
    const screenToFloor = vi.fn().mockReturnValue({ x: 3, z: 4 })
    bridges.screenToFloor = screenToFloor
    const { getByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 50, clientY: 60 }))
    act(() => pointerMove(zone, { clientX: 90, clientY: 60 })) // > 10 px : ne compte plus comme un tap
    act(() => pointerUp(zone, { clientX: 90, clientY: 60 }))
    expect(screenToFloor).not.toHaveBeenCalled()
    expect(input.tapTarget).toBeNull()
  })

  it('sans bridges.screenToFloor enregistré, un tap ne casse rien et ne pose pas de cible', () => {
    bridges.screenToFloor = null
    const { getByTestId } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 50, clientY: 60 }))
    act(() => pointerUp(zone, { clientX: 51, clientY: 60 }))
    expect(input.tapTarget).toBeNull()
  })

  it('démonter pendant un contact remet l’entrée à zéro', () => {
    const { getByTestId, unmount } = render(<TouchJoystick />)
    const zone = getByTestId('joystick-zone')
    act(() => pointerDown(zone, { clientX: 100, clientY: 100 }))
    act(() => pointerMove(zone, { clientX: 160, clientY: 100 }))
    expect(input.moveX).toBeGreaterThan(0)
    act(() => unmount())
    expect(input.moveX).toBe(0)
    expect(input.moveY).toBe(0)
    expect(input.run).toBe(false)
  })
})
