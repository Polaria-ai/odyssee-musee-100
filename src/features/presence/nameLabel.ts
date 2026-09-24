/**
 * Étiquette de pseudo flottant au-dessus d'un visiteur distant : texture canvas 2D (pas de
 * `<Text>`/`<Html>` drei — police CDN bloquée par la CSP, `Html` coûteux sur mobile), mise en
 * cache par pseudo pour ne jamais la regénérer deux fois (deux visiteurs homonymes la partagent).
 *
 * Cache borné (LRU) : avec « plusieurs centaines » de visiteurs sur toute une soirée, un cache
 * illimité accumulerait une texture GPU par pseudo unique vu, sans jamais rien libérer. Au-delà de
 * `MAX_CACHE_ENTRIES`, l'entrée la moins récemment utilisée est évincée et sa texture disposée.
 */
import * as THREE from 'three'
import { palette } from '../../styles/tokens'

const MAX_CACHE_ENTRIES = 64

// Ordre d'insertion = ordre de fraîcheur (une relecture réinsère la clé en fin de map).
const cache = new Map<string, THREE.CanvasTexture>()

function remember(label: string, texture: THREE.CanvasTexture): void {
  cache.set(label, texture)
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.get(oldestKey)?.dispose()
    cache.delete(oldestKey)
  }
}

const FONT = '600 34px Nunito, sans-serif'
const PADDING_X = 22
const HEIGHT_PX = 56
const MIN_WIDTH_PX = 90

function roundedRectPath(ctx: CanvasRenderingContext2D, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(w, 0, w, h, r)
  ctx.arcTo(w, h, 0, h, r)
  ctx.arcTo(0, h, 0, 0, r)
  ctx.arcTo(0, 0, w, 0, r)
  ctx.closePath()
}

/** `null` si le pseudo est vide (pas d'étiquette) ou si le canvas 2D est indisponible. */
export function getNameLabelTexture(name: string): THREE.CanvasTexture | null {
  const label = name.trim()
  if (!label) return null
  const cached = cache.get(label)
  if (cached) {
    // Touch LRU : réinsère la clé en fin de map pour ne pas l'évincer alors qu'elle est active.
    cache.delete(label)
    cache.set(label, cached)
    return cached
  }

  const measurer = document.createElement('canvas').getContext('2d')
  if (!measurer) return null
  measurer.font = FONT
  const width = Math.ceil(Math.max(measurer.measureText(label).width + PADDING_X * 2, MIN_WIDTH_PX))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = HEIGHT_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = 'rgba(74, 55, 40, 0.82)' // palette.ink, translucide
  roundedRectPath(ctx, width, HEIGHT_PX, HEIGHT_PX / 2)
  ctx.fill()

  ctx.font = FONT
  ctx.fillStyle = palette.cream
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, width / 2, HEIGHT_PX / 2 + 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  remember(label, texture)
  return texture
}

/** Ratio largeur/hauteur du canvas source, pour dimensionner le sprite sans le déformer. */
export function getNameLabelAspect(texture: THREE.CanvasTexture): number {
  const image = texture.image as { width: number; height: number }
  return image.height > 0 ? image.width / image.height : 1
}
