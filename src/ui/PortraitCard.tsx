/**
 * Fiche plein écran de la personne ouverte (`openPersonId`). Feuille qui monte du bas
 * (plein écran mobile, carte centrée sur desktop), navigation précédent/suivant dans l'aile.
 */
import { useEffect, useRef, type CSSProperties, type TouchEvent as ReactTouchEvent } from 'react'
import { useGame } from '../state/gameStore'
import { useT, usePick } from '../i18n'
import { strings } from './strings'
import { flagEmoji, organizationLabel, safeUrl, splitParagraphs } from './format'
import { wingThemes } from '../styles/tokens'
import type { Person } from '../types'
import { playSfx } from '../audio'
import './ui.css'

const SWIPE_CLOSE_THRESHOLD = 90

function PlaceholderPortrait({ order, wingColor }: { order: number; wingColor: string }) {
  return (
    <svg className="ui-portrait__placeholder" viewBox="0 0 120 150" role="img" aria-hidden="true">
      <rect width="120" height="150" fill={wingColor} opacity="0.22" />
      <circle cx="60" cy="56" r="26" fill={wingColor} opacity="0.55" />
      <path d="M16 146 Q60 88 104 146 Z" fill={wingColor} opacity="0.55" />
      <text x="60" y="132" textAnchor="middle" fontFamily="var(--font-display)" fontSize="18" fill="#4a3728">
        {`N°${String(order).padStart(3, '0')}`}
      </text>
    </svg>
  )
}

export function PortraitCard() {
  const openPersonId = useGame((s) => s.openPersonId)
  const people = useGame((s) => s.people)
  const layout = useGame((s) => s.layout)
  const closePerson = useGame((s) => s.closePerson)
  const openPerson = useGame((s) => s.openPerson)
  const t = useT(strings)
  const p = usePick()

  const titleRef = useRef<HTMLHeadingElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ startY: 0, active: false })
  const wasOpenRef = useRef(false)

  const person: Person | null = openPersonId ? (people.find((per) => per.id === openPersonId) ?? null) : null

  useEffect(() => {
    if (person) titleRef.current?.focus()
    // Ne réagit qu'au changement de personne affichée, pas à chaque nouvelle référence de `person`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id])

  // Son d'ouverture/fermeture de la fiche : sur la transition fermé↔ouvert, pas sur la navigation
  // précédent/suivant (qui change `person` sans jamais repasser par `null`).
  useEffect(() => {
    const isOpen = person !== null
    if (isOpen && !wasOpenRef.current) playSfx('open')
    if (!isOpen && wasOpenRef.current) playSfx('close')
    wasOpenRef.current = isOpen
  }, [person])

  useEffect(() => {
    if (!person) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closePerson()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [person, closePerson])

  if (!person) return null

  const wingPeople = people.filter((per) => per.wing === person.wing).sort((a, b) => a.order - b.order)
  const idx = wingPeople.findIndex((per) => per.id === person.id)
  const prevPerson = idx > 0 ? wingPeople[idx - 1] : null
  const nextPerson = idx >= 0 && idx < wingPeople.length - 1 ? wingPeople[idx + 1] : null

  const room = layout?.rooms.find((r) => r.id === person.wing) ?? null
  const wingColor = room?.accentColor ?? wingThemes[person.wing].accent
  const wingLabel = room ? p(room.label) : ''
  const organization = organizationLabel(person, t('portraitOrgPending'))
  const photo = safeUrl(person.photoUrl)
  const paragraphs = splitParagraphs(p(person.story))
  const safeLinks = (person.links ?? [])
    .map((link) => ({ label: link.label, href: safeUrl(link.url) }))
    .filter((link): link is { label: string; href: string } => link.href !== null)

  function handleTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    if ((sheetRef.current?.scrollTop ?? 0) > 0) {
      dragRef.current.active = false
      return
    }
    dragRef.current = { startY: e.touches[0].clientY, active: true }
  }

  function handleTouchMove(e: ReactTouchEvent<HTMLDivElement>) {
    if (!dragRef.current.active || !sheetRef.current) return
    const delta = e.touches[0].clientY - dragRef.current.startY
    if (delta > 0) sheetRef.current.style.transform = `translateY(${Math.min(delta, 240)}px)`
  }

  function handleTouchEnd(e: ReactTouchEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return
    const delta = e.changedTouches[0].clientY - dragRef.current.startY
    if (sheetRef.current) sheetRef.current.style.transform = ''
    dragRef.current.active = false
    if (delta > SWIPE_CLOSE_THRESHOLD) closePerson()
  }

  return (
    <div className="ui-portrait" data-testid="portrait-card" role="dialog" aria-modal="true" aria-labelledby="portrait-card-title">
      <button type="button" className="ui-portrait__backdrop" aria-label={t('portraitClose')} onClick={closePerson} />
      <div
        className="ui-portrait__sheet"
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="ui-portrait__handle" aria-hidden="true" />
        <button
          type="button"
          className="ui-portrait__close"
          data-testid="portrait-close"
          aria-label={t('portraitClose')}
          onClick={() => {
            playSfx('click')
            closePerson()
          }}
        >
          ✕
        </button>

        <div className="ui-portrait__frame">
          {photo ? (
            <img className="ui-portrait__photo" src={photo} alt={person.name} loading="lazy" />
          ) : (
            <PlaceholderPortrait order={person.order} wingColor={wingColor} />
          )}
        </div>

        {person.placeholder && <p className="ui-portrait__waiting">{t('portraitWaiting')}</p>}

        <h2 id="portrait-card-title" className="ui-portrait__name" ref={titleRef} tabIndex={-1}>
          {person.name}
        </h2>
        <p className="ui-portrait__role">
          {p(person.role)} · {organization}
        </p>
        <p className="ui-portrait__meta">
          <span aria-hidden="true">{flagEmoji(person.country)}</span>
          <span className="ui-portrait__wing" style={{ '--wing-color': wingColor } as CSSProperties}>
            {wingLabel}
          </span>
        </p>

        <p className="ui-portrait__bio">{p(person.bio)}</p>

        {paragraphs.length > 0 && (
          <div className="ui-portrait__story">
            {paragraphs.map((paragraph, i) => (
              // Paragraphes d'une histoire statique, jamais réordonnés : la clé d'index est stable.
              <p key={`${person.id}-${i}`}>{paragraph}</p>
            ))}
          </div>
        )}

        {person.quote && <blockquote className="ui-portrait__quote">“{p(person.quote)}”</blockquote>}

        {safeLinks.length > 0 && (
          <ul className="ui-portrait__links">
            {safeLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        {person.photoCredit && <p className="ui-portrait__credit">{t('portraitCredit', { credit: person.photoCredit })}</p>}

        <div className="ui-portrait__nav">
          <button
            type="button"
            data-testid="portrait-prev"
            disabled={!prevPerson}
            onClick={() => {
              if (!prevPerson) return
              playSfx('click')
              openPerson(prevPerson.id)
            }}
          >
            {t('portraitPrev')}
          </button>
          <button
            type="button"
            data-testid="portrait-next"
            disabled={!nextPerson}
            onClick={() => {
              if (!nextPerson) return
              playSfx('click')
              openPerson(nextPerson.id)
            }}
          >
            {t('portraitNext')}
          </button>
        </div>
      </div>
    </div>
  )
}
