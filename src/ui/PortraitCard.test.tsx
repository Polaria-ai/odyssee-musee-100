import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { generatePlaceholderPeople } from '../data/placeholder'
import type { Person } from '../types'
import { PortraitCard } from './PortraitCard'

// Module audio : stub d'un autre agent, no-op tant que le son est coupé. On vérifie ici seulement
// que PortraitCard l'appelle avec le bon identifiant, pas un comportement sonore réel.
const playSfxMock = vi.fn()
vi.mock('../audio', () => ({
  playSfx: (...args: unknown[]) => playSfxMock(...args),
}))

// Personnes manifestement fictives, fabriquées uniquement pour ce test.
const fictionalPeople: Person[] = [
  {
    id: 'fixture-ada-testeau',
    order: 1,
    name: 'Ada Testeau',
    role: { fr: 'Ingénieure de test', en: 'Test engineer' },
    organization: 'Exemple SA',
    country: 'FR',
    wing: 'infrastructures',
    bio: { fr: 'Une accroche fabriquée pour le test.', en: 'A hook made up for the test.' },
    story: {
      fr: 'Premier paragraphe de test.\n\nDeuxième paragraphe de test.',
      en: 'First test paragraph.\n\nSecond test paragraph.',
    },
    quote: { fr: 'Une citation de test.', en: 'A test quote.' },
    photoUrl: null,
    photoCredit: 'Studio Exemple',
    links: [
      { label: 'Site de test', url: 'https://example.com' },
      { label: 'Lien dangereux', url: 'javascript:alert(1)' },
    ],
    placeholder: false,
  },
  {
    id: 'fixture-bruno-exemple',
    order: 2,
    name: 'Bruno Exemple',
    role: { fr: 'Testeur', en: 'Tester' },
    organization: 'Exemple SA',
    country: 'EU',
    wing: 'infrastructures',
    bio: { fr: 'Deuxième fiche de test.', en: 'Second test card.' },
    story: { fr: '', en: '' },
    photoUrl: null,
    placeholder: false,
  },
]

describe('PortraitCard', () => {
  beforeEach(() => {
    playSfxMock.mockClear()
    useGame.setState({ lang: 'fr', layout: null, openPersonId: null })
  })

  it('ne rend rien sans fiche ouverte', () => {
    useGame.setState({ people: fictionalPeople, openPersonId: null })
    render(<PortraitCard />)
    expect(screen.queryByTestId('portrait-card')).not.toBeInTheDocument()
  })

  it('rend une fiche d’attente pour une personne placeholder', () => {
    const people = generatePlaceholderPeople(3)
    useGame.setState({ people, openPersonId: people[0].id })
    render(<PortraitCard />)

    expect(screen.getByTestId('portrait-card')).toBeInTheDocument()
    expect(screen.getByText("Fiche d'attente")).toBeInTheDocument()
  })

  it('affiche « À dévoiler le 6 octobre » pour une fiche d’attente sans organisation', () => {
    const people = generatePlaceholderPeople(1).map((person) => ({ ...person, organization: '' }))
    useGame.setState({ people, openPersonId: people[0].id })
    render(<PortraitCard />)

    expect(screen.getByText(/À dévoiler le 6 octobre/)).toBeInTheDocument()
  })

  it('affiche l’organisation telle quelle quand elle est renseignée, même pour une fiche d’attente', () => {
    const people = generatePlaceholderPeople(1).map((person) => ({ ...person, organization: 'Exemple' }))
    useGame.setState({ people, openPersonId: people[0].id })
    render(<PortraitCard />)

    expect(screen.getByText(/Exemple/)).toBeInTheDocument()
    expect(screen.queryByText(/À dévoiler/)).not.toBeInTheDocument()
  })

  it('joue un son à l’ouverture et à la fermeture, pas à la navigation', () => {
    useGame.setState({ people: fictionalPeople, openPersonId: fictionalPeople[0].id })
    render(<PortraitCard />)
    expect(playSfxMock).toHaveBeenCalledWith('open')
    playSfxMock.mockClear()

    fireEvent.click(screen.getByTestId('portrait-next'))
    expect(playSfxMock).not.toHaveBeenCalledWith('open')
    expect(playSfxMock).not.toHaveBeenCalledWith('close')
    playSfxMock.mockClear()

    fireEvent.click(screen.getByTestId('portrait-close'))
    expect(playSfxMock).toHaveBeenCalledWith('close')
  })

  it('rend une fiche complète fabriquée pour le test', () => {
    useGame.setState({ people: fictionalPeople, openPersonId: fictionalPeople[0].id })
    render(<PortraitCard />)

    expect(screen.getByRole('heading', { name: 'Ada Testeau' })).toBeInTheDocument()
    expect(screen.getByText(/Ingénieure de test · Exemple SA/)).toBeInTheDocument()
    expect(screen.getByText('Une accroche fabriquée pour le test.')).toBeInTheDocument()
    expect(screen.getByText('Premier paragraphe de test.')).toBeInTheDocument()
    expect(screen.getByText('Deuxième paragraphe de test.')).toBeInTheDocument()
    expect(screen.getByText('“Une citation de test.”')).toBeInTheDocument()
    expect(screen.getByText('Photo : Studio Exemple')).toBeInTheDocument()

    // Seul le lien http/https doit apparaître.
    expect(screen.getByRole('link', { name: 'Site de test' })).toHaveAttribute('href', 'https://example.com/')
    expect(screen.queryByRole('link', { name: 'Lien dangereux' })).not.toBeInTheDocument()
  })

  it('navigue précédent/suivant dans la même aile et marque la fiche visitée', () => {
    useGame.setState({ people: fictionalPeople, openPersonId: fictionalPeople[0].id, visited: {} })
    render(<PortraitCard />)

    expect(screen.getByTestId('portrait-prev')).toBeDisabled()
    fireEvent.click(screen.getByTestId('portrait-next'))
    expect(useGame.getState().openPersonId).toBe('fixture-bruno-exemple')
    expect(useGame.getState().visited['fixture-bruno-exemple']).toBeTypeOf('number')

    fireEvent.click(screen.getByTestId('portrait-prev'))
    expect(useGame.getState().openPersonId).toBe('fixture-ada-testeau')
  })

  it('Échap ferme la fiche', () => {
    useGame.setState({ people: fictionalPeople, openPersonId: fictionalPeople[0].id })
    render(<PortraitCard />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useGame.getState().openPersonId).toBeNull()
  })

  it('donne le focus au titre sans faire défiler la feuille (préserve le cadre photo en paysage bas)', () => {
    const focusSpy = vi.spyOn(HTMLHeadingElement.prototype, 'focus')
    useGame.setState({ people: fictionalPeople, openPersonId: fictionalPeople[0].id })
    render(<PortraitCard />)

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
    focusSpy.mockRestore()
  })
})
