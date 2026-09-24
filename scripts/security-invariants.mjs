#!/usr/bin/env node
/**
 * Invariants de sécurité, vérifiés en CI après le build.
 * - aucune clé serveur Supabase dans le bundle client ni dans src/ ;
 * - aucun HTML injecté (les bios viennent d'une liste externe) ;
 * - en-têtes de sécurité présents dans vercel.json.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const failures = []
const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((n) => {
        const p = join(dir, n)
        return statSync(p).isDirectory() ? walk(p) : [p]
      })
    : []

function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return payload.role
  } catch {
    return undefined
  }
}

// 1. Bundle client
if (!existsSync('dist')) failures.push('dist/ absent : lancer `pnpm build` avant ce script')
for (const file of walk('dist').filter((f) => /\.(js|html|json)$/.test(f))) {
  const text = readFileSync(file, 'utf8')
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) failures.push(`${file} contient une clé secrète Supabase (sb_secret_)`)
  if (/SERVICE_ROLE/i.test(text)) failures.push(`${file} mentionne SERVICE_ROLE`)
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) {
    if (jwtRole(m[0]) === 'service_role') failures.push(`${file} contient un JWT service_role`)
  }
}

// 2. Code source client
for (const file of walk('src').filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))) {
  const text = readFileSync(file, 'utf8')
  if (/SERVICE_ROLE/.test(text)) failures.push(`${file} référence une clé service_role côté client`)
  if (/dangerouslySetInnerHTML/.test(text)) failures.push(`${file} utilise dangerouslySetInnerHTML (contenu externe non fiable)`)
  if (/\beval\s*\(|new\s+Function\s*\(/.test(text)) failures.push(`${file} utilise eval / new Function`)
  if (/import\.meta\.env\.VITE_[A-Z_]*(SECRET|SERVICE)/.test(text)) failures.push(`${file} expose un secret via VITE_`)
}

// 3. Fichiers d'environnement versionnés
for (const f of ['.env', '.env.local', '.env.production']) {
  if (existsSync(f)) {
    const text = readFileSync(f, 'utf8')
    if (/SUPABASE_SERVICE_ROLE_KEY=\S+/.test(text)) failures.push(`${f} contient une clé service_role renseignée`)
  }
}

// 4. En-têtes HTTP
if (!existsSync('vercel.json')) failures.push('vercel.json absent')
else {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'))
  const headers = (cfg.headers ?? []).flatMap((h) => h.headers ?? []).map((h) => h.key.toLowerCase())
  for (const required of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
    if (!headers.includes(required)) failures.push(`vercel.json : en-tête ${required} manquant`)
  }
}

if (failures.length) {
  console.error('Invariants de sécurité en échec :\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log('Invariants de sécurité : OK')
