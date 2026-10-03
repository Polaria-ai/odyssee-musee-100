// @vitest-environment node
/**
 * Nettoyage de la texture de l'Archiviste (WEL-928, `scripts/clean-texture-stains.mjs`) : détection des taches
 * sombres en amas dans les zones anthracite, remplissage par la couleur voisine, marge des îlots, et surtout
 * ce qui ne doit JAMAIS bouger (tête, cheveux, yeux, mains, texels isolés, zones noires franches). Les cas
 * se jouent sur un petit atlas synthétique (128², deux îlots) ; un test sur la vraie source (hors Git) vérifie
 * le contrôle par différence et s'ignore sans elle.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { PROTECTED_JOINTS, cleanCharacterTexture, compareTextures, dilate, fillStains, islandLevels, keepClusters, localLevel, padAtlas } from './clean-texture-stains.mjs'

const SIZE = 128
const GREY = 40 // anthracite : dans la plage « zone sombre » (14 à 70)
const DARK = 8 // presque noir : tache

/**
 * Atlas gris sur deux îlots (vêtement à gauche, tête à droite), le reste noir (vide). Les îlots sont peints 2 texels
 * plus largement que leurs triangles (UV 8 à 56 et 72 à 120), comme ceux de Meshy : le rastériseur compte les
 * texels qui touchent à peine un triangle, il ne doit pas y trouver de noir.
 */
function makeAtlas(): Uint8Array {
  const px = new Uint8Array(SIZE * SIZE * 3)
  const fill = (x0: number, x1: number, y0: number, y1: number, v: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.fill(v, (y * SIZE + x) * 3, (y * SIZE + x) * 3 + 3)
  }
  fill(6, 58, 6, 122, GREY) // îlot du vêtement
  fill(70, 122, 6, 122, GREY) // îlot de la tête
  fill(30, 36, 50, 56, DARK) // tache de 6×6 dans le vêtement
  fill(90, 96, 50, 56, DARK) // même tache dans la tête (protégée)
  fill(20, 21, 90, 91, DARK) // texel isolé dans le vêtement (< minCluster : du grain, pas une tache)
  return px
}

type Quad = [x0: number, x1: number, joint: number, y0?: number, y1?: number]

/** Deux îlots de 48×112 texels par défaut : vêtement (os « Hips ») et tête (os « Head », protégé). */
async function makeDocument(pixels: Uint8Array, quads: Quad[] = [[8, 56, 0], [72, 120, 1]]): Promise<Document> {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const hips = doc.createNode('Hips')
  const head = doc.createNode('Head')
  const skin = doc.createSkin().addJoint(hips).addJoint(head)
  const positions: number[] = []
  const uvs: number[] = []
  const joints: number[] = []
  const indices: number[] = []
  const quad = (x0: number, x1: number, joint: number, y0 = 8, y1 = 120) => {
    const base = positions.length / 3
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
      positions.push(x / 10, y / 10, 0)
      uvs.push(x / SIZE, y / SIZE)
      joints.push(joint, 0, 0, 0)
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  for (const q of quads) quad(...q)
  const weights = new Float32Array((positions.length / 3) * 4)
  for (let i = 0; i < positions.length / 3; i++) weights[i * 4] = 1
  const prim = doc
    .createPrimitive()
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer))
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uvs)).setBuffer(buffer))
    .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new Uint8Array(joints)).setBuffer(buffer))
    .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(weights).setBuffer(buffer))
  const png = await sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.length), { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer()
  const texture = doc.createTexture().setImage(png).setMimeType('image/png')
  prim.setMaterial(doc.createMaterial().setBaseColorTexture(texture))
  const mesh = doc.createMesh().addPrimitive(prim)
  const node = doc.createNode('char1').setMesh(mesh).setSkin(skin)
  doc.createScene().addChild(hips).addChild(head).addChild(node)
  return doc
}

const at = (px: Uint8Array, x: number, y: number) => px[(y * SIZE + x) * 3]

describe('nettoyage de texture : atlas synthétique', () => {
  it('remplace la tache du vêtement par la couleur voisine, jamais celle de la tête', async () => {
    const original = makeAtlas()
    const result = await cleanCharacterTexture(await makeDocument(original))
    const { after, report } = result
    // La tache du vêtement (6×6) rejoint l'anthracite voisin.
    for (let y = 50; y < 56; y++) for (let x = 30; x < 36; x++) expect(Math.abs(at(after, x, y) - GREY), `texel ${x},${y}`).toBeLessThanOrEqual(2)
    // La même tache dans l'îlot de la tête (os « Head » : protégé) n'est pas touchée.
    for (let y = 50; y < 56; y++) for (let x = 90; x < 96; x++) expect(at(after, x, y)).toBe(DARK)
    // Un texel isolé n'est pas un amas : du grain de tissu, laissé tel quel.
    expect(at(after, 20, 90)).toBe(DARK)
    expect(report.clusters).toBe(1)
    expect(report.stainTexels).toBeGreaterThanOrEqual(36)
    expect(report.stainTexels).toBeLessThan(120) // la tache et son halo, pas l'îlot
    expect(report.changedProtected).toBe(0)
    expect(report.elsewhere).toBe(0)
  })

  it('ne change aucun texel utilisé hors des taches : le reste de l’îlot est identique octet pour octet', async () => {
    const original = makeAtlas()
    const { after, mask, zones } = await cleanCharacterTexture(await makeDocument(original))
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (!zones.used[i] || mask[i]) continue
      expect(after[i * 3], `texel utilisé ${i % SIZE},${Math.floor(i / SIZE)}`).toBe(original[i * 3])
    }
    expect(PROTECTED_JOINTS).toEqual(expect.arrayContaining(['Head', 'neck', 'LeftHand', 'RightHand']))
  })

  it('étend la couleur des îlots dans le vide qui les entoure, sur le rayon demandé seulement', async () => {
    const { after, padded } = await cleanCharacterTexture(await makeDocument(makeAtlas()), { padRadius: 4 })
    expect(at(after, 60, 60)).toBe(GREY) // à 3 texels du vêtement : rempli
    expect(padded[60 * SIZE + 60]).toBe(1)
    expect(at(after, 64, 60)).toBe(0) // à 7 texels des deux îlots : toujours vide
    expect(padded[60 * SIZE + 64]).toBe(0)
    expect(at(after, 0, 0)).toBe(0)
  })

  it('ne repeint pas une zone sombre voulue : un amas trop grand pour une tache, ou un îlot noir collé au manteau', async () => {
    const px = makeAtlas()
    // Grande zone sombre (20×20 = 400 texels) dans l'îlot anthracite : pas une tache (t-shirt, pli profond).
    for (let y = 70; y < 90; y++) for (let x = 20; x < 40; x++) px.fill(DARK, (y * SIZE + x) * 3, (y * SIZE + x) * 3 + 3)
    // Îlot noir de 12×12 collé au vêtement, sans marge (UV 58–70 × 50–62), peint un texel plus largement.
    for (let y = 49; y < 63; y++) for (let x = 58; x < 71; x++) px.fill(6, (y * SIZE + x) * 3, (y * SIZE + x) * 3 + 3)
    const { after, report } = await cleanCharacterTexture(await makeDocument(px, [[8, 56, 0], [72, 120, 1], [58, 70, 0, 50, 62]]), { padRadius: 0 })
    for (let y = 70; y < 90; y++) for (let x = 20; x < 40; x++) expect(at(after, x, y)).toBe(DARK)
    for (let y = 50; y < 62; y++) for (let x = 58; x < 70; x++) expect(at(after, x, y), `îlot noir ${x},${y}`).toBe(6)
    expect(report.clusters).toBe(1) // la seule vraie tache : celle de 6×6
    expect(report.stainTexels).toBeLessThan(120)
  })

  it('est déterministe : deux exécutions donnent le même PNG', async () => {
    const a = await cleanCharacterTexture(await makeDocument(makeAtlas()))
    const b = await cleanCharacterTexture(await makeDocument(makeAtlas()))
    expect(a.png).not.toBeNull()
    expect(Buffer.compare(a.png!, b.png!)).toBe(0)
  })

  it('laisse intacte une zone entièrement noire (t-shirt) et une zone saturée (peau, tissu coloré)', async () => {
    const px = makeAtlas()
    // Zone noire franche (niveau local < 14) avec un amas encore plus sombre : jamais touchée.
    for (let y = 6; y < 122; y++) for (let x = 6; x < 58; x++) px.fill(4, (y * SIZE + x) * 3, (y * SIZE + x) * 3 + 3)
    for (let y = 50; y < 56; y++) for (let x = 30; x < 36; x++) px.fill(0, (y * SIZE + x) * 3, (y * SIZE + x) * 3 + 3)
    const black = await cleanCharacterTexture(await makeDocument(px), { padRadius: 0 })
    expect(black.report.stainTexels).toBe(0)
    expect(black.png).toBeNull()

    // Rouge sombre saturé : ni neutre ni anthracite, pas une tache.
    const red = makeAtlas()
    for (let y = 50; y < 56; y++) for (let x = 30; x < 36; x++) red.set([60, 6, 6], (y * SIZE + x) * 3)
    const coloured = await cleanCharacterTexture(await makeDocument(red), { padRadius: 0 })
    expect(coloured.report.stainTexels).toBe(0)
  })
})

describe('nettoyage de texture : fonctions pures', () => {
  it('dilate élargit un masque du rayon demandé, rien de plus', () => {
    const mask = new Uint8Array(9 * 9)
    mask[4 * 9 + 4] = 1
    const out = dilate(mask, 9, 9, 2)
    expect(out.reduce((s, v) => s + v, 0)).toBe(25)
    expect(out[2 * 9 + 2]).toBe(1)
    expect(out[1 * 9 + 4]).toBe(0)
    expect(dilate(mask, 9, 9, 0)).toEqual(mask)
  })

  it('keepClusters ne garde que les amas d’au moins minCluster texels (8-connexité)', () => {
    const c = new Uint8Array(10 * 10)
    c[1 * 10 + 1] = 1 // isolé
    for (const [x, y] of [[5, 5], [6, 6], [7, 5], [6, 4]]) c[y * 10 + x] = 1 // 4 texels reliés en diagonale
    const { mask, clusters } = keepClusters(c, 10, 10, 4)
    expect(clusters).toBe(1)
    expect(mask[1 * 10 + 1]).toBe(0)
    expect(mask[6 * 10 + 6]).toBe(1)
  })

  it('localLevel ignore les texels très sombres : une tache ne tire pas le niveau de sa zone vers le bas', () => {
    const w = 40
    const lum = new Float32Array(w * w).fill(50)
    const valid = new Uint8Array(w * w).fill(1)
    for (let y = 18; y < 22; y++) for (let x = 18; x < 22; x++) lum[y * w + x] = 5
    const level = localLevel(lum, valid, w, w, 12)
    expect(level[20 * w + 20]).toBeGreaterThan(48)
  })

  it('keepClusters écarte aussi les amas trop grands pour être des taches', () => {
    const c = new Uint8Array(20 * 20)
    for (let y = 2; y < 12; y++) for (let x = 2; x < 12; x++) c[y * 20 + x] = 1 // 100 texels
    c[17 * 20 + 17] = c[17 * 20 + 18] = c[18 * 20 + 17] = c[18 * 20 + 18] = 1 // 4 texels
    expect(keepClusters(c, 20, 20, 4, 50).clusters).toBe(1)
    expect(keepClusters(c, 20, 20, 4).clusters).toBe(2)
  })

  it('islandLevels donne à chaque îlot son propre niveau (un îlot noir reste noir à côté d’un îlot anthracite)', () => {
    const lum = new Float32Array([40, 40, 40, 40, 5, 5, 5, 5])
    const island = new Int32Array([1, 1, 1, 1, 2, 2, 2, 2])
    const levels = islandLevels(lum, new Uint8Array(8).fill(1), island, 2)
    expect(levels[1]).toBeCloseTo(40)
    expect(levels[2]).toBeCloseTo(5)
    expect(levels[0]).toBe(0)
  })

  it('fillStains avec des îlots : la couleur d’un îlot voisin n’est jamais reprise', () => {
    const w = 8
    const px = new Uint8Array(w * 3).fill(40)
    px.fill(200, 6 * 3, 8 * 3) // îlot clair à droite
    const mask = new Uint8Array(w)
    mask[4] = 1
    const trusted = new Uint8Array(w).fill(1)
    const island = new Int32Array([1, 1, 1, 1, 1, 1, 2, 2])
    const out = fillStains(px, 3, w, 1, mask, trusted, island)
    expect(out[4 * 3]).toBe(40)
    const mixed = fillStains(px, 3, w, 1, mask, trusted)
    expect(mixed[4 * 3]).toBeGreaterThan(40) // sans îlots, la fenêtre 5×5 attrape les texels clairs voisins
  })

  it('padAtlas n’écrit que des texels inutilisés ; compareTextures range chaque changement', () => {
    const w = 16
    const px = new Uint8Array(w * w * 3)
    const used = new Uint8Array(w * w)
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) { used[y * w + x] = 1; px.fill(60, (y * w + x) * 3, (y * w + x) * 3 + 3) }
    const { pixels, filled } = padAtlas(px, 3, w, w, used, () => true, 3)
    for (let i = 0; i < w * w; i++) if (used[i]) expect(pixels[i * 3]).toBe(60)
    expect(filled.reduce((s, v) => s + v, 0)).toBe(10 * 10 - 4 * 4) // couronne de 3 texels autour de l'îlot 4×4
    const diff = compareTextures(px, pixels, 3, w, w, { used, padded: filled })
    expect(diff.inPadding).toBe(diff.changed)
    expect(diff.elsewhere).toBe(0)
    expect(diff.maxDelta).toBe(60)
  })
})

const SOURCE = join(homedir(), 'Dev', 'odyssee-musee-100-assets', 'personnages', 'archiviste-idle.glb')

describe.skipIf(!existsSync(SOURCE))('nettoyage de texture : source réelle de l’Archiviste (hors Git)', () => {
  it('trouve des taches, protège la tête et les mains, et ne change rien d’autre que taches et vide', async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(SOURCE)
    const { report } = await cleanCharacterTexture(doc) // lève une erreur si un texel protégé ou « ailleurs » a changé
    expect(report.width).toBe(2048)
    expect(report.protectedTexels).toBeGreaterThan(50_000) // visage, cheveux, mains : bien exercés
    expect(report.clusters).toBeGreaterThan(20)
    expect(report.stainTexels).toBeGreaterThan(1000)
    expect(report.stainTexels).toBeLessThan(report.usedTexels * 0.01) // des taches, pas un aplat
    expect(report.changedProtected).toBe(0)
    expect(report.elsewhere).toBe(0)
    expect(report.changed).toBe(report.inStains + report.inPadding)
  }, 120_000)
})
