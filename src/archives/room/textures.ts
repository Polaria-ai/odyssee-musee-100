/**
 * Textures canvas 2D de la salle des Archives (capsules holographiques, frise au sol, panneau d'entrée,
 * bandeau de la porte, bulle « ! »). Textures ≤ 512 px, toutes mises en cache (jamais redessinées hors
 * bascule FR/EN ou changement d'état).
 *
 * Charte 3D du 29/09/2026 (`docs/CHARTE-3D.md` §4.8 et §4.9) : fond nuit, texte blanc pur, cyan pour
 * l'identité de la salle, cyan vif pour l'état « en attente », corail pour l'état « archivé ». Aucune
 * couleur en dur ici : tout vient de `charter3d.archives`. Poppins (≤ 600) pour les mots, JetBrains Mono
 * (≤ 500) pour les heures, via `canvasFont` ; `paintedTexture` (module monde) repeint en place une
 * texture dessinée avant le chargement des polices.
 */
import type { CanvasTexture } from 'three'
import type { AABB, ArchiveSlot, EveningSession, Lang, SessionKind } from '../../types'
import { pick } from '../../i18n'
import { charter3d } from '../../styles/tokens'
import { canvasFont, paintedTexture, spacedGlyphOffsets } from '../../world/textures'
import { archivesRoomStrings, sessionKindLabels } from '../strings'

const { archives: charter, base } = charter3d
const { vitrine } = charter

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Même couleur `rgba(...)` avec une autre opacité : bout transparent d'un dégradé, sans recopier la teinte. */
export function withAlpha(rgba: string, alpha: number): string {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)$/.exec(rgba)
  if (!m) throw new Error(`rgba() attendu : ${rgba}`)
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`
}

function truncate(ctx: CanvasRenderingContext2D, str: string, maxWidth: number): string {
  if (ctx.measureText(str).width <= maxWidth) return str
  let s = str
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s}…`
}

/** Taille de police (≤ `start`) pour que `str` tienne dans `maxWidth`, dans la police du contexte. */
function fitSize(ctx: CanvasRenderingContext2D, str: string, maxWidth: number, weight: number, start: number, min: number): number {
  let size = start
  ctx.font = canvasFont(weight, size)
  while (size > min && ctx.measureText(str).width > maxWidth) {
    size -= 1
    ctx.font = canvasFont(weight, size)
  }
  return size
}

/** Capitales espacées (kicker), dessinées caractère par caractère : `ctx.letterSpacing` n'est pas universel. */
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

function cachedTexture(cache: Map<string, CanvasTexture>, key: string, draw: () => CanvasTexture): CanvasTexture {
  let tex = cache.get(key)
  if (!tex) {
    tex = draw()
    cache.set(key, tex)
  }
  return tex
}

/** Petit pictogramme abstrait par type de séquence (jamais un logo réel), dessiné à `(cx, cy)`, rayon `r`. */
export function drawSessionPictogram(ctx: CanvasRenderingContext2D, kind: SessionKind, cx: number, cy: number, r: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(2, r * 0.16)
  ctx.lineCap = 'round'
  switch (kind) {
    case 'ouverture': {
      // Éclat : petit disque + rayons courts.
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2)
      ctx.fill()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55)
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        ctx.stroke()
      }
      break
    }
    case 'film': {
      // Clap de cinéma : rectangle + bande biseautée (les biseaux reprennent le fond de l'écran).
      roundRect(ctx, cx - r, cy - r * 0.5, r * 2, r, r * 0.12)
      ctx.fill()
      ctx.fillStyle = base.nuit
      for (let i = -3; i <= 2; i++) {
        ctx.beginPath()
        ctx.moveTo(cx + i * r * 0.34, cy - r * 0.9)
        ctx.lineTo(cx + i * r * 0.34 + r * 0.22, cy - r * 0.9)
        ctx.lineTo(cx + i * r * 0.34 + r * 0.1, cy - r * 0.5)
        ctx.lineTo(cx + i * r * 0.34 - r * 0.12, cy - r * 0.5)
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 'keynote': {
      // Micro : capsule + pied.
      roundRect(ctx, cx - r * 0.28, cy - r, r * 0.56, r * 1.1, r * 0.28)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(cx, cy + r * 0.1)
      ctx.lineTo(cx, cy + r)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.4, cy + r)
      ctx.lineTo(cx + r * 0.4, cy + r)
      ctx.stroke()
      break
    }
    case 'presentation': {
      // Chevalet : écran + pied triangulaire.
      roundRect(ctx, cx - r * 0.85, cy - r * 0.7, r * 1.7, r * 1.1, r * 0.1)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(cx, cy + r * 0.4)
      ctx.lineTo(cx - r * 0.35, cy + r)
      ctx.lineTo(cx + r * 0.35, cy + r)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'les100': {
      // Trois portraits en ligne (écho du pictogramme des 100, sans le reprendre à l'identique).
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.arc(cx + i * r * 0.62, cy, r * 0.28, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'magneto': {
      // Lecture : triangle « play » dans un cercle (dataviz vidéo).
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2)
      ctx.lineWidth = Math.max(2, r * 0.14)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.28, cy - r * 0.4)
      ctx.lineTo(cx - r * 0.28, cy + r * 0.4)
      ctx.lineTo(cx + r * 0.4, cy)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'table-ronde': {
      // Table ronde vue de dessus : cercle + petits sièges autour.
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
      ctx.fill()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85, r * 0.16, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'face-a-face': {
      // Deux flèches qui se font face.
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.9, cy)
      ctx.lineTo(cx - r * 0.1, cy)
      ctx.moveTo(cx - r * 0.3, cy - r * 0.3)
      ctx.lineTo(cx - r * 0.1, cy)
      ctx.lineTo(cx - r * 0.3, cy + r * 0.3)
      ctx.moveTo(cx + r * 0.9, cy)
      ctx.lineTo(cx + r * 0.1, cy)
      ctx.moveTo(cx + r * 0.3, cy - r * 0.3)
      ctx.lineTo(cx + r * 0.1, cy)
      ctx.lineTo(cx + r * 0.3, cy + r * 0.3)
      ctx.stroke()
      break
    }
    case 'final': {
      // Étoile à 4 branches (bouquet final).
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2
        const a2 = a + Math.PI / 4
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        ctx.lineTo(cx + Math.cos(a2) * r * 0.4, cy + Math.sin(a2) * r * 0.4)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'cloture': {
      // Porte + flèche de sortie.
      roundRect(ctx, cx - r * 0.5, cy - r, r * 0.8, r * 2, r * 0.08)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.1, cy)
      ctx.lineTo(cx + r * 0.7, cy)
      ctx.moveTo(cx + r * 0.42, cy - r * 0.28)
      ctx.lineTo(cx + r * 0.7, cy)
      ctx.lineTo(cx + r * 0.42, cy + r * 0.28)
      ctx.stroke()
      break
    }
  }
  ctx.restore()
}

/**
 * Capsule holographique d'une vitrine : pictogramme, titre, heure et type. La transcription est
 * consultable dans `ArchiveCard.tsx`; seul l'état (publiée/en attente) change ici la teinte.
 */
const capsuleCache = new Map<string, CanvasTexture>()
export function drawCapsuleScreen(session: Pick<EveningSession, 'kind' | 'title' | 'startTime'>, lang: Lang, archived: boolean): CanvasTexture {
  const key = `${session.kind}|${pick(session.title, lang)}|${session.startTime}|${lang}|${archived}`
  return cachedTexture(capsuleCache, key, () => paintCapsuleScreen(session, lang, archived))
}
function paintCapsuleScreen(session: Pick<EveningSession, 'kind' | 'title' | 'startTime'>, lang: Lang, archived: boolean): CanvasTexture {
  const w = 320
  const h = 224
  const tint = archived ? vitrine.screenArchived : vitrine.screenIdle
  return paintedTexture(w, h, (ctx) => {
    // Fond nuit translucide, bordure lumineuse à la teinte d'état.
    ctx.fillStyle = vitrine.screenFill
    roundRect(ctx, 0, 0, w, h, 20)
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = tint
    roundRect(ctx, 4, 4, w - 8, h - 8, 17)
    ctx.stroke()

    drawSessionPictogram(ctx, session.kind, w / 2, 62, 34, tint)

    ctx.fillStyle = vitrine.screenText
    ctx.textAlign = 'center'
    ctx.font = canvasFont(600, 25)
    ctx.fillText(truncate(ctx, pick(session.title, lang), w - 36), w / 2, 136)

    // L'heure, en chiffres : JetBrains Mono.
    ctx.font = canvasFont(500, 22, 'mono')
    ctx.fillStyle = tint
    ctx.fillText(session.startTime, w / 2, 170)

    // Type de séquence : kicker (capitales espacées).
    ctx.font = canvasFont(500, 13)
    ctx.fillStyle = vitrine.screenSub
    drawSpaced(ctx, pick(sessionKindLabels[session.kind], lang).toLocaleUpperCase(lang), w / 2, 199, 2.4)
  })
}

/**
 * Grand sol de la galerie : bleu profond de la charte + frise chronologique, un chemin lumineux doux qui
 * serpente d'une vitrine à l'autre dans l'ordre du programme (voir `layout.ts::buildCandidates`, rangées
 * en serpentin — sans quoi ce tracé reviendrait d'un bord à l'autre de la salle à chaque rangée). Une
 * seule texture pour toute la salle (1 appel de dessin), mappée directement sur le plan du sol (voir
 * `RoomShell.tsx`).
 *
 * L'heure de chaque séquence n'est PAS peinte ici : à la résolution de cette texture (512 px pour toute
 * la salle, contrainte mobile), les libellés se chevauchaient et étaient coupés dès que deux rangées se
 * rapprochaient. Chaque vitrine porte déjà SON heure, bien plus lisible, sur l'écran de sa capsule
 * (`drawCapsuleScreen`) : le sol garde seulement le tracé et un repère discret par vitrine.
 */
const floorCache = new Map<string, CanvasTexture>()
export function drawArchivesFloor(bounds: AABB, slots: ArchiveSlot[], lang: Lang): CanvasTexture {
  const key = `${bounds.minX}|${bounds.maxZ}|${slots.map((s) => `${s.position[0]},${s.position[2]}`).join(';')}|${lang}`
  return cachedTexture(floorCache, key, () => paintArchivesFloor(bounds, slots))
}
function paintArchivesFloor(bounds: AABB, slots: ArchiveSlot[]): CanvasTexture {
  const worldW = bounds.maxX - bounds.minX
  const worldD = bounds.maxZ - bounds.minZ
  const w = 512
  const h = Math.round((worldD / worldW) * 512)
  const floor = charter.floor

  const toPx = (x: number, z: number) => ({ px: ((x - bounds.minX) / worldW) * w, py: ((z - bounds.minZ) / worldD) * h })

  return paintedTexture(w, h, (ctx) => {
    // Fond : le bleu profond du sol de tout le musée, un peu plus sombre vers les bords (profondeur douce
    // vers `nuitProfond`, jamais un fond noir : régression constatée à la vérification visuelle).
    ctx.fillStyle = floor.base
    ctx.fillRect(0, 0, w, h)
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.max(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.75)
    vignette.addColorStop(0, withAlpha(floor.vignetteEdge, 0))
    vignette.addColorStop(1, floor.vignetteEdge)
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, w, h)

    if (slots.length === 0) return
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    // Chemin lumineux : une passe large et translucide (lueur) puis une passe fine et vive (le trait).
    ctx.beginPath()
    slots.forEach((s, i) => {
      const { px, py } = toPx(s.position[0], s.position[2])
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.strokeStyle = floor.pathGlow
    ctx.lineWidth = 13
    ctx.stroke()
    ctx.strokeStyle = floor.pathLine
    ctx.lineWidth = 4
    ctx.stroke()

    slots.forEach((s) => {
      const { px, py } = toPx(s.position[0], s.position[2])
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 15)
      glow.addColorStop(0, floor.nodeGlow)
      glow.addColorStop(1, withAlpha(floor.nodeGlow, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(px, py, 15, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = floor.node
      ctx.beginPath()
      ctx.arc(px, py, 4.5, 0, Math.PI * 2)
      ctx.fill()
    })
  })
}

/**
 * Grand panneau d'entrée (titre de la salle + date de la soirée + mention « provisoire ») : posé bien
 * en vue depuis l'arrivée, comme la grande bannière du hall (voir docs/DESIGN.md). Un seul panneau, plus
 * lisible, porte toute l'information plutôt que de l'éparpiller.
 */
const entranceSignCache = new Map<string, CanvasTexture>()
export function drawEntranceSign(lang: Lang): CanvasTexture {
  return cachedTexture(entranceSignCache, lang, () => paintEntranceSign(lang))
}
function paintEntranceSign(lang: Lang): CanvasTexture {
  const w = 512
  const h = 176
  const sign = charter.sign
  return paintedTexture(w, h, (ctx) => {
    ctx.fillStyle = sign.fill
    roundRect(ctx, 0, 0, w, h, 22)
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = sign.border
    roundRect(ctx, 5, 5, w - 10, h - 10, 18)
    ctx.stroke()

    // Filet du kicker (cyan de la salle).
    ctx.fillStyle = sign.border
    ctx.fillRect(w / 2 - 14, 24, 28, 3)

    ctx.textAlign = 'center'
    ctx.fillStyle = sign.title
    const title = pick(archivesRoomStrings.roomLabel, lang)
    ctx.font = canvasFont(600, fitSize(ctx, title, w - 60, 600, 34, 22))
    ctx.fillText(title, w / 2, h * 0.43)

    ctx.font = canvasFont(600, 18)
    ctx.fillStyle = sign.date
    ctx.fillText(pick(archivesRoomStrings.eveningDate, lang), w / 2, h * 0.66)

    const provisional = pick(archivesRoomStrings.provisionalBanner, lang)
    ctx.font = canvasFont(500, fitSize(ctx, provisional, w - 50, 500, 16, 11))
    ctx.fillStyle = sign.provisional
    ctx.fillText(provisional, w / 2, h * 0.88)
  })
}

/**
 * Bandeau posé sur le linteau de la porte, côté salle : « Les Archives de 2040 ». Fond nuit, contour cyan
 * de la salle, titre blanc ; deux petites séries de barres cyan en écho aux scanlines du logo.
 */
const bannerCache = new Map<string, CanvasTexture>()
export function drawArchivesBanner(lang: Lang): CanvasTexture {
  return cachedTexture(bannerCache, lang, () => paintArchivesBanner(lang))
}
function paintArchivesBanner(lang: Lang): CanvasTexture {
  const w = 512
  const h = 99
  const sign = charter.sign
  return paintedTexture(w, h, (ctx) => {
    ctx.fillStyle = base.nuit
    roundRect(ctx, 0, 0, w, h, 16)
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = sign.border
    roundRect(ctx, 4, 4, w - 8, h - 8, 13)
    ctx.stroke()

    // Scanlines décoratives de part et d'autre du titre (barres de plus en plus courtes vers le titre).
    ctx.fillStyle = sign.date
    const bars = [44, 36, 28, 20]
    bars.forEach((len, i) => {
      const y = 26 + i * 15
      ctx.fillRect(28, y, len, 6)
      ctx.fillRect(w - 28 - len, y, len, 6)
    })

    const title = pick(archivesRoomStrings.roomLabel, lang)
    ctx.textAlign = 'center'
    ctx.fillStyle = sign.title
    ctx.font = canvasFont(600, fitSize(ctx, title, w - 190, 600, 40, 22))
    ctx.fillText(title, w / 2, h / 2 + 13)
  })
}

/** Petite bulle « ! » flottante au-dessus d'une vitrine proche (même esprit que `world/bubbleTexture.ts`). */
let bubbleCached: CanvasTexture | null = null
export function archivesBubbleTexture(): CanvasTexture {
  if (bubbleCached) return bubbleCached
  const size = 64
  const bubble = charter.bubble
  bubbleCached = paintedTexture(size, size, (ctx) => {
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
    ctx.fillStyle = bubble.fill
    ctx.fill()
    ctx.strokeStyle = bubble.stroke
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = bubble.glyph
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = canvasFont(600, 34)
    ctx.fillText('!', size / 2, size / 2 + 2)
  })
  return bubbleCached
}
