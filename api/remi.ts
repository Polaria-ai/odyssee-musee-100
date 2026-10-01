/**
 * Fonction Vercel `POST /api/remi` : chat avec Rémi · IA (runtime Node.js, gestionnaire au standard Web).
 *
 * Le navigateur ne connaît ni OpenRouter ni sa clé : il poste ici, et seule cette fonction lit
 * `OPENROUTER_API_KEY` (variable d'environnement serveur, jamais préfixée `VITE_`). Toute la logique
 * est dans `api/_lib/` (modules purs testés ; Vercel n'expose pas comme routes les fichiers dont le
 * chemin commence par `_`). Architecture, variables et garde-fous : `docs/REMI-IA.md`.
 *
 * Sans clé, ou avec `REMI_CHAT_DISABLED=1`, la fonction répond `unavailable` : le jeu garde les
 * répliques scriptées de Rémi.
 */
import { createRemiHandler, methodNotAllowed } from './_lib/handler.js'

/**
 * La durée par défaut d'une fonction Vercel est de 300 s (plan Hobby compris, avec Fluid compute) :
 * on la ramène à 30 s, pour 20 s accordées à OpenRouter, afin qu'une panne ne coûte jamais plus.
 */
export const config = { runtime: 'nodejs', maxDuration: 30 }

// Créé une fois par instance : les plafonds de `limits.ts` vivent dans cette closure.
const handle = createRemiHandler()

export async function POST(request: Request): Promise<Response> {
  return handle(request)
}

// Refus propre des autres méthodes (sans eux, Vercel répondrait lui-même par une page d'erreur).
export function GET(): Response {
  return methodNotAllowed()
}
export function HEAD(): Response {
  return methodNotAllowed()
}
export function PUT(): Response {
  return methodNotAllowed()
}
export function PATCH(): Response {
  return methodNotAllowed()
}
export function DELETE(): Response {
  return methodNotAllowed()
}
export function OPTIONS(): Response {
  return methodNotAllowed()
}
