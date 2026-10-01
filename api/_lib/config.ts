/**
 * Réglages du chat Rémi · IA côté serveur. Les plafonds partagés avec le navigateur viennent du
 * contrat (`src/features/remiChat/contract.ts`), jamais redéfinis ici.
 *
 * Imports relatifs en `.js` : la fonction est exécutée en ESM (`"type": "module"`), où Node exige
 * l'extension ; TypeScript, Vite et esbuild la résolvent vers le fichier `.ts`.
 */
import {
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGES_PER_VISITOR,
  MAX_USER_MESSAGE_CHARS,
  REMI_MODEL,
} from '../../src/features/remiChat/contract.js'

export { MAX_HISTORY_MESSAGES, MAX_MESSAGES_PER_VISITOR, MAX_USER_MESSAGE_CHARS, REMI_MODEL }

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
/** Identifient l'application auprès d'OpenRouter (classement et tableau de bord). */
export const OPENROUTER_REFERER = 'https://www.odyssee-musee-100.com'
export const OPENROUTER_TITLE = 'Le Musée des 100'

/** Réponse courte attendue (2 à 4 phrases) : 350 jetons laissent de la marge sans laisser dériver le coût. */
export const MAX_OUTPUT_TOKENS = 350
export const TEMPERATURE = 0.6
/** Délai total accordé à OpenRouter, flux compris. La fonction elle-même est plafonnée à 30 s (`api/remi.ts`). */
export const UPSTREAM_TIMEOUT_MS = 20_000

/** Corps JSON accepté : un historique de 12 messages de 500 caractères en tient largement dans 32 Ko. */
export const MAX_BODY_BYTES = 32 * 1024
/** Messages reçus au plus (avant de ne garder que les plus récents) : borne la validation, pas l'usage normal. */
export const MAX_RAW_MESSAGES = 200
/** Une réponse de Rémi renvoyée dans l'historique : 350 jetons font environ 1 500 caractères. */
export const MAX_ASSISTANT_MESSAGE_CHARS = 3000
export const MAX_VISITOR_ID_CHARS = 64
/** Borne des compteurs de la progression transmise en contexte. */
export const MAX_CONTEXT_COUNT = 10_000
