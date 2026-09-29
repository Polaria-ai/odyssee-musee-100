/**
 * Textures canvas 2D du musée : portraits d'attente, cartels, bannière du hall, panneaux de porte,
 * plaque du comptoir d'accueil. Textures ≤ 512 px.
 *
 * Charte 3D du 29/09/2026 (`docs/CHARTE-3D.md` §4.5, 4.6, 4.9) : fond nuit `#0a1738`, texte blanc pur,
 * l'accent de l'aile (cyan vif / corail / bleu néon) porte les filets, la silhouette et le bandeau. Aucune
 * couleur en dur ici : tout vient de `charter3d` (`src/styles/tokens.ts`).
 *
 * Polices : Poppins (≤ 600) pour les mots, JetBrains Mono (≤ 500) pour les chiffres, via `canvasFont`.
 * Elles viennent de Google Fonts (`index.html`) : un canvas peint avant leur chargement retombe sur
 * `system-ui` et la texture garderait ce repli. `paintedTexture` repeint donc en place, une fois les
 * polices prêtes, toute texture dessinée trop tôt (et `canvasFontsReady` permet d'attendre avant de monter
 * la scène).
 */
import { CanvasTexture, SRGBColorSpace, Texture } from 'three'
import type { ExhibitWingId, Lang, Localized, Person } from '../types'
import { pick } from '../i18n'
import { charter3d, wingThemes } from '../styles/tokens'
import { worldStrings } from './strings'

const { portrait, signage, cartel, text } = charter3d

/** JetBrains Mono : seuls les graisses 400 et 500 sont chargées (`index.html`). */
const MONO_MAX_WEIGHT = 500

export type CanvasFace = 'display' | 'mono'

/**
 * Police d'un canvas. La graisse est plafonnée à la charte (Poppins ≤ 600, JetBrains Mono ≤ 500) : un
 * `700` demandé par erreur retomberait sur une graisse synthétique, plus lourde que la charte.
 */
export function canvasFont(weight: number, size: number, face: CanvasFace = 'display'): string {
  const cap = face === 'mono' ? MONO_MAX_WEIGHT : text.maxWeight
  return `${Math.min(weight, cap)} ${size}px ${face === 'mono' ? text.mono : text.display}`
}

// --- Polices : attendre leur chargement, repeindre les textures dessinées trop tôt ---

/** Graisses et échantillons de texte à charger (l'échantillon choisit le sous-ensemble Unicode de Google Fonts). */
const FONT_LOADS: ReadonlyArray<readonly [string, string]> = [
  ['600 16px Poppins', "Aàâéèêëîïôùûçœ0123456789!'"],
  ['500 16px Poppins', "Aàâéèêëîïôùûçœ0123456789!'"],
  ['500 16px "JetBrains Mono"', 'N°o.0123456789'],
]

function fontFaceSet(): FontFaceSet | null {
  return typeof document !== 'undefined' && document.fonts && typeof document.fonts.load === 'function' ? document.fonts : null
}

function fontsLoaded(): boolean {
  const fonts = fontFaceSet()
  if (!fonts || typeof fonts.check !== 'function') return true
  try {
    return FONT_LOADS.every(([spec, sample]) => fonts.check(spec, sample))
  } catch {
    return true
  }
}

/**
 * Promesse résolue quand Poppins et JetBrains Mono sont prêtes pour les canvas (ou après `timeoutMs`,
 * jamais rejetée : sans réseau, le repli `system-ui` reste lisible). À attendre avant de monter la scène.
 */
export function canvasFontsReady(timeoutMs = 1500): Promise<void> {
  const fonts = fontFaceSet()
  if (!fonts || fontsLoaded()) return Promise.resolve()
  const loads = Promise.all(FONT_LOADS.map(([spec, sample]) => fonts.load(spec, sample).catch(() => []))).then(() => undefined)
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
  return Promise.race([loads, timeout])
}

interface Repaintable {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  paint: (ctx: CanvasRenderingContext2D) => void
  texture: CanvasTexture
}
/** Textures dessinées avant que les polices soient prêtes : repeintes en place dès qu'elles le sont. */
const awaitingFonts = new Set<Repaintable>()
let fontsRequested = false

function repaintAwaiting() {
  if (awaitingFonts.size === 0 || !fontsLoaded()) return
  for (const item of awaitingFonts) {
    item.ctx.clearRect(0, 0, item.canvas.width, item.canvas.height)
    item.ctx.save()
    item.paint(item.ctx)
    item.ctx.restore()
    item.texture.needsUpdate = true
  }
  awaitingFonts.clear()
}

function requestFonts() {
  const fonts = fontFaceSet()
  if (fontsRequested || !fonts) return
  fontsRequested = true
  for (const [spec, sample] of FONT_LOADS) fonts.load(spec, sample).then(repaintAwaiting, () => {})
  fonts.addEventListener('loadingdone', repaintAwaiting)
}

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

/**
 * Crée une texture canvas `width` × `height` peinte par `paint`. Si les polices de la charte ne sont pas
 * encore chargées, la texture est repeinte en place dès qu'elles le sont (`needsUpdate`), sans jamais
 * rester sur le repli `system-ui`. `paint` doit être idempotent (il repart d'un canvas effacé).
 */
export function paintedTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const { canvas, ctx } = context2d(width, height)
  ctx.save()
  paint(ctx)
  ctx.restore()
  const texture = toTexture(canvas)
  if (!fontsLoaded()) {
    awaitingFonts.add({ canvas, ctx, paint, texture })
    requestFonts()
  }
  return texture
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

// --- Texte : capitales espacées (kicker) et ajustement de taille ---

/**
 * Positions (x du bord gauche de chaque caractère, largeur totale) d'un texte dont les caractères ont les
 * largeurs `widths` et sont séparés de `spacing` px. Pure : le kicker de la charte (capitales espacées) est
 * dessiné caractère par caractère parce que `ctx.letterSpacing` n'est pas disponible partout.
 */
export function spacedGlyphOffsets(widths: readonly number[], spacing: number): { offsets: number[]; total: number } {
  const offsets: number[] = []
  let x = 0
  for (let i = 0; i < widths.length; i++) {
    offsets.push(x)
    x += widths[i] + (i < widths.length - 1 ? spacing : 0)
  }
  return { offsets, total: x }
}

/** Largeur d'un texte en capitales espacées, dans la police courante du contexte. */
function measureSpaced(ctx: CanvasRenderingContext2D, str: string, spacing: number): number {
  return spacedGlyphOffsets(Array.from(str, (ch) => ctx.measureText(ch).width), spacing).total
}

/** Dessine `str` caractère par caractère, centré en `cx`, sur la ligne de base `baseline`. Couleur et police : celles du contexte. */
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

/** Hauteur des capitales de Poppins / JetBrains Mono, en part du corps : sert à centrer un texte verticalement sans dépendre de `textBaseline`. */
const CAP_HEIGHT_RATIO = 0.7

/** Ligne de base d'un texte en capitales ou en chiffres dont le milieu visuel est `centerY`. */
function baselineFor(centerY: number, size: number): number {
  return Math.round(centerY + (size * CAP_HEIGHT_RATIO) / 2)
}

// --- Portrait d'attente ---

/**
 * Géométrie du portrait d'attente (pure, testée sans canvas dans `textures.test.ts`), en pixels d'un canvas
 * `portrait.canvas`. De haut en bas : silhouette (tête + buste), filet accent, légende, bandeau du numéro.
 */
export interface PlaceholderLayout {
  width: number
  height: number
  head: { cx: number; cy: number; r: number }
  /** Buste : de `left` à `right`, base plate à `base`, sommet des épaules à `apexY`. */
  bust: { left: number; right: number; base: number; apexY: number }
  /** Filet accent au-dessus de la légende. */
  rule: { top: number; width: number; height: number }
  /** Milieu vertical de la légende. */
  kickerCenterY: number
  bandTop: number
  bandHeight: number
  /** Milieu vertical du numéro dans la partie visible du bandeau (la moulure du cadre recouvre les derniers pixels du bas). */
  numberCenterY: number
}

/** Pixels du bas de la toile cachés par le passe-partout du cadre (0,03 m de recouvrement, voir `frameGeometry.ts`). */
const MAT_HIDDEN_PX = 6

export function placeholderLayout(): PlaceholderLayout {
  const { width, height } = portrait.canvas
  const bandHeight = Math.round(height * portrait.bandShare)
  const bandTop = height - bandHeight
  const kickerCenterY = bandTop - 20
  const ruleTop = kickerCenterY - 21
  const headR = Math.round(width * 0.165)
  const headCy = Math.round(height * 0.11) + headR
  return {
    width,
    height,
    head: { cx: width / 2, cy: headCy, r: headR },
    bust: { left: Math.round(width * 0.17), right: Math.round(width * 0.83), base: ruleTop - 12, apexY: headCy + headR - 2 },
    rule: { top: ruleTop, width: 28, height: 3 },
    kickerCenterY,
    bandTop,
    bandHeight,
    numberCenterY: bandTop + (bandHeight - MAT_HIDDEN_PX) / 2,
  }
}

/**
 * Portrait d'attente : écran nuit, silhouette (tête + buste) tracée en scanlines dans l'accent de l'aile,
 * comme le disque du logo ; filet accent + « PORTRAIT À VENIR » en capitales espacées ; numéro en JetBrains
 * Mono sur un bandeau accent (texte nuit très sombre, ≥ 6:1 pour chaque aile).
 * Comme les 100 fiches sont toutes des placeholders (liste officielle pas encore reçue), c'est tout le
 * contenu visuel du musée pour l'instant : il doit se lire à la distance de jeu.
 */
const placeholderCache = new Map<string, CanvasTexture>()
export function drawPlaceholderPortrait(accentColor: string, order: number, lang: Lang): CanvasTexture {
  return cachedTexture(placeholderCache, `${accentColor}|${order}|${lang}`, () => {
    const { width, height } = portrait.canvas
    return paintedTexture(width, height, (ctx) => paintPlaceholderPortrait(ctx, accentColor, order, lang))
  })
}

/** Couleur de la silhouette d'un portrait d'attente : l'accent de l'aile, tel quel (fond sombre, plus de pastel). */
export function placeholderSilhouetteColor(accentColor: string): string {
  return accentColor
}

function paintPlaceholderPortrait(ctx: CanvasRenderingContext2D, accentColor: string, order: number, lang: Lang) {
  const L = placeholderLayout()

  ctx.fillStyle = portrait.fill
  ctx.fillRect(0, 0, L.width, L.height)

  // Silhouette : tête + buste, clippés, puis barres horizontales alignées sur un pas commun (le motif
  // se poursuit de la tête au buste). Les deux sous-tracés tournent dans le même sens : leur union est pleine.
  ctx.save()
  ctx.beginPath()
  ctx.arc(L.head.cx, L.head.cy, L.head.r, 0, Math.PI * 2)
  ctx.moveTo(L.bust.left, L.bust.base)
  ctx.quadraticCurveTo(L.bust.left, L.bust.apexY, L.head.cx, L.bust.apexY)
  ctx.quadraticCurveTo(L.bust.right, L.bust.apexY, L.bust.right, L.bust.base)
  ctx.closePath()
  ctx.clip()
  ctx.fillStyle = placeholderSilhouetteColor(accentColor)
  for (let y = 0; y < L.bust.base; y += portrait.scanline.pitch) ctx.fillRect(0, y, L.width, portrait.scanline.bar)
  ctx.restore()

  // Kicker : filet accent puis légende en capitales espacées.
  ctx.fillStyle = accentColor
  ctx.fillRect(Math.round((L.width - L.rule.width) / 2), L.rule.top, L.rule.width, L.rule.height)
  const caption = pick(worldStrings.waitingPortraitCaption, lang).toLocaleUpperCase(lang)
  const captionSize = fitFontSize(
    (size) => {
      ctx.font = canvasFont(500, size)
      return measureSpaced(ctx, caption, size * 0.18)
    },
    L.width - 40,
    14,
    10,
  )
  ctx.font = canvasFont(500, captionSize)
  ctx.fillStyle = portrait.kicker
  drawSpaced(ctx, caption, L.width / 2, baselineFor(L.kickerCenterY, captionSize), captionSize * 0.18)

  // Bandeau du numéro : accent plein, chiffres en JetBrains Mono sur nuit très sombre.
  ctx.fillStyle = accentColor
  ctx.fillRect(0, L.bandTop, L.width, L.bandHeight)
  const label = pick(worldStrings.waitingPortraitNumber, lang).replace('{order}', String(order))
  const labelSize = fitFontSize(
    (size) => {
      ctx.font = canvasFont(500, size, 'mono')
      return ctx.measureText(label).width
    },
    L.width - 48,
    40,
    26,
  )
  ctx.font = canvasFont(500, labelSize, 'mono')
  ctx.fillStyle = portrait.bandText
  ctx.textAlign = 'center'
  ctx.fillText(label, L.width / 2, baselineFor(L.numberCenterY, labelSize))
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

// --- Cartel ---

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

/**
 * Plaque de cartel (nom + organisation) sur un canvas `w` × `h` : fond nuit, contour et filet séparateur
 * dans l'accent de l'aile de la personne, nom en blanc (Poppins 600), organisation en blanc adouci
 * (Poppins 500). Partagée par le cartel générique ci-dessous (256×96) et celui des cadres
 * (`frameCartel.ts`, 512×128) : tailles de police proportionnelles à la hauteur.
 */
export function paintCartelPlate(ctx: CanvasRenderingContext2D, w: number, h: number, person: Person, lang: Lang) {
  const accent = wingThemes[person.wing].accent
  const radius = h * 0.11
  const line = Math.max(2, Math.round(h * 0.024))

  ctx.fillStyle = cartel.fill
  roundRect(ctx, 0, 0, w, h, radius)
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = line
  roundRect(ctx, line / 2, line / 2, w - line, h - line, radius - line / 2)
  ctx.stroke()

  ctx.textAlign = 'center'
  const maxWidth = w - h * 0.5
  ctx.fillStyle = cartel.name
  const nameSize = fitFontSize(
    (size) => {
      ctx.font = canvasFont(600, size)
      return ctx.measureText(person.name).width
    },
    maxWidth,
    Math.round(h * 0.33),
    Math.round(h * 0.19),
  )
  ctx.font = canvasFont(600, nameSize)
  ctx.fillText(truncate(ctx, person.name, maxWidth), w / 2, h * 0.44)

  // Filet séparateur nom / organisation : l'aile se lit aussi sous le cadre.
  ctx.strokeStyle = accent
  ctx.lineWidth = Math.max(2, Math.round(h * 0.016))
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(w * 0.36, h * 0.61)
  ctx.lineTo(w * 0.64, h * 0.61)
  ctx.stroke()

  const orgText = cartelOrganizationText(person, lang)
  ctx.fillStyle = cartel.org
  const orgSize = fitFontSize(
    (size) => {
      ctx.font = canvasFont(500, size)
      return ctx.measureText(orgText).width
    },
    maxWidth,
    Math.round(h * 0.19),
    Math.round(h * 0.12),
  )
  ctx.font = canvasFont(500, orgSize)
  ctx.fillText(truncate(ctx, orgText, maxWidth), w / 2, h * 0.84)
}

/** Cartel générique 256×96 (les cadres utilisent `drawFrameCartel`, 512×128, même dessin). */
const cartelCache = new Map<string, CanvasTexture>()
export function drawCartel(person: Person, lang: Lang): CanvasTexture {
  return cachedTexture(cartelCache, `${person.id}|${lang}`, () => paintedTexture(256, 96, (ctx) => paintCartelPlate(ctx, 256, 96, person, lang)))
}

/** Tronque `str` (avec « … ») pour tenir dans `maxWidth`, dans la police courante du contexte. */
export function truncate(ctx: CanvasRenderingContext2D, str: string, maxWidth: number): string {
  if (ctx.measureText(str).width <= maxWidth) return str
  let s = str
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s}…`
}

/**
 * Plus grande taille (px, jusqu'à `maxSize`, jamais sous `minSize`, par pas de 1 px) telle que
 * `measureWidth(size) <= maxWidth`. Pure — `measureWidth` est injecté plutôt qu'un `ctx` + un texte,
 * pour rester testable sans canvas 2D (indisponible en jsdom, voir `textures.test.ts`) : l'appelant
 * y règle `ctx.font` sur la taille candidate puis renvoie `ctx.measureText(text).width`.
 *
 * Une taille fixe déborde selon la langue : mesuré (`measureText`, `600 46px`, la police de
 * `paintBanner`), le titre FR ('Le Musée des 100') tient large (largeur ≈383 px sur un canvas de
 * 512 px, marge ≈65 px de chaque côté) mais l'EN ('The Museum of the 100') mesure ≈500 px (marge
 * ≈6 px, quasiment collé à la bordure) — les deux langues doivent retomber sur une police qui
 * laisse la même marge confortable, quel que soit le texte.
 */
export function fitFontSize(measureWidth: (size: number) => number, maxWidth: number, maxSize: number, minSize: number): number {
  let size = maxSize
  while (size > minSize && measureWidth(size) > maxWidth) size -= 1
  return size
}

// --- Bannière du hall ---

/** Grande bannière du hall : titre + filet corail + sous-titre en kicker (capitales espacées). */
const bannerCache = new Map<string, CanvasTexture>()
export function drawBanner(title: Localized, subtitle: Localized, lang: Lang): CanvasTexture {
  return cachedTexture(bannerCache, `${pick(title, lang)}|${pick(subtitle, lang)}`, () =>
    paintedTexture(512, 160, (ctx) => paintBanner(ctx, 512, 160, title, subtitle, lang)),
  )
}
function paintBanner(ctx: CanvasRenderingContext2D, w: number, h: number, title: Localized, subtitle: Localized, lang: Lang) {
  const banner = signage.banner
  // Charte de l'Odyssée : panneau bleu nuit, liseré corail, texte blanc pur, sous-titre corail.
  ctx.fillStyle = banner.fill
  roundRect(ctx, 0, 0, w, h, 22)
  ctx.fill()
  ctx.strokeStyle = banner.border
  ctx.lineWidth = 6
  roundRect(ctx, 6, 6, w - 12, h - 12, 18)
  ctx.stroke()

  // `fitFontSize` réduit la police pour l'EN, plus long, plutôt que de la laisser toucher le liseré.
  ctx.fillStyle = banner.title
  ctx.textAlign = 'center'
  const titleText = pick(title, lang)
  const titleSize = fitFontSize(
    (size) => {
      ctx.font = canvasFont(600, size)
      return ctx.measureText(titleText).width
    },
    w - 120,
    46,
    26,
  )
  ctx.font = canvasFont(600, titleSize)
  ctx.fillText(titleText, w / 2, 72)

  // Kicker : filet corail puis sous-titre en capitales espacées.
  ctx.fillStyle = banner.subtitle
  ctx.fillRect(w / 2 - 22, 98, 44, 3)
  const subtitleText = pick(subtitle, lang).toLocaleUpperCase(lang)
  const subtitleSize = fitFontSize(
    (size) => {
      ctx.font = canvasFont(500, size)
      return measureSpaced(ctx, subtitleText, size * 0.18)
    },
    w - 80,
    22,
    14,
  )
  ctx.font = canvasFont(500, subtitleSize)
  drawSpaced(ctx, subtitleText, w / 2, 128, subtitleSize * 0.18)
}

// --- Panneaux de porte ---

/** Petit pictogramme abstrait (jamais un logo réel) dessiné à `(cx, cy)`, rayon `r`, dans `color`. `hole` : couleur du fond, pour les détails évidés. */
function drawWingPictogram(ctx: CanvasRenderingContext2D, wing: ExhibitWingId, cx: number, cy: number, r: number, color: string, hole: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(2, r * 0.16)
  if (wing === 'infrastructures') {
    // Baie de serveurs : trois barres empilées, chacune avec un petit point (LED) évidé.
    const barH = r * 0.5
    for (let i = -1; i <= 1; i++) {
      const top = cy + i * barH - barH * 0.4
      ctx.fillStyle = color
      roundRect(ctx, cx - r, top, r * 2, barH * 0.7, barH * 0.15)
      ctx.fill()
      ctx.fillStyle = hole
      ctx.beginPath()
      ctx.arc(cx + r * 0.68, top + barH * 0.35, Math.max(1.2, r * 0.07), 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (wing === 'industrialisation') {
    // Roue dentée simplifiée : disque évidé au centre + petites dents radiales.
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
    ctx.fillStyle = hole
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Palette de conservateur : blob arrondi + trois pastilles évidées.
    ctx.beginPath()
    ctx.ellipse(cx, cy, r, r * 0.75, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = hole
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(cx - r * 0.4 + i * r * 0.4, cy + (i % 2 ? -1 : 1) * r * 0.15, r * 0.16, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** Panneau fléché du nom d'une aile : fond nuit, contour + pictogramme + flèche à la couleur de l'aile, libellé blanc. */
const wingPanelCache = new Map<string, CanvasTexture>()
export function drawWingPanel(wing: ExhibitWingId, label: Localized, accentColor: string, lang: Lang): CanvasTexture {
  return cachedTexture(wingPanelCache, `${wing}|${pick(label, lang)}|${accentColor}`, () =>
    paintedTexture(256, 96, (ctx) => paintWingPanel(ctx, 256, 96, wing, label, accentColor, lang)),
  )
}
function paintWingPanel(ctx: CanvasRenderingContext2D, w: number, h: number, wing: ExhibitWingId, label: Localized, accentColor: string, lang: Lang) {
  const panel = signage.wingPanel
  ctx.fillStyle = panel.fill
  roundRect(ctx, 0, 0, w, h, 16)
  ctx.fill()
  ctx.strokeStyle = accentColor
  ctx.lineWidth = 5
  roundRect(ctx, 2.5, 2.5, w - 5, h - 5, 14)
  ctx.stroke()
  drawWingPictogram(ctx, wing, 34, h / 2, 20, accentColor, panel.fill)

  ctx.fillStyle = panel.text
  ctx.textAlign = 'left'
  const labelText = pick(label, lang)
  const labelWidth = w - 74
  const labelSize = fitFontSize(
    (size) => {
      ctx.font = canvasFont(600, size)
      return ctx.measureText(labelText).width
    },
    labelWidth,
    26,
    16,
  )
  ctx.font = canvasFont(600, labelSize)
  ctx.fillText(truncate(ctx, labelText, labelWidth), 64, h * 0.44)

  // Petite flèche vers le bas (« par ici ») sous le nom, tracée (aucune dépendance à un glyphe de police).
  ctx.strokeStyle = accentColor
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(72, h * 0.58)
  ctx.lineTo(72, h * 0.8)
  ctx.moveTo(65, h * 0.72)
  ctx.lineTo(72, h * 0.8)
  ctx.lineTo(79, h * 0.72)
  ctx.stroke()
}

/** Plaque « Bientôt » d'une aile sans aucune personne : fond nuit, contour magenta (accès fermé, seul usage du magenta en 3D), texte blanc. */
const comingSoonCache = new Map<string, CanvasTexture>()
export function drawComingSoonPanel(lang: Lang): CanvasTexture {
  return cachedTexture(comingSoonCache, lang, () => paintedTexture(256, 96, (ctx) => paintComingSoonPanel(ctx, 256, 96, lang)))
}
function paintComingSoonPanel(ctx: CanvasRenderingContext2D, w: number, h: number, lang: Lang) {
  const panel = signage.comingSoon
  ctx.fillStyle = panel.fill
  roundRect(ctx, 0, 0, w, h, 16)
  ctx.fill()
  ctx.strokeStyle = panel.border
  ctx.lineWidth = 3
  roundRect(ctx, 5, 5, w - 10, h - 10, 12)
  ctx.stroke()
  ctx.fillStyle = panel.text
  ctx.textAlign = 'center'
  const label = pick(worldStrings.wingComingSoon, lang)
  const size = fitFontSize(
    (s) => {
      ctx.font = canvasFont(600, s)
      return ctx.measureText(label).width
    },
    w - 40,
    30,
    18,
  )
  ctx.font = canvasFont(600, size)
  ctx.fillText(label, w / 2, baselineFor(h / 2, size))
}

// --- Plaque du comptoir d'accueil ---

/** Plaque du comptoir d'accueil : nom + fonction, fond nuit, contour corail. */
const curatorPlateCache = new Map<string, CanvasTexture>()
export function drawCuratorPlate(lang: Lang): CanvasTexture {
  return cachedTexture(curatorPlateCache, lang, () => paintedTexture(256, 80, (ctx) => paintCuratorPlate(ctx, 256, 80, lang)))
}
function paintCuratorPlate(ctx: CanvasRenderingContext2D, w: number, h: number, lang: Lang) {
  const plate = signage.plate
  ctx.fillStyle = plate.fill
  roundRect(ctx, 0, 0, w, h, 10)
  ctx.fill()
  ctx.strokeStyle = plate.border
  ctx.lineWidth = 3
  roundRect(ctx, 1.5, 1.5, w - 3, h - 3, 9)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = plate.name
  ctx.font = canvasFont(600, 26)
  ctx.fillText(pick(worldStrings.curatorName, lang), w / 2, h * 0.46)
  ctx.fillStyle = plate.title
  ctx.font = canvasFont(500, 16)
  ctx.fillText(pick(worldStrings.curatorTitle, lang), w / 2, h * 0.78)
}
