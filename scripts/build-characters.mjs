#!/usr/bin/env node
/**
 * Personnages générés par Magnific (image → 3D Meshy 7.1, squelette Meshy, animations du catalogue
 * Meshy) : fusionne les animations livrées dans des fichiers séparés en UN seul GLB par personnage,
 * puis l'optimise pour le mobile (meshopt, texture WebP) vers public/models/characters/.
 *
 * Sources (non versionnées, ~7 Mo chacune) : ~/Dev/odyssee-musee-100-assets/personnages/
 *   <nom>-<clip>.glb — même squelette (24 os), un clip par fichier (idle, walk, wave…).
 * Usage : node scripts/build-characters.mjs
 * Voir docs/ASSETS.md (section Personnages) pour la provenance et l'accord des personnes.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const SRC = join(homedir(), 'Dev', 'odyssee-musee-100-assets', 'personnages')
const OUT = join('public', 'models', 'characters')
const TEXTURE_SIZE = process.env.CHARACTER_TEXTURE_SIZE ?? '1024'

/** Personnage → clips : le premier fichier sert de base (maillage, squelette, texture). */
const CHARACTERS = {
  cyril: ['idle', 'walk'],
  remi: ['idle', 'wave'],
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

async function merge(name, clips) {
  const [baseClip, ...extraClips] = clips
  const base = await io.read(join(SRC, `${name}-${baseClip}.glb`))
  const root = base.getRoot()
  const byName = new Map(root.listNodes().map((n) => [n.getName(), n]))
  const buffer = root.listBuffers()[0]

  root.listAnimations().forEach((a) => a.setName(baseClip))

  for (const clip of extraClips) {
    const doc = await io.read(join(SRC, `${name}-${clip}.glb`))
    for (const anim of doc.getRoot().listAnimations()) {
      const out = base.createAnimation(clip)
      for (const channel of anim.listChannels()) {
        const target = channel.getTargetNode()
        const node = target && byName.get(target.getName())
        if (!node) throw new Error(`${name}/${clip} : os « ${target?.getName()} » absent du squelette de base`)
        const sampler = channel.getSampler()
        const copy = (acc) =>
          base.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buffer)
        const s = base
          .createAnimationSampler()
          .setInput(copy(sampler.getInput()))
          .setOutput(copy(sampler.getOutput()))
          .setInterpolation(sampler.getInterpolation())
        out.addSampler(s).addChannel(base.createAnimationChannel().setTargetNode(node).setTargetPath(channel.getTargetPath()).setSampler(s))
      }
    }
  }
  return base
}

if (!existsSync(SRC)) {
  console.log(`Sources absentes (${SRC}) : rien à construire.`)
  process.exit(0)
}
mkdirSync(OUT, { recursive: true })
const bin = join('node_modules', '.bin', 'gltf-transform')
for (const [name, clips] of Object.entries(CHARACTERS)) {
  if (!clips.every((c) => existsSync(join(SRC, `${name}-${c}.glb`)))) {
    console.log(`${name} : clips manquants (${clips.join(', ')}), ignoré.`)
    continue
  }
  const merged = join(tmpdir(), `personnage-${name}.glb`)
  await io.write(merged, await merge(name, clips))
  const out = join(OUT, `${name}.glb`)
  execFileSync(bin, ['optimize', merged, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', TEXTURE_SIZE, '--simplify', 'false'], { stdio: 'pipe' })
  rmSync(merged)
  console.log(`${name} → ${out} (${(statSync(out).size / 1024).toFixed(0)} Ko, clips : ${clips.join(', ')})`)
}
