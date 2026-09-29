import { describe, expect, it, vi } from 'vitest'
import { CROSSFADE_SECONDS, CharacterAnimator } from './animator'
import { cloneRig } from './rig.fixture'

function setup(clips: 'all' | 'idle-wave' = 'all') {
  const { root, clips: available } = cloneRig(clips)
  const animator = new CharacterAnimator(root, available)
  const action = (name: keyof typeof available) => animator.mixer.clipAction(available[name]!)
  return { animator, action, root }
}

describe('CharacterAnimator', () => {
  it('démarre en idle, squelette posé tout de suite', () => {
    const { animator, action } = setup()
    expect(animator.current).toBeNull()
    animator.play('idle')
    expect(animator.current).toBe('idle')
    expect(action('idle').isRunning()).toBe(true)
    expect(action('idle').getEffectiveWeight()).toBe(1)
  })

  it('part de la phase demandée au tout premier lancement', () => {
    const { animator, action } = setup()
    animator.play('idle', { startPhase: 0.5 })
    expect(action('idle').time).toBeCloseTo(1) // idle dure 2 s
  })

  it('ignore la phase de départ pour un clip joué une seule fois', () => {
    const { animator, action } = setup()
    animator.play('wave', { once: true, startPhase: 0.9 })
    expect(action('wave').time).toBe(0)
  })

  it('fond d\'un clip à l\'autre sur CROSSFADE_SECONDS', () => {
    const { animator, action } = setup()
    animator.play('idle')
    animator.update(0.5)
    animator.play('walk')
    expect(animator.current).toBe('walk')
    animator.update(CROSSFADE_SECONDS / 2)
    const mid = { idle: action('idle').getEffectiveWeight(), walk: action('walk').getEffectiveWeight() }
    expect(mid.idle).toBeGreaterThan(0)
    expect(mid.idle).toBeLessThan(1)
    expect(mid.walk).toBeGreaterThan(0)
    expect(mid.walk).toBeLessThan(1)
    animator.update(CROSSFADE_SECONDS)
    expect(action('walk').getEffectiveWeight()).toBeCloseTo(1)
    expect(action('idle').getEffectiveWeight()).toBeCloseTo(0)
  })

  it('ne relance pas un clip déjà en cours : seule la cadence change', () => {
    const { animator, action } = setup()
    animator.play('idle')
    animator.update(0.6)
    const time = action('idle').time
    animator.play('idle', { timeScale: 2 })
    expect(action('idle').time).toBeCloseTo(time)
    expect(action('idle').getEffectiveTimeScale()).toBe(2)
  })

  it('setTimeScale change la cadence du clip en cours sans le relancer', () => {
    const { animator, action } = setup()
    animator.play('walk')
    animator.update(0.3)
    const time = action('walk').time
    animator.setTimeScale(2.5)
    expect(action('walk').getEffectiveTimeScale()).toBe(2.5)
    expect(action('walk').time).toBeCloseTo(time)
    animator.update(0.1)
    expect(action('walk').time).toBeCloseTo(time + 0.25)
  })

  it('applique la cadence courante au clip suivant', () => {
    const { animator, action } = setup()
    animator.play('idle', { timeScale: 1.5 })
    animator.play('walk')
    expect(action('walk').getEffectiveTimeScale()).toBe(1.5)
    animator.play('walk', { timeScale: 0.8 })
    expect(action('walk').getEffectiveTimeScale()).toBe(0.8)
  })

  it('joue un clip une seule fois puis revient à idle et appelle onDone une fois', () => {
    const { animator, action } = setup()
    const onDone = vi.fn()
    animator.play('idle')
    animator.update(0.1)
    animator.play('wave', { once: true, onDone })
    expect(animator.current).toBe('wave')
    animator.update(0.9)
    expect(onDone).not.toHaveBeenCalled()
    animator.update(0.2) // wave dure 1 s
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(animator.current).toBe('idle')
    animator.update(CROSSFADE_SECONDS + 0.05)
    expect(action('idle').getEffectiveWeight()).toBeCloseTo(1)
    expect(action('wave').getEffectiveWeight()).toBeCloseTo(0)
    animator.update(5)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('peut rejouer un clip une seule fois après le retour à idle', () => {
    const { animator } = setup()
    const onDone = vi.fn()
    animator.play('wave', { once: true, onDone })
    animator.update(1.1)
    animator.play('idle')
    animator.play('wave', { once: true, onDone })
    animator.update(1.1)
    expect(onDone).toHaveBeenCalledTimes(2)
  })

  it('boucle un clip qui n\'est pas « une fois »', () => {
    const { animator, action } = setup()
    const onDone = vi.fn()
    animator.play('wave', { onDone })
    animator.update(3.4)
    expect(onDone).not.toHaveBeenCalled()
    expect(action('wave').isRunning()).toBe(true)
    expect(animator.current).toBe('wave')
  })

  it('n\'appelle pas onDone si on change de clip avant la fin', () => {
    const { animator } = setup()
    const onDone = vi.fn()
    animator.play('wave', { once: true, onDone })
    animator.update(0.4)
    animator.play('idle')
    animator.update(2)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('retombe sur idle pour un clip que le personnage n\'a pas', () => {
    const { animator } = setup('idle-wave')
    animator.play('walk')
    expect(animator.current).toBe('idle')
  })

  it('reste réutilisable après dispose', () => {
    const { animator, action } = setup()
    animator.play('walk')
    animator.update(0.2)
    animator.dispose()
    expect(animator.current).toBeNull()
    animator.play('walk')
    animator.update(0.1)
    expect(animator.current).toBe('walk')
    expect(action('walk').isRunning()).toBe(true)
  })

  it('pose vraiment les os (le bassin suit la piste de position)', () => {
    const { animator, root } = setup()
    animator.play('idle')
    const hips = root.getObjectByName('Hips')!
    expect(hips.position.y).toBeCloseTo(0.75) // t = 0 du clip idle
    animator.update(1)
    expect(hips.position.y).toBeCloseTo(0.5)
  })

  it('anime chaque instance indépendamment', () => {
    const a = setup()
    const b = setup()
    a.animator.play('idle')
    b.animator.play('idle')
    a.animator.update(1)
    expect(a.root.getObjectByName('Hips')!.position.y).toBeCloseTo(0.5)
    expect(b.root.getObjectByName('Hips')!.position.y).toBeCloseTo(0.75)
  })
})
