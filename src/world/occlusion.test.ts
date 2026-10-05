import { describe, expect, it } from 'vitest'
import { approach, occludesPlayer, worstCaseCameraFor } from './occlusion'
import { cameraPositionFor, cameraRig, dims } from '../styles/tokens'

// Géométrie de référence pour tous les tests : caméra au sud (+Z), joueur en (0, 0), regardant vers
// -Z (nord) — même convention que `buildXWing`/`buildNorthWing` (voir `layout.ts`).
const CAMERA_SOUTH = worstCaseCameraFor(0, 0)

describe('worstCaseCameraFor', () => {
  it('reprend cameraPositionFor à la distance maximale du rig', () => {
    expect(CAMERA_SOUTH).toEqual(cameraPositionFor(0, 0, cameraRig.maxDistance))
  })

  it('place la caméra au sud (+Z) et au-dessus du joueur', () => {
    expect(CAMERA_SOUTH.z).toBeGreaterThan(0)
    expect(CAMERA_SOUTH.y).toBeGreaterThan(0)
  })
})

describe('occludesPlayer', () => {
  it('une cimaise entre la caméra et le joueur occulte (cas du bug V1)', () => {
    // Cloison fine, pleine hauteur, juste au sud du joueur (donc entre lui et la caméra).
    const obstacle = { box: { minX: -5, maxX: 5, minZ: 1, maxZ: 1.3 }, height: dims.wallHeight }
    expect(occludesPlayer(obstacle, 0, 0, CAMERA_SOUTH)).toBe(true)
  })

  it('la même cimaise ne masque plus rien une fois franchie (elle est alors au nord du joueur)', () => {
    // Joueur passé de l'autre côté : l'obstacle est maintenant plus au nord que lui, donc jamais
    // entre lui et la caméra (toujours au sud).
    const obstacle = { box: { minX: -5, maxX: 5, minZ: 1, maxZ: 1.3 }, height: dims.wallHeight }
    expect(occludesPlayer(obstacle, 0, 5, CAMERA_SOUTH)).toBe(false)
  })

  it('un obstacle hors de la portée en X (mur latéral) n’occulte jamais le joueur', () => {
    const obstacle = { box: { minX: 6, maxX: 6.5, minZ: -20, maxZ: 20 }, height: dims.wallHeight }
    expect(occludesPlayer(obstacle, 0, 0, CAMERA_SOUTH)).toBe(false)
  })

  it('un muret trop bas (ne touche ni les pieds, ni le torse, ni la tête) n’occulte pas', () => {
    // Cas impossible pour une vraie cimaise (elle part du sol) : sert à vérifier que la hauteur de
    // l'obstacle borne bien le test, pas seulement son emprise au sol.
    const veryLow = { box: { minX: -5, maxX: 5, minZ: 1, maxZ: 1.3 }, height: 0.001 }
    expect(occludesPlayer(veryLow, 0, 0, CAMERA_SOUTH)).toBe(false)
  })

  it('un obstacle bas mais juste devant le joueur occulte quand même (échantillon pieds, le plus sensible)', () => {
    // La caméra étant en surplomb, le segment vers les pieds (y = 0) est celui qui plonge le plus
    // près du sol le plus près du joueur : un obstacle bas mais tout contre lui (jardinière, muret)
    // suffit à l'occulter, même si le torse et la tête passeraient au-dessus.
    const nearLowObstacle = { box: { minX: -5, maxX: 5, minZ: 0.05, maxZ: 0.3 }, height: 0.3 }
    expect(occludesPlayer(nearLowObstacle, 0, 0, CAMERA_SOUTH)).toBe(true)
  })

  it('un obstacle au nord du joueur (jamais entre lui et la caméra, au sud) n’occulte pas', () => {
    const obstacle = { box: { minX: -5, maxX: 5, minZ: -10, maxZ: -9.7 }, height: dims.wallHeight }
    expect(occludesPlayer(obstacle, 0, 0, CAMERA_SOUTH)).toBe(false)
  })

  it('accepte une hauteur de joueur personnalisée sans jamais lever d’exception', () => {
    const obstacle = { box: { minX: -5, maxX: 5, minZ: 1, maxZ: 1.3 }, height: dims.wallHeight }
    expect(occludesPlayer(obstacle, 0, 0, CAMERA_SOUTH, 0.6)).toBe(true)
    expect(occludesPlayer(obstacle, 0, 0, CAMERA_SOUTH, 1.8)).toBe(true)
  })

  it('avec la caméra réelle à distance minimale (écran large), une cimaise proche du joueur occulte aussi', () => {
    const near = cameraPositionFor(0, 0, cameraRig.minDistance)
    const obstacle = { box: { minX: -5, maxX: 5, minZ: 1, maxZ: 1.3 }, height: dims.wallHeight }
    expect(occludesPlayer(obstacle, 0, 0, near)).toBe(true)
  })
})

describe('approach', () => {
  it('avance vers la cible sans jamais dépasser', () => {
    expect(approach(1, 0.18, 0.5)).toBe(0.5)
    expect(approach(0.4, 0.18, 0.5)).toBe(0.18)
    expect(approach(0.18, 1, 0.05)).toBeCloseTo(0.23, 10)
    expect(approach(0.18, 1, 5)).toBe(1)
  })

  it('reste immobile si déjà à la cible', () => {
    expect(approach(0.18, 0.18, 0.1)).toBe(0.18)
  })
})
