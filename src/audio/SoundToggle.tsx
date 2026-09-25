/** Bouton rond son on/off (≥ 48 px) pour le HUD et l'écran titre. */
import { useSyncExternalStore } from 'react'
import { useT } from '../i18n'
import { isSoundEnabled, subscribeSound, toggleSoundEnabled, unlockAudio } from './engine'
import { playSfx } from './sfx'
import { strings } from './strings'
import './SoundToggle.css'

function getServerSnapshot(): boolean {
  return false
}

function IconSpeakerOn() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="M16.3 8.4a5 5 0 0 1 0 7.2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path
        d="M18.6 6.1a8.4 8.4 0 0 1 0 11.8"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  )
}

function IconSpeakerOff() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function SoundToggle() {
  const enabled = useSyncExternalStore(subscribeSound, isSoundEnabled, getServerSnapshot)
  const t = useT(strings)

  function handleClick() {
    const turningOn = !enabled
    if (turningOn) unlockAudio()
    toggleSoundEnabled()
    if (turningOn) playSfx('click')
  }

  return (
    <button
      type="button"
      className="audio-sound-toggle"
      data-testid="sound-toggle"
      aria-pressed={enabled}
      aria-label={t(enabled ? 'soundOnLabel' : 'soundOffLabel')}
      onClick={handleClick}
    >
      {enabled ? <IconSpeakerOn /> : <IconSpeakerOff />}
    </button>
  )
}
