/**
 * Cartel en laiton (WEL-875) : nom + organisation, redessiné en 512×128 (contre 256×96 pour le cartel
 * générique de `textures.ts`) pour rester net à la distance de jeu une fois agrandi sur le cadre. Même
 * logique de contenu que `textures.ts::drawCartel` (réutilisée via `cartelOrganizationText`, testée dans
 * `textures.test.ts` — jamais réimplémentée ici) ; seul le DESSIN change. Fichier séparé plutôt qu'une
 * modification de `textures.ts` (partagé, hors de mon périmètre de fichiers pour ce chantier — voir
 * `docs/assets/frames.md`, note de contrat).
 * Aucune police externe (même règle que `textures.ts` : pas de CDN, conforme à la CSP).
 */
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { Lang, Person } from '../types'
import { cartelOrganizationText, fitFontSize } from './textures'

const WIDTH = 512
const HEIGHT = 128

function context2d(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Contexte canvas 2D indisponible')
  return { canvas, ctx }
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

/** Tronque `text` (avec « … ») pour tenir dans `maxWidth` — même principe que le `truncate` privé de `textures.ts`, dupliqué ici (petite fonction générique, pas une règle métier) faute de pouvoir l'importer. */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s}…`
}

const cache = new Map<string, CanvasTexture>()

/** Cartel en laiton, haute résolution. Mis en cache par personne + langue (bascule FR/EN sans texture orpheline, voir `textures.ts`). */
export function drawFrameCartel(person: Person, lang: Lang): CanvasTexture {
  const key = `${person.id}|${lang}`
  let tex = cache.get(key)
  if (!tex) {
    tex = paintFrameCartel(person, lang)
    cache.set(key, tex)
  }
  return tex
}

function paintFrameCartel(person: Person, lang: Lang): CanvasTexture {
  const { canvas, ctx } = context2d()
  const margin = 6

  // Plaque de laiton : fond deux tons (reflet du haut plus clair) + fin listel plus sombre en pourtour,
  // comme une vraie plaque gravée plutôt qu'un aplat.
  ctx.fillStyle = '#8a6a2c'
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 14)
  ctx.fill()
  ctx.fillStyle = '#c9a24a'
  roundRect(ctx, margin, margin, WIDTH - margin * 2, HEIGHT - margin * 2, 11)
  ctx.fill()
  const sheen = ctx.createLinearGradient(0, margin, 0, HEIGHT * 0.55)
  sheen.addColorStop(0, 'rgba(255,255,255,0.32)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  roundRect(ctx, margin, margin, WIDTH - margin * 2, HEIGHT * 0.5, 11)
  ctx.fill()

  // Nom : taille ajustée pour tenir sur une ligne (police de l'interface non chargée ici, voir
  // l'en-tête — même choix que `textures.ts`), en gras, encre foncée pour un fort contraste sur laiton.
  ctx.fillStyle = '#3b2a10'
  ctx.textAlign = 'center'
  const nameMaxWidth = WIDTH - 64
  const nameSize = fitFontSize((size) => {
    ctx.font = `700 ${size}px system-ui, sans-serif`
    return ctx.measureText(person.name).width
  }, nameMaxWidth, 42, 24)
  ctx.font = `700 ${nameSize}px system-ui, sans-serif`
  ctx.fillText(truncate(ctx, person.name, nameMaxWidth), WIDTH / 2, HEIGHT * 0.42)

  // Fin filet séparateur nom / organisation.
  ctx.strokeStyle = 'rgba(59,42,16,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(WIDTH * 0.32, HEIGHT * 0.58)
  ctx.lineTo(WIDTH * 0.68, HEIGHT * 0.58)
  ctx.stroke()

  // Organisation (ou date de révélation localisée pour une fiche d'attente sans organisation) : logique
  // strictement identique au cartel générique, via la fonction pure partagée et déjà testée.
  ctx.fillStyle = '#5a441c'
  const orgText = cartelOrganizationText(person, lang)
  const orgMaxWidth = WIDTH - 64
  const orgSize = fitFontSize((size) => {
    ctx.font = `500 ${size}px system-ui, sans-serif`
    return ctx.measureText(orgText).width
  }, orgMaxWidth, 24, 15)
  ctx.font = `500 ${orgSize}px system-ui, sans-serif`
  ctx.fillText(truncate(ctx, orgText, orgMaxWidth), WIDTH / 2, HEIGHT * 0.78)

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  tex.anisotropy = 1
  return tex
}
