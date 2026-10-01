/**
 * Texture de la plaque Polaria du hall (canvas 512 × 205, ≤ 512 px comme toutes les textures du jeu) :
 * fond nuit, liseré corail (le même dessin que la plaque de Rémi sur le comptoir), kicker « UNE CRÉATION »
 * en capitales espacées, logo officiel, « polaria.ai ». Couleurs de `charter3d.signage.plate` et
 * `charter3d.text` : aucune couleur en dur ici (le logo, lui, garde ses blanc et jaune d'origine).
 *
 * Le logo est une image chargée (`/brand/polaria-logo.webp`) : la plaque est d'abord peinte sans lui, puis
 * repeinte en place dès qu'il est arrivé (`needsUpdate`). Si le chargement échoue, la plaque reste lisible
 * (kicker + adresse). Une texture par langue, gardée en cache comme celles de `world/textures.ts`.
 */
import type { CanvasTexture } from 'three'
import { pick } from '../../i18n'
import type { Lang } from '../../types'
import { charter3d } from '../../styles/tokens'
import { canvasFont, paintedTexture, spacedGlyphOffsets } from '../../world/textures'
import { POLARIA_LOGO } from './brand'
import { strings } from './strings'

const { plate } = charter3d.signage

export const PLATE_CANVAS = { width: 512, height: 205 } as const

/** Géométrie de la plaque en pixels du canvas (pure : testée sans canvas). */
export interface PlateTextureLayout {
  width: number
  height: number
  /** Épaisseur du liseré et rayon des coins. */
  rim: number
  radius: number
  /** Milieu vertical et corps (px) du kicker et de l'adresse. */
  kickerCenterY: number
  kickerSize: number
  siteCenterY: number
  siteSize: number
  /** Logo : rectangle d'affichage. */
  logo: { x: number; y: number; width: number; height: number }
}

/** Part de la largeur du canvas occupée par le logo. */
const LOGO_SHARE = 0.72
/** Hauteur des capitales de Poppins / JetBrains Mono, en part du corps. */
const CAP_HEIGHT_RATIO = 0.7

export function plateTextureLayout(): PlateTextureLayout {
  const { width, height } = PLATE_CANVAS
  const logoWidth = Math.round(width * LOGO_SHARE)
  const logoHeight = Math.round((logoWidth * POLARIA_LOGO.height) / POLARIA_LOGO.width)
  const logoY = Math.round(height * 0.33)
  return {
    width,
    height,
    rim: 6,
    radius: 18,
    kickerCenterY: Math.round(height * 0.19),
    kickerSize: 22,
    siteCenterY: Math.round(height * 0.835),
    siteSize: 21,
    logo: { x: Math.round((width - logoWidth) / 2), y: logoY, width: logoWidth, height: logoHeight },
  }
}

// --- Logo : chargé une fois, partagé par toutes les plaques ---

let logoImage: HTMLImageElement | null = null
let logoRequested = false
const awaitingLogo = new Set<() => void>()

function whenLogoReady(callback: () => void) {
  if (logoImage) {
    callback()
    return
  }
  awaitingLogo.add(callback)
  if (logoRequested || typeof Image === 'undefined') return
  logoRequested = true
  const img = new Image()
  img.onload = () => {
    logoImage = img
    for (const cb of awaitingLogo) cb()
    awaitingLogo.clear()
  }
  img.onerror = () => awaitingLogo.clear()
  img.src = POLARIA_LOGO.url
}

// --- Dessin ---

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Texte en capitales espacées centré en `cx`, ligne de base `baseline` (police et couleur du contexte). */
function drawSpaced(ctx: CanvasRenderingContext2D, str: string, cx: number, baseline: number, spacing: number) {
  const glyphs = Array.from(str)
  const { offsets, total } = spacedGlyphOffsets(
    glyphs.map((ch) => ctx.measureText(ch).width),
    spacing,
  )
  const align = ctx.textAlign
  ctx.textAlign = 'left'
  glyphs.forEach((ch, i) => ctx.fillText(ch, cx - total / 2 + offsets[i], baseline))
  ctx.textAlign = align
}

function paintPlate(ctx: CanvasRenderingContext2D, lang: Lang) {
  const L = plateTextureLayout()

  // Fond nuit à coins arrondis (le reste du canvas reste transparent : `alphaTest` découpe la plaque).
  ctx.fillStyle = plate.fill
  roundRect(ctx, 0, 0, L.width, L.height, L.radius)
  ctx.fill()
  // Liseré corail, comme la plaque du comptoir.
  ctx.strokeStyle = plate.border
  ctx.lineWidth = L.rim
  roundRect(ctx, L.rim / 2, L.rim / 2, L.width - L.rim, L.height - L.rim, L.radius - L.rim / 2)
  ctx.stroke()

  // Kicker « UNE CRÉATION » en capitales espacées.
  const kicker = pick(strings.creation, lang).toLocaleUpperCase(lang)
  ctx.font = canvasFont(500, L.kickerSize, 'mono')
  ctx.fillStyle = plate.title
  drawSpaced(ctx, kicker, L.width / 2, Math.round(L.kickerCenterY + (L.kickerSize * CAP_HEIGHT_RATIO) / 2), L.kickerSize * 0.2)

  // Logo officiel, si déjà chargé.
  if (logoImage) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(logoImage, L.logo.x, L.logo.y, L.logo.width, L.logo.height)
  }

  // Adresse du site.
  ctx.font = canvasFont(500, L.siteSize, 'mono')
  ctx.fillStyle = plate.title
  ctx.textAlign = 'center'
  ctx.fillText(pick(strings.plateSite, lang), L.width / 2, Math.round(L.siteCenterY + (L.siteSize * CAP_HEIGHT_RATIO) / 2))
}

const plateCache = new Map<Lang, CanvasTexture>()

/** Texture de la plaque pour `lang` (cache : jamais redessinée deux fois, jamais libérée — une seule par langue). */
export function drawSignaturePlate(lang: Lang): CanvasTexture {
  let texture = plateCache.get(lang)
  if (!texture) {
    const created = paintedTexture(PLATE_CANVAS.width, PLATE_CANVAS.height, (ctx) => paintPlate(ctx, lang))
    texture = created
    plateCache.set(lang, created)
    whenLogoReady(() => {
      const canvas = created.image as HTMLCanvasElement
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      paintPlate(ctx, lang)
      ctx.restore()
      created.needsUpdate = true
    })
  }
  return texture
}
