/**
 * Textures canvas 2D (portraits d'attente, cartels, bannière). Aucune police externe :
 * `system-ui` uniquement (pas de CDN, conforme à la CSP). Textures ≤ 512 px.
 */
import { CanvasTexture, SRGBColorSpace, Texture } from 'three'
import type { ExhibitWingId, Lang, Localized, Person } from '../types'
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
/**
 * Portrait d'attente. Comme les 100 fiches actuelles sont toutes des placeholders (liste officielle
 * pas encore reçue), ce dessin est tout le contenu visuellement présent dans le musée pour l'instant :
 * il doit rester lisible à distance de jeu, pas seulement en zoomant sur l'image. Fond pastel très
 * clair + silhouette nettement plus foncée (grand écart, pas 23 points de blanc) ; le numéro est posé
 * sur un bandeau encre plein contraste (texte blanc), jamais directement sur le pastel : sa lisibilité
 * ne dépend alors jamais de la couleur (parfois claire) de l'aile.
 */
/**
 * Écart (0..1, part de blanc mélangée) entre le fond pastel et la silhouette d'un portrait d'attente.
 * Grand et fixe : `textures.test.ts` vérifie qu'il reste large quelle que soit `accentColor`, pour
 * qu'une régression future (fond et silhouette qui se rapprochent à nouveau) échoue au lint des tests
 * plutôt qu'en revue visuelle.
 */
export const PLACEHOLDER_BG_MIX = 0.88
export const PLACEHOLDER_SILHOUETTE_MIX = 0.08

function paintPlaceholderPortrait(accentColor: string, order: number, lang: Lang): CanvasTexture {
  const size = 256
  const { canvas, ctx } = context2d(size, size)

  // Fond : pastel très clair de l'aile (le plus loin possible d'une silhouette qui doit foncer).
  ctx.fillStyle = mixWithWhite(accentColor, PLACEHOLDER_BG_MIX)
  ctx.fillRect(0, 0, size, size)

  // Silhouette : couleur d'aile presque pure, sans blanc — contraste large et stable avec le fond,
  // quelle que soit la teinte (claire ou foncée) de l'aile.
  ctx.fillStyle = mixWithWhite(accentColor, PLACEHOLDER_SILHOUETTE_MIX)
  ctx.beginPath()
  ctx.arc(size / 2, size * 0.38, size * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(size * 0.2, size * 0.98)
  ctx.quadraticCurveTo(size * 0.2, size * 0.58, size * 0.5, size * 0.56)
  ctx.quadraticCurveTo(size * 0.8, size * 0.58, size * 0.8, size * 0.98)
  ctx.closePath()
  ctx.fill()

  // Bandeau du numéro : encre pleine opacité + texte blanc, jamais posé nu sur le pastel — contraste
  // garanti indépendamment de `accentColor`, et police bien plus grande (34px) pour rester lisible à
  // distance de jeu, pas seulement en zoomant sur la capture.
  const bandHeight = size * 0.22
  ctx.fillStyle = palette.ink
  ctx.fillRect(0, size - bandHeight, size, bandHeight)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 34px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(pick(worldStrings.waitingPortraitNumber, lang).replace('{order}', String(order)), size / 2, size - bandHeight / 2)

  // Légende (« Portrait à venir ») : juste au-dessus du bandeau, sur le pastel — texte encre, plus
  // discret que le numéro (`waitingPortraitCaption`, code mort V1 réutilisé ici).
  ctx.fillStyle = mixWithWhite(accentColor, PLACEHOLDER_SILHOUETTE_MIX * 0.5)
  ctx.font = '600 16px system-ui, sans-serif'
  ctx.fillText(pick(worldStrings.waitingPortraitCaption, lang), size / 2, size - bandHeight - 14)
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

/**
 * Texte de la ligne « organisation » d'un cartel. Fonction pure (testable sans canvas, voir
 * `textures.test.ts`) : une fiche d'attente (`placeholder: true`) dont l'organisation a été
 * volontairement vidée (le module données la vide pendant cette passe, la vraie liste n'étant pas
 * reçue) montre la date de révélation plutôt que « organisation à confirmer », qui suggérerait un
 * oubli plutôt qu'une attente délibérée.
 */
export function cartelOrganizationText(person: Pick<Person, 'organization' | 'placeholder'>, lang: Lang): string {
  if (person.organization && person.organization !== '—') return person.organization
  return pick(person.placeholder ? worldStrings.revealOctober6 : worldStrings.cartelUnknownOrg, lang)
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
  ctx.fillText(truncate(ctx, cartelOrganizationText(person, lang), w - 24), w / 2, h * 0.8)
  return toTexture(canvas)
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s}…`
}

/**
 * Plus grande taille (px, jusqu'à `maxSize`, jamais sous `minSize`, par pas de 1 px) telle que
 * `measureWidth(size) <= maxWidth`. Pure — `measureWidth` est injecté plutôt qu'un `ctx` + un texte,
 * pour rester testable sans canvas 2D (indisponible en jsdom, voir `textures.test.ts`) : l'appelant
 * y règle `ctx.font` sur la taille candidate puis renvoie `ctx.measureText(text).width`.
 *
 * Une taille fixe déborde selon la langue : mesuré (`measureText`, `700 46px`, la police de
 * `paintBanner`), le titre FR ('Le Musée des 100') tient large (largeur ≈383 px sur un canvas de
 * 512 px, marge ≈65 px de chaque côté) mais l'EN ('The Museum of the 100') mesure ≈500 px (marge
 * ≈6 px, quasiment collé à la bordure dorée) — les deux langues doivent retomber sur une police qui
 * laisse la même marge confortable, quel que soit le texte.
 */
export function fitFontSize(measureWidth: (size: number) => number, maxWidth: number, maxSize: number, minSize: number): number {
  let size = maxSize
  while (size > minSize && measureWidth(size) > maxWidth) size -= 1
  return size
}

export function mixWithWhite(hex: string, amount: number): string {
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
  // Marge confortable des deux côtés du cadre doré (assez large pour laisser le FR à sa taille
  // pleine, ≈383 px sur 512 : voir le commentaire de `fitFontSize`) : `fitFontSize` réduit la police
  // pour l'EN, plus long, plutôt que de la laisser toucher la bordure.
  const titleText = pick(title, lang)
  const titleMaxWidth = w - 120
  const titleSize = fitFontSize((size) => {
    ctx.font = `700 ${size}px system-ui, sans-serif`
    return ctx.measureText(titleText).width
  }, titleMaxWidth, 46, 26)
  ctx.font = `700 ${titleSize}px system-ui, sans-serif`
  ctx.fillText(titleText, w / 2, h * 0.48)
  const subtitleText = pick(subtitle, lang)
  const subtitleMaxWidth = w - 80
  const subtitleSize = fitFontSize((size) => {
    ctx.font = `500 ${size}px system-ui, sans-serif`
    return ctx.measureText(subtitleText).width
  }, subtitleMaxWidth, 24, 15)
  ctx.font = `500 ${subtitleSize}px system-ui, sans-serif`
  ctx.fillStyle = palette.inkSoft
  ctx.fillText(subtitleText, w / 2, h * 0.78)
  return toTexture(canvas)
}

/** Petit pictogramme abstrait (jamais un logo réel) dessiné à `(cx, cy)`, rayon `r`, dans `color`. */
function drawWingPictogram(ctx: CanvasRenderingContext2D, wing: ExhibitWingId, cx: number, cy: number, r: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(2, r * 0.16)
  if (wing === 'infrastructures') {
    // Baie de serveurs : trois barres empilées, chacune avec un petit point (LED).
    const barH = r * 0.5
    for (let i = -1; i <= 1; i++) {
      roundRect(ctx, cx - r, cy + i * barH - barH * 0.4, r * 2, barH * 0.7, barH * 0.15)
      ctx.fill()
    }
  } else if (wing === 'industrialisation') {
    // Roue dentée simplifiée : cercle + petites dents radiales.
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2)
    ctx.fill()
    for (let t = 0; t < 8; t++) {
      const a = (t / 8) * Math.PI * 2
      const x1 = cx + Math.cos(a) * r * 0.55
      const y1 = cy + Math.sin(a) * r * 0.55
      const x2 = cx + Math.cos(a) * r
      const y2 = cy + Math.sin(a) * r
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
  } else {
    // Palette de conservateur : blob arrondi + trois pastilles de couleur.
    ctx.beginPath()
    ctx.ellipse(cx, cy, r, r * 0.75, 0, 0, Math.PI * 2)
    ctx.fill()
    const dotColors = ['#ffffff', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.8)']
    dotColors.forEach((c, i) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(cx - r * 0.4 + i * r * 0.4, cy + (i % 2 ? -1 : 1) * r * 0.15, r * 0.16, 0, Math.PI * 2)
      ctx.fill()
    })
  }
  ctx.restore()
}

/** Panneau fléché du nom d'une aile, avec pictogramme, à la couleur de l'aile. */
const wingPanelCache = new Map<string, CanvasTexture>()
export function drawWingPanel(wing: ExhibitWingId, label: Localized, accentColor: string, lang: Lang): CanvasTexture {
  return cachedTexture(wingPanelCache, `${wing}|${pick(label, lang)}|${accentColor}`, () => paintWingPanel(wing, label, accentColor, lang))
}
function paintWingPanel(wing: ExhibitWingId, label: Localized, accentColor: string, lang: Lang): CanvasTexture {
  const w = 256
  const h = 96
  const { canvas, ctx } = context2d(w, h)
  ctx.fillStyle = accentColor
  roundRect(ctx, 0, 0, w, h, 16)
  ctx.fill()
  drawWingPictogram(ctx, wing, 34, h / 2, 20, 'rgba(255,255,255,0.92)')
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.font = '700 26px system-ui, sans-serif'
  ctx.fillText(truncate(ctx, pick(label, lang), w - 74), 64, h * 0.44)
  // Petite flèche vers le bas (« par ici ») sous le nom.
  ctx.font = '700 20px system-ui, sans-serif'
  ctx.fillText('↓', 64, h * 0.75)
  return toTexture(canvas)
}

/** Plaque « Bientôt » d'une aile sans aucune personne (mur fermé, cordon décoratif devant). */
const comingSoonCache = new Map<string, CanvasTexture>()
export function drawComingSoonPanel(lang: Lang): CanvasTexture {
  return cachedTexture(comingSoonCache, lang, () => paintComingSoonPanel(lang))
}
function paintComingSoonPanel(lang: Lang): CanvasTexture {
  const w = 256
  const h = 96
  const { canvas, ctx } = context2d(w, h)
  ctx.fillStyle = palette.woodDark
  roundRect(ctx, 0, 0, w, h, 16)
  ctx.fill()
  ctx.fillStyle = palette.gold
  roundRect(ctx, 5, 5, w - 10, h - 10, 12)
  ctx.lineWidth = 3
  ctx.strokeStyle = palette.gold
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '700 30px system-ui, sans-serif'
  ctx.fillText(pick(worldStrings.wingComingSoon, lang), w / 2, h * 0.6)
  return toTexture(canvas)
}

/** Plaque du comptoir de Minerve : nom + fonction. */
const minervePlateCache = new Map<string, CanvasTexture>()
export function drawMinervePlate(lang: Lang): CanvasTexture {
  return cachedTexture(minervePlateCache, lang, () => paintMinervePlate(lang))
}
function paintMinervePlate(lang: Lang): CanvasTexture {
  const w = 256
  const h = 80
  const { canvas, ctx } = context2d(w, h)
  ctx.fillStyle = '#c9a24a'
  roundRect(ctx, 0, 0, w, h, 10)
  ctx.fill()
  ctx.fillStyle = '#3b2a10'
  ctx.textAlign = 'center'
  ctx.font = '700 26px system-ui, sans-serif'
  ctx.fillText(pick(worldStrings.minerveName, lang), w / 2, h * 0.42)
  ctx.font = '400 17px system-ui, sans-serif'
  ctx.fillText(pick(worldStrings.minerveTitle, lang), w / 2, h * 0.76)
  return toTexture(canvas)
}
