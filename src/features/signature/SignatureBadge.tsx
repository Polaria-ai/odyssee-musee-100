/**
 * Badge Polaria en jeu : le logo seul, petit (16 px de haut), en bas à gauche, à environ 70 % d'opacité.
 * Un tap ouvre la carte de crédits. Posé dans le coin que ni le HUD (barre du haut, bouton d'action en bas
 * à droite) ni l'aide au premier pas (à 96 px du bas) n'occupent ; sa zone de toucher (≈ 93 × 32 px) reste
 * serrée pour ne pas voler le départ d'un joystick tactile posé près du coin.
 */
import { useT } from '../../i18n'
import { playSfx } from '../../audio'
import { PolariaLogo } from './PolariaLogo'
import { useSignature } from './signatureStore'
import { strings } from './strings'
import './signature.css'

/** Hauteur du logo du badge (consigne : environ 16 px). */
export const BADGE_LOGO_HEIGHT = 16

export function SignatureBadge() {
  const t = useT(strings)
  const openCard = useSignature((s) => s.openCard)
  return (
    <button
      type="button"
      className="sig-badge"
      data-testid="signature-badge"
      aria-label={t('badgeLabel')}
      aria-haspopup="dialog"
      onClick={() => {
        playSfx('click')
        openCard()
      }}
    >
      <PolariaLogo height={BADGE_LOGO_HEIGHT} />
    </button>
  )
}
