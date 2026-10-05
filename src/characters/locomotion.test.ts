import { describe, expect, it } from 'vitest'
import {
  WALK_ENTER_SPEED,
  WALK_EXIT_SPEED,
  WALK_REFERENCE_SPEED,
  WALK_TIMESCALE_AT_REFERENCE,
  WALK_TIMESCALE_MAX,
  WALK_TIMESCALE_MIN,
  pickLocomotionClip,
  walkTimeScale,
} from './locomotion'

describe('pickLocomotionClip', () => {
  it('reste en idle à l\'arrêt et sous le seuil', () => {
    expect(pickLocomotionClip(0)).toBe('idle')
    expect(pickLocomotionClip(0.01)).toBe('idle')
    expect(pickLocomotionClip(WALK_ENTER_SPEED)).toBe('idle')
  })

  it('passe en walk au-dessus du seuil, à la marche comme à la course du joueur', () => {
    expect(pickLocomotionClip(WALK_ENTER_SPEED + 0.01)).toBe('walk')
    expect(pickLocomotionClip(3.2)).toBe('walk')
    expect(pickLocomotionClip(5.6)).toBe('walk')
  })

  it('traite une vitesse négative comme sa valeur absolue et une valeur non finie comme 0', () => {
    expect(pickLocomotionClip(-3.2)).toBe('walk')
    expect(pickLocomotionClip(Number.NaN)).toBe('idle')
    expect(pickLocomotionClip(Number.POSITIVE_INFINITY)).toBe('idle')
  })

  it('hystérésis : un personnage qui marche ne s\'arrête qu\'en dessous du seuil de sortie', () => {
    const between = (WALK_ENTER_SPEED + WALK_EXIT_SPEED) / 2
    expect(WALK_EXIT_SPEED).toBeLessThan(WALK_ENTER_SPEED)
    expect(pickLocomotionClip(between)).toBe('idle')
    expect(pickLocomotionClip(between, 'idle')).toBe('idle')
    expect(pickLocomotionClip(between, 'walk')).toBe('walk')
    expect(pickLocomotionClip(WALK_EXIT_SPEED, 'walk')).toBe('idle')
  })
})

describe('walkTimeScale', () => {
  it('vaut WALK_TIMESCALE_AT_REFERENCE à la vitesse de marche du joueur', () => {
    expect(walkTimeScale(WALK_REFERENCE_SPEED)).toBeCloseTo(WALK_TIMESCALE_AT_REFERENCE)
  })

  it('est proportionnelle à la vitesse entre les bornes', () => {
    expect(walkTimeScale(2.4)).toBeCloseTo(walkTimeScale(1.2) * 2)
    expect(walkTimeScale(2.4)).toBeCloseTo(1.5)
  })

  it('est bornée : plancher pour un pas très lent, plafond pour la course', () => {
    expect(walkTimeScale(0)).toBe(WALK_TIMESCALE_MIN)
    expect(walkTimeScale(0.1)).toBe(WALK_TIMESCALE_MIN)
    expect(walkTimeScale(5.6)).toBe(WALK_TIMESCALE_MAX)
    expect(walkTimeScale(100)).toBe(WALK_TIMESCALE_MAX)
  })

  it('ne décroît jamais quand la vitesse augmente', () => {
    let previous = -Infinity
    for (let speed = 0; speed <= 8; speed += 0.1) {
      const scale = walkTimeScale(speed)
      expect(scale).toBeGreaterThanOrEqual(previous)
      previous = scale
    }
  })

  it('reste dans les bornes pour les valeurs non finies ou négatives', () => {
    expect(walkTimeScale(Number.NaN)).toBe(WALK_TIMESCALE_MIN)
    expect(walkTimeScale(-3.2)).toBeCloseTo(WALK_TIMESCALE_AT_REFERENCE)
  })
})
