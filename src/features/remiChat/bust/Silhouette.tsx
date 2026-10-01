/**
 * Silhouette d'attente et de repli du buste : affichée pendant le chargement du modèle, et à sa place si
 * WebGL est indisponible ou si le chargement échoue (jamais d'écran vide). Tracée en scanlines, comme le
 * disque du logo et les toiles d'attente du musée (charte 3D §4.6), avec le contre-jour cyan en liseré.
 * SVG pur : aucune ressource GPU, aucune requête réseau.
 */
import { useId } from 'react'
import { charter3d } from '../../../styles/tokens'
import type { RemiBustVariant } from '../contract'

const { cyanVif, nuit, brume } = charter3d.base

/** Part de la hauteur du conteneur occupée par la silhouette : tout en split, le haut (60 %) en plein écran. */
const HEIGHT: Record<RemiBustVariant, string> = { split: '100%', fullscreen: '60%' }

export interface SilhouetteProps {
  variant: RemiBustVariant
  /** Masque CSS de fondu (le même que celui du buste 3D) : le corps s'estompe sous la coupe à mi-torse. */
  mask?: string
  /** Le vrai buste est prêt : la silhouette s'efface (fondu court, sans animation). */
  hidden?: boolean
}

export function Silhouette({ variant, mask, hidden = false }: SilhouetteProps) {
  const id = useId().replace(/:/g, '')
  const clip = `remi-sil-clip-${id}`
  const bars = `remi-sil-bars-${id}`
  const glow = `remi-sil-glow-${id}`
  const breathe = `remi-sil-breathe-${id}`
  return (
    <div
      data-testid="remi-bust-silhouette"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: hidden ? 0 : 1,
        transition: 'opacity 0.35s ease-out',
        pointerEvents: 'none',
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    >
      <style>{`
        @keyframes ${breathe} { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-0.6%) scale(1.012); } }
        .${breathe} { transform-origin: 50% 100%; animation: ${breathe} 4.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .${breathe} { animation: none; } }
      `}</style>
      <svg
        className={hidden ? undefined : breathe}
        viewBox="0 0 200 250"
        preserveAspectRatio="xMidYMin meet"
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: HEIGHT[variant], display: 'block', overflow: 'visible' }}
      >
        <defs>
          <pattern id={bars} width="200" height="11" patternUnits="userSpaceOnUse">
            <rect width="200" height="6" fill={brume} fillOpacity="0.3" />
          </pattern>
          <clipPath id={clip}>
            <ellipse cx="100" cy="64" rx="30" ry="37" />
            <path d="M86 96 H114 V130 H86 Z" />
            <path d="M12 330 V250 C12 178 48 140 100 134 C152 140 188 178 188 250 V330 Z" />
          </clipPath>
          <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="200" height="330" fill={nuit} fillOpacity="0.6" />
          <rect width="200" height="330" fill={`url(#${bars})`} />
        </g>
        <g fill="none" stroke={cyanVif} strokeWidth="2">
          <g filter={`url(#${glow})`} opacity="0.55">
            <ellipse cx="100" cy="64" rx="30" ry="37" />
            <path d="M12 330 V250 C12 178 48 140 100 134 C152 140 188 178 188 250 V330" />
          </g>
          <ellipse cx="100" cy="64" rx="30" ry="37" strokeOpacity="0.85" />
          <path d="M12 330 V250 C12 178 48 140 100 134 C152 140 188 178 188 250 V330" strokeOpacity="0.85" />
        </g>
      </svg>
    </div>
  )
}
