/** Écran de chargement : petite chouette originale qui se dandine. */
import { useT } from '../i18n'
import { strings } from './strings'
import './ui.css'

export function LoadingScreen() {
  const t = useT(strings)

  return (
    <div className="screen ui-loading" data-testid="loading-screen">
      <svg className="ui-loading__owl" viewBox="0 0 100 100" role="img" aria-hidden="true">
        <ellipse cx="50" cy="60" rx="30" ry="28" fill="#c9c2da" />
        <ellipse cx="50" cy="60" rx="20" ry="20" fill="#e9e5f2" />
        <ellipse cx="28" cy="48" rx="9" ry="13" fill="#c9c2da" />
        <ellipse cx="72" cy="48" rx="9" ry="13" fill="#c9c2da" />
        <circle cx="38" cy="55" r="11" fill="#fff" />
        <circle cx="62" cy="55" r="11" fill="#fff" />
        <circle cx="38" cy="56" r="5" fill="#4a3728" />
        <circle cx="62" cy="56" r="5" fill="#4a3728" />
        <circle cx="38" cy="55" r="11" fill="none" stroke="#4a3728" strokeWidth="2.5" />
        <circle cx="62" cy="55" r="11" fill="none" stroke="#4a3728" strokeWidth="2.5" />
        <path d="M49 66 L51 66 L50 71 Z" fill="#e8c872" />
        <path d="M50 44 C46 60, 54 60, 50 44" fill="none" stroke="#4a3728" strokeWidth="2" />
      </svg>
      <p className="ui-loading__text">{t('loadingText')}</p>
    </div>
  )
}
