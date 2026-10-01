/** Habillage CSS du buste (halo derrière la tête) : fonctions pures, testables sans navigateur. */

/** `#rrggbb` + opacité → `rgba(r, g, b, a)`. */
export function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Halo doux centré sur la tête (`headCenterFraction` : 0 = haut du conteneur, 1 = bas). */
export function haloBackground(headCenterFraction: number, hex: string, alpha = 0.3): string {
  const y = (Math.min(Math.max(headCenterFraction, 0), 1) * 100).toFixed(1)
  return `radial-gradient(ellipse 62% 40% at 50% ${y}%, ${rgba(hex, alpha)}, transparent 72%)`
}
