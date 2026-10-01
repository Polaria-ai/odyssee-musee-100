import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import { cameraPositionFor, cameraRig } from '../../styles/tokens'
import { SIGNATURE_PLATE } from './plateLayout'
import { MIN_TAP_TARGET_PX, TAP_LIMITS, createTapTracker, expandRect, projectPlateRect, rectContains } from './plateTap'

const VIEWPORT = { left: 0, top: 0, width: 390, height: 844 }

/** Caméra du jeu (même rig que `Player.tsx`) pour un joueur en (x, z) : orientation fixe vers le nord. */
function gameCamera(x: number, z: number, aspect = VIEWPORT.width / VIEWPORT.height): PerspectiveCamera {
  const camera = new PerspectiveCamera(cameraRig.fovDeg, aspect, 0.1, 120)
  const pos = cameraPositionFor(x, z, 12)
  camera.position.set(pos.x, pos.y, pos.z)
  camera.lookAt(x, cameraRig.lookHeight, z)
  camera.updateMatrixWorld()
  return camera
}

describe('expandRect / rectContains', () => {
  it('agrandit un petit rectangle autour de son centre jusqu’à la cible minimale', () => {
    const r = expandRect({ left: 100, top: 200, right: 130, bottom: 213 }, 44)
    expect(r.right - r.left).toBeCloseTo(44)
    expect(r.bottom - r.top).toBeCloseTo(44)
    expect((r.left + r.right) / 2).toBeCloseTo(115)
    expect((r.top + r.bottom) / 2).toBeCloseTo(206.5)
  })

  it('ne rétrécit jamais un rectangle déjà assez grand', () => {
    const big = { left: 0, top: 0, right: 200, bottom: 120 }
    expect(expandRect(big, 44)).toEqual(big)
  })

  it('n’agrandit que la dimension trop petite', () => {
    const r = expandRect({ left: 0, top: 0, right: 200, bottom: 20 }, 44)
    expect(r.right - r.left).toBe(200)
    expect(r.bottom - r.top).toBeCloseTo(44)
  })

  it('contient ses bords et rien au-delà', () => {
    const r = { left: 10, top: 10, right: 20, bottom: 20 }
    expect(rectContains(r, 10, 10)).toBe(true)
    expect(rectContains(r, 20, 20)).toBe(true)
    expect(rectContains(r, 9.9, 15)).toBe(false)
    expect(rectContains(r, 15, 20.1)).toBe(false)
  })
})

describe('createTapTracker', () => {
  it('un appui court et immobile est un tap', () => {
    const t = createTapTracker()
    t.down(1, 100, 100, 1000)
    expect(t.up(1, 103, 98, 1120)).toBe(true)
  })

  it('un appui trop long n’est pas un tap', () => {
    const t = createTapTracker()
    t.down(1, 100, 100, 1000)
    expect(t.up(1, 100, 100, 1000 + TAP_LIMITS.maxDurationMs + 1)).toBe(false)
  })

  it('un appui qui a glissé n’est pas un tap (joystick)', () => {
    const t = createTapTracker()
    t.down(1, 100, 100, 1000)
    expect(t.up(1, 100 + TAP_LIMITS.maxDistancePx + 5, 100, 1100)).toBe(false)
  })

  it('un relâchement sans appui connu, ou d’un autre doigt, n’est pas un tap', () => {
    const t = createTapTracker()
    expect(t.up(1, 0, 0, 10)).toBe(false)
    t.down(1, 0, 0, 0)
    expect(t.up(2, 0, 0, 10)).toBe(false)
  })

  it('un appui n’est consommé qu’une fois, et un appui annulé ne devient jamais un tap', () => {
    const t = createTapTracker()
    t.down(1, 0, 0, 0)
    expect(t.up(1, 0, 0, 10)).toBe(true)
    expect(t.up(1, 0, 0, 20)).toBe(false)
    t.down(3, 0, 0, 100)
    t.cancel(3)
    expect(t.up(3, 0, 0, 110)).toBe(false)
  })

  it('suit deux doigts indépendamment', () => {
    const t = createTapTracker()
    t.down(1, 0, 0, 0)
    t.down(2, 300, 300, 5)
    expect(t.up(2, 301, 300, 50)).toBe(true)
    expect(t.up(1, 0, 0, 60)).toBe(true)
  })
})

describe('projectPlateRect', () => {
  it('projette la plaque dans le champ d’un joueur qui longe le mur nord : un rectangle non vide, à l’intérieur de l’écran', () => {
    const [x, , z] = SIGNATURE_PLATE.position
    const rect = projectPlateRect(gameCamera(x, z + 2), VIEWPORT, SIGNATURE_PLATE)
    expect(rect).not.toBeNull()
    if (!rect) return
    expect(rect.right).toBeGreaterThan(rect.left)
    expect(rect.bottom).toBeGreaterThan(rect.top)
    expect(rect.left).toBeGreaterThanOrEqual(0)
    expect(rect.right).toBeLessThanOrEqual(VIEWPORT.width)
    expect(rect.top).toBeGreaterThanOrEqual(0)
    expect(rect.bottom).toBeLessThanOrEqual(VIEWPORT.height)
    // Centrée horizontalement : la caméra est dans l'axe de la plaque.
    expect((rect.left + rect.right) / 2).toBeCloseTo(VIEWPORT.width / 2, 0)
  })

  it('la plaque est petite à l’écran d’un téléphone : l’agrandir à la cible tactile la rend tapable au doigt', () => {
    const [x, , z] = SIGNATURE_PLATE.position
    const rect = projectPlateRect(gameCamera(x, z + 2), VIEWPORT, SIGNATURE_PLATE)!
    const finger = expandRect(rect, MIN_TAP_TARGET_PX)
    expect(finger.bottom - finger.top).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX)
    expect(finger.right - finger.left).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX)
  })

  it('tient compte du cadre du canvas (décalage de la page)', () => {
    const [x, , z] = SIGNATURE_PLATE.position
    const camera = gameCamera(x, z + 2)
    const base = projectPlateRect(camera, VIEWPORT, SIGNATURE_PLATE)!
    const shifted = projectPlateRect(camera, { ...VIEWPORT, left: 50, top: 30 }, SIGNATURE_PLATE)!
    expect(shifted.left - base.left).toBeCloseTo(50)
    expect(shifted.top - base.top).toBeCloseTo(30)
  })

  it('plaque derrière la caméra (joueur loin au nord-est, regard vers le sud) : aucun rectangle', () => {
    const camera = new PerspectiveCamera(42, 0.46, 0.1, 120)
    camera.position.set(8.6, 6, -20)
    camera.lookAt(8.6, 1, -40) // regarde en s'éloignant du mur
    camera.updateMatrixWorld()
    expect(projectPlateRect(camera, VIEWPORT, SIGNATURE_PLATE)).toBeNull()
  })

  it('plaque au-delà du plan lointain : aucun rectangle', () => {
    const camera = new PerspectiveCamera(42, 0.46, 0.1, 5)
    camera.position.set(8.6, 6, 6)
    camera.lookAt(8.6, 1, 0)
    camera.updateMatrixWorld()
    expect(projectPlateRect(camera, VIEWPORT, SIGNATURE_PLATE)).toBeNull()
  })

  it('un joueur au centre du hall voit la plaque hors champ à l’écran, et ce rectangle ne peut donc pas être touché', () => {
    // La largeur visible est ~11 m à la profondeur du joueur : la plaque (x = 8,6) est hors cadre depuis l'axe.
    const rect = projectPlateRect(gameCamera(0, 0), VIEWPORT, SIGNATURE_PLATE)
    expect(rect === null || rect.left >= VIEWPORT.width).toBe(true)
  })
})
