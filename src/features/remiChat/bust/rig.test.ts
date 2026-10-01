/**
 * Normales soudées par position (`smoothNormals`) : le maillage de Rémi est éclaté par îlots UV, et des
 * normales lissées seulement à l'intérieur de chaque îlot laissaient des fissures sur le visage.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry } from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { smoothNormals } from './rig'

function normalOf(geometry: BufferGeometry, vertex: number): [number, number, number] {
  const n = geometry.getAttribute('normal')
  return [n.getX(vertex), n.getY(vertex), n.getZ(vertex)]
}

/** Deux triangles pliés le long de l'axe y (un « livre » à demi ouvert), dont l'arête commune est éclatée en deux jeux de sommets. */
function foldedStrip(): BufferGeometry {
  const geometry = new BufferGeometry()
  // Triangle de gauche dans le plan z = 0 ; triangle de droite relevé de 45° (z croît avec x).
  // Les sommets 1/4 et 2/5 sont confondus (même position) mais portent des UV différentes : couture.
  const positions = new Float32Array([
    -1, 0, 0, /* 0 */ 0, 0, 0, /* 1 */ 0, 1, 0, /* 2 */
    0, 0, 0, /* 3 = 1 */ 1, 0, 1, /* 4 */ 0, 1, 0, /* 5 = 2 */
  ])
  const uvs = new Float32Array([0, 0, 0.4, 0, 0.4, 1, 0.6, 0, 1, 0, 0.6, 1])
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  return geometry
}

describe('smoothNormals', () => {
  it('deux sommets de même position mais d\'UV différentes reçoivent exactement la même normale', () => {
    const geometry = foldedStrip()
    smoothNormals(geometry)
    expect(normalOf(geometry, 3)).toEqual(normalOf(geometry, 0 + 1)) // sommet 3 = sommet 1
    expect(normalOf(geometry, 5)).toEqual(normalOf(geometry, 2)) // sommet 5 = sommet 2
    // La couture est bien lissée : somme des normales des deux faces, (0, 0, 1) et (-1, 0, 1), normalisée.
    const [x, y, z] = normalOf(geometry, 1)
    expect(x).toBeCloseTo(-1 / Math.sqrt(5), 5)
    expect(y).toBeCloseTo(0, 5)
    expect(z).toBeCloseTo(2 / Math.sqrt(5), 5)
    // Les sommets hors couture gardent la normale de leur seul triangle.
    expect(normalOf(geometry, 0)).toEqual([0, 0, 1])
  })

  it('toutes les normales sont des flottants unitaires, jamais NaN', () => {
    const geometry = foldedStrip()
    smoothNormals(geometry)
    const normal = geometry.getAttribute('normal')
    expect(normal.array).toBeInstanceOf(Float32Array)
    expect(normal.normalized).toBe(false)
    for (let i = 0; i < normal.count; i++) {
      const [x, y, z] = normalOf(geometry, i)
      expect(Number.isFinite(x + y + z)).toBe(true)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
    }
  })

  it('pondère par l\'aire : un grand triangle l\'emporte sur un petit au sommet partagé', () => {
    const geometry = new BufferGeometry()
    // Sommet 0 partagé (confondu avec 3). Grand triangle de normale +z (aire 2), petit de normale +x (aire 0,005).
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0.1]), 3),
    )
    smoothNormals(geometry)
    const [x, , z] = normalOf(geometry, 0)
    expect(z).toBeGreaterThan(0.99)
    expect(x).toBeGreaterThan(0)
    expect(normalOf(geometry, 3)).toEqual([x, normalOf(geometry, 3)[1], z])
  })

  it('géométrie indexée : les triangles sont lus par l\'index, les sommets confondus partagent leur normale', () => {
    const geometry = foldedStrip()
    geometry.setIndex([0, 1, 2, 3, 4, 5])
    smoothNormals(geometry)
    expect(normalOf(geometry, 3)).toEqual(normalOf(geometry, 1))
    expect(normalOf(geometry, 5)).toEqual(normalOf(geometry, 2))
  })

  it('positions entières normalisées (comme remi.glb) : normales valides, pas un modèle noir', () => {
    const geometry = new BufferGeometry()
    const q = 32767
    const ints = new Int16Array([-q, 0, 0, 0, 0, 0, 0, q, 0, 0, 0, 0, q, 0, q, 0, q, 0])
    geometry.setAttribute('position', new BufferAttribute(ints, 3, true))
    smoothNormals(geometry)
    for (let i = 0; i < 6; i++) {
      const [x, y, z] = normalOf(geometry, i)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
    }
    expect(normalOf(geometry, 3)).toEqual(normalOf(geometry, 1))
  })

  it('sommet sans triangle ou face dégénérée : une normale valide de repli', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, 5, 5, 5]), 3)) // 3 points alignés + 1 isolé
    smoothNormals(geometry)
    for (let i = 0; i < 4; i++) {
      const [x, y, z] = normalOf(geometry, i)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
    }
  })

  it('sans position : ne fait rien', () => {
    const geometry = new BufferGeometry()
    expect(() => smoothNormals(geometry)).not.toThrow()
    expect(geometry.getAttribute('normal')).toBeUndefined()
  })
})

interface MeshoptView {
  buffer: number
  byteOffset: number
  byteLength: number
  byteStride: number
  count: number
  mode: 'ATTRIBUTES' | 'TRIANGLES' | 'INDICES'
  filter?: 'NONE' | 'OCTAHEDRAL' | 'QUATERNION' | 'EXPONENTIAL'
}

/**
 * Géométrie réelle de `public/models/characters/remi.glb` (positions entières normalisées, index 16 bits),
 * décompressée avec le décodeur meshopt de three, sans charger de texture ni de GLTFLoader.
 */
async function readRemiGeometry(): Promise<BufferGeometry> {
  await MeshoptDecoder.ready
  const file = readFileSync(resolve(process.cwd(), 'public/models/characters/remi.glb'))
  const jsonLength = file.readUInt32LE(12)
  const json = JSON.parse(file.toString('utf8', 20, 20 + jsonLength)) as {
    accessors: { bufferView: number; count: number }[]
    bufferViews: { extensions?: { EXT_meshopt_compression?: MeshoptView } }[]
    meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[]
  }
  const bin = new Uint8Array(file.buffer, file.byteOffset + 20 + jsonLength + 8)
  const primitive = json.meshes[0].primitives[0]
  const decode = (accessorIndex: number): Uint8Array => {
    const ext = json.bufferViews[json.accessors[accessorIndex].bufferView].extensions?.EXT_meshopt_compression
    if (!ext) throw new Error('vue meshopt attendue')
    const out = new Uint8Array(ext.count * ext.byteStride)
    MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, bin.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength), ext.mode, ext.filter ?? 'NONE')
    return out
  }
  const raw = decode(primitive.attributes.POSITION)
  const rawView = new DataView(raw.buffer)
  const count = json.accessors[primitive.attributes.POSITION].count
  const positions = new Int16Array(count * 3)
  for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) positions[i * 3 + c] = rawView.getInt16(i * 8 + c * 2, true)
  const indexBytes = decode(primitive.indices)
  const indices = new Uint16Array(indexBytes.buffer, 0, indexBytes.byteLength / 2)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3, true))
  geometry.setIndex(new BufferAttribute(indices, 1))
  return geometry
}

describe('smoothNormals sur remi.glb', () => {
  it('chaque position distincte n\'a qu\'une seule normale, unitaire : plus de rupture aux coutures UV', async () => {
    const geometry = await readRemiGeometry()
    const position = geometry.getAttribute('position')
    expect(position.count).toBe(13519) // éclaté par îlots UV
    smoothNormals(geometry)
    const byPosition = new Map<string, string>()
    let distinct = 0
    for (let i = 0; i < position.count; i++) {
      const key = [position.getX(i), position.getY(i), position.getZ(i)].map((v) => Math.round(v * 1e4)).join(',')
      const normal = normalOf(geometry, i)
      expect(Math.hypot(...normal)).toBeCloseTo(1, 4)
      const value = normal.join(',')
      const known = byPosition.get(key)
      if (known === undefined) {
        byPosition.set(key, value)
        distinct++
      } else {
        expect(value).toBe(known)
      }
    }
    expect(distinct).toBe(6208) // positions distinctes du maillage (13 519 sommets)
  })
})
