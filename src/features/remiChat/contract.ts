/**
 * Contrat partagé du chat avec Rémi · IA (V5, WEL-918 à WEL-920), étendu au chat de l'Archiviste · IA
 * (WEL-929) par la notion de persona. Fichier figé : les agents `chat-api`, `remi-bust` et `chat-ui` le lisent,
 * aucun ne le modifie sans l'orchestrateur.
 *
 * Le navigateur n'appelle jamais OpenRouter : il poste sur `/api/remi` (fonction Vercel), qui seule
 * connaît `OPENROUTER_API_KEY`. Réponse en flux `text/event-stream`, une ligne `data: <json>` par
 * événement (voir `RemiStreamEvent`), terminée par `done` ou `error`.
 */
import type { Lang } from '../../types'

export const REMI_CHAT_ENDPOINT = '/api/remi'
/** Modèle vérifié sur l'API publique d'OpenRouter le 01/10/2026 (0,02 $/M en entrée, 0,396 $/M en sortie). */
export const REMI_MODEL = 'deepseek/deepseek-v4.1-flash'

/** Plafonds appliqués des deux côtés (client : désactive l'envoi ; serveur : refuse en `bad_request`). */
export const MAX_USER_MESSAGE_CHARS = 500
/** Messages d'historique envoyés au serveur (les plus récents ; le message d'accueil compris). */
export const MAX_HISTORY_MESSAGES = 12
/** Messages qu'un visiteur peut envoyer pendant une session (au-delà : `limit_reached`). */
export const MAX_MESSAGES_PER_VISITOR = 40

/**
 * Qui répond : Rémi · IA (au comptoir du hall) ou l'Archiviste · IA (dans les Archives de 2040). Une seule
 * fonction `/api/remi` sert les deux, avec son prompt, ses plafonds et son historique propres.
 */
export type ChatPersona = 'remi' | 'archiviste'
export const CHAT_PERSONAS: readonly ChatPersona[] = ['remi', 'archiviste']
/** Persona de toute requête qui n'en porte pas : celle des clients déjà en ligne (avant le chat de l'Archiviste). */
export const DEFAULT_PERSONA: ChatPersona = 'remi'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

/**
 * Progression de la partie, pour que le personnage oriente le visiteur (facultatif). Rémi : portraits ouverts,
 * tampons, nombre de portraits. L'Archiviste : vitrines consultées, tampons, nombre de vitrines.
 */
export interface RemiChatContext {
  visitedCount: number
  stampsCount: number
  total: number
}

export interface RemiChatRequest {
  messages: ChatMessage[]
  lang: Lang
  /** `visitorId` du store : sert au plafond par visiteur, jamais stocké. */
  visitorId: string
  context?: RemiChatContext
  /**
   * Facultatif, `DEFAULT_PERSONA` (`'remi'`) quand il manque : les clients déjà en ligne ne l'envoient pas, et
   * `client.ts` ne l'écrit pas non plus pour Rémi (requête identique à celle d'avant l'Archiviste).
   * Une valeur inconnue est refusée en `bad_request`.
   */
  persona?: ChatPersona
}

export type RemiChatErrorCode =
  /** Trop de requêtes rapprochées (plafond de débit du serveur ou d'OpenRouter). */
  | 'rate_limited'
  /** `MAX_MESSAGES_PER_VISITOR` atteint pour cette session. */
  | 'limit_reached'
  /** Requête invalide (message vide, trop long, historique mal formé). */
  | 'bad_request'
  /** Clé absente, OpenRouter injoignable, délai dépassé, réponse vide : le client passe au repli scripté. */
  | 'unavailable'

export type RemiStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; code: RemiChatErrorCode }

export type RemiChatResult = { ok: true; text: string } | { ok: false; code: RemiChatErrorCode; partialText: string }

export interface RemiStreamHandlers {
  /** Appelé à chaque morceau de texte reçu, dans l'ordre. */
  onDelta: (text: string) => void
  signal?: AbortSignal
}

/** Variante d'affichage du buste : PC coupé en deux (`split`) ou téléphone plein écran (`fullscreen`). */
export type RemiBustVariant = 'split' | 'fullscreen'

/**
 * État de Rémi pour le buste :
 * - `idle` : respiration, petits mouvements de tête ;
 * - `listening` : le visiteur écrit (tête légèrement inclinée, regard vers le chat) ;
 * - `thinking` : requête partie, aucun texte reçu ;
 * - `speaking` : le texte arrive (gestes des bras qui tournent).
 */
export type RemiMood = 'idle' | 'listening' | 'thinking' | 'speaking'

export interface RemiBustProps {
  mood: RemiMood
  variant: RemiBustVariant
  /** Personnage du buste : le GLB et le squelette sont ceux de Rémi par défaut (`DEFAULT_PERSONA`). */
  character?: ChatPersona
}
