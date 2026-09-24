// Propriétaire : agent avatar+tampons.
// Génère l'image partageable du carnet complet. Le calcul de mise en page est pur et testable ;
// le dessin lui-même tolère l'absence de canvas 2D (jsdom renvoie `getContext('2d') === null`).
import type { ExhibitWingId, Lang } from '../../types'
import { EXHIBIT_WINGS } from '../../types'
import { pick } from '../../i18n'
import { strings } from './strings'

export const SHARE_WIDTH = 1080
export const SHARE_HEIGHT = 1350

const WING_INK_COLORS: Record<ExhibitWingId, string> = {
  infrastructures: '#3f7f78',
  industrialisation: '#b86a35',
  culture: '#7a5a9e',
}
const PENDING_STAMP_COLOR = '#c9c2b6'

export interface StampBadgeLayout {
  wing: ExhibitWingId
  x: number
  y: number
  radius: number
}

export interface ShareLayout {
  width: number
  height: number
  title: { x: number; y: number; fontSize: number }
  stamps: StampBadgeLayout[]
  name: { x: number; y: number; fontSize: number }
  event: { x: number; y: number; fontSize: number }
}

/** Calcul pur de la mise en page (position/taille de chaque élément), sans dessiner. */
export function computeShareLayout(width = SHARE_WIDTH, height = SHARE_HEIGHT): ShareLayout {
  const marginX = width * 0.12
  const radius = width * 0.13
  const count = EXHIBIT_WINGS.length
  const span = width - marginX * 2
  const step = count > 1 ? (span - radius * 2) / (count - 1) : 0
  const stamps: StampBadgeLayout[] = EXHIBIT_WINGS.map((wing, i) => ({
    wing,
    x: marginX + radius + i * step,
    y: height * 0.46,
    radius,
  }))
  return {
    width,
    height,
    title: { x: width / 2, y: height * 0.13, fontSize: width * 0.058 },
    stamps,
    name: { x: width / 2, y: height * 0.72, fontSize: width * 0.042 },
    event: { x: width / 2, y: height * 0.92, fontSize: width * 0.022 },
  }
}

/** Nom de fichier sûr pour le téléchargement (slug ASCII). */
export function buildShareFilename(avatarName: string): string {
  const slug = avatarName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
  return `musee-des-100-${slug || 'carte'}.png`
}

export interface ShareCardData {
  avatarName: string
  stamps: Partial<Record<ExhibitWingId, number>>
  lang: Lang
}

/** Dessine une pastille de tampon (cercle + contour), encrée ou en attente. */
function drawStampBadge(ctx: CanvasRenderingContext2D, badge: StampBadgeLayout, obtained: boolean): void {
  ctx.save()
  ctx.strokeStyle = obtained ? WING_INK_COLORS[badge.wing] : PENDING_STAMP_COLOR
  ctx.lineWidth = badge.radius * 0.09
  if (!obtained) ctx.setLineDash([badge.radius * 0.09, badge.radius * 0.11])
  ctx.beginPath()
  ctx.arc(badge.x, badge.y, badge.radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/** Dessine la carte complète sur un contexte 2D. No-op silencieux si `ctx` est `null` (pas de canvas). */
export function drawShareCard(ctx: CanvasRenderingContext2D | null, data: ShareCardData, layout: ShareLayout = computeShareLayout()): void {
  if (!ctx) return
  ctx.fillStyle = '#fdf1d6'
  ctx.fillRect(0, 0, layout.width, layout.height)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#4a3728'
  ctx.font = `700 ${layout.title.fontSize}px "Fredoka", sans-serif`
  ctx.fillText(pick(strings.shareTitle, data.lang), layout.title.x, layout.title.y)

  for (const badge of layout.stamps) {
    drawStampBadge(ctx, badge, Boolean(data.stamps[badge.wing]))
  }

  ctx.fillStyle = '#4a3728'
  ctx.font = `700 ${layout.name.fontSize}px "Nunito", sans-serif`
  ctx.fillText(data.avatarName || '—', layout.name.x, layout.name.y)

  ctx.fillStyle = '#7a6250'
  ctx.font = `400 ${layout.event.fontSize}px "Nunito", sans-serif`
  ctx.fillText(pick(strings.shareEvent, data.lang), layout.event.x, layout.event.y)
}

/** Génère l'image (PNG) en mémoire. `null` si le canvas 2D est indisponible (ex. jsdom). */
export async function generateShareBlob(data: ShareCardData): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_WIDTH
  canvas.height = SHARE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  drawShareCard(ctx, data)
  if (typeof canvas.toBlob !== 'function') return null
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}

/** Partage la carte (Web Share API) si possible, sinon la télécharge. */
export async function shareCard(data: ShareCardData): Promise<'shared' | 'downloaded' | 'unavailable'> {
  const blob = await generateShareBlob(data)
  if (!blob) return 'unavailable'
  const filename = buildShareFilename(data.avatarName)
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = typeof navigator !== 'undefined' ? navigator : undefined

  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: pick(strings.shareTitle, data.lang) })
      return 'shared'
    } catch {
      // Annulé par la personne ou échec du partage : on retombe sur le téléchargement.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Révocation différée : certains navigateurs (Safari notamment) lisent le blob de façon
  // asynchrone après le clic — révoquer l'URL trop tôt peut interrompre le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}
