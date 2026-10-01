/**
 * Carte de crédits Polaria : « Le Musée des 100 — une création Polaria », qui a conçu le jeu et pour quel
 * événement, droits réservés, lien vers polaria.ai. Ouverte par le badge du HUD ou la plaque du hall
 * (`useSignature`) ; se ferme par le bouton ✕, un tap sur le fond ou Échap. `role="dialog"`, focus dans la
 * carte à l'ouverture (rendu à l'élément précédent à la fermeture), Tab bouclé dans la carte.
 *
 * Elle n'est pas dans `isOverlayOpen` (voir `signatureStore.ts`) : à l'ouverture elle remet l'entrée de
 * déplacement à zéro, et tant qu'elle est ouverte un écouteur clavier en phase de capture avale tout sauf
 * Échap et Tab — le jeu, qui écoute `window`, ne reçoit ni déplacement ni action (Entrée/E/Espace).
 */
import { useEffect, useRef } from 'react'
import { useT } from '../../i18n'
import { playSfx } from '../../audio'
import { resetInput } from '../../state/runtime'
import { POLARIA_URL } from './brand'
import { PolariaLogo } from './PolariaLogo'
import { isCloseClickGuarded, useSignature } from './signatureStore'
import { strings } from './strings'
import './signature.css'

/** Hauteur du logo en tête de la carte. */
export const CARD_LOGO_HEIGHT = 34

const FOCUSABLE = 'a[href], button:not([disabled])'

export function SignatureCard() {
  const open = useSignature((s) => s.cardOpen)
  const closeCard = useSignature((s) => s.closeCard)
  const t = useT(strings)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    resetInput()
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.stopPropagation()
        closeCard()
        return
      }
      if (e.key === 'Tab') {
        const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
        if (nodes && nodes.length > 0) {
          const first = nodes[0]
          const last = nodes[nodes.length - 1]
          const active = document.activeElement
          if (e.shiftKey && (active === first || active === panelRef.current)) {
            last.focus()
            e.preventDefault()
          } else if (!e.shiftKey && active === last) {
            first.focus()
            e.preventDefault()
          }
        }
        return
      }
      // Ni déplacement ni action (Entrée/E/Espace) pendant la lecture ; les touches natives du lien et du
      // bouton fonctionnent quand même (on n'appelle pas preventDefault).
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      if (previous && previous.isConnected) previous.focus()
    }
  }, [open, closeCard])

  if (!open) return null

  function close() {
    if (isCloseClickGuarded(useSignature.getState())) return
    playSfx('click')
    closeCard()
  }

  return (
    <div className="sig-card-backdrop" data-testid="signature-backdrop" onClick={close}>
      <div
        className="sig-card"
        data-testid="signature-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-card-title"
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="sig-card__close" data-testid="signature-close" aria-label={t('cardClose')} onClick={close}>
          ✕
        </button>
        <PolariaLogo className="sig-card__logo" height={CARD_LOGO_HEIGHT} alt={t('logoAlt')} />
        <h2 id="signature-card-title" className="sig-card__title">
          {t('cardTitle')}
        </h2>
        <p className="sig-card__credit">{t('cardCredit')}</p>
        <p className="sig-card__rights">{t('cardRights')}</p>
        <a className="sig-card__link" data-testid="signature-link" href={POLARIA_URL} target="_blank" rel="noopener">
          {t('cardLink')}
          <span className="ui-sr-only"> {t('newTab')}</span>
        </a>
      </div>
    </div>
  )
}
