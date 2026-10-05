/**
 * Logo « 2026 : l'Odyssée de l'IA » : le disque en scanlines (15 barres horizontales, bord droit
 * sur le cercle, bord gauche érodé, tirets qui fuient à gauche, 3 barres corail dont 2 qui débordent)
 * et le logotype sur trois lignes. Géométrie reprise telle quelle du skill de Cyril
 * (conference-dataviz-odyssee-ia-2026, js/brand.js) : c'est un logo, il ne varie pas.
 */
const ROWS = 15
const ROW_SPEC: ReadonlyArray<{ erode: number; dash?: [number, number]; coral?: boolean; bleed?: number }> = [
  { erode: 0.7, dash: [1.3, 0.2] },
  { erode: 0.3 },
  { erode: 0.52, dash: [1.16, 0.14] },
  { erode: 0.16 },
  { erode: 0.44, dash: [1.44, 0.26] },
  { erode: 0.24, coral: true },
  { erode: 0.08, coral: true, bleed: 0.66 },
  { erode: 0.38, dash: [1.2, 0.17] },
  { erode: 0.12 },
  { erode: 0.56 },
  { erode: 0.28, coral: true, bleed: 0.3 },
  { erode: 0.14, dash: [1.36, 0.22] },
  { erode: 0.48 },
  { erode: 0.22, dash: [1.14, 0.13] },
  { erode: 0.62 },
]

export interface DiscBar {
  x: number
  y: number
  width: number
  height: number
  coral: boolean
}

/** Barres du disque (pur, testé) : coordonnées dans un viewBox 112 × 100. */
export function discBars(): DiscBar[] {
  const R = 44
  const cx = 62
  const cy = 50
  const rowH = (2 * R) / ROWS
  const th = rowH * 0.56
  const bars: DiscBar[] = []
  for (let i = 0; i < ROWS; i++) {
    const spec = ROW_SPEC[i]
    const yc = cy - R + (i + 0.5) * rowH
    const dy = yc - cy
    const half = Math.sqrt(Math.max(0, R * R - dy * dy))
    if (half < th * 0.5) continue
    const xr = cx + half
    let xl = cx - half + spec.erode * R
    if (spec.bleed) xl = cx - half - spec.bleed * R
    bars.push({ x: xl, y: yc - th / 2, width: Math.max(0, xr - xl), height: th, coral: Boolean(spec.coral) })
    if (spec.dash) bars.push({ x: cx - spec.dash[0] * R, y: yc - th / 2, width: spec.dash[1] * R, height: th, coral: false })
  }
  return bars
}

const BARS = discBars()

export function OdysseeDisc({ size = 72, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg className="od-disc" viewBox="0 0 112 100" width={size} height={(size * 100) / 112} role="img" aria-label="L'Odyssée de l'IA">
      {BARS.map((b, i) => (
        <rect key={i} x={b.x.toFixed(2)} y={b.y.toFixed(2)} width={b.width.toFixed(2)} height={b.height.toFixed(2)} fill={b.coral && !mono ? 'var(--corail)' : '#ffffff'} />
      ))}
    </svg>
  )
}

/** Disque + logotype « 2026 : / l'Odyssée / de l'IA » (le « IA » en corail). */
export function OdysseeLogo({ size = 72, year = 2026 }: { size?: number; year?: number }) {
  return (
    <div className="od-logo" aria-label={`${year} : l'Odyssée de l'IA`}>
      <OdysseeDisc size={size} />
      <span className="od-logo__word" aria-hidden="true">
        <span className="od-logo__l1">{year} :</span>
        <span className="od-logo__l2">l’Odyssée</span>
        <span className="od-logo__l3">
          de l’<span className="od-logo__ia">IA</span>
        </span>
      </span>
    </div>
  )
}
