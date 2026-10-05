#!/usr/bin/env node
/**
 * Personnages générés par Magnific (image → 3D Meshy 7.1, squelette Meshy, animations du catalogue
 * Meshy) : fusionne les animations livrées dans des fichiers séparés en UN seul GLB par personnage,
 * puis l'optimise pour le mobile (meshopt, texture WebP) vers public/models/characters/.
 *
 * Sources (non versionnées, ~7 Mo chacune) : ~/Dev/odyssee-musee-100-assets/personnages/
 *   <nom>-<clip>.glb — même squelette (24 os), un clip par fichier (idle, walk, wave, talk…).
 * Usage : node scripts/build-characters.mjs [nom…] [--debug dossier] [--out dossier] [--no-clean]
 *   - sans nom : tous les personnages ; avec des noms : seulement ceux-là (les autres GLB ne sont pas touchés) ;
 *   - --out dossier : écrit les GLB ailleurs que dans public/models/characters ;
 *   - --no-clean : saute le traitement de la texture, taches et marge (pour comparer avant / après, avec --out) ;
 *   - --debug dossier : écrit la texture avant / après traitement, le masque des texels changés (bleu : marge,
 *     rouge : taches), et garde le GLB fusionné avant optimisation (voir `scripts/clean-texture-stains.mjs`).
 * Voir docs/ASSETS.md (section Personnages) pour la provenance et l'accord des personnes.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import sharp from 'sharp'
import { cleanCharacterTexture } from './clean-texture-stains.mjs'

const SRC = join(homedir(), 'Dev', 'odyssee-musee-100-assets', 'personnages')
const args = process.argv.slice(2)
/** Valeur d'une option `--nom valeur` (undefined si absente). */
const optionValue = (flag) => {
  const at = args.indexOf(flag)
  return at >= 0 ? args[at + 1] : undefined
}
const OUT = optionValue('--out') ? resolve(optionValue('--out')) : join('public', 'models', 'characters')
const TEXTURE_SIZE = process.env.CHARACTER_TEXTURE_SIZE ?? '1024'

/** Personnage → clips : le premier fichier sert de base (maillage, squelette, texture). */
const CHARACTERS = {
  cyril: ['idle', 'walk'],
  remi: ['idle', 'wave'],
  archiviste: ['idle', 'wave', 'talk'],
}

/**
 * Réglages propres à un personnage.
 *  - `cleanTexture` : réglages (ou `{}` : ceux par défaut) du traitement de la texture AVANT sa réduction à 1024 et
 *    son optimisation, voir `scripts/clean-texture-stains.mjs` : nettoyage des taches du remaillage Meshy (`passes`) et
 *    dilatation des îlots dans le vide (`padRadius`, `scripts/atlas-padding.mjs`). Les trois personnages reçoivent la
 *    dilatation ; seul l'Archiviste a des taches à nettoyer (`passes: 0` pour les deux autres). La variable
 *    d'environnement CHARACTER_CLEAN_OPTIONS (JSON) surcharge ces réglages, pour essayer des valeurs sans éditer ce fichier.
 *  - `lean` : chaîne plus économe, pour tenir le budget de 400 Ko de `pnpm verify:bundle`. L'Archiviste a un
 *    maillage plus lourd (15 585 triangles contre 12 400) et trois clips au lieu de deux (470 Ko avec la chaîne
 *    des deux autres). `resampleTolerance` fusionne les images clés quasi identiques (écart de rotation < 0,3 °,
 *    invisible) ; `textureQuality` règle le WebP (80, comme `optimize` pour les deux autres : la compression se
 *    fait ici avant `optimize`) ; `simplify` allège le maillage (`ratio` : part des sommets gardés, `error` : écart
 *    maximal en fraction de la taille du modèle). Même taille de texture (1024) et même squelette que les autres.
 */
const OPTIONS = {
  cyril: { cleanTexture: { passes: 0 } },
  remi: { cleanTexture: { passes: 0 } },
  archiviste: {
    cleanTexture: {},
    lean: { resampleTolerance: 0.003, textureQuality: 80, simplify: { ratio: 0.8, error: 0.005 } },
  },
}

const DEBUG_DIR = optionValue('--debug') ? resolve(optionValue('--debug')) : null
const NO_CLEAN = args.includes('--no-clean')
const wanted = args.filter((a, i) => !a.startsWith('--') && !['--debug', '--out'].includes(args[i - 1]))
for (const name of wanted) if (!(name in CHARACTERS)) throw new Error(`Personnage inconnu : « ${name} » (${Object.keys(CHARACTERS).join(', ')})`)

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

/** Traite la texture de couleur du document (taches, marges d'îlots) et, avec --debug, garde de quoi le vérifier à l'œil. */
async function cleanTexture(name, doc, cleanOptions) {
  const result = await cleanCharacterTexture(doc, cleanOptions)
  const { report } = result
  const stains = report.rounds.length
    ? `${report.inStains} texels de taches changés (amas par tour : ${report.rounds.map((r) => r.clusters).join(', ')}), `
    : ''
  console.log(
    `${name} : texture ${report.width}² traitée — ${stains}` +
      `${report.inPadding} texels de vide remplis par la marge, ${report.changed} changés au total (${(report.share * 100).toFixed(2)} %), ` +
      `${report.changedProtected} protégés changés, écart max ${report.maxDelta}`,
  )
  if (result.png) doc.getRoot().listMaterials()[0].getBaseColorTexture().setImage(result.png)
  if (DEBUG_DIR) {
    mkdirSync(DEBUG_DIR, { recursive: true })
    const rawInfo = { raw: { width: result.width, height: result.height, channels: result.channels } }
    const toPng = (px) => sharp(Buffer.from(px.buffer, px.byteOffset, px.length), rawInfo).png().toBuffer()
    // Masque : rouge = tache remplie, bleu = marge ajoutée, sur la texture d'origine assombrie.
    const mask = Uint8Array.from(result.before)
    for (let i = 0; i < result.width * result.height; i++) {
      const o = i * result.channels
      for (let c = 0; c < 3; c++) mask[o + c] = result.before[o + c] >> 1
      if (result.padded[i]) { mask[o] = 40; mask[o + 1] = 90; mask[o + 2] = 255 }
      if (result.mask[i]) { mask[o] = 255; mask[o + 1] = 40; mask[o + 2] = 40 }
    }
    const [before, after, diff] = await Promise.all([toPng(result.before), toPng(result.after), toPng(mask)])
    writeFileSync(join(DEBUG_DIR, `${name}-texture-avant.png`), before)
    writeFileSync(join(DEBUG_DIR, `${name}-texture-apres.png`), after)
    writeFileSync(join(DEBUG_DIR, `${name}-texture-masque.png`), diff)
    console.log(`${name} : texture avant / après / masque écrites dans ${DEBUG_DIR}`)
  }
}

if (!existsSync(SRC)) {
  console.log(`Sources absentes (${SRC}) : rien à construire.`)
  process.exit(0)
}
mkdirSync(OUT, { recursive: true })
const bin = join('node_modules', '.bin', 'gltf-transform')
for (const [name, clips] of Object.entries(CHARACTERS)) {
  if (wanted.length && !wanted.includes(name)) continue
  if (!clips.every((c) => existsSync(join(SRC, `${name}-${c}.glb`)))) {
    console.log(`${name} : clips manquants (${clips.join(', ')}), ignoré.`)
    continue
  }
  const options = OPTIONS[name] ?? {}
  // Avec --debug, le GLB fusionné (nettoyé, avant optimisation) est gardé à côté des textures : de quoi tester d'autres réglages.
  const merged = join(DEBUG_DIR ?? tmpdir(), `personnage-${name}.glb`)
  const doc = await merge(name, clips)
  if (options.cleanTexture && !NO_CLEAN) await cleanTexture(name, doc, { ...options.cleanTexture, ...(process.env.CHARACTER_CLEAN_OPTIONS ? JSON.parse(process.env.CHARACTER_CLEAN_OPTIONS) : {}) })
  await io.write(merged, doc)
  const out = join(OUT, `${name}.glb`)
  if (options.lean) {
    // Chaîne par étapes (chacune relit et réécrit le GLB) : clips allégés, texture 1024 en WebP réglé, puis
    // optimisation du maillage avec meshopt. La compression des textures est faite avant, pas par `optimize`.
    const { resampleTolerance, textureQuality, simplify } = options.lean
    const steps = ['a', 'b', 'c'].map((k) => join(tmpdir(), `personnage-${name}-${k}.glb`))
    const gt = (...a) => execFileSync(bin, a.map(String), { stdio: 'pipe' })
    gt('resample', merged, steps[0], '--tolerance', resampleTolerance)
    gt('resize', steps[0], steps[1], '--width', TEXTURE_SIZE, '--height', TEXTURE_SIZE)
    gt('webp', steps[1], steps[2], '--quality', textureQuality)
    gt('optimize', steps[2], out, '--compress', 'meshopt', '--texture-compress', 'false', '--simplify', 'true', '--simplify-ratio', simplify.ratio, '--simplify-error', simplify.error)
    for (const f of steps) rmSync(f)
  } else {
    execFileSync(bin, ['optimize', merged, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', TEXTURE_SIZE, '--simplify', 'false'], { stdio: 'pipe' })
  }
  if (!DEBUG_DIR) rmSync(merged)
  console.log(`${name} → ${out} (${(statSync(out).size / 1024).toFixed(0)} Ko, clips : ${clips.join(', ')})`)
}
