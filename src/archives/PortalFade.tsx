/**
 * Fondu plein écran (DOM) pendant le passage par la Porte de 2040, piloté par `store.portalTransition`.
 *
 * Séquence : écran qui noircit (~350 ms) → téléportation (`placePlayer`) vers `archivesLayout.arrival`
 * ('to-archives') ou 1,6 m au sud de `archivesLayout.hallPortal` ('to-hall', face au nord comme le
 * point d'apparition du hall) → `resetInput()` → petit son de salle → écran qui s'éclaircit → la
 * transition est remise à `null`. Bloque les entrées pendant tout le fondu : la surimpression
 * plein écran capte les gestes (le joystick et les boutons du HUD restent en dessous, mais ne
 * reçoivent plus aucun événement tant qu'elle est montée).
 */
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../state/gameStore'
import { placePlayer, resetInput } from '../state/runtime'
import { useT } from '../i18n'
import { cardStrings } from './cardStrings'
import { playSfx } from '../audio'
import './archives.css'

const FADE_MS = 350
/** `prefers-reduced-motion` : fondu court plutôt que la durée normale. */
const FADE_MS_REDUCED = 80
/** Distance (m) au sud de la Porte de 2040, dans le hall, à l'arrivée du retour. */
const HALL_ARRIVAL_OFFSET_Z = 1.6

type Phase = 'idle' | 'in' | 'out'

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  } catch {
    return false
  }
}

export function PortalFade() {
  const transition = useGame((s) => s.portalTransition)
  const archivesLayout = useGame((s) => s.archivesLayout)
  const setPortalTransition = useGame((s) => s.setPortalTransition)
  const t = useT(cardStrings)

  const [phase, setPhase] = useState<Phase>('idle')
  // Le type de transition en cours, gardé pendant tout le fondu (y compris après que le store
  // a déjà été remis à `null` par la fin du fondu inverse) : sert au texte et à la téléportation.
  const kindRef = useRef<'to-archives' | 'to-hall' | null>(null)

  // Départ du fondu : une transition apparaît dans le store, l'écran commence à noircir.
  useEffect(() => {
    if (!transition) return
    kindRef.current = transition
    resetInput()
    setPhase('in')
  }, [transition])

  // Écran noir atteint : téléportation puis démarrage du fondu inverse.
  useEffect(() => {
    if (phase !== 'in') return
    const fadeMs = prefersReducedMotion() ? FADE_MS_REDUCED : FADE_MS
    const id = window.setTimeout(() => {
      if (archivesLayout) {
        if (kindRef.current === 'to-archives') {
          placePlayer(archivesLayout.arrival.position.x, archivesLayout.arrival.position.z, archivesLayout.arrival.rotationY)
        } else {
          placePlayer(
            archivesLayout.hallPortal.position.x,
            archivesLayout.hallPortal.position.z + HALL_ARRIVAL_OFFSET_Z,
            Math.PI,
          )
        }
      }
      resetInput()
      playSfx('room')
      setPhase('out')
    }, fadeMs)
    return () => window.clearTimeout(id)
  }, [phase, archivesLayout])

  // Fondu inverse terminé : la transition est refermée, l'écran redevient interactif.
  useEffect(() => {
    if (phase !== 'out') return
    const fadeMs = prefersReducedMotion() ? FADE_MS_REDUCED : FADE_MS
    const id = window.setTimeout(() => {
      setPortalTransition(null)
      setPhase('idle')
      kindRef.current = null
    }, fadeMs)
    return () => window.clearTimeout(id)
  }, [phase, setPortalTransition])

  if (phase === 'idle') return null

  const label = kindRef.current === 'to-hall' ? t('portalToHall') : t('portalToArchives')

  return (
    <div className={`portal-fade portal-fade--${phase}`} data-testid="portal-fade" data-phase={phase}>
      <p className="portal-fade__text" role="status" aria-live="assertive">
        {label}
      </p>
    </div>
  )
}
