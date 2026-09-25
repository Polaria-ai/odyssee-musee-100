import { beforeEach, describe, expect, it } from 'vitest'
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

  it('interact : portrait proche prioritaire, sinon Minerve', () => {
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

  it('interact : portrait > archive > Archiviste > Minerve', () => {
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
