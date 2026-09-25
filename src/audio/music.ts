/**
 * Musique d'ambiance : une boucle générée par salle (voir `rooms.ts`), fondu enchaîné d'≈ 1,5 s au
 * changement de salle, planification par anticipation (`scheduler.ts`) plutôt qu'un `setTimeout`
 * par note. Volume bas (bus dédié, ≈ 0,12) + petite réverbération de convolution (`reverb.ts`).
 *
 * Aucune fonction ici ne lève jamais d'exception : sans `AudioContext` ou son coupé, tout est no-op.
 */
import type { WingId } from '../types'
import { getAudioContext, getMasterGain, isSoundEnabled } from './engine'
import { pentatonicFrequency } from './scale'
import { createReverbImpulse } from './reverb'
import { notesInWindow, type LoopPattern } from './scheduler'
import { roomThemes, type RoomTheme } from './rooms'

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_SECONDS = 0.12
const CROSSFADE_SECONDS = 1.5
const MUSIC_BUS_GAIN = 0.12
const REVERB_SEND_GAIN = 0.4

interface PatternNote {
  time: number
  duration: number
  degree: number
  voice: 'lead' | 'bass'
}

interface ActiveVoice {
  themeId: WingId
  gain: GainNode
  pattern: LoopPattern<PatternNote>
  startCtxTime: number
  scheduledUntil: number
  timer: ReturnType<typeof setInterval>
}

let ctxRef: AudioContext | null = null
let musicBus: GainNode | null = null
let voices: ActiveVoice[] = []
let running = false

function buildPattern(theme: RoomTheme): LoopPattern<PatternNote> {
  const beatSeconds = 60 / theme.bpm
  const loopBeats = theme.barsPerLoop * 4
  const loopDuration = loopBeats * beatSeconds
  const notes: PatternNote[] = theme.melody.map((step) => ({
    time: step.beat * beatSeconds,
    duration: step.beats * beatSeconds,
    degree: step.degree,
    voice: 'lead' as const,
  }))
  const strongBeatCount = loopBeats / 2
  theme.bassDegrees.forEach((degree, i) => {
    if (i >= strongBeatCount) return
    notes.push({ time: i * 2 * beatSeconds, duration: 1.6 * beatSeconds, degree, voice: 'bass' })
  })
  notes.sort((a, b) => a.time - b.time)
  return { loopDuration, notes }
}

function applyMusicEnvelope(param: AudioParam, startAt: number, peak: number, attack: number, release: number): void {
  param.cancelScheduledValues(startAt)
  param.setValueAtTime(0.0001, startAt)
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0005), startAt + attack)
  param.exponentialRampToValueAtTime(0.0001, startAt + attack + release)
}

function scheduleNoteTone(ctx: AudioContext, bus: GainNode, theme: RoomTheme, note: PatternNote, startAt: number): void {
  const isBass = note.voice === 'bass'
  const type = isBass ? theme.bassType : theme.leadType
  const rootHz = isBass ? theme.rootHz / 2 : theme.rootHz
  const freq = pentatonicFrequency(rootHz, note.degree, theme.scale)
  const attack = isBass ? 0.05 : theme.noteAttack
  const release = isBass ? 0.85 : theme.noteRelease
  const peak = isBass ? 0.5 : 0.6

  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startAt)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = isBass ? theme.filterHz * 0.35 : theme.filterHz
  const gain = ctx.createGain()
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(bus)
  applyMusicEnvelope(gain.gain, startAt, peak, attack, release)
  osc.start(startAt)
  osc.stop(startAt + attack + release + 0.1)

  if (!isBass && theme.bell) {
    const bellOsc = ctx.createOscillator()
    bellOsc.type = 'sine'
    bellOsc.frequency.setValueAtTime(freq * 2, startAt)
    const bellGain = ctx.createGain()
    bellOsc.connect(bellGain)
    bellGain.connect(bus)
    applyMusicEnvelope(bellGain.gain, startAt, peak * 0.22, attack * 0.6, release * 0.7)
    bellOsc.start(startAt)
    bellOsc.stop(startAt + attack + release + 0.1)
  }
}

function ensureBuses(): boolean {
  const ctx = getAudioContext()
  if (!ctx) return false
  if (ctxRef === ctx && musicBus) return true
  ctxRef = ctx
  const master = getMasterGain() ?? ctx.destination
  const bus = ctx.createGain()
  bus.gain.value = MUSIC_BUS_GAIN
  bus.connect(master)
  try {
    const send = ctx.createGain()
    send.gain.value = REVERB_SEND_GAIN
    const convolver = ctx.createConvolver()
    convolver.buffer = createReverbImpulse(ctx)
    bus.connect(send)
    send.connect(convolver)
    convolver.connect(master)
  } catch {
    // Réverbération indisponible (buffer non supporté…) : la musique reste jouable, plus sèche.
  }
  musicBus = bus
  return true
}

function tickVoice(voice: ActiveVoice): void {
  const ctx = ctxRef
  if (!ctx || !isSoundEnabled()) return
  const elapsed = ctx.currentTime - voice.startCtxTime
  const to = elapsed + SCHEDULE_AHEAD_SECONDS
  if (to <= voice.scheduledUntil) return
  const theme = roomThemes[voice.themeId]
  for (const note of notesInWindow(voice.pattern, voice.scheduledUntil, to)) {
    scheduleNoteTone(ctx, voice.gain, theme, note, voice.startCtxTime + note.time)
  }
  voice.scheduledUntil = to
}

function stopVoice(voice: ActiveVoice, fadeSeconds: number): void {
  clearInterval(voice.timer)
  const ctx = ctxRef
  if (ctx) {
    try {
      const now = ctx.currentTime
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now)
      voice.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds)
    } catch {
      // ignore
    }
  }
  setTimeout(() => {
    try {
      voice.gain.disconnect()
    } catch {
      // déjà déconnecté
    }
  }, fadeSeconds * 1000 + 60)
}

function spawnVoice(themeId: WingId): ActiveVoice | null {
  const ctx = ctxRef
  if (!ctx || !musicBus) return null
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(musicBus)
  const now = ctx.currentTime
  const fadeIn = voices.length ? CROSSFADE_SECONDS : 0.6
  gain.gain.linearRampToValueAtTime(1, now + fadeIn)
  const voice: ActiveVoice = {
    themeId,
    gain,
    pattern: buildPattern(roomThemes[themeId]),
    startCtxTime: now,
    scheduledUntil: 0,
    timer: setInterval(() => tickVoice(voice), LOOKAHEAD_MS),
  }
  tickVoice(voice)
  return voice
}

/** Démarre (ou continue) la musique d'ambiance sur `room`. No-op si le son est coupé ou sans `AudioContext`. */
export function startMusic(room: WingId): void {
  try {
    if (!isSoundEnabled()) return
    if (!ensureBuses()) return
    if (voices.length && voices[voices.length - 1].themeId === room) {
      running = true
      return
    }
    const fresh = spawnVoice(room)
    if (!fresh) return
    const stale = voices
    voices = [fresh]
    for (const old of stale) stopVoice(old, CROSSFADE_SECONDS)
    running = true
  } catch {
    // ignore
  }
}

/** Change de salle avec un fondu enchaîné ; sans effet si la musique n'est pas démarrée. */
export function setMusicRoom(room: WingId): void {
  if (!running) return
  startMusic(room)
}

/** Arrête toute la musique (fondu rapide) : démontage, écran hors jeu, son coupé. */
export function stopMusic(): void {
  try {
    running = false
    const stale = voices
    voices = []
    for (const old of stale) stopVoice(old, 0.4)
  } catch {
    // ignore
  }
}
