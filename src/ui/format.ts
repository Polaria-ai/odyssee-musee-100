/**
 * Petits utilitaires de formatage pour l'interface. Fonctions pures, testées.
 * Propriétaire : agent interface.
 */
import type { ExhibitWingId, Localized, Person, RoomLayout } from '../types'

/**
 * Emoji drapeau à partir d'un code pays ISO 3166-1 alpha-2 (ou `EU`).
 * Fonctionne par composition d'indicateurs régionaux Unicode : aucune table
 * de correspondance à maintenir. Code invalide → chaîne vide.
 */
export function flagEmoji(code: string | null | undefined): string {
  if (!code) return ''
  const cc = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  const REGIONAL_INDICATOR_A = 0x1f1e6
  const codePoints = [...cc].map((letter) => REGIONAL_INDICATOR_A + (letter.charCodeAt(0) - 65))
  return String.fromCodePoint(...codePoints)
}

/**
 * Découpe une histoire en paragraphes (séparés par une ligne vide).
 * Renvoie du texte brut : jamais de HTML, jamais injecté avec `dangerouslySetInnerHTML`.
 */
export function splitParagraphs(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

/**
 * Valide une URL de lien avant affichage : seuls `http:`/`https:` sont acceptés.
 * Rejette `javascript:`, `data:`, `vbscript:`, les chaînes vides ou mal formées.
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Libellé d'organisation affiché (fiche, cartel…) : le module données vide `organization` pour
 * les fiches d'attente (`placeholder: true`) — la vraie liste n'est pas encore reçue. On affiche
 * alors un texte localisé plutôt qu'un champ vide. Une personne réelle a toujours une organisation.
 */
export function organizationLabel(person: Pick<Person, 'organization' | 'placeholder'>, pendingText: string): string {
  const org = person.organization?.trim()
  if (org) return person.organization
  return person.placeholder ? pendingText : person.organization
}

export interface WingProgress {
  seen: number
  total: number
}

/** Portraits déjà consultés par aile, pour le plan du musée. */
export function countVisitedByWing(
  people: readonly Pick<Person, 'id' | 'wing'>[],
  visited: Readonly<Record<string, number>>,
): Partial<Record<ExhibitWingId, WingProgress>> {
  const result: Partial<Record<ExhibitWingId, WingProgress>> = {}
  for (const person of people) {
    const stat = result[person.wing] ?? { seen: 0, total: 0 }
    stat.total += 1
    if (visited[person.id]) stat.seen += 1
    result[person.wing] = stat
  }
  return result
}

export interface DoorMarker {
  x: number
  z: number
  /** Axe le long duquel la porte s'étend (perpendiculaire au mur percé). */
  axis: 'x' | 'z'
}

const DOOR_EPSILON = 0.05

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Point approximatif (centre du mur partagé) de chaque porte entre le hall et une aile, à partir
 * des seules salles du plan (`layout.rooms`) : fonctionne quelle que soit la répartition des 100
 * (y compris une aile vide, absente de `rooms`). Plan simplifié pour le mini-plan (`MuseumMap`),
 * pas le tracé exact des murs (propriété du module monde, `src/world/layout.ts`).
 */
export function doorMarkers(rooms: readonly RoomLayout[]): DoorMarker[] {
  const hall = rooms.find((r) => r.id === 'hall')
  if (!hall) return []
  const h = hall.bounds
  const markers: DoorMarker[] = []
  for (const room of rooms) {
    if (room.id === 'hall') continue
    const b = room.bounds
    if (Math.abs(b.minX - h.maxX) < DOOR_EPSILON || Math.abs(b.maxX - h.minX) < DOOR_EPSILON) {
      const x = Math.abs(b.minX - h.maxX) < DOOR_EPSILON ? h.maxX : h.minX
      markers.push({ x, z: clamp(0, Math.max(b.minZ, h.minZ), Math.min(b.maxZ, h.maxZ)), axis: 'z' })
    } else if (Math.abs(b.maxZ - h.minZ) < DOOR_EPSILON || Math.abs(b.minZ - h.maxZ) < DOOR_EPSILON) {
      const z = Math.abs(b.maxZ - h.minZ) < DOOR_EPSILON ? h.minZ : h.maxZ
      markers.push({ x: clamp(0, Math.max(b.minX, h.minX), Math.min(b.maxX, h.maxX)), z, axis: 'x' })
    }
  }
  return markers
}

/** Ratio de contraste WCAG entre deux couleurs `#rrggbb`. Vérification (tests), pas de rendu. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA)
  const lumB = relativeLuminance(hexB)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

/**
 * Hauteur de bip déterministe pour une voix (`DialogueBox`) : Minerve a une hauteur fixe,
 * les autres orateurs (aucun aujourd'hui, le contrat `Dialogue` le permet) une légère variation
 * stable dérivée de leur nom — jamais `Math.random()`.
 */
export function pitchForSpeaker(speaker: Localized): number {
  const name = (speaker.fr || speaker.en || '').trim().toLowerCase()
  if (name === 'minerve' || name === 'minerva') return 1.25
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 1000
  return 0.95 + (hash / 999) * 0.1
}
