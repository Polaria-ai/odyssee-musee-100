/**
 * Matériau de la bulle « … » qui flotte au-dessus de Rémi quand le joueur est à portée du comptoir.
 * Dessinée sur un canvas 2D (pas de police CDN, pas de <Html>), créée une seule fois puis partagée.
 * Couleurs : palette de l'événement (charte « 2026 : l'Odyssée de l'IA »), pas l'héritage V1.
 * Propriétaire : agent accueil-remi.
 */
import { CanvasTexture, MeshLambertMaterial, PlaneGeometry } from 'three'
import { eventPalette } from '../styles/tokens'

/** Bulle 0,52 × 0,40 m : la queue est en bas du canvas, donc en bas du plan. */
export const BUBBLE_GEOMETRY = new PlaneGeometry(0.52, 0.4)

let bubbleMaterial: MeshLambertMaterial | null = null

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function getBubbleMaterial(): MeshLambertMaterial {
  if (bubbleMaterial) return bubbleMaterial
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 100
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    roundRect(ctx, 6, 6, 116, 58, 20)
    ctx.fillStyle = eventPalette.blanc
    ctx.fill()
    ctx.strokeStyle = eventPalette.bleuNuit
    ctx.lineWidth = 4
    roundRect(ctx, 6, 6, 116, 58, 20)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(52, 62)
    ctx.lineTo(64, 92)
    ctx.lineTo(76, 62)
    ctx.closePath()
    ctx.fillStyle = eventPalette.blanc
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = eventPalette.bleuNuit
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(38 + i * 26, 35, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  bubbleMaterial = new MeshLambertMaterial({ map: texture, transparent: true, depthWrite: false })
  return bubbleMaterial
}
