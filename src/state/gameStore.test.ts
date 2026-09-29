import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isOverlayOpen, useGame } from './gameStore'
import { generatePlaceholderPeople } from '../data/placeholder'
import { buildMuseumLayout } from '../world/layout'
import { ARCHIVIST_NAME } from '../archives/archivistScript'

describe('gameStore', () => {
  beforeEach(() => {
    const people = generatePlaceholderPeople(12)
    useGame.setState({ visited: {}, stamps: {}, openPersonId: null, dialogue: null, stampCardOpen: false, nearbyPersonId: null, nearCurator: false })
    useGame.getState().setMuseum(people, buildMuseumLayout(people), 'placeholder')
  })

  it('ouvrir une fiche la marque comme vue', () => {
    const id = useGame.getState().people[0].id
    useGame.getState().openPerson(id)
    expect(useGame.getState().openPersonId).toBe(id)
    expect(useGame.getState().visited[id]).toBeTypeOf('number')
  })

  it('interact : portrait proche prioritaire, sinon Rémi', () => {
    const id = useGame.getState().people[1].id
    useGame.setState({ nearbyPersonId: id, nearCurator: true })
    useGame.getState().interact()
    expect(useGame.getState().openPersonId).toBe(id)
    useGame.getState().closePerson()
    useGame.setState({ nearbyPersonId: null })
    useGame.getState().interact()
    expect(useGame.getState().dialogue).not.toBeNull()
  })

  it('interact ne fait rien quand une surimpression est ouverte', () => {
    useGame.setState({ stampCardOpen: true, nearbyPersonId: useGame.getState().people[2].id })
    useGame.getState().interact()
    expect(useGame.getState().openPersonId).toBeNull()
    expect(isOverlayOpen(useGame.getState())).toBe(true)
  })

  it('un tampon ne s’attribue qu’une fois', () => {
    useGame.getState().awardStamp('culture')
    const first = useGame.getState().stamps.culture
    useGame.getState().awardStamp('culture')
    expect(useGame.getState().stamps.culture).toBe(first)
  })

  it('le dialogue avance puis se ferme', () => {
    useGame.getState().startDialogue({ id: 'x', speaker: { fr: 'M', en: 'M' }, lines: [{ text: { fr: 'a', en: 'a' } }, { text: { fr: 'b', en: 'b' } }] })
    useGame.getState().advanceDialogue()
    expect(useGame.getState().dialogueIndex).toBe(1)
    useGame.getState().advanceDialogue()
    expect(useGame.getState().dialogue).toBeNull()
  })
})

describe('gameStore — Archives de 2040', () => {
  beforeEach(() => {
    useGame.setState({ nearbyPersonId: null, nearbySessionId: null, nearArchivist: false, nearCurator: false, openPersonId: null, openSessionId: null, dialogue: null, stampCardOpen: false, mapOpen: false, visitedSessions: {} })
  })

  it('interact : portrait > archive > Archiviste > Rémi', () => {
    useGame.setState({ nearbySessionId: 'table-ronde-1', nearArchivist: true, nearCurator: true })
    useGame.getState().interact()
    expect(useGame.getState().openSessionId).toBe('table-ronde-1')
    expect(useGame.getState().visitedSessions['table-ronde-1']).toBeTypeOf('number')
    useGame.getState().closeSession()
    useGame.setState({ nearbySessionId: null })
    useGame.getState().interact()
    expect(useGame.getState().dialogue?.speaker).toEqual(ARCHIVIST_NAME)
  })

  it('une fiche d’archive ouverte compte comme surimpression', () => {
    useGame.getState().openSession('keynote-ouverture')
    expect(isOverlayOpen(useGame.getState())).toBe(true)
  })
})

describe('gameStore — surimpressions', () => {
  it('ouvrir le carnet ou le plan referme le dialogue en cours', () => {
    const d = { id: 'x', speaker: { fr: 'M', en: 'M' }, lines: [{ text: { fr: 'a', en: 'a' } }] }
    useGame.setState({ stampCardOpen: false, mapOpen: false })
    useGame.getState().startDialogue(d)
    useGame.getState().setStampCardOpen(true)
    expect(useGame.getState().dialogue).toBeNull()
    useGame.getState().setStampCardOpen(false)
    useGame.getState().startDialogue(d)
    useGame.getState().setMapOpen(true)
    expect(useGame.getState().dialogue).toBeNull()
    useGame.getState().setMapOpen(false)
  })
})

describe('gameStore — plus de personnalisation (tout le monde joue Cyril)', () => {
  const KEY = 'odyssee-musee-100:v1'

  beforeEach(() => localStorage.clear())
  afterEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('ne garde plus aucun avatar : tout le monde joue Cyril', () => {
    const state = useGame.getState() as unknown as Record<string, unknown>
    expect(state.setAvatar).toBeUndefined()
    expect(state.avatar).toBeUndefined()
  })

  it('ignore un avatar enregistré par une version précédente, et le retire du stockage', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        lang: 'fr',
        visitorId: 'v-legacy',
        avatar: { name: 'Ada', skinTone: '#f5c9a3', hairColor: '#3b2a1e', outfit: 'suit', outfitColor: '#7bc47f', accessory: 'cap' },
      }),
    )
    vi.resetModules()
    const { useGame: freshStore } = await import('./gameStore')

    expect((freshStore.getState() as unknown as Record<string, unknown>).avatar).toBeUndefined()
    expect(freshStore.getState().visitorId).toBe('v-legacy') // le reste de l'état enregistré est conservé
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).not.toHaveProperty('avatar')
  })
})
