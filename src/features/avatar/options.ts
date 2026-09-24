// Propriétaire : agent avatar+tampons. Les exports ci-dessous sont contractuels (utilisés par gameStore).
import type { AccessoryId, AvatarConfig, Lang, OutfitId } from '../../types'
import { format, pick } from '../../i18n'
import { strings } from './strings'

export const SKIN_TONES = ['#fde0c5', '#f5c9a3', '#e0ac7e', '#b98059', '#8d5a3b', '#5e3b26'] as const
export const HAIR_COLORS = ['#3b2a1e', '#6b4a2f', '#c98b4b', '#e8c872', '#b0413e', '#7a8a9e'] as const
export const OUTFIT_COLORS = ['#e76f6f', '#f2a65a', '#e8c872', '#7bc47f', '#4fb3a9', '#6aa6e8', '#b48cd9', '#f4f1ea'] as const
export const OUTFITS: readonly OutfitId[] = ['tee', 'hoodie', 'dress', 'suit', 'overalls']
export const ACCESSORIES: readonly AccessoryId[] = ['none', 'glasses', 'beret', 'headphones', 'flower', 'cap']

export const DEFAULT_AVATAR: AvatarConfig = {
  name: '',
  skinTone: SKIN_TONES[1],
  hairColor: HAIR_COLORS[1],
  outfit: 'tee',
  outfitColor: OUTFIT_COLORS[4],
  accessory: 'none',
}

/** Nettoie un pseudo : ≤ 16 caractères, pas de balises ni de caractères de contrôle. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  // eslint-disable-next-line no-control-regex -- on retire justement les caractères de contrôle
  return raw.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16)
}

/** Valide une configuration venant du stockage ou du réseau. `null` si inutilisable. */
export function sanitizeAvatar(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
  if (!isHex(r.skinTone) || !isHex(r.hairColor) || !isHex(r.outfitColor)) return null
  if (!OUTFITS.includes(r.outfit as OutfitId) || !ACCESSORIES.includes(r.accessory as AccessoryId)) return null
  return {
    name: sanitizeName(r.name),
    skinTone: r.skinTone,
    hairColor: r.hairColor,
    outfit: r.outfit as OutfitId,
    outfitColor: r.outfitColor,
    accessory: r.accessory as AccessoryId,
  }
}

/** Tire une apparence au hasard (pastilles) ; le pseudo n'est pas concerné. */
export function randomAppearance(): Pick<AvatarConfig, 'skinTone' | 'hairColor' | 'outfit' | 'outfitColor' | 'accessory'> {
  const pickOne = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
  return {
    skinTone: pickOne(SKIN_TONES),
    hairColor: pickOne(HAIR_COLORS),
    outfit: pickOne(OUTFITS),
    outfitColor: pickOne(OUTFIT_COLORS),
    accessory: pickOne(ACCESSORIES),
  }
}

/**
 * Numéro déterministe (0-999) dérivé du `visitorId` : sert de pseudo par défaut,
 * stable pour un même visiteur (même après rechargement).
 */
export function defaultVisitorNumber(visitorId: string): number {
  let hash = 0
  for (let i = 0; i < visitorId.length; i++) {
    hash = (hash * 31 + visitorId.charCodeAt(i)) >>> 0
  }
  return hash % 1000
}

/** Pseudo par défaut bilingue, ex. « Visiteur 042 » / « Visitor 042 ». */
export function defaultVisitorName(visitorId: string, lang: Lang): string {
  const n = String(defaultVisitorNumber(visitorId)).padStart(3, '0')
  return format(pick(strings.defaultVisitor, lang), { n })
}

/**
 * Liste courte de jetons injuriés FR/EN (normalisés : minuscules, sans accents, sans leet).
 * Volontairement non exhaustive — filtre de premier niveau pour un kiosque public, pas une modération complète.
 */
const BLOCKED_NAME_TOKENS = [
  // FR
  'merde', 'putain', 'connard', 'connasse', 'encule', 'batard', 'salope', 'pute', 'bite', 'couille', 'negre', 'enfoire',
  // EN
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'dick', 'whore', 'nigger', 'faggot', 'retard',
  // commun
  'nazi', 'hitler',
] as const

const LEET_MAP: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' }

/** Minuscules, accents retirés, leet basique traduit en lettres, reste non alphanumérique retiré. */
function normalizeForFilter(raw: string): string {
  const withoutAccents = raw.normalize('NFD').replace(/[̀-ͯ]/g, '')
  let out = ''
  for (const ch of withoutAccents.toLowerCase()) {
    out += LEET_MAP[ch] ?? ch
  }
  return out.replace(/[^a-z0-9]/g, '')
}

/** Détecte un pseudo injurieux (après normalisation). */
export function isProfaneName(raw: string): boolean {
  const normalized = normalizeForFilter(raw)
  if (!normalized) return false
  return BLOCKED_NAME_TOKENS.some((token) => normalized.includes(token))
}

/**
 * Pseudo final à afficher : nettoyé, puis remplacé par le pseudo par défaut
 * s'il est vide ou injurieux. Ne renvoie jamais une chaîne vide.
 */
export function resolveDisplayName(raw: unknown, visitorId: string, lang: Lang): string {
  const cleaned = sanitizeName(raw)
  if (!cleaned || isProfaneName(cleaned)) return defaultVisitorName(visitorId, lang)
  return cleaned
}
