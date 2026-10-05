/**
 * Mention de signature sous le pied de l'écran titre : « Une création » + logo Polaria (lien vers polaria.ai,
 * nouvel onglet) et « © 2026 Polaria » discret. En portrait : deux lignes centrées ; en paysage de téléphone
 * (hauteur ≤ 500 px) : une seule ligne, pour ne pas toucher le panneau central (voir `signature.css`).
 */
import { useT } from '../../i18n'
import { POLARIA_URL } from './brand'
import { PolariaLogo } from './PolariaLogo'
import { strings } from './strings'
import './signature.css'

/** Hauteur du logo sur l'écran titre (consigne : 20 à 24 px). */
export const TITLE_LOGO_HEIGHT = 22

export function TitleSignature() {
  const t = useT(strings)
  return (
    <div className="ui-title__signature" data-testid="title-signature">
      <a className="ui-title__signature-link" data-testid="title-signature-link" href={POLARIA_URL} target="_blank" rel="noopener">
        <span className="ui-title__signature-label">{t('creation')}</span>{' '}
        <PolariaLogo className="ui-title__signature-logo" height={TITLE_LOGO_HEIGHT} alt={t('logoAlt')} />{' '}
        <span className="ui-sr-only">{t('newTab')}</span>
      </a>
      <p className="ui-title__copyright">{t('copyright')}</p>
    </div>
  )
}
