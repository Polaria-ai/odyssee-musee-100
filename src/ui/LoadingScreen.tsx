/** Écran de chargement : Cyril et Rémi accueillent le visiteur dans le musée. */
import { useT } from '../i18n'
import { strings } from './strings'
import './ui.css'

export function LoadingScreen() {
  const t = useT(strings)

  return (
    <div className="screen ui-loading" data-testid="loading-screen" aria-busy="true">
      <picture className="ui-loading__picture" aria-hidden="true">
        <source media="(orientation: landscape)" srcSet="/brand/loading-cyril-remi-landscape.jpg" />
        <img className="ui-loading__art" src="/brand/loading-cyril-remi-portrait.jpg" alt="" fetchPriority="high" />
      </picture>
      <div className="ui-loading__veil" aria-hidden="true" />
      <div className="ui-loading__status" role="status" aria-live="polite">
        <p className="ui-loading__text">{t('loadingText')}</p>
        <span className="ui-loading__track" aria-hidden="true">
          <span />
        </span>
      </div>
    </div>
  )
}
