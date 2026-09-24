/**
 * Textures canvas 2D (portraits d'attente, cartels, bannière). Aucune police externe :
 * `system-ui` uniquement (pas de CDN, conforme à la CSP). Textures ≤ 512 px.
 */
import { CanvasTexture, SRGBColorSpace, Texture } from 'three'
import type { Lang, Localized, Person } from '../types'
import { pick } from '../i18n'
import { palette } from '../styles/tokens'
import { worldStrings } from './strings'

function context2d(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Contexte canvas 2D indisponible')
  return { canvas, ctx }
}

function toTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  tex.anisotropy = 1
  return tex
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Cache générique par clé : ces textures canvas sont redessinées à chaque bascule FR/EN (jusqu'à
 * ~100 cadres) ; sans cache, l'ancienne texture GPU n'est jamais libérée (`useMemo`, côté appelant,
 * ne fait que perdre la référence). On les garde toutes, comme `photoCache` ci-dessous : leur nombre
 * est borné par le nombre de personnes × 2 langues, jamais réévalué en boucle.
 */
function cachedTexture(cache: Map<string, CanvasTexture>, key: string, draw: () => CanvasTexture): CanvasTexture {
  let tex = cache.get(key)
  if (!tex) {
    tex = draw()
    cache.set(key, tex)
  }
  return tex
}

/** Silhouette buste arrondie + numéro, sur fond pastel : portrait d'attente d'une fiche non illustrée. */
const placeholderCache = new Map<string, CanvasTexture>()
export function drawPlaceholderPortrait(accentColor: string, order: number, lang: Lang): CanvasTexture {
  return cachedTexture(placeholderCache, `${accentColor}|${order}|${lang}`, () => paintPlaceholderPortrait(accentColor, order, lang))
}
function paintPlaceholderPortrait(accentColor: string, order: number, lang: Lang): CanvasTexture {
  const size = 256
  const { canvas, ctx } = context2d(size, size)
  ctx.fillStyle = mixWithWhite(accentColor, 0.78)
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = mixWithWhite(accentColor, 0.55)
  ctx.beginPath()
  ctx.arc(size / 2, size * 0.4, size * 0.19, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(size * 0.22, size * 0.98)
  ctx.quadraticCurveTo(size * 0.22, size * 0.62, size * 0.5, size * 0.6)
  ctx.quadraticCurveTo(size * 0.78, size * 0.62, size * 0.78, size * 0.98)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = palette.ink
  ctx.globalAlpha = 0.85
  ctx.font = '600 22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(pick(worldStrings.waitingPortraitNumber, lang).replace('{order}', String(order)), size / 2, size * 0.92)
  ctx.globalAlpha = 1
  return toTexture(canvas)
}

/** Photo réelle, chargée depuis `photoUrl`. Cache partagé : jamais rechargée deux fois. */
const photoCache = new Map<string, Promise<Texture>>()
export function loadPersonPhoto(url: string): Promise<Texture> {
  let cached = photoCache.get(url)
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const tex = new Texture(img)
        tex.colorSpace = SRGBColorSpace
        tex.needsUpdate = true
        resolve(tex)
      }
      img.onerror = () => reject(new Error(`Photo introuvable: ${url}`))
      img.src = url
    })
    photoCache.set(url, cached)
  }
  return cached
}

/** Cartel en laiton : nom + organisation. */
const cartelCache = new Map<string, CanvasTexture>()
export function drawCartel(person: Person, lang: Lang): CanvasTexture {
  return cachedTexture(cartelCache, `${person.id}|${lang}`, () => paintCartel(person, lang))
}
function paintCartel(person: Person, lang: Lang): CanvasTexture {
  const w = 256
  const h = 96
  const { canvas, ctx } = context2d(w, h)
  ctx.fillStyle = '#c9a24a'
  roundRect(ctx, 0, 0, w, h, 10)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  roundRect(ctx, 4, 4, w - 8, h * 0.4, 8)
  ctx.fill()
  ctx.fillStyle = '#3b2a10'
  ctx.textAlign = 'center'
  ctx.font = '700 26px system-ui, sans-serif'
  ctx.fillText(truncate(ctx, person.name, w - 24), w / 2, h * 0.48)
  ctx.font = '400 18px system-ui, sans-serif'
  const org = person.organization && person.organization !== '—' ? person.organization : pick(worldStrings.cartelUnknownOrg, lang)
  ctx.fillText(truncate(ctx, org, w - 24), w / 2, h * 0.8)
  return toTexture(canvas)
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s}…`
}

function mixWithWhite(hex: string, amount: number): string {
  const c = hexToRgb(hex)
  const mix = (v: number) => Math.round(v + (255 - v) * amount)
  return `rgb(${mix(c.r)}, ${mix(c.g)}, ${mix(c.b)})`
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Grande bannière du hall : titre + sous-titre. */
const bannerCache = new Map<string, CanvasTexture>()
export function drawBanner(title: Localized, subtitle: Localized, lang: Lang): CanvasTexture {
  return cachedTexture(bannerCache, `${pick(title, lang)}|${pick(subtitle, lang)}`, () => paintBanner(title, subtitle, lang))
}
function paintBanner(title: Localized, subtitle: Localized, lang: Lang): CanvasTexture {
  const w = 512
  const h = 160
  const { canvas, ctx } = context2d(w, h)
  ctx.fillStyle = palette.cream
  roundRect(ctx, 0, 0, w, h, 22)
  ctx.fill()
  ctx.strokeStyle = palette.gold
  ctx.lineWidth = 6
  roundRect(ctx, 6, 6, w - 12, h - 12, 18)
  ctx.stroke()
  ctx.fillStyle = palette.ink
  ctx.textAlign = 'center'
  ctx.font = '700 46px system-ui, sans-serif'
  ctx.fillText(pick(title, lang), w / 2, h * 0.48)
  ctx.font = '500 24px system-ui, sans-serif'
  ctx.fillStyle = palette.inkSoft
  ctx.fillText(pick(subtitle, lang), w / 2, h * 0.78)
  return toTexture(canvas)
}

/** Panneau du nom d'une aile, à la couleur de l'aile. */
const wingPanelCache = new Map<string, CanvasTexture>()
export function drawWingPanel(label: Localized, accentColor: string, lang: Lang): CanvasTexture {
  return cachedTexture(wingPanelCache, `${pick(label, lang)}|${accentColor}`, () => paintWingPanel(label, accentColor, lang))
}
function paintWingPanel(label: Localized, accentColor: string, lang: Lang): CanvasTexture {
  const w = 256
  const h = 96
  const { canvas, ctx } = context2d(w, h)
  ctx.fillStyle = accentColor
  roundRect(ctx, 0, 0, w, h, 16)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '700 30px system-ui, sans-serif'
  ctx.fillText(pick(label, lang), w / 2, h * 0.62)
  return toTexture(canvas)
}
