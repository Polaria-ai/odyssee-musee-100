import { describe, expect, it } from 'vitest'
import { BODY_MAX_TURN, WAVE_COOLDOWN_MS, approach, createWaveGate, turnToward, wrapAngle } from './remiBehavior'

describe('createWaveGate', () => {
  it('accepte le premier salut, quelle que soit l’heure', () => {
    expect(createWaveGate()(0)).toBe(true)
    expect(createWaveGate()(123_456)).toBe(true)
  })

  it('refuse un second salut avant 20 s, l’accepte à 20 s exactement', () => {
    expect(WAVE_COOLDOWN_MS).toBe(20_000)
    const canWave = createWaveGate()
    expect(canWave(1_000)).toBe(true)
    expect(canWave(1_001)).toBe(false)
    expect(canWave(20_999)).toBe(false)
    expect(canWave(21_000)).toBe(true)
  })

  it('mesure le délai depuis le dernier salut accepté, pas depuis la dernière tentative', () => {
    const canWave = createWaveGate()
    expect(canWave(0)).toBe(true)
    expect(canWave(15_000)).toBe(false) // refusé : ne repousse pas le prochain salut
    expect(canWave(20_000)).toBe(true)
    expect(canWave(39_999)).toBe(false)
    expect(canWave(40_000)).toBe(true)
  })

  it('accepte un délai personnalisé, et chaque garde a sa propre mémoire', () => {
    const a = createWaveGate(1_000)
    const b = createWaveGate(1_000)
    expect(a(0)).toBe(true)
    expect(b(0)).toBe(true)
    expect(a(999)).toBe(false)
    expect(a(1_000)).toBe(true)
  })
})

describe('wrapAngle', () => {
  it('ramène un angle dans ]-π, π]', () => {
    expect(wrapAngle(0)).toBe(0)
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 10)
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI, 10)
    expect(wrapAngle(1.5 * Math.PI)).toBeCloseTo(-0.5 * Math.PI, 10)
    expect(wrapAngle(-1.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI, 10)
  })
})

describe('turnToward', () => {
  it('ne tourne pas quand le joueur est droit devant (+Z), l’orientation de repos du comptoir', () => {
    expect(turnToward(0, 5, 0)).toBeCloseTo(0, 10)
  })

  it('tourne d’un angle modéré vers un joueur légèrement de côté', () => {
    const angle = (20 * Math.PI) / 180
    expect(turnToward(Math.sin(angle) * 4, Math.cos(angle) * 4, 0)).toBeCloseTo(angle, 6)
    expect(turnToward(-Math.sin(angle) * 4, Math.cos(angle) * 4, 0)).toBeCloseTo(-angle, 6)
  })

  it('borne la rotation à ±BODY_MAX_TURN quand le joueur est sur le côté ou derrière', () => {
    expect(turnToward(5, 0, 0)).toBe(BODY_MAX_TURN)
    expect(turnToward(-5, 0, 0)).toBe(-BODY_MAX_TURN)
    expect(Math.abs(turnToward(0, -5, 0))).toBe(BODY_MAX_TURN)
  })

  it('est relatif à l’orientation de repos, sans saut au passage de ±π', () => {
    // Repos tourné de 90° vers +X : un joueur à +X est droit devant.
    expect(turnToward(5, 0, Math.PI / 2)).toBeCloseTo(0, 10)
    // Repos vers -Z (π) : un joueur légèrement à gauche/droite reste continu autour de π.
    const eps = 0.1
    const left = turnToward(-Math.sin(eps), -Math.cos(eps), Math.PI)
    const right = turnToward(Math.sin(eps), -Math.cos(eps), Math.PI)
    expect(left).toBeGreaterThan(0)
    expect(right).toBeLessThan(0)
    expect(Math.abs(left + right)).toBeLessThan(1e-9)
  })

  it('ne tourne pas quand le joueur est exactement sur le personnage', () => {
    expect(turnToward(0, 0, 1)).toBe(0)
  })
})

describe('approach', () => {
  it('avance vers la cible sans la dépasser, et l’atteint quand delta × rate ≥ 1', () => {
    expect(approach(0, 1, 3, 0.1)).toBeCloseTo(0.3, 10)
    expect(approach(0, 1, 3, 1)).toBe(1)
    expect(approach(1, 0, 3, 10)).toBe(0)
  })

  it('ignore un pas de temps négatif', () => {
    expect(approach(0.4, 1, 3, -1)).toBe(0.4)
  })
})
