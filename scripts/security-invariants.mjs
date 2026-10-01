#!/usr/bin/env node
/**
 * Invariants de sécurité, vérifiés en CI après le build.
 * - aucune clé serveur Supabase dans le bundle client ni dans src/ ;
 * - aucune trace d'OpenRouter (clé, adresse, variable) dans les fichiers servis au navigateur : le chat
 *   de Rémi passe par la fonction /api/remi, seule à connaître la clé ;
 * - aucun HTML injecté (les bios viennent d'une liste externe) ;
 * - en-têtes de sécurité présents dans vercel.json, et réécriture SPA qui laisse passer /api/.
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
// Tout ce que le navigateur peut télécharger comme texte (pas les images, polices ni modèles 3D).
const SERVED_TEXT = /\.(js|mjs|html|json|css|svg|txt|webmanifest|map)$/
const OPENROUTER_TRACES = [
  [/sk-or-/, 'une clé OpenRouter (sk-or-)'],
  [/openrouter\.ai/i, "l'adresse d'OpenRouter (openrouter.ai)"],
  [/OPENROUTER_API_KEY/, 'la variable OPENROUTER_API_KEY'],
]
for (const file of walk('dist').filter((f) => SERVED_TEXT.test(f))) {
  const text = readFileSync(file, 'utf8')
  for (const [pattern, label] of OPENROUTER_TRACES) {
    if (pattern.test(text)) failures.push(`${file} contient ${label} : le navigateur ne doit jamais appeler OpenRouter`)
  }
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
  if (/dangerouslySetInnerHTML\s*[=:]/.test(text)) failures.push(`${file} utilise dangerouslySetInnerHTML (contenu externe non fiable)`)
  if (/\beval\s*\(|new\s+Function\s*\(/.test(text)) failures.push(`${file} utilise eval / new Function`)
  if (/import\.meta\.env\.VITE_[A-Z_]*(SECRET|SERVICE)/.test(text)) failures.push(`${file} expose un secret via VITE_`)
  if (/sk-or-|openrouter\.ai|VITE_OPENROUTER/.test(text)) failures.push(`${file} référence OpenRouter côté client (clé, adresse ou variable VITE_)`)
}

// 2 bis. Fonctions serveur : la clé n'est lue que dans l'environnement, jamais écrite en dur
for (const file of walk('api').filter((f) => /\.(ts|js|mjs)$/.test(f) && !/\.test\.(ts|js|mjs)$/.test(f))) {
  const text = readFileSync(file, 'utf8')
  if (/sk-or-/.test(text)) failures.push(`${file} contient une clé OpenRouter en dur`)
  if (/import\.meta\.env|VITE_OPENROUTER/.test(text)) failures.push(`${file} lit une variable préfixée VITE_ : la clé serveur n'en a jamais`)
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
  // Les textures intégrées aux GLB sont lues par `fetch(blob:…)` (GLTFLoader → ImageBitmapLoader, sur
  // Chrome, Android et Safari ≥ 17). Sans `blob:` dans connect-src, elles échouent toutes et les
  // modèles s'affichent en blanc (29/09 : Cyril et Rémi).
  const csp = (cfg.headers ?? []).flatMap((h) => h.headers ?? []).find((h) => h.key.toLowerCase() === 'content-security-policy')?.value ?? ''
  const connectSrc = csp.split(';').map((d) => d.trim().split(/\s+/)).find(([name]) => name === 'connect-src')
  if (csp && !connectSrc?.includes('blob:')) failures.push('vercel.json : connect-src doit autoriser blob: (textures des GLB)')

  // La réécriture SPA (tout vers /index.html) ne doit pas avaler /api/ : sinon POST /api/remi tomberait
  // sur la page d'accueil. La source est une expression régulière à la manière de path-to-regexp.
  const spaRewrite = (cfg.rewrites ?? []).find((r) => r.destination === '/index.html')
  if (spaRewrite) {
    try {
      const re = new RegExp(`^${spaRewrite.source}$`)
      if (re.test('/api/remi')) failures.push('vercel.json : la réécriture vers /index.html doit exclure api/ (/api/remi la matche)')
      if (!re.test('/une-page')) failures.push('vercel.json : la réécriture vers /index.html ne matche plus les pages du jeu')
    } catch {
      failures.push('vercel.json : réécriture illisible, impossible de vérifier qu’elle exclut api/')
    }
  }
}

if (failures.length) {
  console.error('Invariants de sécurité en échec :\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log('Invariants de sécurité : OK')
