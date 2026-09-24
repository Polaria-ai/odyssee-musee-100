/**
 * Traductions. Chaque module déclare ses textes dans son propre `strings.ts` :
 *
 *   export const strings = defineStrings({ enter: { fr: 'Entrer', en: 'Enter' } })
 *
 * puis dans un composant : `const t = useT(strings); t('enter')`.
 * Un test vérifie que tous les `strings.ts` du projet sont complets en FR et en EN.
 * Propriétaire : intégration.
 */
import { useGame } from '../state/gameStore'
import type { Lang, Localized } from '../types'

export type StringTable = Record<string, Localized>

/** Identité typée : garde les clés littérales pour l'autocomplétion. */
export function defineStrings<T extends StringTable>(table: T): T {
  return table
}

/** Choisit la langue demandée, retombe sur le français si l'anglais est vide. */
export function pick(text: Localized | undefined | null, lang: Lang): string {
  if (!text) return ''
  const value = text[lang]
  return value && value.trim().length > 0 ? value : text.fr
}

/** Remplace `{nom}` par la valeur correspondante. */
export function format(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(vars[key]) : `{${key}}`))
}

export function translate<T extends StringTable>(table: T, lang: Lang) {
  return (key: keyof T & string, vars?: Record<string, string | number>): string => format(pick(table[key], lang), vars)
}

/** Hook : renvoie `t(key, vars)` pour la langue courante. */
export function useT<T extends StringTable>(table: T) {
  const lang = useGame((s) => s.lang)
  return translate(table, lang)
}

/** Hook : renvoie `p(localized)` pour du contenu (fiches, dialogues). */
export function usePick() {
  const lang = useGame((s) => s.lang)
  return (text: Localized | undefined | null) => pick(text, lang)
}
