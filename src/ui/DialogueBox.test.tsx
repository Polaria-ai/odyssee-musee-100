import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { DialogueBox } from './DialogueBox'

// Module audio : stub d'un autre agent, no-op tant que le son est coupé. On vérifie ici seulement
// que DialogueBox l'appelle avec le bon identifiant/options, pas un comportement sonore réel.
const playSfxMock = vi.fn()
vi.mock('../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
}))

const twoLineDialogue = {
  id: 'd-test',
  speaker: { fr: 'Rémi Godeau', en: 'Rémi Godeau' },
  lines: [
    { text: { fr: 'Bonjour cher visiteur, bienvenue.', en: 'Hello dear visitor, welcome.' } },
    { text: { fr: 'Suite.', en: 'Next.' } },
  ],
}

describe('DialogueBox', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    playSfxMock.mockClear()
    useGame.setState({ lang: 'fr', dialogue: null, dialogueIndex: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ne rend rien sans dialogue actif', () => {
    render(<DialogueBox />)
    expect(screen.queryByTestId('dialogue-box')).not.toBeInTheDocument()
  })

  it('un premier tap termine la ligne en cours d’écriture, le suivant fait avancer', () => {
    useGame.setState({ dialogue: twoLineDialogue, dialogueIndex: 0 })
    render(<DialogueBox />)

    const box = screen.getByTestId('dialogue-box')
    // La ligne vient de démarrer : le texte n'est pas encore complet.
    expect(box.textContent).not.toContain('Bonjour cher visiteur, bienvenue.')

    fireEvent.click(box)
    expect(box.textContent).toContain('Bonjour cher visiteur, bienvenue.')
    expect(useGame.getState().dialogueIndex).toBe(0)

    fireEvent.click(box)
    expect(useGame.getState().dialogueIndex).toBe(1)
  })

  it('avancer sur la dernière ligne ferme le dialogue', () => {
    useGame.setState({ dialogue: twoLineDialogue, dialogueIndex: 1 })
    render(<DialogueBox />)

    const box = screen.getByTestId('dialogue-box')
    fireEvent.click(box) // termine « Suite. »
    fireEvent.click(box) // dernière ligne → ferme
    expect(useGame.getState().dialogue).toBeNull()
  })

  it('le bouton Passer ferme le dialogue immédiatement', () => {
    useGame.setState({ dialogue: twoLineDialogue, dialogueIndex: 0 })
    render(<DialogueBox />)

    fireEvent.click(screen.getByText('Passer'))
    expect(useGame.getState().dialogue).toBeNull()
    expect(playSfxMock).toHaveBeenCalledWith('click')
  })

  it('joue un bip toutes les 2 lettres écrites, jamais sur un espace, hauteur 0.85 pour Rémi Godeau', () => {
    useGame.setState({ dialogue: twoLineDialogue, dialogueIndex: 0 })
    render(<DialogueBox />)

    // « Bonjour cher visiteur, bienvenue. » : 10 premiers caractères = « Bonjour ch »,
    // avec un espace en position 8 (10 lettres non-espace parmi les 10 premières, une paire
    // « 7-8 » tombe sur un espace) → bips attendus aux lettres 2, 4, 6 et 10 (pas 8).
    // Un tic à la fois, chacun dans son propre `act()` : le minuteur relit `shownRef` à chaque
    // tic (voir `DialogueBox.tsx`), qui n'est resynchronisé qu'au rendu suivant — exactement comme
    // dans un vrai navigateur, où chaque tic est une macrotâche séparée entrecoupée d'un rendu.
    const stepMs = 1000 / 40
    for (let i = 0; i < 10; i++) {
      act(() => {
        vi.advanceTimersByTime(stepMs)
      })
    }

    const blipCalls = playSfxMock.mock.calls.filter((call) => call[0] === 'blip')
    expect(blipCalls).toHaveLength(4)
    for (const call of blipCalls) expect(call[1]).toEqual({ pitch: 0.85 })
  })

  it('un tap qui termine la ligne n’est jamais rattrapé/régressé par le tick suivant du minuteur', () => {
    // Régression réelle (trouvée en vérification visuelle, pas par ce test à l'origine) : un
    // minuteur qui réécrit `shown` depuis un compteur local, indépendant du clic, ré-affichait un
    // texte plus court juste après qu'un tap l'ait fait sauter à la fin — le clic n'avait alors
    // plus aucun effet visible dans le navigateur réel (minuteurs réels, pas les faux de ce test).
    useGame.setState({ dialogue: twoLineDialogue, dialogueIndex: 0 })
    render(<DialogueBox />)
    const box = screen.getByTestId('dialogue-box')

    act(() => {
      vi.advanceTimersByTime(50) // quelques lettres tapées, ligne encore incomplète
    })
    fireEvent.click(box) // termine instantanément la ligne
    expect(box.textContent).toContain('Bonjour cher visiteur, bienvenue.')

    act(() => {
      vi.advanceTimersByTime(200) // plusieurs tics de plus du minuteur de frappe
    })
    expect(box.textContent).toContain('Bonjour cher visiteur, bienvenue.') // toujours complet
    expect(useGame.getState().dialogueIndex).toBe(0) // un seul tap : pas encore avancé de ligne
  })

  it('ne joue aucun bip quand `prefers-reduced-motion` est actif (texte affiché d’un coup)', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    useGame.setState({ dialogue: twoLineDialogue, dialogueIndex: 0 })
    render(<DialogueBox />)

    vi.advanceTimersByTime(1000)
    expect(playSfxMock.mock.calls.some((call) => call[0] === 'blip')).toBe(false)
    vi.unstubAllGlobals()
  })
})
