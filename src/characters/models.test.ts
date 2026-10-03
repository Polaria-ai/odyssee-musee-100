/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dims } from '../styles/tokens'
import { CHARACTERS, CHARACTER_IDS, hasClip } from './models'

/** JSON d'un GLB (premier chunk), sans charger three : vérifie le fichier livré, pas seulement la config. */
function readGlbJson(publicPath: string) {
  const buffer = readFileSync(resolve(process.cwd(), 'public', publicPath.replace(/^\//, '')))
  expect(buffer.toString('ascii', 0, 4)).toBe('glTF')
  const jsonLength = buffer.readUInt32LE(12)
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)) as {
    animations: { name: string }[]
    nodes: { name?: string }[]
    skins: { joints: number[] }[]
    materials: unknown[]
    meshes: unknown[]
    extensionsRequired?: string[]
  }
}

/** Noms des os du squelette, dans l'ordre de `skins[0].joints` (c'est l'ordre qui compte pour les clips et le skinning). */
function jointNames(publicPath: string): string[] {
  const json = readGlbJson(publicPath)
  return json.skins[0].joints.map((index) => json.nodes[index].name ?? '')
}

describe('CHARACTERS', () => {
  it('décrit Cyril, Rémi et l’Archiviste avec leurs clips', () => {
    expect(CHARACTER_IDS).toEqual(['cyril', 'remi', 'archiviste'])
    expect(CHARACTERS.cyril.path).toBe('/models/characters/cyril.glb')
    expect(CHARACTERS.remi.path).toBe('/models/characters/remi.glb')
    expect(CHARACTERS.archiviste.path).toBe('/models/characters/archiviste.glb')
    expect(CHARACTERS.cyril.clips).toEqual({ idle: 'idle', walk: 'walk' })
    expect(CHARACTERS.remi.clips).toEqual({ idle: 'idle', wave: 'wave' })
    expect(CHARACTERS.archiviste.clips).toEqual({ idle: 'idle', wave: 'wave', talk: 'talk' })
    expect(hasClip('cyril', 'walk')).toBe(true)
    expect(hasClip('cyril', 'wave')).toBe(false)
    expect(hasClip('cyril', 'talk')).toBe(false)
    expect(hasClip('remi', 'wave')).toBe(true)
    expect(hasClip('remi', 'walk')).toBe(false)
    expect(hasClip('remi', 'talk')).toBe(false)
    expect(hasClip('archiviste', 'wave')).toBe(true)
    expect(hasClip('archiviste', 'talk')).toBe(true)
    expect(hasClip('archiviste', 'walk')).toBe(false)
  })

  it('donne à l’Archiviste le squelette de Rémi (24 os, mêmes noms, même ordre) : ses clips lui vont', () => {
    const remi = jointNames(CHARACTERS.remi.path)
    expect(remi).toHaveLength(24)
    expect(remi.slice(0, 2)).toEqual(['Hips', 'LeftUpLeg'])
    expect(jointNames(CHARACTERS.archiviste.path)).toEqual(remi)
    expect(jointNames(CHARACTERS.cyril.path)).toEqual(remi)
  })

  it('garde l’Archiviste dans le budget d’un fichier de personnage (verify:bundle : 400 Ko par fichier)', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'public', CHARACTERS.archiviste.path.replace(/^\//, ''))).length
    expect(bytes).toBeLessThanOrEqual(400 * 1024)
  })

  it('garde les hôtes lisibles sans écraser le cadrage (1,3 à 1,6 × la hauteur de référence)', () => {
    for (const id of CHARACTER_IDS) {
      const ratio = CHARACTERS[id].height / dims.playerHeight
      expect(ratio).toBeGreaterThanOrEqual(1.3)
      expect(ratio).toBeLessThanOrEqual(1.6)
    }
  })

  for (const id of CHARACTER_IDS) {
    describe(`fichier ${id}.glb`, () => {
      const json = readGlbJson(CHARACTERS[id].path)

      it('contient les clips déclarés et un squelette de 24 os', () => {
        const names = json.animations.map((a) => a.name)
        for (const fileName of Object.values(CHARACTERS[id].clips)) expect(names).toContain(fileName)
        expect(json.skins).toHaveLength(1)
        expect(json.skins[0].joints).toHaveLength(24)
      })

      it('est un seul maillage à un seul matériau', () => {
        expect(json.meshes).toHaveLength(1)
        expect(json.materials).toHaveLength(1)
      })

      it('est compressé en meshopt, jamais en Draco', () => {
        expect(json.extensionsRequired).toContain('EXT_meshopt_compression')
        expect(json.extensionsRequired).not.toContain('KHR_draco_mesh_compression')
      })
    })
  }
})
