import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { player } from '../state/runtime'
import { CoachMark } from './CoachMark'

const STORAGE_KEY = 'musee.ui.coachMarkSeen'
// Doit dépasser le court délai de stabilisation interne de `CoachMark` (`SETTLE_MS`) : le temps
// que le dialogue d'accueil, s'il doit démarrer, ait réellement démarré (voir `CoachMark.tsx`).
const SETTLE_MS = 50

describe('CoachMark', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    player.moving = false
    useGame.setState({ lang: 'fr', dialogue: null, dialogueIndex: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('s’affiche au premier passage en jeu', () => {
    render(<CoachMark />)
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS)
    })
    expect(screen.getByTestId('coach-mark')).toBeInTheDocument()
  })

  it('mémorise le premier passage dans localStorage dès l’affichage', () => {
    render(<CoachMark />)
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS)
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('ne s’affiche pas du tout si déjà vue (nouveau montage)', () => {
    localStorage.setItem(STORAGE_KEY, '1')
    render(<CoachMark />)
    expect(screen.queryByTestId('coach-mark')).not.toBeInTheDocument()
  })

  it('affiche le message tactile sur un pointeur grossier (`pointer: coarse`)', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    render(<CoachMark />)
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS)
    })
    expect(screen.getByText('Glisse ton pouce pour marcher')).toBeInTheDocument()
  })

  it('affiche le message clavier sans pointeur grossier (jsdom par défaut)', () => {
    render(<CoachMark />)
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS)
    })
    expect(screen.getByText('Flèches ou ZQSD pour marcher')).toBeInTheDocument()
  })

  it('disparaît au premier déplacement du joueur', () => {
    render(<CoachMark />)
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS)
    })
    expect(screen.getByTestId('coach-mark')).toBeInTheDocument()

    player.moving = true
    act(() => {
      vi.advanceTimersByTime(200) // une passe du sondage (quelques fois par seconde)
    })
    expect(screen.queryByTestId('coach-mark')).not.toBeInTheDocument()
  })

  it('ne disparaît pas tant que le joueur ne bouge pas', () => {
    render(<CoachMark />)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByTestId('coach-mark')).toBeInTheDocument()
  })

  it('disparaît après 10 secondes sans déplacement', () => {
    render(<CoachMark />)
    // En deux passes distinctes (pas une seule grosse avance) : le minuteur de 10 s n'est posé
    // qu'une fois `settled` devenu vrai (état posé par ce même minuteur de stabilisation) — il faut
    // laisser `act()` reposer l'effet correspondant avant d'avancer jusqu'à son échéance à lui.
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS)
    })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.queryByTestId('coach-mark')).not.toBeInTheDocument()
  })

  it('disparaît au premier déplacement même sous StrictMode (double montage des effets)', () => {
    // Régression réelle (trouvée en vérification visuelle app réelle, `main.tsx` a `<StrictMode>`,
    // pas ce test à l'origine) : StrictMode (dev) rejoue chaque effet une fois — montage →
    // nettoyage → remontage, pour détecter les effets impurs. Si l'effet relit `localStorage`
    // lui-même, le deuxième passage voit l'écriture du premier et abandonne aussitôt, avant même
    // de reposer son minuteur de secours : la bulle restait affichée mais plus jamais masquée.
    render(
      <StrictMode>
        <CoachMark />
      </StrictMode>,
    )
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS)
    })
    expect(screen.getByTestId('coach-mark')).toBeInTheDocument()

    player.moving = true
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByTestId('coach-mark')).not.toBeInTheDocument()
  })

  it('ne s’affiche jamais pendant un dialogue', () => {
    useGame.setState({
      dialogue: { id: 'x', speaker: { fr: 'Minerve', en: 'Minerva' }, lines: [{ text: { fr: 'Bonjour', en: 'Hi' } }] },
      dialogueIndex: 0,
    })
    render(<CoachMark />)
    expect(screen.queryByTestId('coach-mark')).not.toBeInTheDocument()
  })

  it('ne s’arme pas pendant le dialogue d’accueil : le compte à rebours de 10 s démarre à sa fermeture, pas au montage', () => {
    // Régression réelle (trouvée en vérification visuelle, pas par ce test à l'origine) : le
    // dialogue d'accueil (7 lignes tapées lettre par lettre) dépasse quasi toujours 10 s. Si le
    // minuteur s'armait dès le montage de `CoachMark` (qui coïncide avec le début de ce dialogue,
    // `App.tsx`), il expirerait pendant que la bulle est encore masquée par le dialogue — elle ne
    // s'afficherait ensuite plus jamais. Le joueur ne peut de toute façon pas bouger tant que le
    // dialogue est ouvert (`isOverlayOpen`), donc rien n'est perdu à attendre sa fermeture.
    useGame.setState({
      dialogue: { id: 'welcome', speaker: { fr: 'Minerve', en: 'Minerva' }, lines: [{ text: { fr: 'Bonjour', en: 'Hi' } }] },
      dialogueIndex: 0,
    })
    render(<CoachMark />)

    // Le dialogue traîne plus de 10 s : le minuteur ne doit pas s'être épuisé pendant ce temps.
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.queryByTestId('coach-mark')).not.toBeInTheDocument() // toujours masqué par le dialogue

    act(() => {
      useGame.setState({ dialogue: null, dialogueIndex: 0 })
    })
    expect(screen.getByTestId('coach-mark')).toBeInTheDocument() // apparaît enfin, à la fermeture

    act(() => {
      vi.advanceTimersByTime(9_000)
    })
    expect(screen.getByTestId('coach-mark')).toBeInTheDocument() // pas encore 10 s depuis la fermeture

    act(() => {
      vi.advanceTimersByTime(1_500)
    })
    expect(screen.queryByTestId('coach-mark')).not.toBeInTheDocument() // 10 s après la fermeture, pas après le montage
  })

  it('ne s’arme pas si le dialogue d’accueil démarre juste après le montage (course avec l’effet de App.tsx)', () => {
    // Régression réelle (trouvée en navigateur réel, Playwright — pas par un test à l'origine,
    // et non couverte par le test précédent où le dialogue est déjà ouvert AVANT le montage) :
    // `Hud`/`CoachMark` (enfant) et l'effet de `App.tsx` (parent) qui démarre le dialogue d'accueil
    // s'exécutent dans le même commit, enfant d'abord. Au tout premier passage de l'effet
    // d'armement, `dialogue` valait donc encore `null` un court instant, AVANT que le dialogue ne
    // démarre l'instant d'après dans le même commit : sans délai de stabilisation (`settled`,
    // `CoachMark.tsx`), le minuteur de 10 s s'armait immédiatement, sur cette fenêtre de `null`
    // fantôme — bien avant que le joueur n'ait vraiment fini le dialogue d'accueil.
    render(<CoachMark />) // dialogue déjà `null` au montage (voir `beforeEach`), comme au tout début d'App.tsx
    act(() => {
      useGame.setState({
        dialogue: { id: 'welcome', speaker: { fr: 'Minerve', en: 'Minerva' }, lines: [{ text: { fr: 'Bonjour', en: 'Hi' } }] },
        dialogueIndex: 0,
      })
    })
    expect(screen.queryByTestId('coach-mark')).not.toBeInTheDocument() // masqué par le dialogue qui vient de démarrer

    // Le dialogue traîne plus de 10 s : rien ne doit avoir pu s'armer sur la fenêtre `null` fantôme.
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.queryByTestId('coach-mark')).not.toBeInTheDocument()

    act(() => {
      useGame.setState({ dialogue: null, dialogueIndex: 0 })
    })
    expect(screen.getByTestId('coach-mark')).toBeInTheDocument() // apparaît bien, à la vraie fermeture
  })
})
