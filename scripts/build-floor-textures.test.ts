// @vitest-environment node
/**
 * Textures de sol (WEL-923) : fichiers produits par `scripts/build-floor-textures.mjs` dans
 * `public/textures/floors/`. On contrôle ce que le jeu décode vraiment (les webp), pas les valeurs
 * intermédiaires du script : présence, dimensions (règle mobile ≤ 512 px), moyenne de la carte de détail (elle
 * multiplie la charte : sa moyenne × le gain du matériau doit valoir 1), tuilage, budget, normales plates en
 * moyenne. Le test de déterminisme a besoin des sources (hors Git) et s'ignore sans elles.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { charter3d } from '../src/styles/tokens'
import { FLOOR_KINDS, FLOOR_SPECS, FLOOR_TEXTURE_DIR, ROOM_FLOOR_KIND, type FloorKind } from '../src/world/floorSpec'
import { BUDGET_BYTES, FLOORS, OUT_DIR, OUT_SIZE, buildFloor, readDetailFile, screenContrast, seamRatio, sourceDir } from './build-floor-textures.mjs'

const file = (kind: FloorKind, map: 'detail' | 'normal') => join(OUT_DIR, `${kind}-${map}.webp`)

describe('textures de sol : fichiers', () => {
  it('le dossier de sortie du script est celui que le jeu charge', () => {
    expect(`/${OUT_DIR.replace(/^public\//, '')}`).toBe(FLOOR_TEXTURE_DIR)
  })

  it('chaque matière a sa configuration de fabrication et ses deux cartes (détail, normales)', () => {
    for (const kind of FLOOR_KINDS) {
      expect(FLOORS[kind], `configuration de ${kind}`).toBeDefined()
      expect(existsSync(file(kind, 'detail')), `${file(kind, 'detail')} absent`).toBe(true)
      expect(existsSync(file(kind, 'normal')), `${file(kind, 'normal')} absent`).toBe(true)
      expect(FLOOR_SPECS[kind].detailUrl).toBe(`${FLOOR_TEXTURE_DIR}/${kind}-detail.webp`)
      expect(FLOOR_SPECS[kind].normalUrl).toBe(`${FLOOR_TEXTURE_DIR}/${kind}-normal.webp`)
    }
  })

  it.each(FLOOR_KINDS.flatMap((k) => [[k, 'detail'] as const, [k, 'normal'] as const]))('%s (%s) : carrée, ≤ 512 px, webp', async (kind, map) => {
    const meta = await sharp(file(kind, map)).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(meta.height)
    expect(meta.width!).toBeLessThanOrEqual(OUT_SIZE)
    expect(meta.width! & (meta.width! - 1), 'puissance de deux (mipmaps propres)').toBe(0)
  })

  it('budget total < 450 Ko', () => {
    const total = FLOOR_KINDS.flatMap((k) => [file(k, 'detail'), file(k, 'normal')]).reduce((sum, f) => sum + statSync(f).size, 0)
    expect(total).toBeLessThan(450 * 1024)
    expect(BUDGET_BYTES).toBe(450 * 1024)
  })
})

describe('cartes de détail : elles multiplient la couleur de la charte, sans la déplacer', () => {
  it.each(FLOOR_KINDS)('%s : moyenne = detailMean (le gain du matériau la ramène à 1), blanc présent, pas de trou noir', async (kind) => {
    const d = await readDetailFile(file(kind, 'detail'))
    // `detailMean` (floorSpec.ts) est recopiée à la main depuis la sortie du script : si ce test échoue après
    // un nouveau réglage, y mettre la moyenne affichée par `node scripts/build-floor-textures.mjs`.
    expect(d.mean, `moyenne de ${kind}`).toBeCloseTo(FLOOR_SPECS[kind].detailMean, 2)
    expect(Math.abs(d.mean - FLOOR_SPECS[kind].detailMean)).toBeLessThan(0.004)
    expect(d.mean * (1 / FLOOR_SPECS[kind].detailMean)).toBeCloseTo(1, 1)
    expect(d.mean, 'carte trop sombre : la matière doit rester une nuance de la couleur, pas la remplacer').toBeGreaterThan(0.7)
    expect(d.max, 'le blanc (couleur de la charte inchangée) doit exister').toBeGreaterThan(0.97)
    // Les creux les plus marqués (le webp avec perte déborde un peu la profondeur voulue) : la vraie garde est le test de
    // contraste sur le ciel plus bas (creux ≥ 1,15:1), ceci écarte seulement un trou franchement noir.
    expect(d.min, 'jamais de trou noir : le sol reste lisible').toBeGreaterThan(0.3)
    expect(1 - d.min, 'profondeur du motif').toBeLessThanOrEqual(0.7)
  })

  it.each(FLOOR_KINDS)('%s : tuilable (raccord des bords opposés comparable à celui de deux colonnes voisines)', async (kind) => {
    const d = await readDetailFile(file(kind, 'detail'))
    expect(seamRatio(d.values, d.size), `raccord de ${kind}`).toBeLessThan(1.8)
  })

  it.each(FLOOR_KINDS)('%s : pas de marche de luminosité à la couture (une dérive lente de la source creuse un raccord à chaque répétition)', async (kind) => {
    const d = await readDetailFile(file(kind, 'detail'))
    const n = d.size
    const band = 3
    const rows = (axis: 'rows' | 'cols', from: number) => {
      let sum = 0
      for (let a = from; a < from + band; a++) for (let b = 0; b < n; b++) sum += d.values[axis === 'rows' ? (((a % n) + n) % n) * n + b : b * n + (((a % n) + n) % n)]
      return sum / (band * n)
    }
    for (const axis of ['rows', 'cols'] as const) {
      // Écart de moyenne entre deux bandes de 3 px voisines : à la couture (bords opposés, voisins une fois la carte répétée)
      // et à chaque frontière intérieure. La couture ne doit pas sortir de la variation naturelle du motif.
      const seam = Math.abs(rows(axis, 0) - rows(axis, n - band))
      const inner: number[] = []
      for (let k = band; k < n - band; k++) inner.push(Math.abs(rows(axis, k) - rows(axis, k - band)))
      inner.sort((x, y) => x - y)
      const p95 = inner[Math.floor(0.95 * (inner.length - 1))]
      // Mesuré sur l'ancien terrazzo (haut plus clair que le bas) : couture 5,8 % de la moyenne pour 1,9 % au p95 intérieur.
      expect(seam / (d.mean * 255), `couture ${axis} de ${kind}`).toBeLessThanOrEqual(Math.max(0.01, (p95 / (d.mean * 255)) * 1.5))
    }
  })

  it.each(FLOOR_KINDS)('%s : carte de normales plate en moyenne (relief centré, tangent space)', async (kind) => {
    const { data, info } = await sharp(file(kind, 'normal')).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const n = info.width * info.height
    let sx = 0
    let sy = 0
    let sz = 0
    for (let i = 0; i < n; i++) {
      sx += data[i * 3] / 255 * 2 - 1
      sy += data[i * 3 + 1] / 255 * 2 - 1
      sz += data[i * 3 + 2] / 255 * 2 - 1
    }
    expect(Math.abs(sx / n)).toBeLessThan(0.05)
    expect(Math.abs(sy / n)).toBeLessThan(0.05)
    expect(sz / n).toBeGreaterThan(0.85)
  })

  it('réglages de matière raisonnables : normales modérées, motif de 0,5 à 8 m', () => {
    for (const kind of FLOOR_KINDS) {
      const spec = FLOOR_SPECS[kind]
      expect(spec.normalScale).toBeGreaterThan(0)
      expect(spec.normalScale).toBeLessThanOrEqual(1)
      expect(spec.tileMeters).toBeGreaterThanOrEqual(0.5)
      expect(spec.tileMeters).toBeLessThanOrEqual(8)
    }
  })
})

describe('cartes de détail : la matière se lit à la distance du jeu (pas un aplat)', () => {
  // La caméra plonge à 48° et montre ≈ 11 m de sol sur un téléphone, rendu à dpr 1,75 : 60 à 80 px par mètre. À cette
  // densité, un motif fin (maille de 4 cm, éclat de 1 cm) se moyenne et le sol redevient uni, même si la carte a du
  // contraste en elle-même. La première version de ces sols échouait ici (moquette 0,047, terrazzo 0,052, microciment
  // 0,052) et les captures le confirmaient : indiscernables de l'aplat d'avant.
  const MIN_SCREEN_CV: Record<FloorKind, number> = { marble: 0.05, terrazzo: 0.09, microcement: 0.11, carpet: 0.11 }

  it.each(FLOOR_KINDS)('%s : coefficient de variation à 80 et à 55 px/m au-dessus du plancher', async (kind) => {
    const d = await readDetailFile(file(kind, 'detail'))
    const tile = FLOOR_SPECS[kind].tileMeters
    expect(screenContrast(d.values, d.size, tile, 80), `${kind} à 80 px/m`).toBeGreaterThanOrEqual(MIN_SCREEN_CV[kind])
    expect(screenContrast(d.values, d.size, tile, 55), `${kind} à 55 px/m`).toBeGreaterThanOrEqual(MIN_SCREEN_CV[kind] * 0.8)
  })

  it('le motif n\'est jamais plus fin que l\'écran : au plus 3 texels de carte par pixel à 80 px/m', () => {
    for (const kind of FLOOR_KINDS) {
      const texelsPerScreenPixel = OUT_SIZE / (FLOOR_SPECS[kind].tileMeters * 80)
      expect(texelsPerScreenPixel, `${kind} : texels par pixel d'écran`).toBeLessThanOrEqual(3) // marbre : 2,6 (veines fines, lignes isolées)
    }
  })
})

/** Gain de lumière des dessus (docs/CHARTE-3D.md §1, lumières de `charter3d.scene`) : R, V, B. */
const UP_GAIN = [0.94, 0.94, 0.96]
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const toSrgb = (l: number) => (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055)
const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
const luminance = (rgb: number[]) => 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2])
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** Couleur affichée d'un dessus de la charte, multipliée par `factor` (détail × gain du matériau). */
function renderedUp(hex: string, factor: number): number[] {
  return hexToRgb(hex).map((c, i) => toSrgb(Math.min(1, toLinear(c) * UP_GAIN[i] * factor)))
}

describe('sols texturés : la charte tient, le musée reste une « nuit bleue » lisible', () => {
  const sky = luminance(hexToRgb(charter3d.scene.background))

  it.each(FLOOR_KINDS)('%s : sur chaque sol de cette matière, la moyenne reste à la couleur de la charte et les creux restent plus clairs que le ciel', async (kind) => {
    const spec = FLOOR_SPECS[kind]
    const d = await readDetailFile(file(kind, 'detail'))
    const gain = 1 / spec.detailMean
    const rooms = (Object.keys(ROOM_FLOOR_KIND) as Array<keyof typeof ROOM_FLOOR_KIND>).filter((id) => ROOM_FLOOR_KIND[id] === kind)
    expect(rooms.length).toBeGreaterThan(0)
    for (const id of rooms) {
      // Archives : le fond réel du sol est `floor` (`floorAlt` n'est que la teinte de la vignette des bords).
      for (const hex of id === 'archives' ? [charter3d.rooms.archives.floor] : [charter3d.rooms[id].floor, charter3d.rooms[id].floorAlt]) {
        const mean = luminance(renderedUp(hex, d.mean * gain))
        const plain = luminance(renderedUp(hex, 1))
        expect(Math.abs(mean - plain) / plain, `${id} ${hex} : la couleur moyenne ne bouge pas`).toBeLessThan(0.01)
        const darkest = luminance(renderedUp(hex, d.min * gain))
        // Le test de palette impose sol / ciel ≥ 1,5 sur la couleur de la charte ; les creux du motif (veine, éclat) peuvent
        // descendre, localement, jusqu'à 1,15 : jamais un trou noir.
        expect(contrast(darkest, sky), `${id} ${hex} : creux du motif sur le ciel`).toBeGreaterThanOrEqual(1.15)
      }
    }
  })
})

describe.skipIf(!sourceDir())('script de fabrication : sorties déterministes', () => {
  // Marbre (raccord fondu) et moquette (la plus lourde) couvrent les deux chemins du script ; les autres
  // matières n'en ajoutent pas, inutile de quadrupler la durée du test.
  it.each(['marble', 'carpet'] as const)('%s : deux fabrications donnent les mêmes octets', async (kind) => {
    const a = await buildFloor(kind)
    const b = await buildFloor(kind)
    expect(Buffer.compare(a.detailWebp, b.detailWebp)).toBe(0)
    expect(Buffer.compare(a.normalWebp, b.normalWebp)).toBe(0)
  }, 180_000)

  it.each(FLOOR_KINDS)('%s : les fichiers publiés sont ceux que le script produit aujourd’hui', async (kind) => {
    const built = await buildFloor(kind)
    const published = await readDetailFile(file(kind, 'detail'))
    // Mêmes statistiques que le fichier committé (et non les mêmes octets : l'encodeur webp peut varier d'une
    // plate-forme à l'autre) : le script et les cartes publiées n'ont pas divergé.
    expect(built.stats.mean).toBeCloseTo(published.mean, 2)
    expect(Math.abs(built.stats.min - published.min)).toBeLessThan(0.02)
    expect(readFileSync(file(kind, 'detail')).length / built.detailWebp.length).toBeGreaterThan(0.9)
    expect(readFileSync(file(kind, 'detail')).length / built.detailWebp.length).toBeLessThan(1.1)
  }, 180_000)
})
