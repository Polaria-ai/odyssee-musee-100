/**
 * Mesures sur les pixels d'une capture d'écran (chat translucide devant le musée, V5 « chat-fond »).
 *
 * Le projet TypeScript des tests n'a pas la lib DOM (voir `museeApi.ts`) : le décodage PNG et les calculs se font
 * dans la page (`createImageBitmap` + canvas 2D), à qui l'on passe la capture en base64. Les fonctions exportées
 * prennent des `Buffer` (ce que renvoie `page.screenshot()`) et ne renvoient que des nombres.
 *
 * Luminance : celle de WCAG 2.x (sRGB linéarisé), de 0 (noir) à 1 (blanc) ; contraste = (L1 + 0,05) / (L2 + 0,05).
 */
import type { Page } from '@playwright/test'

/** Rectangle en pixels de la capture (donc en pixels CSS × `deviceScaleFactor`, voir `scale`). */
export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
}

export interface LumaStats {
  /** Luminance moyenne, 0..255 (luma Rec. 709 sur les valeurs sRGB brutes : une mesure de « clair/sombre » simple). */
  mean: number
  /** Écart-type de cette luma : 0 = aplat uniforme. */
  std: number
  /** Nombre de couleurs distinctes (quantifiées sur 4 bits par canal) : un aplat n'en a qu'une ou deux. */
  colors: number
}

interface PixelGlobals {
  createImageBitmap: (blob: unknown) => Promise<{ width: number; height: number }>
  Blob: new (parts: unknown[], options: { type: string }) => unknown
  atob: (data: string) => string
  document: {
    createElement: (tag: 'canvas') => {
      width: number
      height: number
      getContext: (kind: '2d') => {
        drawImage: (image: unknown, x: number, y: number) => void
        getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray }
      }
    }
  }
}

/** Statistiques simples d'une région (ou de toute la capture si `rect` est absent). */
export async function lumaStats(page: Page, png: Buffer, rect?: PixelRect): Promise<LumaStats> {
  return page.evaluate(
    async ({ b64, rect }) => {
      const g = globalThis as unknown as PixelGlobals
      const bytes = Uint8Array.from(g.atob(b64), (c) => c.charCodeAt(0))
      const bitmap = await g.createImageBitmap(new g.Blob([bytes], { type: 'image/png' }))
      const canvas = g.document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      const r = rect ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
      const { data } = ctx.getImageData(r.x, r.y, r.width, r.height)
      let sum = 0
      let sumSq = 0
      const seen = new Set<number>()
      const n = data.length / 4
      for (let i = 0; i < data.length; i += 4) {
        const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        sum += luma
        sumSq += luma * luma
        seen.add(((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4))
      }
      const mean = sum / n
      return { mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)), colors: seen.size }
    },
    { b64: png.toString('base64'), rect: rect ?? null },
  )
}

export interface SceneMatch {
  /** Blocs examinés (grille de `block` × `block` pixels). */
  blocks: number
  /** Blocs où le musée seul (`museum`) a du relief (écart-type de luma ≥ `minStd`) : les seuls qui comptent. */
  textured: number
  /** Parmi eux, ceux où la capture avec le chat (`withChat`) suit le même relief (corrélation de luma ≥ `minCorrelation`). */
  matching: number
  /** `matching / textured` (0 si aucun bloc n'a de relief : le test serait alors sans objet). */
  ratio: number
}

/**
 * Compare la capture avec le chat ouvert à celle du musée seul, bloc par bloc. Un voile sombre, un teint bleuté ou
 * un léger flou changent les valeurs sans changer le relief : la corrélation reste haute. Un fond opaque (aplat,
 * dégradé) la fait tomber à zéro. Les blocs cachés par Rémi, les bulles ou le panneau flouté ne passent pas non plus :
 * c'est la PART de blocs qui passent qu'on exige, pas leur totalité.
 */
export async function sceneMatch(
  page: Page,
  withChat: Buffer,
  museum: Buffer,
  options: { block?: number; minStd?: number; minCorrelation?: number } = {},
): Promise<SceneMatch> {
  const { block = 24, minStd = 6, minCorrelation = 0.85 } = options
  return page.evaluate(
    async ({ a64, b64, block, minStd, minCorrelation }) => {
      const g = globalThis as unknown as PixelGlobals
      const decode = async (b64: string) => {
        const bytes = Uint8Array.from(g.atob(b64), (c) => c.charCodeAt(0))
        const bitmap = await g.createImageBitmap(new g.Blob([bytes], { type: 'image/png' }))
        const canvas = g.document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(bitmap, 0, 0)
        return { width: bitmap.width, height: bitmap.height, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data }
      }
      const [a, b] = await Promise.all([decode(a64), decode(b64)])
      if (a.width !== b.width || a.height !== b.height) throw new Error(`captures de tailles différentes : ${a.width}×${a.height} / ${b.width}×${b.height}`)
      const luma = (d: Uint8ClampedArray, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
      let blocks = 0
      let textured = 0
      let matching = 0
      for (let by = 0; by + block <= a.height; by += block) {
        for (let bx = 0; bx + block <= a.width; bx += block) {
          blocks++
          let sa = 0
          let sb = 0
          let saa = 0
          let sbb = 0
          let sab = 0
          const n = block * block
          for (let y = by; y < by + block; y++) {
            for (let x = bx; x < bx + block; x++) {
              const i = (y * a.width + x) * 4
              const la = luma(a.data, i)
              const lb = luma(b.data, i)
              sa += la
              sb += lb
              saa += la * la
              sbb += lb * lb
              sab += la * lb
            }
          }
          const va = saa / n - (sa / n) ** 2
          const vb = sbb / n - (sb / n) ** 2
          if (Math.sqrt(Math.max(0, vb)) < minStd) continue
          textured++
          if (va <= 1e-6) continue
          const corr = (sab / n - (sa / n) * (sb / n)) / Math.sqrt(va * vb)
          if (corr >= minCorrelation) matching++
        }
      }
      return { blocks, textured, matching, ratio: textured === 0 ? 0 : matching / textured }
    },
    { a64: withChat.toString('base64'), b64: museum.toString('base64'), block, minStd, minCorrelation },
  )
}

/**
 * Contraste le plus faible entre un texte et le fond qu'il recouvre : `background` est une capture faite TEXTE
 * MASQUÉ (couleur transparente), `rect` la zone du texte, `color` sa couleur CSS rgba (alpha compris : un texte à 86 %
 * de blanc est mélangé au fond pixel par pixel). Renvoie le 1er centile des contrastes (écarte les pixels de bord).
 */
export async function minTextContrast(
  page: Page,
  background: Buffer,
  rect: PixelRect,
  color: { r: number; g: number; b: number; a: number },
): Promise<number> {
  return page.evaluate(
    async ({ b64, rect, color }) => {
      const g = globalThis as unknown as PixelGlobals
      const bytes = Uint8Array.from(g.atob(b64), (c) => c.charCodeAt(0))
      const bitmap = await g.createImageBitmap(new g.Blob([bytes], { type: 'image/png' }))
      const canvas = g.document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      const { data } = ctx.getImageData(rect.x, rect.y, rect.width, rect.height)
      const lin = (v: number) => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      }
      const lum = (r: number, g2: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g2) + 0.0722 * lin(b)
      const ratios: number[] = []
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g2 = data[i + 1]
        const b = data[i + 2]
        const tr = color.a * color.r + (1 - color.a) * r
        const tg = color.a * color.g + (1 - color.a) * g2
        const tb = color.a * color.b + (1 - color.a) * b
        const l1 = lum(tr, tg, tb)
        const l2 = lum(r, g2, b)
        ratios.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))
      }
      ratios.sort((x, y) => x - y)
      return ratios[Math.floor(ratios.length * 0.01)]
    },
    { b64: background.toString('base64'), rect, color },
  )
}
