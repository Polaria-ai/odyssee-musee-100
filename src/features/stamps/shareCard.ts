// Propriétaire : agent avatar+tampons.
// Génère l'image partageable du carnet complet. Le calcul de mise en page est pur et testable ;
// le dessin lui-même tolère l'absence de canvas 2D (jsdom renvoie `getContext('2d') === null`).
import type { ExhibitWingId, Lang } from '../../types'
import { pick } from '../../i18n'
import { ALL_STAMPS, ARCHIVES_INK, type StampId } from './stamps'
import { strings } from './strings'

export const SHARE_WIDTH = 1080
export const SHARE_HEIGHT = 1350

// Charte de l'Odyssée : encres vives des ailes sur fond bleu nuit.
const WING_INK_COLORS: Record<StampId, string> = {
  infrastructures: '#6de4e5',
  industrialisation: '#e8785c',
  culture: '#4d8cff',
  archives: ARCHIVES_INK,
}
const PENDING_STAMP_COLOR = '#3a4a78'

export interface StampBadgeLayout {
  wing: StampId
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
  const marginX = width * 0.1
  const radius = width * 0.1
  const count = ALL_STAMPS.length
  const span = width - marginX * 2
  const step = count > 1 ? (span - radius * 2) / (count - 1) : 0
  const stamps: StampBadgeLayout[] = ALL_STAMPS.map((wing, i) => ({
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

/** Nom du fichier téléchargé (plus de pseudo depuis que tout le monde joue Cyril). */
export const SHARE_FILENAME = 'musee-des-100-carte.png'

/** Nombre de tampons obtenus sur la carte (trois ailes + Archives de 2040). Fonction pure. */
export function countObtainedStamps(data: Pick<ShareCardData, 'stamps' | 'archivesObtained'>): number {
  return Object.values(data.stamps).filter(Boolean).length + (data.archivesObtained ? 1 : 0)
}

export interface ShareCardData {
  stamps: Partial<Record<ExhibitWingId, number>>
  /** 4e tampon (Archives de 2040) : pas stocké dans `stamps` (déduit de `visitedSessions`, voir `stamps.ts`). */
  archivesObtained: boolean
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
  // Charte de l'Odyssée : fond bleu nuit, liseré corail, texte blanc pur, Poppins.
  ctx.fillStyle = '#071336'
  ctx.fillRect(0, 0, layout.width, layout.height)
  ctx.strokeStyle = '#e8785c'
  ctx.lineWidth = 12
  ctx.strokeRect(24, 24, layout.width - 48, layout.height - 48)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${layout.title.fontSize}px "Poppins", "Futura", sans-serif`
  ctx.fillText(pick(strings.shareTitle, data.lang), layout.title.x, layout.title.y)

  for (const badge of layout.stamps) {
    const obtained = badge.wing === 'archives' ? data.archivesObtained : Boolean(data.stamps[badge.wing])
    drawStampBadge(ctx, badge, obtained)
  }

  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${layout.name.fontSize}px "Poppins", "Futura", sans-serif`
  ctx.fillText(pick(strings.shareCount, data.lang).replace('{count}', String(countObtainedStamps(data))), layout.name.x, layout.name.y)

  ctx.fillStyle = '#e8785c'
  ctx.font = `500 ${layout.event.fontSize}px "JetBrains Mono", monospace`
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
  const filename = SHARE_FILENAME
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
