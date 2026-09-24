/** Petite bulle « ! » flottante, au-dessus du cadre proche du joueur. Une seule texture, partagée. */
import { CanvasTexture, SRGBColorSpace } from 'three'
import { palette } from '../styles/tokens'

let cached: CanvasTexture | null = null

export function bubbleTexture(): CanvasTexture {
  if (cached) return cached
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Contexte canvas 2D indisponible')
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
  ctx.fillStyle = palette.leaf
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 34px system-ui, sans-serif'
  ctx.fillText('!', size / 2, size / 2 + 2)
  cached = new CanvasTexture(canvas)
  cached.colorSpace = SRGBColorSpace
  cached.needsUpdate = true
  return cached
}
