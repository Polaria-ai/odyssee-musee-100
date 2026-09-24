/**
 * État « froid » du jeu (écrans, langue, fiches ouvertes, tampons…).
 * Tout ce qui change moins d'une fois par seconde vit ici. Le reste : `runtime.ts`.
 * Propriétaire : intégration.
 */
import { create } from 'zustand'
import type {
  AvatarConfig,
  DataSource,
  Dialogue,
  ExhibitWingId,
  Lang,
  Localized,
  MuseumLayout,
  Person,
  Screen,
} from '../types'
import { DEFAULT_AVATAR, sanitizeAvatar } from '../features/avatar/options'
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
  avatar: AvatarConfig
  visitorId: string

  people: Person[]
  layout: MuseumLayout | null
  dataSource: DataSource

  /** Portrait le plus proche à portée d'interaction (bouton « Regarder »). */
  nearbyPersonId: string | null
  /** Fiche ouverte en plein écran. */
  openPersonId: string | null
  /** Personnes déjà consultées : id → horodatage ms. */
  visited: Record<string, number>
  /** Tampons obtenus : aile → horodatage ms. */
  stamps: Partial<Record<ExhibitWingId, number>>
  stampCardOpen: boolean

  dialogue: Dialogue | null
  dialogueIndex: number

  toast: Toast | null
  /** Nombre d'autres visiteurs connectés (présence temps réel). */
  peersCount: number
  quality: Quality

  setScreen: (screen: Screen) => void
  setLang: (lang: Lang) => void
  setAvatar: (avatar: AvatarConfig) => void
  setMuseum: (people: Person[], layout: MuseumLayout, source: DataSource) => void
  setNearby: (personId: string | null) => void
  openPerson: (personId: string) => void
  closePerson: () => void
  markVisited: (personId: string) => void
  awardStamp: (wing: ExhibitWingId) => void
  setStampCardOpen: (open: boolean) => void
  startDialogue: (dialogue: Dialogue) => void
  advanceDialogue: () => void
  closeDialogue: () => void
  showToast: (text: Localized, duration?: number) => void
  clearToast: () => void
  setPeersCount: (count: number) => void
  setQuality: (quality: Quality) => void
  /** Remet la progression à zéro (tampons, visites). Garde avatar et langue. */
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
  avatar: sanitizeAvatar(persisted.avatar) ?? DEFAULT_AVATAR,
  visitorId,

  people: [],
  layout: null,
  dataSource: 'placeholder',

  nearbyPersonId: null,
  openPersonId: null,
  visited: (persisted.visited as Record<string, number>) ?? {},
  stamps: (persisted.stamps as Partial<Record<ExhibitWingId, number>>) ?? {},
  stampCardOpen: false,

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
  setAvatar: (avatar) => {
    savePersisted({ avatar })
    set({ avatar })
  },
  setMuseum: (people, layout, dataSource) => set({ people, layout, dataSource }),
  setNearby: (nearbyPersonId) => {
    if (get().nearbyPersonId !== nearbyPersonId) set({ nearbyPersonId })
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
  setStampCardOpen: (stampCardOpen) => set({ stampCardOpen }),
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
    savePersisted({ visited: {}, stamps: {} })
    set({ visited: {}, stamps: {}, openPersonId: null, stampCardOpen: false })
  },
}))

/** Vrai quand une interface recouvre le jeu : le joueur ne doit pas bouger. */
export function isOverlayOpen(s: Pick<GameState, 'openPersonId' | 'dialogue' | 'stampCardOpen'>): boolean {
  return s.openPersonId !== null || s.dialogue !== null || s.stampCardOpen
}
