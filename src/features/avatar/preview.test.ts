import { describe, expect, it } from 'vitest'
import {
  clampDragOffset,
  decayVelocity,
  degToRad,
  dragToAngularStep,
  fitVerticalBounds,
  previewSwayAngle,
  wrapAngle,
  PREVIEW_BASE_YAW_DEG,
  PREVIEW_MAX_DRAG_OFFSET_DEG,
  PREVIEW_MAX_DRAG_VELOCITY,
  PREVIEW_SWAY_DEG,
} from './preview'

describe('fitVerticalBounds', () => {
  it('vise le centre vertical du sujet, pas le sol (bug : tête coupée)', () => {
    // Pieds à 0, sommet de la tête à 1.16 (proportions du chibi, voir src/player/AvatarMesh.tsx).
    const { targetY } = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 32)
    expect(targetY).toBeCloseTo(0.58)
    expect(targetY).not.toBe(0) // l'ancien bug visait (0,0,0), c'est-à-dire les pieds
  })

  it('recule la caméra quand le sujet est plus grand (accessoire haut, ex. casquette)', () => {
    const short = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 32)
    const tall = fitVerticalBounds({ minY: 0, maxY: 1.4 }, 32)
    expect(tall.distance).toBeGreaterThan(short.distance)
    expect(tall.targetY).toBeGreaterThan(short.targetY)
  })

  it('un FOV plus étroit demande une distance plus grande pour le même sujet', () => {
    const wide = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 60)
    const narrow = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 20)
    expect(narrow.distance).toBeGreaterThan(wide.distance)
  })

  it('une marge plus grande éloigne la caméra (plus d’air autour du sujet)', () => {
    const tight = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 32, 1)
    const loose = fitVerticalBounds({ minY: 0, maxY: 1.16 }, 32, 1.35)
    expect(loose.distance).toBeGreaterThan(tight.distance)
    expect(loose.distance).toBeCloseTo(tight.distance * 1.35)
  })

  it('ne renvoie jamais une distance nulle ou infinie pour une boîte dégénérée', () => {
    const { distance } = fitVerticalBounds({ minY: 0.4, maxY: 0.4 }, 32)
    expect(distance).toBeGreaterThan(0)
    expect(Number.isFinite(distance)).toBe(true)
  })

  it('reste cohérent quand la boîte ne commence pas à 0 (ex. sujet décalé)', () => {
    const { targetY, distance } = fitVerticalBounds({ minY: 2, maxY: 3.16 }, 32)
    expect(targetY).toBeCloseTo(2.58)
    expect(distance).toBeCloseTo(fitVerticalBounds({ minY: 0, maxY: 1.16 }, 32).distance)
  })
})

describe('previewSwayAngle', () => {
  it('vaut 0 au départ (t=0) : on part de la pose de repos, trois quarts face', () => {
    expect(previewSwayAngle(0)).toBeCloseTo(0)
  })

  it('reste borné par l’amplitude demandée (± 30° par défaut)', () => {
    const amplitudeRad = (30 * Math.PI) / 180
    for (let t = 0; t < 20; t += 0.37) {
      expect(Math.abs(previewSwayAngle(t))).toBeLessThanOrEqual(amplitudeRad + 1e-9)
    }
  })

  it('une amplitude plus grande balance plus loin', () => {
    expect(Math.abs(previewSwayAngle(Math.PI / 2 / 0.6, 45))).toBeGreaterThan(Math.abs(previewSwayAngle(Math.PI / 2 / 0.6, 10)))
  })
})

describe('wrapAngle', () => {
  it('laisse un angle déjà dans [-π, π] inchangé', () => {
    expect(wrapAngle(1)).toBeCloseTo(1)
    expect(wrapAngle(-2)).toBeCloseTo(-2)
  })

  it('ramène un grand angle positif ou négatif dans [-π, π]', () => {
    const wrapped = wrapAngle(Math.PI * 5)
    expect(wrapped).toBeGreaterThanOrEqual(-Math.PI)
    expect(wrapped).toBeLessThanOrEqual(Math.PI)
    expect(wrapAngle(-Math.PI * 7)).toBeGreaterThanOrEqual(-Math.PI)
  })
})

describe('dragToAngularStep', () => {
  it('un glisser vers la droite tourne dans le même sens (signe conservé)', () => {
    const { offsetDelta } = dragToAngularStep(120, 16)
    expect(offsetDelta).toBeGreaterThan(0)
    expect(dragToAngularStep(-120, 16).offsetDelta).toBeLessThan(0)
  })

  it('un glisser plus rapide (même distance, moins de temps) donne une vitesse plus grande', () => {
    // Distances volontairement petites : en dessous du plafond de vitesse (voir test suivant),
    // sinon les deux mesures saturent au même plafond et la comparaison ne dit plus rien.
    const slow = dragToAngularStep(3, 100)
    const fast = dragToAngularStep(3, 20)
    expect(Math.abs(fast.velocity)).toBeGreaterThan(Math.abs(slow.velocity))
    expect(Math.abs(fast.velocity)).toBeLessThan(PREVIEW_MAX_DRAG_VELOCITY)
  })

  it('plafonne la vitesse pour ignorer un pic de mesure (deltaTime quasi nul)', () => {
    const { velocity } = dragToAngularStep(500, 0)
    expect(Math.abs(velocity)).toBeLessThanOrEqual(PREVIEW_MAX_DRAG_VELOCITY)
  })

  it('même au plafond, l’inertie intégrée reste « légère » (régression : elle ramenait au profil complet)', () => {
    // Simule ce que fait `useFrame` : on intègre la vitesse (plafonnée) qui décroît, à 60 i/s,
    // et on additionne la rotation qu'elle ajoute. Un plafond trop haut (ancienne valeur : 14
    // rad/s) faisait dépasser 200° à lui seul, ramenant l'aperçu au profil, voire au dos.
    let velocity = PREVIEW_MAX_DRAG_VELOCITY
    let totalRotation = 0
    const dt = 1 / 60
    for (let i = 0; i < 600 && velocity !== 0; i++) {
      totalRotation += velocity * dt
      velocity = decayVelocity(velocity, dt)
    }
    expect(Math.abs(totalRotation)).toBeLessThan(degToRad(45))
  })
})

describe('clampDragOffset', () => {
  it('laisse un angle déjà sous la borne inchangé', () => {
    expect(clampDragOffset(degToRad(10))).toBeCloseTo(degToRad(10))
    expect(clampDragOffset(-degToRad(10))).toBeCloseTo(-degToRad(10))
  })

  it('sature à ±maxDeg au-delà de la borne, dans les deux sens', () => {
    expect(clampDragOffset(degToRad(200))).toBeCloseTo(degToRad(PREVIEW_MAX_DRAG_OFFSET_DEG))
    expect(clampDragOffset(-degToRad(200))).toBeCloseTo(-degToRad(PREVIEW_MAX_DRAG_OFFSET_DEG))
  })

  it(
    'régression : un glisser franc et ordinaire (la largeur de l’aperçu) ne doit plus faire ' +
      'tourner le personnage jusqu’à son dos — avant cette borne, ~114° s’ajoutaient d’un coup, ' +
      'sans jamais redescendre, exactement le bug d’origine (« on voit mal son visage »)',
    () => {
      // Glisser de 200 px d'un coup, comme un swipe naturel du pouce sur l'aperçu (≈ 220-300 px de large).
      const { offsetDelta } = dragToAngularStep(200, 250)
      const offset = clampDragOffset(offsetDelta)
      const worstCaseSway = degToRad(PREVIEW_SWAY_DEG) // le balancement peut s'ajouter au pire moment
      const totalYaw = Math.abs(degToRad(PREVIEW_BASE_YAW_DEG) + worstCaseSway + offset)
      // Pas de vue de dos (180°), ni même largement au-delà du profil pur (90°).
      expect(totalYaw).toBeLessThan(degToRad(115))
    },
  )

  it('la borne reste symétrique par défaut : la même valeur absolue des deux côtés', () => {
    const maxDeg = 42
    expect(clampDragOffset(degToRad(1000), maxDeg)).toBeCloseTo(degToRad(maxDeg))
    expect(clampDragOffset(-degToRad(1000), maxDeg)).toBeCloseTo(-degToRad(maxDeg))
  })
})

describe('decayVelocity', () => {
  it('ne change jamais le signe et diminue en magnitude avec le temps', () => {
    const v1 = decayVelocity(5, 0.1)
    expect(v1).toBeGreaterThan(0)
    expect(v1).toBeLessThan(5)
  })

  it('atteint exactement 0 sous le seuil (inertie « légère », pas de rotation infinie)', () => {
    let v = 0.01
    for (let i = 0; i < 30 && v !== 0; i++) v = decayVelocity(v, 0.2)
    expect(v).toBe(0)
  })

  it('une vitesse nulle reste nulle', () => {
    expect(decayVelocity(0, 1)).toBe(0)
  })
})
