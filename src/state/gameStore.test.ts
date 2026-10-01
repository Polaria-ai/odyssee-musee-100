import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isOverlayOpen, useGame } from './gameStore'
import { generatePlaceholderPeople } from '../data/placeholder'
import { buildMuseumLayout } from '../world/layout'
import { ARCHIVIST_NAME } from '../archives/archivistScript'

describe('gameStore', () => {
  beforeEach(() => {
    const people = generatePlaceholderPeople(12)
    useGame.setState({ visited: {}, stamps: {}, openPersonId: null, dialogue: null, stampCardOpen: false, remiChatOpen: false, nearbyPersonId: null, nearCurator: false })
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
    // « Parler à Rémi » ouvre le chat (V5), plus le dialogue scripté.
    expect(useGame.getState().remiChatOpen).toBe(true)
    expect(useGame.getState().dialogue).toBeNull()
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
    useGame.setState({ nearbyPersonId: null, nearbySessionId: null, nearArchivist: false, nearCurator: false, openPersonId: null, openSessionId: null, dialogue: null, stampCardOpen: false, mapOpen: false, remiChatOpen: false, visitedSessions: {} })
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

describe('gameStore — chat avec Rémi · IA', () => {
  const dialogue = { id: 'x', speaker: { fr: 'M', en: 'M' }, lines: [{ text: { fr: 'a', en: 'a' } }] }

  beforeEach(() => {
    useGame.setState({
      remiChatOpen: false,
      dialogue: null,
      dialogueIndex: 0,
      stampCardOpen: false,
      mapOpen: false,
      openPersonId: null,
      openSessionId: null,
      nearbyPersonId: null,
      nearbySessionId: null,
      nearArchivist: false,
      nearCurator: false,
    })
  })

  it('est fermé au départ, s’ouvre et se ferme', () => {
    expect(useGame.getState().remiChatOpen).toBe(false)
    useGame.getState().openRemiChat()
    expect(useGame.getState().remiChatOpen).toBe(true)
    useGame.getState().closeRemiChat()
    expect(useGame.getState().remiChatOpen).toBe(false)
  })

  it('compte comme une surimpression : le joueur ne bouge plus', () => {
    expect(isOverlayOpen(useGame.getState())).toBe(false)
    useGame.getState().openRemiChat()
    expect(isOverlayOpen(useGame.getState())).toBe(true)
    useGame.getState().closeRemiChat()
    expect(isOverlayOpen(useGame.getState())).toBe(false)
  })

  it('l’ouvrir ferme les autres surimpressions (dialogue, carnet, plan, fiches)', () => {
    useGame.setState({ stampCardOpen: true, mapOpen: true, openPersonId: 'p1', openSessionId: 's1' })
    useGame.getState().startDialogue(dialogue)
    useGame.getState().openRemiChat()
    const s = useGame.getState()
    expect(s.remiChatOpen).toBe(true)
    expect(s.dialogue).toBeNull()
    expect(s.dialogueIndex).toBe(0)
    expect(s.stampCardOpen).toBe(false)
    expect(s.mapOpen).toBe(false)
    expect(s.openPersonId).toBeNull()
    expect(s.openSessionId).toBeNull()
  })

  it('ouvrir une fiche de portrait ou d’archive referme le chat', () => {
    useGame.getState().openRemiChat()
    useGame.getState().openPerson(useGame.getState().people[0].id)
    expect(useGame.getState().remiChatOpen).toBe(false)
    useGame.getState().closePerson()

    useGame.getState().openRemiChat()
    useGame.getState().openSession('keynote-ouverture')
    expect(useGame.getState().remiChatOpen).toBe(false)
    useGame.getState().closeSession()
  })

  it('ouvrir le carnet, le plan ou un dialogue referme le chat', () => {
    useGame.getState().openRemiChat()
    useGame.getState().setStampCardOpen(true)
    expect(useGame.getState().remiChatOpen).toBe(false)
    useGame.getState().setStampCardOpen(false)

    useGame.getState().openRemiChat()
    useGame.getState().setMapOpen(true)
    expect(useGame.getState().remiChatOpen).toBe(false)
    useGame.getState().setMapOpen(false)

    useGame.getState().openRemiChat()
    useGame.getState().startDialogue(dialogue)
    expect(useGame.getState().remiChatOpen).toBe(false)
    expect(useGame.getState().dialogue).toEqual(dialogue)
  })

  it('fermer le carnet ou le plan ne touche pas au chat', () => {
    useGame.getState().openRemiChat()
    useGame.getState().setStampCardOpen(false)
    useGame.getState().setMapOpen(false)
    expect(useGame.getState().remiChatOpen).toBe(true)
  })

  it('interact : « Parler à Rémi » près du comptoir ouvre le chat, pas un dialogue', () => {
    useGame.setState({ nearCurator: true })
    useGame.getState().interact()
    expect(useGame.getState().remiChatOpen).toBe(true)
    expect(useGame.getState().dialogue).toBeNull()
  })

  it('interact ne fait rien tant que le chat est ouvert, même près d’un portrait', () => {
    useGame.getState().openRemiChat()
    useGame.setState({ nearbyPersonId: useGame.getState().people[0].id, nearCurator: true })
    useGame.getState().interact()
    expect(useGame.getState().openPersonId).toBeNull()
    expect(useGame.getState().remiChatOpen).toBe(true)
  })

  it('l’Archiviste garde son dialogue scripté (DialogueBox), le chat ne s’ouvre pas', () => {
    useGame.setState({ nearArchivist: true, nearCurator: true })
    useGame.getState().interact()
    expect(useGame.getState().dialogue?.speaker).toEqual(ARCHIVIST_NAME)
    expect(useGame.getState().remiChatOpen).toBe(false)
  })

  it('remettre la progression à zéro referme le chat', () => {
    useGame.getState().openRemiChat()
    useGame.getState().resetProgress()
    expect(useGame.getState().remiChatOpen).toBe(false)
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
