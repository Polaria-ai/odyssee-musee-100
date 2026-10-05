#!/usr/bin/env node
/**
 * Optimise les modèles 3D bruts (assets-src/<module>/**.glb|gltf) vers public/models/<module>/.
 * - géométrie : dédoublonnage, soudure, simplification légère, compression meshopt ;
 * - textures : redimensionnées (≤ 512 px) et converties en WebP.
 * Usage : node scripts/optimize-assets.mjs [module]   (sans argument : tous les modules)
 * Les packs bruts (assets-src/) ne sont pas versionnés ; seuls les GLB optimisés le sont.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, relative } from 'node:path'

const SRC = 'assets-src'
const OUT = 'public/models'
const only = process.argv[2]
const bin = join('node_modules', '.bin', 'gltf-transform')

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

if (!existsSync(SRC)) {
  console.log(`Rien à optimiser : ${SRC}/ absent.`)
  process.exit(0)
}
const inputs = walk(SRC).filter((f) => /\.(glb|gltf)$/i.test(f) && (!only || relative(SRC, f).startsWith(`${only}/`)))
let total = 0
for (const input of inputs) {
  const rel = relative(SRC, input)
  const out = join(OUT, dirname(rel), `${basename(rel, extname(rel))}.glb`)
  mkdirSync(dirname(out), { recursive: true })
  execFileSync(bin, ['optimize', input, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '512', '--simplify', 'false'], { stdio: 'pipe' })
  const size = statSync(out).size
  total += size
  console.log(`${rel} → ${out} (${(size / 1024).toFixed(0)} Ko)`)
}
console.log(`${inputs.length} modèle(s), ${(total / 1024).toFixed(0)} Ko au total.`)
