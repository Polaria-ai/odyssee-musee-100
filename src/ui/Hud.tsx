/**
 * Barre du haut (salle, langue, tampons, visiteurs) + gros bouton d'action contextuel.
 * Le conteneur ne capte aucun geste (pointer-events: none) : seuls ses boutons le font,
 * pour laisser le joystick tactile libre ailleurs à l'écran.
 */
import type { CSSProperties } from 'react'
import { useGame } from '../state/gameStore'
import { useT, usePick } from '../i18n'
import { strings } from './strings'
import { EXHIBIT_WINGS } from '../types'
import './ui.css'

function shortName(name: string): string {
  const trimmed = name.trim()
  const first = trimmed.split(/\s+/)[0]
  return first || trimmed
}

export function Hud() {
  const currentRoom = useGame((s) => s.currentRoom)
  const layout = useGame((s) => s.layout)
  const lang = useGame((s) => s.lang)
  const setLang = useGame((s) => s.setLang)
  const stamps = useGame((s) => s.stamps)
  const setStampCardOpen = useGame((s) => s.setStampCardOpen)
  const peersCount = useGame((s) => s.peersCount)
  const nearbyPersonId = useGame((s) => s.nearbyPersonId)
  const nearCurator = useGame((s) => s.nearCurator)
  const people = useGame((s) => s.people)
  const t = useT(strings)
  const p = usePick()

  const room = layout?.rooms.find((r) => r.id === currentRoom) ?? null
  const stampsCount = Object.keys(stamps).length
  const nearbyPerson = nearbyPersonId ? (people.find((person) => person.id === nearbyPersonId) ?? null) : null

  const actionLabel = nearbyPerson
    ? t('hudLook', { name: shortName(nearbyPerson.name) })
    : nearCurator
      ? t('hudTalkCurator')
      : null

  return (
    <div className="ui-hud" data-testid="hud">
      {room && (
        <div className="ui-hud__top-left">
          <span className="ui-hud__room-pill" style={{ '--pill-color': room.accentColor } as CSSProperties}>
            {p(room.label)}
          </span>
        </div>
      )}

      <div className="ui-hud__top-right">
        <button
          type="button"
          className="ui-hud__lang"
          data-testid="hud-lang"
          aria-label={t('langSwitch')}
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
        >
          {lang.toUpperCase()}
        </button>
        <button
          type="button"
          className="ui-hud__stamps"
          data-testid="stamps-button"
          aria-label={t('hudStamps')}
          onClick={() => setStampCardOpen(true)}
        >
          {t('hudStampsCount', { n: stampsCount, total: EXHIBIT_WINGS.length })}
        </button>
        {peersCount > 0 && (
          <span className="ui-hud__peers" data-testid="peers-count" aria-label={t('hudPeers', { n: peersCount })}>
            {peersCount}
          </span>
        )}
      </div>

      {actionLabel && (
        <button
          type="button"
          className="ui-hud__action"
          data-testid="action-button"
          onClick={() => useGame.getState().interact()}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
