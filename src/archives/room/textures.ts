/**
 * Textures canvas 2D de la salle des Archives (capsules holographiques, frise au sol, panneaux de la
 * Porte de 2040). Même conventions que `src/world/textures.ts` : aucune police externe (`system-ui`),
 * textures ≤ 512 px, tout est mis en cache (jamais redessiné hors bascule FR/EN ou changement d'état).
 */
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { AABB, ArchiveSlot, EveningSession, Lang, SessionKind } from '../../types'
import { pick } from '../../i18n'
import { wingThemes } from '../../styles/tokens'
import { archivesRoomStrings, sessionKindLabels } from '../strings'

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

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s}…`
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
      // Clap de cinéma : rectangle + bande biseautée.
      roundRect(ctx, cx - r, cy - r * 0.5, r * 2, r, r * 0.12)
      ctx.fill()
      ctx.fillStyle = wingThemes.archives.wall
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
 * Capsule holographique d'une vitrine : pictogramme, titre et heure. Jamais de synthèse ni de
 * citation ici (voir `ArchiveCard.tsx`, propriétaire d'une autre phase) — seul l'état (archivée/en
 * attente) change la teinte, jamais le texte affiché sur cette petite texture.
 */
const capsuleCache = new Map<string, CanvasTexture>()
export function drawCapsuleScreen(session: Pick<EveningSession, 'kind' | 'title' | 'startTime'>, lang: Lang, archived: boolean): CanvasTexture {
  const key = `${session.kind}|${pick(session.title, lang)}|${session.startTime}|${lang}|${archived}`
  return cachedTexture(capsuleCache, key, () => paintCapsuleScreen(session, lang, archived))
}
function paintCapsuleScreen(session: Pick<EveningSession, 'kind' | 'title' | 'startTime'>, lang: Lang, archived: boolean): CanvasTexture {
  const w = 320
  const h = 224
  const { canvas, ctx } = context2d(w, h)
  const tint = archived ? '#e8c872' : '#7fd6e8'

  // Fond translucide bleu nuit, bordure lumineuse à la teinte d'état.
  ctx.fillStyle = 'rgba(15, 22, 43, 0.92)'
  roundRect(ctx, 0, 0, w, h, 20)
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = tint
  roundRect(ctx, 4, 4, w - 8, h - 8, 17)
  ctx.stroke()

  drawSessionPictogram(ctx, session.kind, w / 2, 62, 34, tint)

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '700 26px system-ui, sans-serif'
  const titleText = truncate(ctx, pick(session.title, lang), w - 36)
  ctx.fillText(titleText, w / 2, 138)

  ctx.font = '600 20px system-ui, sans-serif'
  ctx.fillStyle = tint
  ctx.fillText(session.startTime, w / 2, 170)

  ctx.font = '500 15px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(pick(sessionKindLabels[session.kind], lang), w / 2, 196)

  return toTexture(canvas)
}

/**
 * Grand sol de la galerie : bleu nuit + frise chronologique, un chemin lumineux doux qui serpente
 * d'une vitrine à l'autre dans l'ordre du programme (voir `layout.ts::buildCandidates`, rangées en
 * serpentin — sans quoi ce tracé reviendrait d'un bord à l'autre de la salle à chaque rangée). Une
 * seule texture pour toute la salle (1 appel de dessin), mappée directement sur le plan du sol (voir
 * `RoomShell.tsx`).
 *
 * L'heure de chaque séquence n'est PLUS peinte ici : à la résolution de cette texture (512 px pour
 * toute la salle, contrainte mobile), les libellés se chevauchaient et étaient coupés dès que deux
 * rangées se rapprochaient (constat de la vérification visuelle). Chaque vitrine porte déjà SON heure,
 * bien plus lisible, sur l'écran de sa capsule (`drawCapsuleScreen`) : le sol garde seulement le tracé
 * et un repère discret par vitrine, jamais un second horaire redondant « peint en grand ».
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
  const { canvas, ctx } = context2d(w, h)

  const toPx = (x: number, z: number) => ({ px: ((x - bounds.minX) / worldW) * w, py: ((z - bounds.minZ) / worldD) * h })

  // Fond bleu nuit doux (couleur de la salle, voir wingThemes.archives.floor), un peu plus sombre vers
  // les bords (effet de profondeur léger, jamais un fond noir : régression constatée à la vérification
  // visuelle — un fond `palette.shadow` presque noir écrasait toute la salle).
  ctx.fillStyle = wingThemes.archives.floor
  ctx.fillRect(0, 0, w, h)
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.max(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.75)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(20, 26, 46, 0.35)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)

  if (slots.length > 0) {
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    // Chemin lumineux doux : une passe large et très translucide (lueur) puis une passe fine et vive
    // (le trait) — jamais un simple trait dur, pour rester « 2040 mais cosy ».
    ctx.beginPath()
    slots.forEach((s, i) => {
      const { px, py } = toPx(s.position[0], s.position[2])
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.strokeStyle = 'rgba(127, 214, 232, 0.28)'
    ctx.lineWidth = 13
    ctx.stroke()
    ctx.strokeStyle = 'rgba(191, 235, 245, 0.85)'
    ctx.lineWidth = 4
    ctx.stroke()

    slots.forEach((s) => {
      const { px, py } = toPx(s.position[0], s.position[2])
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 15)
      glow.addColorStop(0, 'rgba(191, 235, 245, 0.55)')
      glow.addColorStop(1, 'rgba(191, 235, 245, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(px, py, 15, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f4fbfd'
      ctx.beginPath()
      ctx.arc(px, py, 4.5, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  return toTexture(canvas)
}

/** Panneau de la Porte de 2040 (aller, dans le hall, ou retour, dans la salle). */
const gateCache = new Map<string, CanvasTexture>()
export function drawGateSign(subtitleKey: 'toArchives' | 'toHall', lang: Lang): CanvasTexture {
  return cachedTexture(gateCache, `${subtitleKey}|${lang}`, () => paintGateSign(subtitleKey, lang))
}
function paintGateSign(subtitleKey: 'toArchives' | 'toHall', lang: Lang): CanvasTexture {
  const w = 256
  const h = 128
  const { canvas, ctx } = context2d(w, h)
  ctx.fillStyle = 'rgba(15, 22, 43, 0.92)'
  roundRect(ctx, 0, 0, w, h, 18)
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = '#7fd6e8'
  roundRect(ctx, 4, 4, w - 8, h - 8, 15)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '700 28px system-ui, sans-serif'
  ctx.fillText(pick(archivesRoomStrings.gateTitle, lang), w / 2, h * 0.42)
  ctx.font = '500 17px system-ui, sans-serif'
  ctx.fillStyle = '#7fd6e8'
  const subtitle = subtitleKey === 'toArchives' ? archivesRoomStrings.gateSubtitleToArchives : archivesRoomStrings.gateSubtitleToHall
  ctx.fillText(pick(subtitle, lang), w / 2, h * 0.72)
  return toTexture(canvas)
}

/**
 * Grand panneau d'entrée (titre de la salle + date de la soirée + mention « provisoire ») : posé bien
 * en vue depuis l'arrivée, comme la grande bannière du hall (voir docs/DESIGN.md). Remplace l'ancien
 * petit bandeau « Programme provisoire » isolé — un seul panneau, plus lisible, porte toute
 * l'information plutôt que de l'éparpiller.
 */
const entranceSignCache = new Map<string, CanvasTexture>()
export function drawEntranceSign(lang: Lang): CanvasTexture {
  return cachedTexture(entranceSignCache, lang, () => paintEntranceSign(lang))
}
function paintEntranceSign(lang: Lang): CanvasTexture {
  const w = 512
  const h = 176
  const { canvas, ctx } = context2d(w, h)
  ctx.fillStyle = 'rgba(15, 22, 43, 0.94)'
  roundRect(ctx, 0, 0, w, h, 22)
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = '#e8c872'
  roundRect(ctx, 5, 5, w - 10, h - 10, 18)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 34px system-ui, sans-serif'
  ctx.fillText(pick(archivesRoomStrings.roomLabel, lang), w / 2, h * 0.4)

  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillStyle = '#7fd6e8'
  ctx.fillText(pick(archivesRoomStrings.eveningDate, lang), w / 2, h * 0.64)

  ctx.font = '500 16px system-ui, sans-serif'
  ctx.fillStyle = '#e8c872'
  ctx.fillText(pick(archivesRoomStrings.provisionalBanner, lang), w / 2, h * 0.86)
  return toTexture(canvas)
}

/**
 * Plafond de la salle : une voûte sombre et douce (jamais un noir plat) avec quelques lueurs
 * éparses, pour fermer la vue vers le haut sans faire caisson opaque. Une seule texture, réutilisée
 * telle quelle (mêmes bounds pour toute la salle, pas de dépendance à la langue ni au programme).
 */
let ceilingCached: CanvasTexture | null = null
export function archivesCeilingTexture(): CanvasTexture {
  if (ceilingCached) return ceilingCached
  const w = 256
  const h = 256
  const { canvas, ctx } = context2d(w, h)
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.72)
  g.addColorStop(0, '#232c4d')
  g.addColorStop(1, '#11162b')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // Semis d'étoiles discret, disposition fixe (déterministe) plutôt que `Math.random()`.
  for (let i = 0; i < 46; i++) {
    const a = i * 2.399963 // angle doré : répartition régulière sans motif visible
    const r = Math.sqrt(i / 46) * w * 0.48
    const x = w / 2 + Math.cos(a) * r
    const y = h / 2 + Math.sin(a) * r
    const s = 0.6 + ((i * 37) % 5) * 0.22
    ctx.fillStyle = i % 5 === 0 ? 'rgba(232, 200, 114, 0.55)' : 'rgba(191, 235, 245, 0.45)'
    ctx.beginPath()
    ctx.arc(x, y, s, 0, Math.PI * 2)
    ctx.fill()
  }
  ceilingCached = toTexture(canvas)
  return ceilingCached
}

/**
 * Halo posé sur le mur nord, derrière l'Archiviste : casse le grand aplat de mur nu constaté à la
 * vérification visuelle (vue « fond de salle »), sans concurrencer l'hologramme lui-même (pas de
 * forme figurative ici, juste une lueur diffuse cyan → or).
 */
let archivistBackdropCached: CanvasTexture | null = null
export function drawArchivistBackdrop(): CanvasTexture {
  if (archivistBackdropCached) return archivistBackdropCached
  const w = 256
  const h = 256
  const { canvas, ctx } = context2d(w, h)
  const g = ctx.createRadialGradient(w / 2, h * 0.6, 0, w / 2, h * 0.6, w * 0.55)
  g.addColorStop(0, 'rgba(127, 214, 232, 0.5)')
  g.addColorStop(0.6, 'rgba(232, 200, 114, 0.16)')
  g.addColorStop(1, 'rgba(232, 200, 114, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  archivistBackdropCached = toTexture(canvas)
  return archivistBackdropCached
}

/** Petite bulle « ! » flottante au-dessus d'une vitrine proche (même esprit que `world/bubbleTexture.ts`). */
let bubbleCached: CanvasTexture | null = null
export function archivesBubbleTexture(): CanvasTexture {
  if (bubbleCached) return bubbleCached
  const size = 64
  const { canvas, ctx } = context2d(size, size)
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
  ctx.fillStyle = '#7fd6e8'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#0f162b'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 34px system-ui, sans-serif'
  ctx.fillText('!', size / 2, size / 2 + 2)
  bubbleCached = toTexture(canvas)
  return bubbleCached
}
