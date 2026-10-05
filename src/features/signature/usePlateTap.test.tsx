/**
 * Intégration du tap sur la plaque : le vrai `TouchJoystick` (qui pose une cible de marche au sol sur tout
 * tap court) et le hook `usePlateTap` (qui doit retirer cette cible et ouvrir la carte). `useThree` est
 * remplacé par une caméra three.js réelle et un cadre de canvas de 390 × 844.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { PerspectiveCamera } from 'three'
import { useGame } from '../../state/gameStore'
import { bridges, input } from '../../state/runtime'
import { cameraPositionFor, cameraRig } from '../../styles/tokens'
import { TouchJoystick } from '../../player/TouchJoystick'
import { SIGNATURE_PLATE } from './plateLayout'
import { expandRect, projectPlateRect } from './plateTap'
import { useSignature } from './signatureStore'
import { usePlateTap } from './usePlateTap'

const VIEWPORT = { left: 0, top: 0, width: 390, height: 844 }

const camera = new PerspectiveCamera(cameraRig.fovDeg, VIEWPORT.width / VIEWPORT.height, 0.1, 120)
const gl = { domElement: { getBoundingClientRect: () => ({ ...VIEWPORT, right: 390, bottom: 844 }) } }

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (s: { camera: PerspectiveCamera; gl: typeof gl }) => unknown) => selector({ camera, gl }),
}))

const playSfxMock = vi.fn()
vi.mock('../../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
}))

function Harness() {
  usePlateTap()
  return <TouchJoystick />
}

function pointer(type: 'pointerdown' | 'pointerup', target: Element, x: number, y: number, pointerId = 1) {
  fireEvent(target, new PointerEvent(type, { pointerId, clientX: x, clientY: y, bubbles: true, cancelable: true }))
}

function tap(target: Element, x: number, y: number) {
  act(() => pointer('pointerdown', target, x, y))
  act(() => pointer('pointerup', target, x, y))
}

/** Caméra du jeu pour un joueur qui longe le mur nord au pied de la plaque (`distance` : recul de la caméra). */
function aimCameraAtPlate(distance = 12) {
  const [x, , z] = SIGNATURE_PLATE.position
  const pos = cameraPositionFor(x, z + 2, distance)
  camera.position.set(pos.x, pos.y, pos.z)
  camera.lookAt(x, cameraRig.lookHeight, z + 2)
  camera.updateMatrixWorld()
}

function plateCenter() {
  const rect = projectPlateRect(camera, VIEWPORT, SIGNATURE_PLATE)!
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2, rect }
}

describe('usePlateTap (avec le joystick réel)', () => {
  beforeEach(() => {
    playSfxMock.mockClear()
    aimCameraAtPlate()
    useGame.setState({ screen: 'play', openPersonId: null, openSessionId: null, dialogue: null, stampCardOpen: false, mapOpen: false })
    useSignature.setState({ cardOpen: false, ignoreClicksUntil: 0 })
    input.tapTarget = null
    // Le pont écran → sol du joueur : un point au sol quelconque, comme `Player.tsx`.
    bridges.screenToFloor = () => ({ x: 3, z: -2 })
  })

  afterEach(() => {
    cleanup()
    bridges.screenToFloor = null
    input.tapTarget = null
  })

  it('un tap sur la plaque ouvre la carte, avec la garde anti-clic fantôme, et le son', () => {
    const { getByTestId } = render(<Harness />)
    const { x, y } = plateCenter()
    tap(getByTestId('joystick-zone'), x, y)
    expect(useSignature.getState().cardOpen).toBe(true)
    expect(useSignature.getState().ignoreClicksUntil).toBeGreaterThan(performance.now())
    expect(playSfxMock).toHaveBeenCalledWith('click')
  })

  it('le tap sur la plaque ne fait PAS marcher le joueur (la cible posée par le joystick est retirée)', () => {
    const { getByTestId } = render(<Harness />)
    const { x, y } = plateCenter()
    tap(getByTestId('joystick-zone'), x, y)
    expect(input.tapTarget).toBeNull()
  })

  it('un tap ailleurs fait marcher le joueur et n’ouvre pas la carte (le tap-pour-marcher est intact)', () => {
    const { getByTestId } = render(<Harness />)
    tap(getByTestId('joystick-zone'), 40, 760)
    expect(input.tapTarget).toEqual({ x: 3, z: -2 })
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('la cible tactile est agrandie : un tap à quelques pixels du rectangle projeté ouvre quand même la carte', () => {
    // Caméra reculée : la plaque est minuscule à l'écran (moins de 44 px de haut), comme sur un petit téléphone.
    aimCameraAtPlate(40)
    const { getByTestId } = render(<Harness />)
    const { rect } = plateCenter()
    expect(rect.bottom - rect.top).toBeLessThan(44)
    const finger = expandRect(rect, 44)
    // Juste à l'intérieur de la zone agrandie, mais hors du rectangle exact de la plaque.
    const y = finger.top + 2
    expect(y).toBeLessThan(rect.top)
    tap(getByTestId('joystick-zone'), (rect.left + rect.right) / 2, y)
    expect(useSignature.getState().cardOpen).toBe(true)
  })

  it('un tap hors de la zone agrandie n’ouvre rien', () => {
    aimCameraAtPlate(40)
    const { getByTestId } = render(<Harness />)
    const { rect } = plateCenter()
    const finger = expandRect(rect, 44)
    tap(getByTestId('joystick-zone'), (rect.left + rect.right) / 2, finger.top - 10)
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('un glissé qui part de la plaque est un joystick, pas un tap : rien ne s’ouvre', () => {
    const { getByTestId } = render(<Harness />)
    const { x, y } = plateCenter()
    const zone = getByTestId('joystick-zone')
    act(() => pointer('pointerdown', zone, x, y))
    act(() => pointer('pointerup', zone, x + 60, y + 40))
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('un tap sur un bouton du HUD qui recouvre la plaque à l’écran n’ouvre pas la carte', () => {
    const { container } = render(<Harness />)
    const hudButton = document.createElement('button')
    hudButton.className = 'ui-hud__stamps'
    container.appendChild(hudButton)
    const { x, y } = plateCenter()
    tap(hudButton, x, y)
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('le canvas lui-même compte comme cible du jeu (écran sans joystick monté)', () => {
    render(<Harness />)
    const canvas = document.createElement('canvas')
    canvas.className = 'game-canvas'
    document.body.appendChild(canvas)
    const { x, y } = plateCenter()
    tap(canvas, x, y)
    expect(useSignature.getState().cardOpen).toBe(true)
    canvas.remove()
  })

  it.each([
    ['sur l’écran titre', { screen: 'title' as const }],
    ['pendant une fiche portrait', { openPersonId: 'p1' }],
    ['pendant un dialogue', { dialogue: { id: 'd', lines: [] } as never }],
    ['pendant le plan', { mapOpen: true }],
  ])('n’ouvre rien %s', (_name, state) => {
    useGame.setState(state)
    const { getByTestId } = render(<Harness />)
    const { x, y } = plateCenter()
    tap(getByTestId('joystick-zone'), x, y)
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('carte déjà ouverte : un second tap ne la rouvre pas et ne réécrit pas la garde', () => {
    useSignature.setState({ cardOpen: true, ignoreClicksUntil: 123 })
    const { getByTestId } = render(<Harness />)
    const { x, y } = plateCenter()
    tap(getByTestId('joystick-zone'), x, y)
    expect(useSignature.getState().ignoreClicksUntil).toBe(123)
  })

  it('plaque hors champ (joueur au centre du hall) : un tap n’ouvre rien', () => {
    const pos = cameraPositionFor(0, 0, 12)
    camera.position.set(pos.x, pos.y, pos.z)
    camera.lookAt(0, cameraRig.lookHeight, 0)
    camera.updateMatrixWorld()
    const { getByTestId } = render(<Harness />)
    tap(getByTestId('joystick-zone'), 380, 300)
    expect(useSignature.getState().cardOpen).toBe(false)
  })

  it('retire ses écouteurs au démontage', () => {
    const { getByTestId, unmount } = render(<Harness />)
    const zone = getByTestId('joystick-zone')
    const { x, y } = plateCenter()
    unmount()
    // Le joystick démonté n'existe plus ; on tape directement sur le document.
    tap(document.body, x, y)
    expect(zone.isConnected).toBe(false)
    expect(useSignature.getState().cardOpen).toBe(false)
  })
})
