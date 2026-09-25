/**
 * Contrat partagé du Musée des 100.
 * Ce fichier est la source de vérité des types échangés entre modules.
 * Propriétaire : intégration (ne pas modifier depuis un module — demander).
 */

export type Lang = 'fr' | 'en'

/** Texte bilingue. `en` peut être vide : l'UI retombe alors sur `fr`. */
export interface Localized {
  fr: string
  en: string
}

/**
 * Les trois ailes suivent les trois tables rondes de la soirée, plus le hall d'accueil
 * et les Archives de 2040 (salle de la soirée, reliée au hall par la Porte de 2040).
 */
export type WingId = 'hall' | 'infrastructures' | 'industrialisation' | 'culture' | 'archives'
/** Les trois ailes à portraits (les 100). Les Archives ne sont pas une aile d'exposition des 100. */
export type ExhibitWingId = 'infrastructures' | 'industrialisation' | 'culture'
export const EXHIBIT_WINGS: readonly ExhibitWingId[] = ['infrastructures', 'industrialisation', 'culture'] as const
export const ALL_WINGS: readonly WingId[] = ['hall', 'infrastructures', 'industrialisation', 'culture', 'archives'] as const

export interface PersonLink {
  label: string
  url: string
}

/** Une des 100 personnes exposées. */
export interface Person {
  /** Slug stable, kebab-case, unique (ex. `arthur-mensch`). */
  id: string
  /** Rang d'affichage 1..100 (ordre dans l'aile). */
  order: number
  name: string
  role: Localized
  organization: string
  /** Code pays ISO 3166-1 alpha-2 en majuscules (ex. `FR`). */
  country: string
  wing: ExhibitWingId
  /** Accroche courte (≤ 220 caractères). */
  bio: Localized
  /** Histoire longue, paragraphes séparés par une ligne vide. */
  story: Localized
  quote?: Localized
  /** URL publique de la photo (Supabase Storage ou /portraits/…). `null` = portrait dessiné par défaut. */
  photoUrl: string | null
  photoCredit?: string
  links?: PersonLink[]
  /** `true` = fiche d'attente fictive, en attendant la vraie liste. Jamais un vrai nom. */
  placeholder: boolean
}

export interface Vec2 {
  x: number
  z: number
}

/** Boîte alignée sur les axes, dans le plan du sol (x, z). Unité : mètre. */
export interface AABB {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface RoomLayout {
  id: WingId
  /** Emprise intérieure de la salle (sol marchable, hors épaisseur des murs). */
  bounds: AABB
  label: Localized
  /** Couleurs de la salle (hex `#rrggbb`), dérivées des tokens de `src/styles/tokens.ts`. */
  floorColor: string
  wallColor: string
  accentColor: string
}

/** Emplacement d'un portrait accroché. */
export interface FrameSlot {
  personId: string
  wing: ExhibitWingId
  /** Centre du cadre, y = hauteur du centre. */
  position: [number, number, number]
  /** Rotation autour de Y : le cadre regarde vers +Z local tourné de `rotationY`. */
  rotationY: number
  /** Point au sol où le joueur doit se tenir pour regarder le portrait. */
  viewPoint: Vec2
}

export interface Placement {
  position: Vec2
  rotationY: number
}

export interface StampStationSlot {
  wing: ExhibitWingId
  position: Vec2
}

export interface MuseumLayout {
  rooms: RoomLayout[]
  /** Tous les obstacles (murs, cloisons, comptoir, socles). Le joueur ne les traverse pas. */
  colliders: AABB[]
  frames: FrameSlot[]
  spawn: Placement
  curator: Placement
  stampStations: StampStationSlot[]
  /** Emprise totale, pour la caméra et la mini-carte. */
  bounds: AABB
}

export type OutfitId = 'tee' | 'hoodie' | 'dress' | 'suit' | 'overalls'
export type AccessoryId = 'none' | 'glasses' | 'beret' | 'headphones' | 'flower' | 'cap'

export interface AvatarConfig {
  /** Pseudo affiché aux autres visiteurs (nettoyé, ≤ 16 caractères). */
  name: string
  skinTone: string
  hairColor: string
  outfit: OutfitId
  outfitColor: string
  accessory: AccessoryId
}

/** Un autre visiteur vu via Supabase Realtime. */
export interface PresencePeer {
  id: string
  avatar: AvatarConfig
  x: number
  z: number
  rotY: number
  moving: boolean
  /** Horodatage d'émission (ms, horloge de l'émetteur). */
  t: number
}

export type Screen = 'loading' | 'title' | 'customize' | 'play'

export interface DialogueLine {
  text: Localized
  /** Humeur de la chouette pour l'animation. */
  mood?: 'neutral' | 'happy' | 'surprised' | 'thinking'
}

export interface Dialogue {
  id: string
  speaker: Localized
  lines: DialogueLine[]
}

export type DataSource = 'supabase' | 'static' | 'placeholder'

// ---------------------------------------------------------------------------
// Les Archives de 2040 — la soirée, séquence par séquence
// ---------------------------------------------------------------------------

export type SessionKind =
  | 'ouverture'
  | 'film'
  | 'presentation'
  | 'keynote'
  | 'les100'
  | 'magneto'
  | 'table-ronde'
  | 'face-a-face'
  | 'final'
  | 'cloture'

export interface SessionSpeaker {
  name: string
  organization?: string
  role?: Localized
  moderator?: boolean
}

/** Une séquence du programme de la soirée (connue à l'avance, peut évoluer). */
export interface EveningSession {
  /** Slug stable, kebab-case (ex. `table-ronde-1`). Clé de jointure avec `SessionArchive`. */
  id: string
  order: number
  /** Heure de début, heure de Paris, `HH:MM`. */
  startTime: string
  durationMin: number
  kind: SessionKind
  title: Localized
  /** Thème ou question annoncés. */
  theme?: Localized
  speakers: SessionSpeaker[]
  /** `true` = information du programme provisoire, à confirmer. */
  provisional: boolean
}

export interface ArchiveQuote {
  text: Localized
  /** Nom de l'intervenant·e, tel qu'annoncé au programme. */
  author: string
  /** Vérifiée sur l'enregistrement avant publication. */
  verified: boolean
}

/** Ce que l'agent de fin de soirée dépose pour une séquence. Jamais inventé à l'avance. */
export interface SessionArchive {
  sessionId: string
  summary: Localized
  quotes: ArchiveQuote[]
  /** Horodatage ISO du dépôt. */
  archivedAt: string
  /** Relu et validé par un humain : seules les archives publiées sont affichées. */
  published: boolean
}

export type EveningSource = 'supabase' | 'static' | 'program'

/** Emplacement d'une vitrine d'archive dans la salle. */
export interface ArchiveSlot {
  sessionId: string
  position: [number, number, number]
  rotationY: number
  viewPoint: Vec2
}

/** Plan de la salle des Archives de 2040, fusionné dans `MuseumLayout` par le module archives. */
export interface ArchivesLayout {
  room: RoomLayout
  colliders: AABB[]
  slots: ArchiveSlot[]
  /** Arrivée dans la salle après la Porte de 2040. */
  arrival: Placement
  /** Porte de 2040 dans le hall (aller). */
  hallPortal: Placement
  /** Porte de retour vers le hall, dans la salle. */
  returnPortal: Placement
  /** Hologramme de l'Archiviste. */
  archivist: Placement
}
