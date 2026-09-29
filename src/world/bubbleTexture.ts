/**
 * Petite bulle « ! » flottante, au-dessus du cadre proche du joueur. Une seule texture, partagée.
 * Charte 3D (`charter3d.frame.bubble`) : disque corail (la couleur d'action), contour blanc, « ! » nuit très
 * sombre en Poppins 600 (6,8:1 sur le corail).
 */
import type { CanvasTexture } from 'three'
import { charter3d } from '../styles/tokens'
import { canvasFont, paintedTexture } from './textures'

const SIZE = 128

let cached: CanvasTexture | null = null

export function bubbleTexture(): CanvasTexture {
  if (cached) return cached
  const { fill, stroke, glyph } = charter3d.frame.bubble
  cached = paintedTexture(SIZE, SIZE, (ctx) => {
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 6
    ctx.stroke()
    ctx.fillStyle = glyph
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = canvasFont(600, 68)
    ctx.fillText('!', SIZE / 2, SIZE / 2 + 4)
  })
  return cached
}
