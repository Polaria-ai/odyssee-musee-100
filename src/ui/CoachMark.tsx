/**
 * Aide au premier pas : bulle en bas à gauche montrée une seule fois (mémorisée en `localStorage`),
 * au premier passage en jeu. Disparaît au premier déplacement du joueur ou après 10 s, jamais
 * pendant un dialogue (elle recouvrirait la bulle de Rémi, au même endroit de l'écran).
 */
import { useEffect, useState } from 'react'
import { useGame } from '../state/gameStore'
import { player } from '../state/runtime'
import { useT } from '../i18n'
import { strings } from './strings'
import './ui.css'

const STORAGE_KEY = 'musee.ui.coachMarkSeen'
const AUTO_HIDE_MS = 10_000
const MOVING_POLL_MS = 200
const SETTLE_MS = 50

function hasCoarsePointer(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
  } catch {
    return false
  }
}

function readSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen(): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, '1')
  } catch {
    // Stockage indisponible (navigation privée…) : tant pis, la bulle réapparaîtra la prochaine fois.
  }
}

export function CoachMark() {
  const dialogue = useGame((s) => s.dialogue)
  const t = useT(strings)
  const [visible, setVisible] = useState(false)
  // Lu une seule fois (initialiseur paresseux, pur — sûr à rejouer) : React StrictMode (dev)
  // rejoue chaque effet une fois (montage → nettoyage → remontage) pour détecter les effets
  // impurs. Si on relisait `localStorage` directement dans l'effet, ce deuxième passage verrait
  // l'écriture du premier et s'arrêterait aussitôt, avant d'avoir reposé son minuteur de secours —
  // la bulle resterait affichée mais plus jamais masquée. En le figeant ici, les deux passages de
  // l'effet voient la même décision et convergent vers un seul minuteur actif, comme en prod.
  const [alreadySeen] = useState(() => readSeen())
  // Bascule une seule fois, de false à true, jamais l'inverse (voir l'effet ci-dessous) : sûr à
  // mettre en dépendance d'un second effet sans jamais le faire nettoyer/relancer après coup.
  const [readyToArm, setReadyToArm] = useState(false)
  // Vrai UNE COURTE PÉRIODE après le montage (voir l'effet juste en dessous) : le temps que le
  // dialogue d'accueil, s'il doit démarrer, ait réellement démarré — voir pourquoi ci-dessous.
  const [settled, setSettled] = useState(false)

  // `Hud` (donc `CoachMark`) et l'effet de `App.tsx` qui lance le dialogue d'accueil
  // (`g.startDialogue(...)`, sur le même rendu où `screen` passe à `'play'`) sont deux composants
  // frères : React exécute les effets des enfants avant celui du parent au sein d'un même commit.
  // Au tout premier passage de l'effet d'armement ci-dessous, `dialogue` peut donc encore valoir
  // `null` alors que le dialogue d'accueil est sur le point de démarrer l'instant d'après, dans le
  // même commit. On attend un court délai après le montage avant d'évaluer `dialogue` pour la
  // première fois : le temps que ce commit se termine entièrement (effet de `App.tsx` inclus).
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), SETTLE_MS)
    return () => window.clearTimeout(id)
  }, [])

  // On n'arme le minuteur de 10 s qu'une fois le dialogue d'accueil terminé (le joueur ne peut de
  // toute façon pas bouger tant qu'il est ouvert, `isOverlayOpen`) : le dialogue de bienvenue
  // (7 lignes tapées lettre par lettre) dépasse presque toujours 10 s à lui seul. Armer le minuteur
  // dès le montage — en même temps que ce dialogue démarre (`App.tsx`) — ferait quasi systématiquement
  // expirer les 10 s pendant que la bulle est encore masquée par `!visible || dialogue` ci-dessous :
  // en sortant du dialogue, `visible` serait déjà retombé à faux et la bulle n'apparaîtrait jamais.
  // Régressions réelles (trouvées en vérification visuelle app réelle, Playwright — pas par un test
  // à l'origine), toutes deux couvertes par `CoachMark.test.tsx` :
  // — le dialogue dure plus de 10 s : le minuteur ne doit pas s'épuiser pendant qu'il est masqué ;
  // — le dialogue n'a même pas encore démarré au tout premier passage de cet effet (voir `settled`
  //   ci-dessus) : sans lui, le minuteur s'armait avant même que `dialogue` ne devienne vrai.
  useEffect(() => {
    if (!settled || alreadySeen || readyToArm || dialogue) return
    setReadyToArm(true)
  }, [settled, alreadySeen, readyToArm, dialogue])

  // Effet séparé, qui ne dépend que de `readyToArm` (jamais directement de `dialogue`) : une fois
  // armé, un dialogue ultérieur (Rémi, plus tard dans la partie) ne doit ni nettoyer ni relancer
  // ce minuteur — seul le tout premier passage en jeu doit en poser un.
  useEffect(() => {
    if (!readyToArm) return
    markSeen()
    setVisible(true)
    let hidden = false
    const hide = () => {
      if (hidden) return
      hidden = true
      setVisible(false)
    }
    const timeout = window.setTimeout(hide, AUTO_HIDE_MS)
    const poll = window.setInterval(() => {
      if (player.moving) hide()
    }, MOVING_POLL_MS)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(poll)
    }
  }, [readyToArm])

  if (!visible || dialogue) return null

  const text = hasCoarsePointer() ? t('coachTouch') : t('coachKeys')

  return (
    <div className="ui-coach" data-testid="coach-mark">
      <span className="ui-coach__hand" aria-hidden="true">
        👆
      </span>
      <p className="ui-coach__text">{text}</p>
    </div>
  )
}
