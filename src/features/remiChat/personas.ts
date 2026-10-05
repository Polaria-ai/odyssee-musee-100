/**
 * Configuration du chat par persona (WEL-929) : un seul composant (`RemiChat.tsx`), un seul hook (`useRemiChat.ts`),
 * une configuration par personnage. Donnée pure (aucun import React ni three), testable seule.
 *
 * - `remi` : Rémi · IA, au comptoir du hall. Textes de `strings` (relus par Rémi Godeau), accent corail de la charte.
 * - `archiviste` : l'Archiviste · IA, dans la salle des Archives de 2040. Textes de `archivisteStrings`, accent cyan.
 *
 * Ce qui ne dépend pas du personnage (boutons, compteur, attente, fin de discussion, mise en page) reste dans
 * `strings` et `remiChat.css`.
 */
import type { Localized } from '../../types'
import { DEFAULT_PERSONA, type ChatPersona } from './contract'
import { archivisteStrings, strings } from './strings'

/** Accent de couleur de la charte : le corail (parole du visiteur, bouton d'envoi) ou le cyan des Archives. */
export type PersonaAccent = 'corail' | 'cyan'

export interface PersonaConfig {
  id: ChatPersona
  /** Nom affiché en tête du chat (titre accessible de la boîte de dialogue). */
  title: Localized
  /** Mention affichée sous le nom : le visiteur parle à une IA. */
  aiNotice: Localized
  /** Étiquette (lecteurs d'écran) de la région qui porte le fil. */
  threadLabel: Localized
  /** Auteur des bulles du personnage, pour les lecteurs d'écran. */
  author: Localized
  /** « … écrit… », pendant que la réponse arrive. */
  typing: Localized
  inputLabel: Localized
  inputPlaceholder: Localized
  /** Premier message du fil, court et sans réseau. */
  greeting: Localized
  /** Début de la réponse de repli quand le service est indisponible. */
  fallbackPreface: Localized
  /** Puces de départ (envoyées telles quelles), dans l'ordre d'affichage. */
  suggestions: readonly Localized[]
  /** Personnage du buste 3D (GLB et squelette du même nom dans `src/characters/models.ts`). */
  character: ChatPersona
  accent: PersonaAccent
}

export const PERSONAS: Readonly<Record<ChatPersona, PersonaConfig>> = {
  remi: {
    id: 'remi',
    title: strings.title,
    aiNotice: strings.aiNotice,
    threadLabel: strings.threadLabel,
    author: strings.authorRemi,
    typing: strings.typing,
    inputLabel: strings.inputLabel,
    inputPlaceholder: strings.inputPlaceholder,
    greeting: strings.greeting,
    fallbackPreface: strings.fallbackPreface,
    suggestions: [strings.suggestionHow, strings.suggestionWho, strings.suggestionArchives, strings.suggestionProgram],
    character: 'remi',
    accent: 'corail',
  },
  archiviste: {
    id: 'archiviste',
    title: archivisteStrings.title,
    aiNotice: archivisteStrings.aiNotice,
    threadLabel: archivisteStrings.threadLabel,
    author: archivisteStrings.author,
    typing: archivisteStrings.typing,
    inputLabel: archivisteStrings.inputLabel,
    inputPlaceholder: archivisteStrings.inputPlaceholder,
    greeting: archivisteStrings.greeting,
    fallbackPreface: archivisteStrings.fallbackPreface,
    suggestions: [
      archivisteStrings.suggestionContents,
      archivisteStrings.suggestionProgram,
      archivisteStrings.suggestionWho,
      archivisteStrings.suggestionSaid,
    ],
    character: 'archiviste',
    accent: 'cyan',
  },
}

/** Configuration d'une persona ; Rémi pour une valeur absente. */
export function personaConfig(persona: ChatPersona | undefined): PersonaConfig {
  return PERSONAS[persona ?? DEFAULT_PERSONA]
}
