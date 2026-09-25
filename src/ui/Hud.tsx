/**
 * Barre du haut (salle, langue, tampons, visiteurs) + gros bouton d'action contextuel.
 * Le conteneur ne capte aucun geste (pointer-events: none) : seuls ses boutons le font,
 * pour laisser le joystick tactile libre ailleurs à l'écran.
 */
import { type CSSProperties } from 'react'
import { useGame } from '../state/gameStore'
import { useT, usePick } from '../i18n'
import { strings } from './strings'
import { EXHIBIT_WINGS } from '../types'
import { cardStrings } from '../archives/cardStrings'
import { hasArchivesStamp } from '../features/stamps/stamps'
import { playSfx } from '../audio'
import { SoundToggle } from '../audio/SoundToggle'
import { MuseumMap } from './MuseumMap'
import { CoachMark } from './CoachMark'
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
  const nearbySessionId = useGame((s) => s.nearbySessionId)
  const nearArchivist = useGame((s) => s.nearArchivist)
  const sessions = useGame((s) => s.sessions)
  const visitedSessions = useGame((s) => s.visitedSessions)
  const people = useGame((s) => s.people)
  const mapOpen = useGame((s) => s.mapOpen)
  const setMapOpen = useGame((s) => s.setMapOpen)
  const t = useT(strings)
  const tc = useT(cardStrings)
  const p = usePick()

  // Le plan est une surimpression comme les autres (fiche, dialogue, carnet) : `mapOpen` vit dans
  // `src/state/gameStore.ts` et compte dans `isOverlayOpen`, donc `App` coupe `useKeyboardControls`
  // et démonte `TouchJoystick` tant qu'il reste ouvert — plus besoin de remettre l'entrée à zéro ici.

  const room = layout?.rooms.find((r) => r.id === currentRoom) ?? null
  // Le 4e tampon (Archives de 2040) ne compte que si le programme de la soirée est chargé.
  const hasArchives = sessions.length > 0
  const stampsCount = Object.keys(stamps).length + (hasArchives && hasArchivesStamp(visitedSessions, sessions.length) ? 1 : 0)
  const stampsTotal = EXHIBIT_WINGS.length + (hasArchives ? 1 : 0)
  const nearbyPerson = nearbyPersonId ? (people.find((person) => person.id === nearbyPersonId) ?? null) : null

  // Même ordre de priorité que `interact()` (src/state/gameStore.ts).
  const actionLabel = nearbyPerson
    ? t('hudLook', { name: shortName(nearbyPerson.name) })
    : nearbySessionId
      ? tc('hudConsultArchive')
      : nearArchivist
        ? tc('hudTalkArchivist')
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
        <SoundToggle />
        <button
          type="button"
          className="ui-hud__map"
          data-testid="map-button"
          aria-label={t('mapButton')}
          onClick={() => {
            playSfx('click')
            setMapOpen(true)
          }}
        >
          {t('mapButton')}
        </button>
        <button
          type="button"
          className="ui-hud__lang"
          data-testid="hud-lang"
          aria-label={t('langSwitch')}
          onClick={() => {
            playSfx('click')
            setLang(lang === 'fr' ? 'en' : 'fr')
          }}
        >
          {lang.toUpperCase()}
        </button>
        <button
          type="button"
          className="ui-hud__stamps"
          data-testid="stamps-button"
          aria-label={t('hudStamps')}
          onClick={() => {
            playSfx('click')
            setStampCardOpen(true)
          }}
        >
          {t('hudStampsCount', { n: stampsCount, total: stampsTotal })}
        </button>
        {peersCount > 0 && (
          <span className="ui-hud__peers" data-testid="peers-count" aria-label={peersCount === 1 ? t('hudPeersOne') : t('hudPeers', { n: peersCount })}>
            {peersCount}
          </span>
        )}
      </div>

      {actionLabel && (
        <button
          type="button"
          className="ui-hud__action"
          data-testid="action-button"
          onClick={() => {
            playSfx('click')
            useGame.getState().interact()
          }}
        >
          {actionLabel}
        </button>
      )}

      <CoachMark />
      <MuseumMap open={mapOpen} onClose={() => setMapOpen(false)} />
    </div>
  )
}
