import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ARCHIVE_SESSIONS } from '../data/eveningProgram'
import type { SessionArchive } from '../types'
import { isOverlayOpen, useGame, type GameState } from './gameStore'

function archiveFor(sessionId: string, published = true): SessionArchive {
  return {
    sessionId,
    published,
    archivedAt: '2026-10-07T00:00:00+02:00',
    transcript: { fr: 'Premier passage fictif. Deuxième passage fictif.', en: '' },
    highlights: ['Premier', 'Deuxième'].map((label, index) => ({
      id: `theme-${index + 1}`,
      title: { fr: `${label} thème`, en: `Topic ${index + 1}` },
      body: { fr: 'Résumé fictif.', en: 'Fictional summary.' },
      source: { excerpt: `${label} passage fictif.` },
    })),
  }
}

describe('gameStore — sélection des bulles de la salle', () => {
  let previous: GameState

  beforeEach(() => {
    previous = useGame.getState()
    useGame.setState({
      sessions: ARCHIVE_SESSIONS,
      archives: Object.fromEntries(ARCHIVE_SESSIONS.map((session) => [session.id, archiveFor(session.id)])),
      openSessionId: null,
      openArchiveHighlightId: null,
      openPersonId: null,
      remiChatOpen: false,
      dialogue: null,
      dialogueIndex: 0,
      stampCardOpen: false,
      mapOpen: false,
      visitedSessions: {},
    })
  })

  afterEach(() => useGame.setState(previous, true))

  it('ouvre le bon thème et marque la table parente comme consultée une seule fois', () => {
    const g = useGame.getState()
    g.openArchiveHighlight('table-ronde-2', 'theme-2')
    expect(useGame.getState().openSessionId).toBe('table-ronde-2')
    expect(useGame.getState().openArchiveHighlightId).toBe('theme-2')
    expect(isOverlayOpen(useGame.getState())).toBe(true)
    const visit = useGame.getState().visitedSessions['table-ronde-2']
    expect(visit).toBeTypeOf('number')
    g.openArchiveHighlight('table-ronde-2', 'theme-1')
    expect(useGame.getState().openArchiveHighlightId).toBe('theme-1')
    expect(useGame.getState().visitedSessions['table-ronde-2']).toBe(visit)
    expect(Object.keys(useGame.getState().visitedSessions)).toEqual(['table-ronde-2'])
  })

  it('la fiche entière et sa fermeture effacent la sélection de thème', () => {
    const g = useGame.getState()
    g.openArchiveHighlight('table-ronde-1', 'theme-1')
    g.openSession('table-ronde-3')
    expect(useGame.getState().openSessionId).toBe('table-ronde-3')
    expect(useGame.getState().openArchiveHighlightId).toBeNull()
    g.openArchiveHighlight('table-ronde-3', 'theme-2')
    g.closeSession()
    expect(useGame.getState().openSessionId).toBeNull()
    expect(useGame.getState().openArchiveHighlightId).toBeNull()
    expect(isOverlayOpen(useGame.getState())).toBe(false)
  })

  it('referme les autres surimpressions lorsqu’une bulle est ouverte', () => {
    useGame.setState({ openPersonId: 'fictif', remiChatOpen: true, dialogue: { id: 'fictif', speaker: { fr: 'Test', en: 'Test' }, lines: [] }, dialogueIndex: 4, stampCardOpen: true, mapOpen: true })
    useGame.getState().openArchiveHighlight('table-ronde-1', 'theme-1')
    const s = useGame.getState()
    expect([s.openPersonId, s.remiChatOpen, s.dialogue, s.dialogueIndex, s.stampCardOpen, s.mapOpen]).toEqual([null, false, null, 0, false, false])
  })

  it.each([
    ['id de table inconnu', 'inconnu', 'theme-1'],
    ['id de thème inconnu', 'table-ronde-1', 'inconnu'],
  ])('ignore un %s sans fiche ni progression inventée', (_reason, sessionId, highlightId) => {
    useGame.getState().openArchiveHighlight(sessionId, highlightId)
    expect(useGame.getState().openSessionId).toBeNull()
    expect(useGame.getState().openArchiveHighlightId).toBeNull()
    expect(useGame.getState().visitedSessions).toEqual({})
  })

  it('ne publie pas le thème d’un brouillon ou d’une ancienne archive sans bulles', () => {
    useGame.setState({ archives: { 'table-ronde-1': archiveFor('table-ronde-1', false), 'table-ronde-2': { ...archiveFor('table-ronde-2'), highlights: undefined } } })
    useGame.getState().openArchiveHighlight('table-ronde-1', 'theme-1')
    useGame.getState().openArchiveHighlight('table-ronde-2', 'theme-1')
    expect(useGame.getState().openSessionId).toBeNull()
    expect(useGame.getState().visitedSessions).toEqual({})
  })

  it('ne laisse pas entrer une autre séquence de la soirée même si son état est injecté', () => {
    const rogue = { ...ARCHIVE_SESSIONS[0], id: 'keynote-injectee' }
    useGame.setState({ sessions: [...ARCHIVE_SESSIONS, rogue], archives: { ...useGame.getState().archives, [rogue.id]: archiveFor(rogue.id) } })
    useGame.getState().openArchiveHighlight(rogue.id, 'theme-1')
    expect(useGame.getState().openSessionId).toBeNull()
    expect(useGame.getState().visitedSessions).toEqual({})
  })

  it('le rafraîchissement conserve un thème inchangé et efface un thème retiré', () => {
    const g = useGame.getState()
    g.openArchiveHighlight('table-ronde-1', 'theme-2')
    g.setArchives({ ...useGame.getState().archives })
    expect(useGame.getState().openArchiveHighlightId).toBe('theme-2')
    g.setArchives({ 'table-ronde-1': { ...archiveFor('table-ronde-1'), highlights: [archiveFor('table-ronde-1').highlights![0]] } })
    expect(useGame.getState().openSessionId).toBe('table-ronde-1')
    expect(useGame.getState().openArchiveHighlightId).toBeNull()
  })

  it('un remplacement de la soirée sans le thème choisi efface aussi la sélection', () => {
    const g = useGame.getState()
    g.openArchiveHighlight('table-ronde-1', 'theme-1')
    g.setEvening(ARCHIVE_SESSIONS, {}, 'program')
    expect(useGame.getState().openArchiveHighlightId).toBeNull()
  })

  it('le chat et la remise à zéro effacent le thème choisi', () => {
    const g = useGame.getState()
    g.openArchiveHighlight('table-ronde-3', 'theme-1')
    g.openChat('archiviste')
    expect(useGame.getState().openSessionId).toBeNull()
    expect(useGame.getState().openArchiveHighlightId).toBeNull()
    g.openArchiveHighlight('table-ronde-3', 'theme-2')
    g.resetProgress()
    expect(useGame.getState().openArchiveHighlightId).toBeNull()
    expect(useGame.getState().visitedSessions).toEqual({})
  })
})
