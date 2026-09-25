/**
 * Plan du musée (bouton « Plan » du HUD) : salles colorées selon l'aile, noms, portes, position du
 * joueur (rafraîchie pendant l'ouverture) et portraits vus par aile. Lecture seule : pas de
 * téléportation depuis ce plan.
 *
 * `open`/`onClose` restent pilotés par `Hud`, mais l'état d'ouverture lui-même (`mapOpen`) vit dans
 * `src/state/gameStore.ts` et compte dans `isOverlayOpen` : le déplacement est donc coupé pendant
 * que ce plan est affiché, comme pour la fiche, le dialogue et le carnet de tampons.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGame } from '../state/gameStore'
import { player } from '../state/runtime'
import { useT, usePick } from '../i18n'
import { strings } from './strings'
import { EXHIBIT_WINGS } from '../types'
import type { AABB, ExhibitWingId, RoomLayout } from '../types'
import { countVisitedByWing, doorMarkers } from './format'
import { playSfx } from '../audio'
import { cardStrings } from '../archives/cardStrings'
import './ui.css'
import '../archives/archives.css'

const PLAYER_POLL_MS = 250
/** Marge visuelle (m) autour de l'emprise du musée. */
const MAP_PADDING = 2
const DOOR_SPAN = 2.8
const DOOR_THICKNESS = 0.3
const PLAYER_DOT_RADIUS = 0.7
/** Rayon (m) du pictogramme de la Porte de 2040 dans le plan principal. */
const PORTAL_MARKER_RADIUS = 0.9
/** Tolérance (px) sous laquelle on considère la feuille défilée jusqu'en bas (arrondis sous-pixel). */
const SCROLL_HINT_EPSILON_PX = 2

/** Emprise réunie de plusieurs salles (fonction pure). */
function unionBounds(rooms: readonly RoomLayout[]): AABB {
  return rooms.reduce<AABB>(
    (acc, room) => ({
      minX: Math.min(acc.minX, room.bounds.minX),
      maxX: Math.max(acc.maxX, room.bounds.maxX),
      minZ: Math.min(acc.minZ, room.bounds.minZ),
      maxZ: Math.max(acc.maxZ, room.bounds.maxZ),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  )
}

/** ViewBox SVG (avec marge) pour une emprise donnée (fonction pure). */
function toViewBox(bounds: AABB, padding: number) {
  const originX = bounds.minX - padding
  const originZ = bounds.minZ - padding
  const width = bounds.maxX - bounds.minX + padding * 2
  const height = bounds.maxZ - bounds.minZ + padding * 2
  return { originX, originZ, width, height, viewBox: `${originX} ${originZ} ${width} ${height}` }
}

export interface MuseumMapProps {
  open: boolean
  onClose: () => void
}

export function MuseumMap({ open, onClose }: MuseumMapProps) {
  const layout = useGame((s) => s.layout)
  const people = useGame((s) => s.people)
  const visited = useGame((s) => s.visited)
  const archivesLayout = useGame((s) => s.archivesLayout)
  const sessions = useGame((s) => s.sessions)
  const visitedSessions = useGame((s) => s.visitedSessions)
  const currentRoom = useGame((s) => s.currentRoom)
  const t = useT(strings)
  const tArchives = useT(cardStrings)
  const p = usePick()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [playerPos, setPlayerPos] = useState({ x: player.x, z: player.z })
  // Vrai quand il reste du contenu sous le bas visible de `.ui-map__sheet` (légende des ailes
  // coupée sans indice en paysage bas — bug QA WEL-863). Recalculé au défilement et à la
  // réorientation ; jamais vrai quand tout tient déjà (portrait), jamais vrai une fois défilé
  // jusqu'au vrai bas.
  const [showScrollHint, setShowScrollHint] = useState(false)

  const updateScrollHint = useCallback(() => {
    const el = sheetRef.current
    if (!el) return
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollHint(remaining > SCROLL_HINT_EPSILON_PX)
  }, [])

  useEffect(() => {
    if (!open) return
    titleRef.current?.focus()
    setPlayerPos({ x: player.x, z: player.z })
    const id = window.setInterval(() => setPlayerPos({ x: player.x, z: player.z }), PLAYER_POLL_MS)
    return () => window.clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) {
      setShowScrollHint(false)
      return
    }
    updateScrollHint()
    // Réorientation ou redimensionnement pendant que le plan reste ouvert : la hauteur visible
    // change, l'indice doit se réévaluer (pas seulement au prochain défilement).
    window.addEventListener('resize', updateScrollHint)
    return () => window.removeEventListener('resize', updateScrollHint)
  }, [open, updateScrollHint])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !layout) return null

  // La salle des Archives (loin dans le monde, voir `src/archives/layout.ts`, `ARCHIVES_ORIGIN`)
  // est exclue de l'emprise du plan principal : sinon son éloignement écraserait l'échelle du
  // hall et des ailes. Elle est affichée à part, dans son propre encart à sa propre échelle,
  // plus bas — reliée au plan principal par un pictogramme à la position de la Porte de 2040.
  const mainRooms = layout.rooms.filter((room) => room.id !== 'archives')
  const mainBounds = mainRooms.length > 0 ? unionBounds(mainRooms) : layout.bounds
  const { originX, originZ, width, height, viewBox } = toViewBox(mainBounds, MAP_PADDING)
  const progress = countVisitedByWing(people, visited)
  const doors = doorMarkers(mainRooms)
  const archivesBox = archivesLayout ? toViewBox(archivesLayout.room.bounds, MAP_PADDING) : null
  const archivesSeen = Object.keys(visitedSessions).length
  const archivesTotal = sessions.length
  const playerInArchives = currentRoom === 'archives'
  const portalLeft = archivesLayout ? ((archivesLayout.hallPortal.position.x - originX) / width) * 100 : 0
  const portalTop = archivesLayout ? ((archivesLayout.hallPortal.position.z - originZ) / height) * 100 : 0

  function close() {
    playSfx('click')
    onClose()
  }

  return (
    <div className="ui-map" data-testid="museum-map" role="dialog" aria-modal="true" aria-labelledby="museum-map-title">
      <button type="button" className="ui-map__backdrop" aria-label={t('mapClose')} onClick={close} />
      <div
        className="ui-map__sheet"
        ref={sheetRef}
        onScroll={updateScrollHint}
      >
        <button type="button" className="ui-map__close" data-testid="map-close" aria-label={t('mapClose')} onClick={close}>
          ✕
        </button>
        <h2 id="museum-map-title" className="ui-map__title" ref={titleRef} tabIndex={-1}>
          {t('mapTitle')}
        </h2>

        <div className="ui-map__plan" style={{ aspectRatio: `${width} / ${height}` }}>
          <svg
            className="ui-map__svg"
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            role="presentation"
            aria-hidden="true"
          >
            {mainRooms.map((room) => (
              <rect
                key={room.id}
                className="ui-map__room"
                x={room.bounds.minX}
                y={room.bounds.minZ}
                width={room.bounds.maxX - room.bounds.minX}
                height={room.bounds.maxZ - room.bounds.minZ}
                rx={0.6}
                fill={room.wallColor}
                stroke={room.accentColor}
                strokeWidth={0.25}
              />
            ))}
            {doors.map((door, i) => (
              <rect
                key={i}
                className="ui-map__door"
                x={door.axis === 'z' ? door.x - DOOR_THICKNESS / 2 : door.x - DOOR_SPAN / 2}
                y={door.axis === 'x' ? door.z - DOOR_THICKNESS / 2 : door.z - DOOR_SPAN / 2}
                width={door.axis === 'z' ? DOOR_THICKNESS : DOOR_SPAN}
                height={door.axis === 'x' ? DOOR_THICKNESS : DOOR_SPAN}
                fill="var(--cream)"
              />
            ))}
            {archivesLayout && (
              <g data-testid="map-portal-marker">
                <circle
                  cx={archivesLayout.hallPortal.position.x}
                  cy={archivesLayout.hallPortal.position.z}
                  r={PORTAL_MARKER_RADIUS}
                  className="ui-map__portal-ring"
                />
                <circle
                  cx={archivesLayout.hallPortal.position.x}
                  cy={archivesLayout.hallPortal.position.z}
                  r={PORTAL_MARKER_RADIUS * 0.4}
                  className="ui-map__portal-core"
                />
              </g>
            )}
            <circle
              cx={playerPos.x}
              cy={playerPos.z}
              r={PLAYER_DOT_RADIUS}
              fill="var(--leaf-dark)"
              stroke="#fff"
              strokeWidth={0.15}
            />
          </svg>

          <div className="ui-map__labels">
            {mainRooms.map((room) => {
              const cx = (room.bounds.minX + room.bounds.maxX) / 2
              const cz = (room.bounds.minZ + room.bounds.maxZ) / 2
              const left = ((cx - originX) / width) * 100
              const top = ((cz - originZ) / height) * 100
              const stat = room.id === 'hall' ? null : (progress[room.id as ExhibitWingId] ?? { seen: 0, total: 0 })
              return (
                <div key={room.id} className="ui-map__label" style={{ left: `${left}%`, top: `${top}%` }}>
                  <span className="ui-map__label-name">{p(room.label)}</span>
                  {stat && (
                    <span className="ui-map__label-count">{t('mapWingCount', { seen: stat.seen, total: stat.total })}</span>
                  )}
                </div>
              )
            })}
            {archivesLayout && (
              <div
                className="ui-map__label ui-map__label--portal"
                style={{ left: `${portalLeft}%`, top: `${portalTop}%` }}
              >
                <span className="ui-map__label-name">{tArchives('archivesMapPortalLabel')}</span>
              </div>
            )}
          </div>
        </div>

        <ul className="ui-map__legend">
          {EXHIBIT_WINGS.map((wing) => {
            const room = layout.rooms.find((r) => r.id === wing)
            if (!room) return null
            const stat = progress[wing] ?? { seen: 0, total: 0 }
            return (
              <li key={wing} className="ui-map__legend-item">
                <span className="ui-map__legend-dot" style={{ '--wing-color': room.accentColor } as CSSProperties} />
                <span>{p(room.label)}</span>
                <strong>{t('mapWingCount', { seen: stat.seen, total: stat.total })}</strong>
              </li>
            )
          })}
        </ul>

        {archivesLayout && archivesBox && (
          <div className="ui-map__archives" data-testid="map-archives">
            <h3 className="ui-map__archives-title">{tArchives('archivesMapTitle')}</h3>
            <div className="ui-map__archives-plan" style={{ aspectRatio: `${archivesBox.width} / ${archivesBox.height}` }}>
              <svg
                className="ui-map__svg"
                viewBox={archivesBox.viewBox}
                preserveAspectRatio="xMidYMid meet"
                role="presentation"
                aria-hidden="true"
              >
                <rect
                  x={archivesLayout.room.bounds.minX}
                  y={archivesLayout.room.bounds.minZ}
                  width={archivesLayout.room.bounds.maxX - archivesLayout.room.bounds.minX}
                  height={archivesLayout.room.bounds.maxZ - archivesLayout.room.bounds.minZ}
                  rx={0.6}
                  fill={archivesLayout.room.wallColor}
                  stroke={archivesLayout.room.accentColor}
                  strokeWidth={0.3}
                />
                {playerInArchives && (
                  <circle
                    cx={playerPos.x}
                    cy={playerPos.z}
                    r={PLAYER_DOT_RADIUS}
                    fill="var(--leaf-dark)"
                    stroke="#fff"
                    strokeWidth={0.15}
                    data-testid="map-archives-player-dot"
                  />
                )}
              </svg>
            </div>
            <p className="ui-map__archives-count" data-testid="map-archives-count">
              {tArchives('archivesMapCount', { seen: archivesSeen, total: archivesTotal })}
            </p>
          </div>
        )}

        {showScrollHint && (
          <div className="ui-map__scroll-hint" data-testid="map-scroll-hint" aria-hidden="true">
            <span className="ui-map__scroll-hint-chevron">⌄</span>
          </div>
        )}
      </div>
    </div>
  )
}
