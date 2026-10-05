/**
 * Réverbération par convolution : réponse impulsionnelle générée (bruit qui décroît), aucun
 * fichier audio. `impulseResponseSamples` est pure et testable ; `createReverbImpulse` a besoin
 * d'un vrai `AudioContext` pour fabriquer le buffer.
 */

/**
 * Échantillons mono (-1..1) d'une décroissance de bruit ~exponentielle.
 * `decay` est ramené à 0 s'il est négatif ou NaN : un exposant négatif ferait exploser
 * `(1 - t) ** decay` vers l'infini en fin de buffer (t → 1), ce qui casserait l'invariant -1..1
 * (et propagerait du NaN/Infinity dans la convolution en aval).
 */
export function impulseResponseSamples(length: number, decay: number): Float32Array {
  const size = Math.max(1, Math.floor(length))
  const safeDecay = Number.isFinite(decay) && decay > 0 ? decay : 0
  const data = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    const t = i / size
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, safeDecay)
  }
  return data
}

/** Buffer de convolution stéréo pour une petite réverbe douce (salle chaleureuse, pas une cathédrale). */
export function createReverbImpulse(ctx: AudioContext, seconds = 2.2, decay = 2.6): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = impulseResponseSamples(length, decay)
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) data[i] = samples[i]
  }
  return buffer
}
