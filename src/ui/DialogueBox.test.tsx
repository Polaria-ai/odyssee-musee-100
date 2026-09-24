import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { DialogueBox } from './DialogueBox'

const twoLineDialogue = {
  id: 'd-test',
  speaker: { fr: 'Minerve', en: 'Minerva' },
  lines: [
    { text: { fr: 'Bonjour cher visiteur, bienvenue.', en: 'Hello dear visitor, welcome.' } },
    { text: { fr: 'Suite.', en: 'Next.' } },
  ],
}

describe('DialogueBox', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
  })
})
