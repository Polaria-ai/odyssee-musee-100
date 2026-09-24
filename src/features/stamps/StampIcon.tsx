// Propriétaire : agent avatar+tampons. SVG originaux (pas de police externe, pas de trace de logo réel).
import type { ExhibitWingId } from '../../types'
import { wingThemes } from '../../styles/tokens'

const PENDING_COLOR = '#c9c2b6'

/** Tampon encré (SVG original) : engrenage + antenne, usine + fusée, ou palette + livre selon l'aile. */
export function StampIcon({ wing, obtained }: { wing: ExhibitWingId; obtained: boolean }) {
  const color = obtained ? wingThemes[wing].trim : PENDING_COLOR
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" className="stamp-icon" aria-hidden="true">
      <circle
        cx="32"
        cy="32"
        r="27"
        fill="none"
        stroke={color}
        strokeWidth={obtained ? 3 : 2.5}
        strokeDasharray={obtained ? undefined : '4 5'}
      />
      {wing === 'infrastructures' && <InfrastructuresGlyph color={color} />}
      {wing === 'industrialisation' && <IndustrialisationGlyph color={color} />}
      {wing === 'culture' && <CultureGlyph color={color} />}
    </svg>
  )
}

/** Engrenage + antenne. */
function InfrastructuresGlyph({ color }: { color: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="25" cy="35" r="9" />
      <circle cx="25" cy="35" r="3" />
      <path d="M25 23v-3M25 47v-3M39 35h3M10 35h3M34 26l2-2M14 46l2-2M34 44l2 2M14 24l2 2" />
      <path d="M45 45V23" />
      <circle cx="45" cy="19" r="3" fill={color} stroke="none" />
      <path d="M41 29h8M41 35h8" />
    </g>
  )
}

/** Usine + fusée qui décolle. */
function IndustrialisationGlyph({ color }: { color: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 47V30l7 6v-6l7 6V21h15v26H13z" />
      <path d="M21 47v-9M28 47v-9M35 47v-9" />
      <path d="M47 25c2.5-6.5 2.5-11 0-15-2.5 4-2.5 8.5 0 15z" />
      <path d="M44 25l3 5 3-5" />
    </g>
  )
}

/** Palette de peintre + livre ouvert. */
function CultureGlyph({ color }: { color: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 14c-9.5 0-17 6.7-17 14.9 0 5.1 3.6 7.7 7.2 7.7 1.7 0 2.4-1.1 2.4-2.4 0-1.2-.9-2.1-.9-3.5 0-2.1 1.8-3.7 4.1-3.7h4.7c5.2 0 9.5-3.9 9.5-8.8 0-2.1-2.9-4.2-10-4.2z" />
      <circle cx="23" cy="24" r="1.6" fill={color} stroke="none" />
      <circle cx="29" cy="19" r="1.6" fill={color} stroke="none" />
      <circle cx="37" cy="21" r="1.6" fill={color} stroke="none" />
      <path d="M13 49c4.2-2 8.4-2 12.6 0V37c-4.2-2-8.4-2-12.6 0z" />
      <path d="M38.4 49c4.2-2 8.4-2 12.6 0V37c-4.2-2-8.4-2-12.6 0z" />
      <path d="M25.6 37v11.5M38.4 37v11.5" />
    </g>
  )
}
