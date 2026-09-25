/**
 * Moteur audio minimal : un seul `AudioContext`, créé paresseusement au premier appel utile
 * (typiquement `unlockAudio()`, dans un geste utilisateur), un gain maître pour couper/rétablir
 * tout le son d'un coup, et un état on/off persisté en `localStorage`.
 *
 * Son COUPÉ par défaut (soirée en salle). Sans `AudioContext` disponible (jsdom, navigateur trop
 * ancien) ou si le stockage local est indisponible (navigation privée), tout ici reste un no-op
 * silencieux : aucune fonction de ce fichier ne lève jamais d'exception.
 */

const STORAGE_KEY = 'odyssee-musee-100:sound'
const MUTE_RAMP_SECONDS = 0.05

type Listener = () => void

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let unlocked = false
let visibilityBound = false
let enabled = readPersistedEnabled()
const listeners = new Set<Listener>()

function readPersistedEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

function writePersistedEnabled(value: boolean): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value ? 'on' : 'off')
  } catch {
    // Stockage indisponible (navigation privée, quota…) : on continue sans mémoire.
  }
}

/** `webkitAudioContext` : anciens Safari/iOS. Jamais présent dans un navigateur à jour. */
function pickAudioContextCtor(): (new () => AudioContext) | null {
  const w = globalThis as unknown as {
    AudioContext?: new () => AudioContext
    webkitAudioContext?: new () => AudioContext
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function bindVisibilityHandling(context: AudioContext): void {
  if (visibilityBound || typeof document === 'undefined') return
  visibilityBound = true
  document.addEventListener('visibilitychange', () => {
    try {
      if (document.visibilityState === 'hidden') void context.suspend().catch(() => {})
      else if (unlocked) void context.resume().catch(() => {})
    } catch {
      // ignore
    }
  })
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = pickAudioContextCtor()
  if (!Ctor) return null
  try {
    const created = new Ctor()
    const gain = created.createGain()
    gain.gain.value = enabled ? 1 : 0
    gain.connect(created.destination)
    ctx = created
    masterGain = gain
    bindVisibilityHandling(created)
  } catch {
    ctx = null
    masterGain = null
  }
  return ctx
}

/** Le contexte audio courant (créé si besoin), ou `null` si WebAudio est indisponible. */
export function getAudioContext(): AudioContext | null {
  try {
    return ensureContext()
  } catch {
    return null
  }
}

/** Nœud de gain maître : tout son doit s'y connecter (directement ou non) pour respecter le on/off. */
export function getMasterGain(): GainNode | null {
  try {
    ensureContext()
    return masterGain
  } catch {
    return null
  }
}

export function isSoundEnabled(): boolean {
  return enabled
}

export function isAudioUnlocked(): boolean {
  return unlocked
}

/** S'abonne aux changements d'état on/off (pour `SoundToggle`). Renvoie une fonction de désabonnement. */
export function subscribeSound(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}

export function setSoundEnabled(value: boolean): void {
  if (enabled === value) return
  enabled = value
  writePersistedEnabled(value)
  try {
    if (ctx && masterGain) {
      const now = ctx.currentTime
      masterGain.gain.cancelScheduledValues(now)
      masterGain.gain.setTargetAtTime(value ? 1 : 0, now, MUTE_RAMP_SECONDS)
    }
  } catch {
    // ignore
  }
  notify()
}

export function toggleSoundEnabled(): void {
  setSoundEnabled(!enabled)
}

/**
 * À appeler dans un gestionnaire de geste utilisateur (clic « Entrer », bouton son) pour débloquer
 * l'audio sur iOS/Safari : crée l'`AudioContext` si besoin et le reprend s'il est suspendu.
 * Ne lève jamais d'exception.
 */
export function unlockAudio(): void {
  try {
    const context = ensureContext()
    if (!context) return
    unlocked = true
    if (context.state === 'suspended') void context.resume().catch(() => {})
  } catch {
    // ignore
  }
}
