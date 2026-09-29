/**
 * Garde-fous de la charte 3D (`charter3d`, docs/CHARTE-3D.md) : dérivations documentées, palette fermée
 * (aucune teinte chaude ou hors charte qui se glisse dans un décor), contrastes AA de tous les textes
 * peints dans les canvas, hiérarchie de luminance ciel < sol < mur sous les lumières de la scène, et
 * compatibilité des exports historiques. Pur (aucun three.js, aucun canvas).
 */
import { describe, expect, it } from 'vitest'
import { archivesDoor, cameraPositionFor, cameraRig, charter3d, dims, eventPalette, exhibitWingOrder, palette, wingThemes } from './tokens'

// --- Couleur : utilitaires purs -------------------------------------------------------------------

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(c: Rgb): string {
  return `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
}

const toLinear = (v: number): number => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const toSrgb = (v: number): number => {
  const c = Math.max(0, Math.min(1, v))
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Mélange sRGB (comme la dérivation documentée) : `a` vers `b` de `t`. */
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t) as Rgb)
}

interface Rgba {
  rgb: Rgb
  alpha: number
}

function parseRgba(css: string): Rgba {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(css)
  if (!m) throw new Error(`rgba() attendu: ${css}`)
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number(m[4]) }
}

/** Couleur d'un `rgba()` posé sur un fond opaque. */
function over(css: string, background: string): string {
  const { rgb, alpha } = parseRgba(css)
  const bg = hexToRgb(background)
  return rgbToHex(rgb.map((v, i) => v * alpha + bg[i] * (1 - alpha)) as Rgb)
}

// --- Modèle de rendu (three r186, `<Canvas flat>`) : sortie = albédo × E / π ------------------------

type Vec3 = [number, number, number]
const NORMALS = { up: [0, 1, 0], front: [0, 0, 1], sideLit: [1, 0, 0], sideShade: [-1, 0, 0] } as const satisfies Record<string, Vec3>

function irradiance(n: Vec3): Rgb {
  const { hemisphere, directional } = charter3d.scene
  const d = directional.position
  const len = Math.hypot(...d)
  const nl = Math.max(0, (n[0] * d[0] + n[1] * d[1] + n[2] * d[2]) / len)
  const w = 0.5 * n[1] + 0.5
  const sky = hexToRgb(hemisphere.sky).map(toLinear)
  const ground = hexToRgb(hemisphere.ground).map(toLinear)
  const dir = hexToRgb(directional.color).map(toLinear)
  return [0, 1, 2].map((i) => (ground[i] + (sky[i] - ground[i]) * w) * hemisphere.intensity + dir[i] * directional.intensity * nl) as Rgb
}

function rendered(albedo: string, n: Vec3): string {
  const e = irradiance(n)
  const a = hexToRgb(albedo).map(toLinear)
  return rgbToHex(a.map((v, i) => toSrgb((v * e[i]) / Math.PI)) as Rgb)
}

// --- Collecte des couleurs littérales de la charte -------------------------------------------------

function collectColors(node: unknown, out: { hex: string[]; rgba: string[] }): void {
  if (typeof node === 'string') {
    if (/^#[0-9a-f]{6}$/i.test(node)) out.hex.push(node.toLowerCase())
    else if (node.startsWith('rgba(')) out.rgba.push(node)
    return
  }
  if (node && typeof node === 'object') for (const v of Object.values(node)) collectColors(v, out)
}

const { base, rooms } = charter3d

describe('charter3d — dérivations documentées', () => {
  it('brume, mur et teintes de sol sont les mélanges annoncés', () => {
    expect(base.brume).toBe(mix(base.blanc, base.bleuNeon, 0.12))
    expect(base.mur).toBe(mix(base.bleu, base.blanc, 0.12))
    expect(rooms.hall.floorAlt).toBe(mix(base.bleuProfond, base.bleu, 0.35))
    expect(rooms.infrastructures.floorAlt).toBe(mix(base.bleuProfond, base.cyanVif, 0.12))
    expect(rooms.industrialisation.floorAlt).toBe(mix(base.bleuProfond, base.corail, 0.12))
    expect(rooms.culture.floor).toBe(mix(base.bleuProfond, base.bleu, 0.25))
    expect(rooms.archives.floorAlt).toBe(mix(base.bleuProfond, base.nuit, 0.55))
    expect(rooms.industrialisation.wallAlt).toBe(mix(base.mur, base.bleu, 0.5))
  })

  it('les jetons de base non dérivés sont ceux de la charte de l’événement', () => {
    expect(base.ciel).toBe(eventPalette.bleuNuit)
    expect(base.bleu).toBe(eventPalette.bleu)
    expect(base.bleuProfond).toBe(eventPalette.bleuDeep)
    expect(base.corail).toBe(eventPalette.corail)
    expect(base.corailProfond).toBe(eventPalette.corailDeep)
    expect(base.cyan).toBe(eventPalette.cyan)
    expect(base.cyanVif).toBe(eventPalette.cyanVif)
    expect(base.bleuNeon).toBe(eventPalette.bleuNeon)
    expect(base.magenta).toBe(eventPalette.alarm)
    expect(base.blanc).toBe('#ffffff')
  })

  it('trois zones : un accent par aile, celui de la charte', () => {
    expect(rooms.infrastructures.accent).toBe(base.cyanVif)
    expect(rooms.industrialisation.accent).toBe(base.corail)
    expect(rooms.culture.accent).toBe(base.bleuNeon)
    expect(rooms.hall.accent).toBe(base.corail)
    expect(rooms.archives.accent).toBe(base.cyan)
  })
})

describe('charter3d — palette fermée', () => {
  const allowedHex = new Set<string>([
    ...Object.values(base),
    rooms.hall.floorAlt,
    rooms.infrastructures.floorAlt,
    rooms.industrialisation.floorAlt,
    rooms.culture.floor,
    rooms.archives.floorAlt,
    rooms.industrialisation.wallAlt,
  ].map((h) => h.toLowerCase()))
  // Composantes autorisées dans un rgba() : couleurs de la charte seulement (le canal alpha varie).
  const allowedRgb = new Set<string>([base.blanc, base.nuit, base.nuitProfond, base.cyan, base.cyanVif, base.brume].map((h) => hexToRgb(h).join(',')))

  // Les couleurs des lumières (hémisphère, directionnelle, rayons) sont des LUMIÈRES blanc froid, pas des
  // matières : hors du contrôle de palette. Le fond et le brouillard, eux, restent contrôlés.
  const found = { hex: [] as string[], rgba: [] as string[] }
  collectColors({ ...charter3d, scene: { background: charter3d.scene.background, fog: charter3d.scene.fog } }, found)

  it('aucune couleur littérale hors charte (pas d’or, de bois, de crème, de vert feuille)', () => {
    const stray = [...new Set(found.hex)].filter((h) => !allowedHex.has(h))
    expect(stray, `couleurs hors charte : ${stray.join(', ')}`).toEqual([])
  })

  it('les rgba() ne mélangent que des couleurs de la charte', () => {
    const stray = found.rgba.filter((c) => !allowedRgb.has(parseRgba(c).rgb.join(',')))
    expect(stray, `rgba hors charte : ${stray.join(', ')}`).toEqual([])
  })

  it('le magenta n’a qu’un usage : l’accès fermé (barrière et plaque « Bientôt »)', () => {
    const users: string[] = []
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        if (node.toLowerCase() === base.magenta) users.push(path)
        return
      }
      if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k)
    }
    walk(charter3d, '')
    expect(users.sort()).toEqual(['base.magenta', 'furniture.rope.cordClosed', 'signage.comingSoon.border'])
  })

  it('graisse ≤ 600 pour Poppins (charte)', () => {
    expect(charter3d.text.maxWeight).toBeLessThanOrEqual(600)
  })
})

describe('charter3d — contrastes AA des textes peints dans les canvas', () => {
  const nuit = base.nuit
  const cases: Array<[string, string, string]> = [
    ['titre de la bannière', charter3d.signage.banner.title, charter3d.signage.banner.fill],
    ['sous-titre de la bannière', charter3d.signage.banner.subtitle, charter3d.signage.banner.fill],
    ['libellé d’un panneau de porte', charter3d.signage.wingPanel.text, charter3d.signage.wingPanel.fill],
    ['« Bientôt »', charter3d.signage.comingSoon.text, charter3d.signage.comingSoon.fill],
    ['plaque du comptoir d’accueil : nom', charter3d.signage.plate.name, charter3d.signage.plate.fill],
    ['plaque du comptoir d’accueil : fonction', over(charter3d.signage.plate.title, nuit), charter3d.signage.plate.fill],
    ['cartel : nom', charter3d.cartel.name, charter3d.cartel.fill],
    ['cartel : organisation', over(charter3d.cartel.org, nuit), charter3d.cartel.fill],
    ['toile d’attente : légende', over(charter3d.portrait.kicker, charter3d.portrait.fill), charter3d.portrait.fill],
    ['bulle « ! » du monde', charter3d.frame.bubble.glyph, charter3d.frame.bubble.fill],
    ['bulle « ! » des Archives', charter3d.archives.bubble.glyph, charter3d.archives.bubble.fill],
    ['panneau d’entrée : titre', charter3d.archives.sign.title, over(charter3d.archives.sign.fill, base.mur)],
    ['panneau d’entrée : date', charter3d.archives.sign.date, over(charter3d.archives.sign.fill, base.mur)],
    ['panneau d’entrée : mention provisoire', charter3d.archives.sign.provisional, over(charter3d.archives.sign.fill, base.mur)],
    ['écran de vitrine : titre', charter3d.archives.vitrine.screenText, over(charter3d.archives.vitrine.screenFill, base.cyan)],
    ['écran de vitrine : heure (en attente)', charter3d.archives.vitrine.screenIdle, over(charter3d.archives.vitrine.screenFill, base.cyan)],
    ['écran de vitrine : heure (archivée)', charter3d.archives.vitrine.screenArchived, over(charter3d.archives.vitrine.screenFill, base.corail)],
    ['écran de vitrine : type', over(charter3d.archives.vitrine.screenSub, over(charter3d.archives.vitrine.screenFill, base.cyan)), over(charter3d.archives.vitrine.screenFill, base.cyan)],
  ]
  it.each(cases)('%s ≥ 4,5:1', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(exhibitWingOrder)('numéro du portrait d’attente (aile %s) : encre sur bandeau d’accent ≥ 4,5:1', (wing) => {
    expect(contrast(charter3d.portrait.bandText, rooms[wing].accent)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(exhibitWingOrder)('aile %s : silhouette, filet, pictogramme et flèche sur la nuit ≥ 3:1 (éléments graphiques)', (wing) => {
    expect(contrast(rooms[wing].accent, charter3d.portrait.fill)).toBeGreaterThanOrEqual(3)
    expect(contrast(rooms[wing].accent, charter3d.signage.wingPanel.fill)).toBeGreaterThanOrEqual(3)
    expect(contrast(rooms[wing].accent, charter3d.cartel.fill)).toBeGreaterThanOrEqual(3)
  })

  it('le contour magenta de « Bientôt » reste visible sur la nuit (≥ 3:1)', () => {
    expect(contrast(charter3d.signage.comingSoon.border, charter3d.signage.comingSoon.fill)).toBeGreaterThanOrEqual(3)
  })
})

describe('charter3d — lumières et hiérarchie de luminance', () => {
  const sky = charter3d.scene.background
  const floor = (id: keyof typeof rooms) => rendered(rooms[id].floor, NORMALS.up)
  const wallFront = (id: keyof typeof rooms) => rendered(rooms[id].wall, NORMALS.front)

  it('les lumières laissent les sols ≈ à leur valeur et les murs vus de face à 75-90 %', () => {
    const up = irradiance(NORMALS.up).map((e) => e / Math.PI)
    const front = irradiance(NORMALS.front).map((e) => e / Math.PI)
    for (const g of up) expect(g).toBeGreaterThan(0.88)
    for (const g of up) expect(g).toBeLessThan(1.06)
    for (const g of front) expect(g).toBeGreaterThan(0.75)
    for (const g of front) expect(g).toBeLessThan(0.98)
  })

  it('le ciel, le fond de scène et le brouillard sont un seul bleu nuit', () => {
    expect(charter3d.scene.background).toBe(base.ciel)
    expect(charter3d.scene.fog.color).toBe(base.ciel)
    expect(palette.sky).toBe(base.ciel)
    expect(charter3d.scene.flat).toBe(true)
  })

  it.each(Object.keys(rooms) as Array<keyof typeof rooms>)('%s : les volumes se lisent (sol > ciel, mur > sol)', (id) => {
    expect(contrast(floor(id), sky)).toBeGreaterThanOrEqual(1.5)
    expect(contrast(wallFront(id), floor(id))).toBeGreaterThanOrEqual(1.5)
    expect(luminance(wallFront(id))).toBeGreaterThan(luminance(floor(id)))
  })

  it.each(Object.keys(rooms) as Array<keyof typeof rooms>)('%s : la corniche d’accent se détache du ciel (≥ 4,5:1) et le cadre blanc du mur (≥ 4,5:1)', (id) => {
    expect(contrast(rendered(rooms[id].cornice, NORMALS.front), sky)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(rendered(charter3d.frame.outer, NORMALS.front), wallFront(id))).toBeGreaterThanOrEqual(4.5)
  })

  it('le dessus d’un mur coupé (bande d’accent) se détache du sol de sa salle (≥ 3:1)', () => {
    for (const id of Object.keys(rooms) as Array<keyof typeof rooms>) {
      expect(contrast(rendered(rooms[id].cap, NORMALS.up), floor(id)), id).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('charter3d — toile d’attente et cadre', () => {
  it('le canvas garde le rapport du cadre (1,3 × 1,6) : plus d’étirement vertical', () => {
    const { width, height } = charter3d.portrait.canvas
    expect(width / height).toBeCloseTo(dims.frameWidth / dims.frameHeight, 1)
    expect(width).toBeLessThanOrEqual(512)
    expect(height).toBeLessThanOrEqual(512)
  })

  it('les scanlines de la silhouette gardent le rapport barre / pas du logo (≈ 0,56)', () => {
    const { pitch, bar } = charter3d.portrait.scanline
    expect(bar / pitch).toBeGreaterThan(0.5)
    expect(bar / pitch).toBeLessThan(0.62)
  })
})

describe('tokens — exports historiques conservés', () => {
  it('palette, eventPalette, wingThemes, archivesDoor, dims, cameraRig existent toujours', () => {
    for (const key of ['cream', 'paper', 'ink', 'inkSoft', 'wood', 'woodDark', 'leaf', 'leafDark', 'sky', 'gold', 'white', 'shadow']) {
      expect(palette, key).toHaveProperty(key)
    }
    for (const key of ['corail', 'corailDeep', 'bleu', 'bleuDeep', 'bleuNuit', 'bleuNeon', 'cyan', 'cyanVif', 'alarm', 'blanc']) {
      expect(eventPalette, key).toHaveProperty(key)
    }
    expect(Object.keys(wingThemes).sort()).toEqual(['archives', 'culture', 'hall', 'industrialisation', 'infrastructures'])
    expect(archivesDoor).toEqual({ x: 0, width: 3.6 })
    expect(dims.wallHeight).toBe(4.2)
    expect(cameraRig.pitchDeg).toBe(48)
    expect(cameraPositionFor(0, 0, 10).z).toBeGreaterThan(0)
  })

  it('les personnages gardent leurs teintes V1 (palette gelée tant qu’ils ne sont pas refaits)', () => {
    expect(palette.cream).toBe('#fff8e7')
    expect(palette.gold).toBe('#e8c872')
    expect(palette.woodDark).toBe('#8c6a4a')
  })

  it('wingThemes lit la charte : sol, mur, accent, liseré', () => {
    for (const id of Object.keys(rooms) as Array<keyof typeof rooms>) {
      expect(wingThemes[id]).toEqual({ floor: rooms[id].floor, wall: rooms[id].wall, accent: rooms[id].accent, trim: rooms[id].cornice })
    }
  })
})
