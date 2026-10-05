/** Habillage CSS du buste : fonctions pures, testables sans navigateur. */

/** `#rrggbb` + opacité → `rgba(r, g, b, a)`. */
export function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
