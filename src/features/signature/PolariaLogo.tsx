/** Logo Polaria (WebP à fond transparent) : `<img>` aux dimensions réservées, sans décalage de mise en page. */
import { POLARIA_LOGO, logoWidthFor } from './brand'

export interface PolariaLogoProps {
  /** Hauteur d'affichage en px ; la largeur suit le rapport du logo. */
  height: number
  className?: string
  /** Texte alternatif ; vide = décoratif (le parent porte déjà un nom accessible). */
  alt?: string
}

export function PolariaLogo({ height, className, alt = '' }: PolariaLogoProps) {
  return (
    <img
      className={className}
      src={POLARIA_LOGO.url}
      width={logoWidthFor(height)}
      height={height}
      alt={alt}
      decoding="async"
      draggable={false}
    />
  )
}
