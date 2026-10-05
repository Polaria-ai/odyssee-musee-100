/**
 * Machine à états d'animation d'un personnage : un `AnimationMixer` par instance, clips lus en boucle
 * ou une seule fois, fondu enchaîné entre clips. Propriétaire : agent personnages. three seul (aucun
 * React) : testable en avançant le temps à la main (`update`). Aucune allocation dans `update`.
 */
import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three'
import type { ClipName } from './models'

/** Durée du fondu enchaîné entre deux clips, en secondes. */
export const CROSSFADE_SECONDS = 0.2

export interface PlayOptions {
  /** Joue le clip une seule fois puis revient à « idle » (sans effet sur « idle » lui-même). */
  once?: boolean
  /** Vitesse de lecture (1 = normale). Conservée pour les clips suivants tant qu'on n'en donne pas d'autre. */
  timeScale?: number
  /** Appelé à la fin d'un clip `once`, après le retour à « idle ». */
  onDone?: () => void
  /** Position de départ dans le clip (0..1) au TOUT PREMIER lancement d'un clip en boucle : décale des instances voisines. */
  startPhase?: number
}

export class CharacterAnimator {
  readonly mixer: AnimationMixer
  private readonly root: Object3D
  private readonly clips: Partial<Record<ClipName, AnimationClip>>
  private actions: Partial<Record<ClipName, AnimationAction>> = {}
  private active: AnimationAction | null = null
  private activeName: ClipName | null = null
  private onceAction: AnimationAction | null = null
  private onDone: (() => void) | undefined
  private timeScale = 1

  constructor(root: Object3D, clips: Partial<Record<ClipName, AnimationClip>>) {
    this.root = root
    this.clips = clips
    this.mixer = new AnimationMixer(root)
    this.mixer.addEventListener('finished', this.handleFinished)
  }

  /** Nom logique du clip en cours (après un clip `once`, c'est « idle »). */
  get current(): ClipName | null {
    return this.activeName
  }

  /** Lance `name` (un clip inconnu retombe sur « idle »), en fondu depuis le clip en cours. */
  play(name: ClipName, options: PlayOptions = {}): void {
    if (options.timeScale !== undefined) this.timeScale = options.timeScale
    const resolvedName: ClipName = this.clips[name] ? name : 'idle'
    const next = this.action(resolvedName)
    if (!next) return
    const once = !!options.once && resolvedName !== 'idle'
    if (this.active === next && once === (this.onceAction === next)) {
      // Même clip, même mode : seule la cadence peut avoir changé.
      next.setEffectiveTimeScale(this.timeScale)
      if (once) this.onDone = options.onDone
      return
    }
    const prev = this.active
    this.start(next, prev, once)
    if (!prev) {
      // Un clip « une fois » démarre toujours à 0 : une phase aléatoire raccourcirait le geste.
      if (options.startPhase && !once) next.time = options.startPhase * next.getClip().duration
      this.mixer.update(0) // pose le squelette tout de suite : jamais la pose de liaison à l'écran
    }
    this.active = next
    this.activeName = resolvedName
    this.onceAction = once ? next : null
    this.onDone = once ? options.onDone : undefined
  }

  /** Change la vitesse de lecture du clip en cours sans le relancer. */
  setTimeScale(timeScale: number): void {
    this.timeScale = timeScale
    this.active?.setEffectiveTimeScale(timeScale)
  }

  update(delta: number): void {
    this.mixer.update(delta)
  }

  /** Arrête tout et libère les liaisons du mixeur. L'animateur reste réutilisable (`play` relance). */
  dispose(): void {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.root)
    this.actions = {}
    this.active = null
    this.activeName = null
    this.onceAction = null
    this.onDone = undefined
  }

  private action(name: ClipName): AnimationAction | undefined {
    let action = this.actions[name]
    if (!action) {
      const clip = this.clips[name]
      if (!clip) return undefined
      action = this.mixer.clipAction(clip)
      this.actions[name] = action
    }
    return action
  }

  private start(next: AnimationAction, prev: AnimationAction | null, once: boolean): void {
    next.reset()
    next.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity)
    next.clampWhenFinished = once
    next.setEffectiveWeight(1)
    next.setEffectiveTimeScale(this.timeScale)
    next.play()
    if (prev && prev !== next) next.crossFadeFrom(prev, CROSSFADE_SECONDS, false)
  }

  private handleFinished = (event: { action: AnimationAction }): void => {
    if (event.action !== this.onceAction) return
    this.onceAction = null
    const idle = this.action('idle')
    if (idle && idle !== event.action) {
      this.start(idle, event.action, false)
      this.active = idle
      this.activeName = 'idle'
    }
    const done = this.onDone
    this.onDone = undefined
    done?.()
  }
}
