#!/usr/bin/env node
/**
 * Budget de poids : le musée doit se charger vite sur un réseau 4G de salle de spectacle.
 * Échoue si le JavaScript total compressé (gzip) ou le point d'entrée dépassent le budget.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGET_TOTAL_JS_GZ = 650 * 1024
const BUDGET_ENTRY_JS_GZ = 160 * 1024
const BUDGET_TOTAL_CSS_GZ = 40 * 1024
const BUDGET_PUBLIC_ASSET = 400 * 1024 // par fichier dans dist hors JS/CSS (images, modèles)

const dist = 'dist'
const assets = join(dist, 'assets')
let totalJs = 0
let totalCss = 0
let entry = 0
const failures = []

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

for (const file of walk(assets)) {
  const buf = readFileSync(file)
  const gz = gzipSync(buf).length
  if (file.endsWith('.js')) {
    totalJs += gz
    if (/[/\\]index-[^/\\]+\.js$/.test(file)) entry += gz
  } else if (file.endsWith('.css')) {
    totalCss += gz
  }
}

for (const file of walk(dist)) {
  if (/\.(js|css|html|json|webmanifest|svg)$/.test(file)) continue
  const size = statSync(file).size
  if (size > BUDGET_PUBLIC_ASSET) failures.push(`${file} pèse ${(size / 1024).toFixed(0)} Ko (> ${BUDGET_PUBLIC_ASSET / 1024} Ko) : compresser en WebP/AVIF`)
}

const kb = (n) => `${(n / 1024).toFixed(1)} Ko`
console.log(`JS total gzip : ${kb(totalJs)} / ${kb(BUDGET_TOTAL_JS_GZ)}`)
console.log(`JS entrée gzip : ${kb(entry)} / ${kb(BUDGET_ENTRY_JS_GZ)}`)
console.log(`CSS total gzip : ${kb(totalCss)} / ${kb(BUDGET_TOTAL_CSS_GZ)}`)
if (totalJs > BUDGET_TOTAL_JS_GZ) failures.push(`JS total ${kb(totalJs)} dépasse ${kb(BUDGET_TOTAL_JS_GZ)}`)
if (entry > BUDGET_ENTRY_JS_GZ) failures.push(`JS d'entrée ${kb(entry)} dépasse ${kb(BUDGET_ENTRY_JS_GZ)}`)
if (totalCss > BUDGET_TOTAL_CSS_GZ) failures.push(`CSS ${kb(totalCss)} dépasse ${kb(BUDGET_TOTAL_CSS_GZ)}`)

if (failures.length) {
  console.error('\nBudget dépassé :\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log('Budget respecté.')
