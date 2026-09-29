/**
 * État « froid » du jeu (écrans, langue, fiches ouvertes, tampons…).
 * Tout ce qui change moins d'une fois par seconde vit ici. Le reste : `runtime.ts`.
 * Propriétaire : intégration.
 */
import { create } from 'zustand'
import type {
  ArchivesLayout,
  DataSource,
  EveningSession,
  EveningSource,
  SessionArchive,
  Dialogue,
  ExhibitWingId,
  Lang,
  Localized,
  MuseumLayout,
  Person,
  Screen,
  WingId,
} from '../types'
import { remiDialogue } from '../npc/remiScript'
import { archivistDialogue } from '../archives/archivistScript'
import { loadPersisted, savePersisted } from './persist'

export type Quality = 'low' | 'high'

export interface Toast {
  id: number
  text: Localized
  /** Durée d'affichage en ms. */
  duration: number
}

export interface GameState {
  screen: Screen
  lang: Lang
  visitorId: string

  people: Person[]
  layout: MuseumLayout | null
  dataSource: DataSource

  /** Portrait le plus proche à portée d'interaction (bouton « Regarder »). */
  nearbyPersonId: string | null
  /** Le joueur est à portée du comptoir de Rémi (bouton « Parler »). */
  nearCurator: boolean
  /** Salle où se trouve le joueur (pastille du HUD). */
  currentRoom: WingId | null
  /** Fiche ouverte en plein écran. */
  openPersonId: string | null

  /** Programme de la soirée et archives déposées (Les Archives de 2040). */
  sessions: EveningSession[]
  /** Archives publiées, par identifiant de séquence. */
  archives: Record<string, SessionArchive>
  eveningSource: EveningSource
  /** Plan de la salle des Archives (déjà fusionné dans `layout`, gardé pour le rendu). */
  archivesLayout: ArchivesLayout | null
  /** Vitrine d'archive la plus proche (bouton « Consulter »). */
  nearbySessionId: string | null
  /** Fiche d'archive ouverte. */
  openSessionId: string | null
  /** Le joueur est à portée de l'hologramme de l'Archiviste. */
  nearArchivist: boolean
  /** Archives consultées : id de séquence → horodatage ms. */
  visitedSessions: Record<string, number>
  /** Le visiteur est déjà entré dans les Archives (accueil de l'Archiviste une seule fois). */
  archivesDiscovered: boolean
  /** Personnes déjà consultées : id → horodatage ms. */
  visited: Record<string, number>
  /** Tampons obtenus : aile → horodatage ms. */
  stamps: Partial<Record<ExhibitWingId, number>>
  stampCardOpen: boolean
  /** Plan du musée (bouton « Plan » du HUD) : surimpression comme les autres, coupe le déplacement. */
  mapOpen: boolean

  dialogue: Dialogue | null
  dialogueIndex: number

  toast: Toast | null
  /** Nombre d'autres visiteurs connectés (présence temps réel). */
  peersCount: number
  quality: Quality

  setScreen: (screen: Screen) => void
  setLang: (lang: Lang) => void
  setMuseum: (people: Person[], layout: MuseumLayout, source: DataSource) => void
  setEvening: (sessions: EveningSession[], archives: Record<string, SessionArchive>, source: EveningSource) => void
  /** Remplace les archives publiées (rafraîchissement pendant la visite, voir `useArchivesRefresh`). */
  setArchives: (archives: Record<string, SessionArchive>) => void
  setArchivesLayout: (archivesLayout: ArchivesLayout | null) => void
  setNearbySession: (sessionId: string | null) => void
  setNearArchivist: (near: boolean) => void
  openSession: (sessionId: string) => void
  closeSession: () => void
  /** Marque la première arrivée dans les Archives ; renvoie true si c'était la première. */
  markArchivesDiscovered: () => boolean
  setNearby: (personId: string | null) => void
  setNearCurator: (near: boolean) => void
  setCurrentRoom: (room: WingId | null) => void
  /** Action principale (bouton rond, Entrée) : regarder le portrait proche, sinon parler à Rémi. */
  interact: () => void
  openPerson: (personId: string) => void
  closePerson: () => void
  markVisited: (personId: string) => void
  awardStamp: (wing: ExhibitWingId) => void
  setStampCardOpen: (open: boolean) => void
  setMapOpen: (open: boolean) => void
  startDialogue: (dialogue: Dialogue) => void
  advanceDialogue: () => void
  closeDialogue: () => void
  showToast: (text: Localized, duration?: number) => void
  clearToast: () => void
  setPeersCount: (count: number) => void
  setQuality: (quality: Quality) => void
  /** Remet la progression à zéro (tampons, visites). Garde la langue. */
  resetProgress: () => void
}

function newVisitorId(): string {
  try {
    return globalThis.crypto.randomUUID()
  } catch {
    return `v-${Math.floor(Math.random() * 1e12).toString(36)}`
  }
}

function initialLang(persisted?: Lang): Lang {
  if (persisted === 'fr' || persisted === 'en') return persisted
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'fr'
  return nav && !nav.toLowerCase().startsWith('fr') ? 'en' : 'fr'
}

const persisted = loadPersisted()
const visitorId = typeof persisted.visitorId === 'string' ? persisted.visitorId : newVisitorId()
if (!persisted.visitorId) savePersisted({ visitorId })

let toastSeq = 0

export const useGame = create<GameState>()((set, get) => ({
  screen: 'loading',
  lang: initialLang(persisted.lang),
  // Un avatar enregistré par une version précédente est ignoré et purgé du stockage (voir `loadPersisted`).
  visitorId,

  people: [],
  layout: null,
  dataSource: 'placeholder',

  nearbyPersonId: null,
  nearCurator: false,
  sessions: [],
  archives: {},
  eveningSource: 'program',
  archivesLayout: null,
  nearbySessionId: null,
  openSessionId: null,
  nearArchivist: false,
  visitedSessions: (persisted.visitedSessions as Record<string, number>) ?? {},
  archivesDiscovered: persisted.archivesDiscovered === true,
  currentRoom: null,
  openPersonId: null,
  visited: (persisted.visited as Record<string, number>) ?? {},
  stamps: (persisted.stamps as Partial<Record<ExhibitWingId, number>>) ?? {},
  stampCardOpen: false,
  mapOpen: false,

  dialogue: null,
  dialogueIndex: 0,

  toast: null,
  peersCount: 0,
  quality: 'high',

  setScreen: (screen) => set({ screen }),
  setLang: (lang) => {
    savePersisted({ lang })
    set({ lang })
  },
  setMuseum: (people, layout, dataSource) => set({ people, layout, dataSource }),
  setEvening: (sessions, archives, eveningSource) => set({ sessions, archives, eveningSource }),
  setArchives: (archives) => set({ archives }),
  setArchivesLayout: (archivesLayout) => set({ archivesLayout }),
  setNearbySession: (nearbySessionId) => {
    if (get().nearbySessionId !== nearbySessionId) set({ nearbySessionId })
  },
  setNearArchivist: (nearArchivist) => {
    if (get().nearArchivist !== nearArchivist) set({ nearArchivist })
  },
  openSession: (openSessionId) => {
    const visited = get().visitedSessions
    if (!visited[openSessionId]) {
      const next = { ...visited, [openSessionId]: Date.now() }
      savePersisted({ visitedSessions: next })
      set({ visitedSessions: next })
    }
    set({ openSessionId })
  },
  closeSession: () => set({ openSessionId: null }),
  markArchivesDiscovered: () => {
    if (get().archivesDiscovered) return false
    savePersisted({ archivesDiscovered: true })
    set({ archivesDiscovered: true })
    return true
  },
  setNearby: (nearbyPersonId) => {
    if (get().nearbyPersonId !== nearbyPersonId) set({ nearbyPersonId })
  },
  setNearCurator: (nearCurator) => {
    if (get().nearCurator !== nearCurator) set({ nearCurator })
  },
  setCurrentRoom: (currentRoom) => {
    if (get().currentRoom !== currentRoom) set({ currentRoom })
  },
  interact: () => {
    const s = get()
    if (isOverlayOpen(s)) return
    if (s.nearbyPersonId) {
      s.openPerson(s.nearbyPersonId)
      return
    }
    if (s.nearbySessionId) {
      s.openSession(s.nearbySessionId)
      return
    }
    if (s.nearArchivist) {
      s.startDialogue(
        archivistDialogue({
          kind: 'talk',
          consulted: Object.keys(s.visitedSessions).length,
          total: s.sessions.length,
          published: Object.keys(s.archives).length,
        }),
      )
      return
    }
    if (s.nearCurator) {
      s.startDialogue(
        remiDialogue({
          kind: 'talk',
          visitedCount: Object.keys(s.visited).length,
          stampsCount: Object.keys(s.stamps).length,
          total: s.people.length,
          archivesToVisit: s.sessions.length > 0 && Object.keys(s.visitedSessions).length === 0,
        }),
      )
    }
  },
  openPerson: (openPersonId) => {
    get().markVisited(openPersonId)
    set({ openPersonId })
  },
  closePerson: () => set({ openPersonId: null }),
  markVisited: (personId) => {
    const visited = get().visited
    if (visited[personId]) return
    const next = { ...visited, [personId]: Date.now() }
    savePersisted({ visited: next })
    set({ visited: next })
  },
  awardStamp: (wing) => {
    const stamps = get().stamps
    if (stamps[wing]) return
    const next = { ...stamps, [wing]: Date.now() }
    savePersisted({ stamps: next })
    set({ stamps: next })
  },
  // Ouvrir le carnet ou le plan referme le dialogue en cours : deux surimpressions ne s'empilent jamais.
  setStampCardOpen: (stampCardOpen) => set(stampCardOpen ? { stampCardOpen, dialogue: null, dialogueIndex: 0 } : { stampCardOpen }),
  setMapOpen: (mapOpen) => set(mapOpen ? { mapOpen, dialogue: null, dialogueIndex: 0 } : { mapOpen }),
  startDialogue: (dialogue) => set({ dialogue, dialogueIndex: 0 }),
  advanceDialogue: () => {
    const { dialogue, dialogueIndex } = get()
    if (!dialogue) return
    if (dialogueIndex + 1 >= dialogue.lines.length) set({ dialogue: null, dialogueIndex: 0 })
    else set({ dialogueIndex: dialogueIndex + 1 })
  },
  closeDialogue: () => set({ dialogue: null, dialogueIndex: 0 }),
  showToast: (text, duration = 2800) => set({ toast: { id: ++toastSeq, text, duration } }),
  clearToast: () => set({ toast: null }),
  setPeersCount: (peersCount) => {
    if (get().peersCount !== peersCount) set({ peersCount })
  },
  setQuality: (quality) => set({ quality }),
  resetProgress: () => {
    savePersisted({ visited: {}, stamps: {}, visitedSessions: {} })
    set({ visited: {}, stamps: {}, visitedSessions: {}, openPersonId: null, openSessionId: null, stampCardOpen: false })
  },
}))

/** Vrai quand une interface recouvre le jeu : le joueur ne doit pas bouger. */
export function isOverlayOpen(
  s: Pick<GameState, 'openPersonId' | 'openSessionId' | 'dialogue' | 'stampCardOpen' | 'mapOpen'>,
): boolean {
  return s.openPersonId !== null || s.openSessionId !== null || s.dialogue !== null || s.stampCardOpen || s.mapOpen
}
