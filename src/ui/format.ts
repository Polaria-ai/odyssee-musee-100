/**
 * Petits utilitaires de formatage pour l'interface. Fonctions pures, testées.
 * Propriétaire : agent interface.
 */

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
