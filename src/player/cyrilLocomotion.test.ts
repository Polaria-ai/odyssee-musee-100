import { describe, expect, it } from 'vitest'
import {
  WALK_ENTER_SPEED,
  WALK_EXIT_SPEED,
  WALK_REFERENCE_SPEED,
  WALK_TIMESCALE_AT_REFERENCE,
  WALK_TIMESCALE_MAX,
  WALK_TIMESCALE_MIN,
} from '../characters/locomotion'
import { REMOTE_WALK_SPEED, cyrilLocomotion, remoteSpeed } from './cyrilLocomotion'

describe('cyrilLocomotion — idle / marche de Cyril', () => {
  it('à l’arrêt : idle, cadence normale', () => {
    expect(cyrilLocomotion(false, 0, 'idle')).toEqual({ clip: 'idle', timeScale: 1 })
  })

  it('le joueur marche à 3,2 m/s : clip walk à la cadence de référence', () => {
    expect(cyrilLocomotion(true, WALK_REFERENCE_SPEED, 'idle')).toEqual({ clip: 'walk', timeScale: WALK_TIMESCALE_AT_REFERENCE })
  })

  it('le joueur court à 5,6 m/s : walk plus vite, plafonné', () => {
    const run = cyrilLocomotion(true, 5.6, 'walk')
    expect(run.clip).toBe('walk')
    expect(run.timeScale).toBeGreaterThan(WALK_TIMESCALE_AT_REFERENCE)
    expect(run.timeScale).toBeLessThanOrEqual(WALK_TIMESCALE_MAX)
  })

  it('`moving` faux prime sur une vitesse affichée qui traîne (elle n’est rafraîchie que par pas de 0,12 m/s)', () => {
    expect(cyrilLocomotion(false, 3.2, 'walk')).toEqual({ clip: 'idle', timeScale: 1 })
    expect(cyrilLocomotion(false, 0.1, 'walk').clip).toBe('idle')
  })

  it('`moving` vrai avec une vitesse quasi nulle reste idle (démarrage, bruit)', () => {
    expect(cyrilLocomotion(true, WALK_ENTER_SPEED - 0.05, 'idle').clip).toBe('idle')
  })

  it('hystérésis : entre les deux seuils, le clip en cours est conservé (pas de clignotement idle ↔ walk)', () => {
    const between = (WALK_ENTER_SPEED + WALK_EXIT_SPEED) / 2
    expect(cyrilLocomotion(true, between, 'walk').clip).toBe('walk')
    expect(cyrilLocomotion(true, between, 'idle').clip).toBe('idle')
  })

  it('la cadence de la marche ne descend jamais sous le minimum, même au ralenti', () => {
    expect(cyrilLocomotion(true, WALK_EXIT_SPEED + 0.05, 'walk').timeScale).toBeGreaterThanOrEqual(WALK_TIMESCALE_MIN)
  })
})

describe('remoteSpeed — visiteurs distants', () => {
  it('le réseau n’envoie que « bouge / ne bouge pas » : un visiteur qui bouge marche à la vitesse du joueur', () => {
    expect(remoteSpeed(true)).toBe(REMOTE_WALK_SPEED)
    expect(remoteSpeed(false)).toBe(0)
    expect(cyrilLocomotion(true, remoteSpeed(true), 'idle').clip).toBe('walk')
    expect(cyrilLocomotion(false, remoteSpeed(false), 'walk').clip).toBe('idle')
  })
})
