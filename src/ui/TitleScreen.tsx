/** Écran titre : la caméra tourne au-dessus du hall derrière cette surimpression transparente. */
import { useGame } from '../state/gameStore'
import { useT } from '../i18n'
import { strings } from './strings'
import './ui.css'

export function TitleScreen() {
  const setScreen = useGame((s) => s.setScreen)
  const lang = useGame((s) => s.lang)
  const setLang = useGame((s) => s.setLang)
  const dataSource = useGame((s) => s.dataSource)
  const t = useT(strings)

  return (
    <div className="screen ui-title" data-testid="title-screen">
      <button
        type="button"
        className="ui-title__lang"
        data-testid="lang-toggle"
        aria-label={t('langSwitch')}
        onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
      >
        {lang === 'fr' ? 'FR · EN' : 'EN · FR'}
      </button>

      <div className="ui-title__panel">
        <p className="ui-title__eyebrow">{t('titleEyebrow')}</p>
        <h1 className="ui-title__heading">{t('titleHeading')}</h1>
        <p className="ui-title__subtitle">{t('titleSubtitle')}</p>
        <button type="button" className="ui-title__enter" data-testid="enter-button" onClick={() => setScreen('customize')}>
          {t('titleEnter')}
        </button>
        {dataSource === 'placeholder' && <p className="ui-title__banner">{t('titlePlaceholderBanner')}</p>}
      </div>

      <p className="ui-title__footer">{t('titleFooter')}</p>
    </div>
  )
}
