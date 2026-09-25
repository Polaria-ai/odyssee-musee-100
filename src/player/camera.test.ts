import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AABB } from '../types'
import { cameraPositionFor, cameraRig, dims } from '../styles/tokens'
import {
  boundedCameraPosition,
  distanceForAspect,
  fixedOrientationReference,
  horizontalFovRad,
  LOOK_DISTANCE_FACTOR,
  lookRaiseFor,
  orientationPitchDeg,
  PLAYER_SCREEN_FRACTION,
  prefersReducedMotion,
  stepBlend,
} from './camera'

/** Fraction verticale (0 haut, 1 bas) à laquelle un point situé à `elevationDeg` (depuis l'horizontale,
 * vu depuis la caméra) apparaît dans le cadre, pour une caméra dont l'axe optique regarde à
 * `opticalAxisDeg` — réciproque de `orientationPitchDeg`, utilisée uniquement pour vérifier le calcul. */
function screenFractionFor(elevationDeg: number, opticalAxisDeg: number, fovDeg: number): number {
  const halfVFovRad = (fovDeg * Math.PI) / 180 / 2
  const deltaRad = ((elevationDeg - opticalAxisDeg) * Math.PI) / 180
  const ndcY = -Math.tan(deltaRad) / Math.tan(halfVFovRad)
  return (1 - ndcY) / 2
}

const WIDE_BOUNDS: AABB = { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 }

describe('horizontalFovRad', () => {
  it('renvoie le champ vertical inchangé pour un format carré (aspect = 1)', () => {
    const vFov = (cameraRig.fovDeg * Math.PI) / 180
    expect(horizontalFovRad(cameraRig.fovDeg, 1)).toBeCloseTo(vFov, 5)
  })

  it('un format plus large donne un champ horizontal plus grand', () => {
    const narrow = horizontalFovRad(42, 0.5)
    const wide = horizontalFovRad(42, 2)
    expect(wide).toBeGreaterThan(narrow)
  })
})

describe('distanceForAspect', () => {
  it('reste dans les bornes [minDistance, maxDistance] quel que soit le format', () => {
    for (const aspect of [390 / 844, 844 / 390, 1, 0.4, 3, 0.01, 100]) {
      const d = distanceForAspect(aspect)
      expect(d).toBeGreaterThanOrEqual(cameraRig.minDistance)
      expect(d).toBeLessThanOrEqual(cameraRig.maxDistance)
    }
  })

  it('le portrait (aspect < 1) demande une distance au moins aussi grande que le paysage (aspect > 1)', () => {
    const portrait = distanceForAspect(390 / 844)
    const landscape = distanceForAspect(844 / 390)
    expect(portrait).toBeGreaterThanOrEqual(landscape)
  })

  it('un portrait serré (iPhone 13, 390×844) recule bien la caméra par rapport à un carré', () => {
    const portrait = distanceForAspect(390 / 844)
    const square = distanceForAspect(1)
    expect(portrait).toBeGreaterThan(square)
  })

  it('retombe sur maxDistance pour un aspect invalide (division par zéro, NaN)', () => {
    expect(distanceForAspect(0)).toBe(cameraRig.maxDistance)
    expect(distanceForAspect(-1)).toBe(cameraRig.maxDistance)
    expect(distanceForAspect(Number.NaN)).toBe(cameraRig.maxDistance)
  })

  it('est déterministe (même entrée → même sortie)', () => {
    expect(distanceForAspect(9 / 16)).toBe(distanceForAspect(9 / 16))
  })
})

describe('lookRaiseFor', () => {
  it('lève le regard vers le centre du cadre (au-dessus de cameraRig.lookHeight) à maxDistance', () => {
    const raise = lookRaiseFor(dims.frameCenterY, cameraRig.maxDistance)
    expect(raise).toBeCloseTo(dims.frameCenterY - cameraRig.lookHeight, 5)
    expect(raise).toBeGreaterThan(0)
  })

  it('ne descend jamais en dessous de 0 (cadre bas, sous lookHeight)', () => {
    expect(lookRaiseFor(0, cameraRig.maxDistance)).toBe(0)
  })

  it('est proportionnel à la distance (même ratio, quelle que soit la distance)', () => {
    const raiseFar = lookRaiseFor(dims.frameCenterY, cameraRig.maxDistance)
    const raiseNear = lookRaiseFor(dims.frameCenterY, cameraRig.maxDistance / 2)
    expect(raiseNear).toBeCloseTo(raiseFar / 2, 5)
  })

  it("ne pousse pas le joueur bien plus bas à l'écran en paysage qu'en portrait (mode « regard »)", () => {
    // Décalage angulaire induit par `extraY` à une `distance` donnée : petit-angle, cohérent avec
    // la dérivation de `fixedOrientationReference` (voir sa docstring). Sert seulement à comparer
    // portrait/paysage entre eux ici, pas à revalider toute la projection.
    function angularShift(distance: number): number {
      const extraY = lookRaiseFor(dims.frameCenterY, distance)
      return extraY / distance
    }
    const portraitDistance = distanceForAspect(390 / 844) * LOOK_DISTANCE_FACTOR
    const landscapeDistance = distanceForAspect(844 / 390) * LOOK_DISTANCE_FACTOR
    // Avec un décalage proportionnel à la distance, le ratio (donc l'effet à l'écran) est identique
    // en portrait et en paysage, contrairement à un décalage fixe en mètres (l'ancien bug : un même
    // décalage absolu a un effet angulaire — donc écran — bien plus grand à une distance plus courte).
    expect(angularShift(portraitDistance)).toBeCloseTo(angularShift(landscapeDistance), 5)
  })
})

describe('boundedCameraPosition', () => {
  it('suit le décalage normal (offset non rogné) loin des bords', () => {
    const distance = distanceForAspect(1)
    const pos = boundedCameraPosition(0, 0, distance, WIDE_BOUNDS)
    const pitch = (cameraRig.pitchDeg * Math.PI) / 180
    expect(pos.z).toBeCloseTo(Math.cos(pitch) * distance, 5)
    expect(pos.y).toBeCloseTo(cameraRig.lookHeight + Math.sin(pitch) * distance, 5)
  })

  it('ne rogne jamais le décalage près d’un bord (bug V1 : la scène semblait vide)', () => {
    const distance = distanceForAspect(1)
    const bounds: AABB = { minX: -11, maxX: 11, minZ: -9, maxZ: 9 }
    // Joueur au point d'apparition (proche du bord sud du hall) : le décalage complet doit s'appliquer.
    const nearEdge = boundedCameraPosition(0, 6.5, distance, bounds)
    const farFromEdge = boundedCameraPosition(0, 0, distance, bounds)
    const pitch = (cameraRig.pitchDeg * Math.PI) / 180
    const expectedOffsetZ = Math.cos(pitch) * distance
    expect(nearEdge.z - 6.5).toBeCloseTo(expectedOffsetZ, 5)
    expect(farFromEdge.z - 0).toBeCloseTo(expectedOffsetZ, 5)
  })

  it('applique extraY sans changer le clamp horizontal', () => {
    const distance = distanceForAspect(1)
    const bounds: AABB = { minX: -11, maxX: 11, minZ: -9, maxZ: 9 }
    const base = boundedCameraPosition(0, 6.5, distance, bounds, 0)
    const raised = boundedCameraPosition(0, 6.5, distance, bounds, 0.9)
    expect(raised.x).toBeCloseTo(base.x, 5)
    expect(raised.z).toBeCloseTo(base.z, 5)
    expect(raised.y).toBeCloseTo(base.y + 0.9, 5)
  })
})

describe('orientationPitchDeg', () => {
  it('redonne positionPitchDeg pour une fraction de 0.5 (centre du cadre)', () => {
    expect(orientationPitchDeg(48, 42, 0.5)).toBeCloseTo(48, 5)
  })

  it('est plus « à plat » (plus petit) qu’une fraction de centre pour viser le tiers inférieur', () => {
    expect(orientationPitchDeg(cameraRig.pitchDeg, cameraRig.fovDeg, PLAYER_SCREEN_FRACTION)).toBeLessThan(cameraRig.pitchDeg)
  })

  it('descend encore quand la fraction visée augmente (plus bas dans le cadre)', () => {
    const a = orientationPitchDeg(48, 42, 0.6)
    const b = orientationPitchDeg(48, 42, 0.8)
    expect(b).toBeLessThan(a)
  })
})

describe('fixedOrientationReference', () => {
  it('place le point à hauteur cameraRig.lookHeight à PLAYER_SCREEN_FRACTION du cadre, pas au centre', () => {
    const opticalAxisDeg = orientationPitchDeg(cameraRig.pitchDeg, cameraRig.fovDeg, PLAYER_SCREEN_FRACTION)
    // Le joueur (position réelle de la caméra, direction cameraRig.pitchDeg par construction de
    // `cameraPositionFor`) est toujours exactement à `cameraRig.pitchDeg` d'élévation vue de la
    // caméra : voir le test suivant pour la preuve géométrique (indépendante de la distance).
    const fraction = screenFractionFor(cameraRig.pitchDeg, opticalAxisDeg, cameraRig.fovDeg)
    expect(fraction).toBeCloseTo(PLAYER_SCREEN_FRACTION, 5)
    expect(fraction).toBeGreaterThanOrEqual(2 / 3) // au tiers inférieur, jamais au centre
  })

  it('place le joueur au tiers inférieur quelle que soit la distance (portrait et paysage)', () => {
    const ref = fixedOrientationReference()
    const dir = { y: ref.target.y - ref.position.y, z: ref.target.z - ref.position.z }
    const dirLen = Math.hypot(dir.y, dir.z)
    const opticalAxisDeg = (Math.atan2(-dir.y, -dir.z) * 180) / Math.PI

    for (const distance of [cameraRig.minDistance, cameraRig.maxDistance, 12]) {
      // Position réelle de la caméra pour cette distance, et direction vers le joueur (qui est,
      // par construction de `cameraPositionFor`, toujours exactement dans la direction
      // `cameraRig.pitchDeg` depuis la caméra — donc son élévation vue de la caméra ne varie pas).
      const camPos = cameraPositionFor(0, 0, distance)
      const toPlayer = { y: cameraRig.lookHeight - camPos.y, z: 0 - camPos.z }
      const elevationDeg = (Math.atan2(-toPlayer.y, -toPlayer.z) * 180) / Math.PI
      expect(elevationDeg).toBeCloseTo(cameraRig.pitchDeg, 5)

      const fraction = screenFractionFor(elevationDeg, opticalAxisDeg, cameraRig.fovDeg)
      expect(fraction).toBeCloseTo(PLAYER_SCREEN_FRACTION, 4)
    }
    expect(dirLen).toBeGreaterThan(0)
  })

  it('regarde vers le bas et vers -Z (plongée cosy, jamais plein ciel)', () => {
    const ref = fixedOrientationReference()
    expect(ref.target.y).toBeLessThan(ref.position.y)
    expect(ref.target.z).toBeLessThan(ref.position.z)
  })
})

describe('mode « regard » : cadrage complet (position + décalage) bout en bout', () => {
  // La revue précédente n'avait vérifié ce point qu'à la main, sur des captures d'écran ("recalibré
  // à ~88% du cadre, mesuré") : ce test fige le calcul complet (position de caméra + `extraY`, comme
  // dans `Player.tsx`) pour que toute régression future (ex. mauvais point de référence, mauvaise
  // proportionnalité) casse `vitest`, pas seulement une capture regardée à l'œil.
  it('à plein mode « regard », le joueur reste dans le tiers inférieur mais jamais collé au bord bas (identique quel que soit le format d’écran)', () => {
    const opticalAxisDeg = orientationPitchDeg(cameraRig.pitchDeg, cameraRig.fovDeg, PLAYER_SCREEN_FRACTION)
    const fractions = [cameraRig.minDistance, cameraRig.maxDistance, 12].map((baseDistance) => {
      const distance = baseDistance * LOOK_DISTANCE_FACTOR
      const extraY = lookRaiseFor(dims.frameCenterY, distance)
      const camPos = cameraPositionFor(0, 0, distance)
      const toPlayer = { y: cameraRig.lookHeight - (camPos.y + extraY), z: 0 - camPos.z }
      const elevationDeg = (Math.atan2(-toPlayer.y, -toPlayer.z) * 180) / Math.PI
      return screenFractionFor(elevationDeg, opticalAxisDeg, cameraRig.fovDeg)
    })
    for (const fraction of fractions) {
      expect(fraction).toBeGreaterThanOrEqual(PLAYER_SCREEN_FRACTION) // toujours au moins aussi bas qu'en mode normal
      expect(fraction).toBeLessThan(0.85) // jamais poussé sous le HUD ou hors cadre
    }
    // La mise à l'échelle proportionnelle (voir `lookRaiseFor`) rend ce cadrage indépendant de la
    // distance de base (donc du format d'écran) : portrait et paysage doivent donner exactement le
    // même résultat, jamais l'un plus bas que l'autre (c'était le bug qu'a corrigé la revue précédente).
    expect(fractions[0]).toBeCloseTo(fractions[1], 5)
    expect(fractions[2]).toBeCloseTo(fractions[1], 5)
  })
})

describe('stepBlend', () => {
  it('avance vers la cible en respectant la durée visée (~0.6 s pour aller de 0 à 1)', () => {
    let blend = 0
    const dt = 1 / 60
    let frames = 0
    while (blend < 1 && frames < 120) {
      blend = stepBlend(blend, 1, dt, 0.6, false)
      frames++
    }
    expect(frames / 60).toBeCloseTo(0.6, 1)
  })

  it('ne dépasse jamais la cible (pas d’oscillation)', () => {
    const next = stepBlend(0.98, 1, 1 / 10, 0.6, false)
    expect(next).toBeLessThanOrEqual(1)
  })

  it('recule vers 0 symétriquement', () => {
    const next = stepBlend(1, 0, 1 / 60, 0.6, false)
    expect(next).toBeCloseTo(1 - 1 / 60 / 0.6, 5)
  })

  it('saute directement à la cible si reducedMotion est vrai', () => {
    expect(stepBlend(0, 1, 1 / 60, 0.6, true)).toBe(1)
    expect(stepBlend(1, 0, 1 / 60, 0.6, true)).toBe(0)
  })

  it('reste immobile si déjà à la cible', () => {
    expect(stepBlend(1, 1, 1 / 60, 0.6, false)).toBe(1)
  })
})

describe('prefersReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renvoie false par défaut (jsdom, aucune préférence)', () => {
    expect(prefersReducedMotion()).toBe(false)
  })

  it('renvoie true quand matchMedia signale la préférence', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMedia)
    expect(prefersReducedMotion()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('ne lève jamais si matchMedia lève une exception', () => {
    vi.stubGlobal('matchMedia', () => {
      throw new Error('nope')
    })
    expect(prefersReducedMotion()).toBe(false)
  })
})
