/**
 * Effets sonores courts, tous synthétisés (oscillateur filtré ou bruit filtré). `playSfx` ne lève
 * jamais d'exception : sans `AudioContext` ou son coupé, c'est un no-op silencieux.
 */
import { getAudioContext, getMasterGain, isSoundEnabled } from './engine'
import { pentatonicFrequency } from './scale'
import type { SfxId, SfxOptions } from './types'

const MAX_CONCURRENT_BLIPS = 6
const BLIP_DURATION_MS = 60
let activeBlips = 0

function connectOut(ctx: AudioContext, node: AudioNode): void {
  const master = getMasterGain()
  node.connect(master ?? ctx.destination)
}

function applyEnvelope(param: AudioParam, startAt: number, peak: number, attack: number, release: number): void {
  param.cancelScheduledValues(startAt)
  param.setValueAtTime(0.0001, startAt)
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0005), startAt + attack)
  param.exponentialRampToValueAtTime(0.0001, startAt + attack + release)
}

interface ToneOptions {
  type: OscillatorType
  freq: number
  duration: number
  peak: number
  attack?: number
  filterHz?: number
  startAt?: number
}

/** Note synthétisée : oscillateur → filtre passe-bas optionnel → enveloppe → bus maître. */
function playTone(ctx: AudioContext, opts: ToneOptions): void {
  const startAt = opts.startAt ?? ctx.currentTime
  const attack = opts.attack ?? 0.008
  const release = Math.max(opts.duration - attack, 0.02)
  const osc = ctx.createOscillator()
  osc.type = opts.type
  osc.frequency.setValueAtTime(Math.max(opts.freq, 1), startAt)
  const gain = ctx.createGain()
  let tail: AudioNode = osc
  if (opts.filterHz) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = opts.filterHz
    osc.connect(filter)
    tail = filter
  }
  tail.connect(gain)
  connectOut(ctx, gain)
  applyEnvelope(gain.gain, startAt, opts.peak, attack, release)
  osc.start(startAt)
  osc.stop(startAt + attack + release + 0.05)
}

interface NoiseOptions {
  duration: number
  peak: number
  filterHz: number
  filterSweepTo?: number
  startAt?: number
}

/** Bruit blanc → filtre passe-bande (balayé ou non) → enveloppe → bus maître. Froissement, tampon, pas. */
function playNoiseBurst(ctx: AudioContext, opts: NoiseOptions): void {
  const startAt = opts.startAt ?? ctx.currentTime
  const length = Math.max(1, Math.floor(ctx.sampleRate * opts.duration))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(opts.filterHz, startAt)
  if (opts.filterSweepTo !== undefined) filter.frequency.linearRampToValueAtTime(opts.filterSweepTo, startAt + opts.duration)
  const gain = ctx.createGain()
  src.connect(filter)
  filter.connect(gain)
  connectOut(ctx, gain)
  applyEnvelope(gain.gain, startAt, opts.peak, 0.006, Math.max(opts.duration - 0.006, 0.01))
  src.start(startAt)
  src.stop(startAt + opts.duration + 0.03)
}

/** La « voix » des dialogues : courte note carrée filtrée, hauteur variable autour de `opts.pitch`. */
function playBlip(opts: SfxOptions): void {
  if (activeBlips >= MAX_CONCURRENT_BLIPS) return
  activeBlips++
  setTimeout(() => {
    activeBlips = Math.max(0, activeBlips - 1)
  }, BLIP_DURATION_MS)
  const ctx = getAudioContext()
  if (!ctx) return
  const pitch = opts.pitch ?? 1
  const jitter = 0.94 + Math.random() * 0.12
  playTone(ctx, {
    type: 'square',
    freq: 380 * pitch * jitter,
    duration: BLIP_DURATION_MS / 1000,
    peak: 0.5 * (opts.volume ?? 1),
    attack: 0.004,
    filterHz: 2400,
  })
}

function playStamp(opts: SfxOptions): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const vol = opts.volume ?? 1
  playNoiseBurst(ctx, { duration: 0.09, peak: 0.5 * vol, filterHz: 220 })
  playTone(ctx, {
    type: 'sine',
    freq: 880 * (opts.pitch ?? 1),
    duration: 0.18,
    peak: 0.35 * vol,
    attack: 0.005,
    startAt: ctx.currentTime + 0.05,
  })
}

const COMPLETE_DEGREES = [0, 2, 4, 7]

function playComplete(opts: SfxOptions): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const vol = opts.volume ?? 1
  const root = 523.25 * (opts.pitch ?? 1) // do5
  COMPLETE_DEGREES.forEach((degree, i) => {
    playTone(ctx, {
      type: 'triangle',
      freq: pentatonicFrequency(root, degree),
      duration: 0.16,
      peak: 0.4 * vol,
      attack: 0.005,
      startAt: ctx.currentTime + i * 0.075,
    })
  })
}

function playOpen(opts: SfxOptions): void {
  const ctx = getAudioContext()
  if (!ctx) return
  playNoiseBurst(ctx, { duration: 0.2, peak: 0.3 * (opts.volume ?? 1), filterHz: 500, filterSweepTo: 2600 })
}

function playClose(opts: SfxOptions): void {
  const ctx = getAudioContext()
  if (!ctx) return
  playNoiseBurst(ctx, { duration: 0.16, peak: 0.28 * (opts.volume ?? 1), filterHz: 2200, filterSweepTo: 500 })
}

function playClick(opts: SfxOptions): void {
  const ctx = getAudioContext()
  if (!ctx) return
  playTone(ctx, {
    type: 'sine',
    freq: 1200 * (opts.pitch ?? 1),
    duration: 0.03,
    peak: 0.3 * (opts.volume ?? 1),
    attack: 0.002,
    filterHz: 4000,
  })
}

function playStep(opts: SfxOptions): void {
  const ctx = getAudioContext()
  if (!ctx) return
  playNoiseBurst(ctx, { duration: 0.05, peak: 0.14 * (opts.volume ?? 1), filterHz: 260 })
}

function playRoom(opts: SfxOptions): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const vol = opts.volume ?? 1
  const root = 660 * (opts.pitch ?? 1)
  playTone(ctx, { type: 'sine', freq: root, duration: 0.3, peak: 0.32 * vol, attack: 0.01 })
  playTone(ctx, {
    type: 'sine',
    freq: pentatonicFrequency(root, 2),
    duration: 0.36,
    peak: 0.3 * vol,
    attack: 0.01,
    startAt: ctx.currentTime + 0.11,
  })
}

/** Joue un effet sonore si le son est activé. Ne lève jamais d'exception. */
export function playSfx(id: SfxId, opts: SfxOptions = {}): void {
  try {
    if (!isSoundEnabled()) return
    switch (id) {
      case 'blip':
        playBlip(opts)
        break
      case 'stamp':
        playStamp(opts)
        break
      case 'complete':
        playComplete(opts)
        break
      case 'open':
        playOpen(opts)
        break
      case 'close':
        playClose(opts)
        break
      case 'click':
        playClick(opts)
        break
      case 'step':
        playStep(opts)
        break
      case 'room':
        playRoom(opts)
        break
    }
  } catch {
    // Le confort sonore ne doit jamais faire planter le jeu.
  }
}
