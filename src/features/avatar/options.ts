// STUB — propriétaire : agent avatar+tampons. Signature contractuelle à conserver.
import type { AccessoryId, AvatarConfig, OutfitId } from '../../types'

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
