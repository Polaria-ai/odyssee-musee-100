/**
 * Buste 3D animé de Rémi · IA dans le chat (son propre `<Canvas>`).
 * BOUCHON posé par l'orchestrateur : l'agent `remi-bust` le remplace par le vrai rendu, en gardant
 * cette signature et le `data-testid`. L'agent `chat-ui` l'importe tel quel et ne le modifie pas.
 */
import type { RemiBustProps } from './contract'

export function RemiBust({ mood, variant }: RemiBustProps) {
  return <div data-testid="remi-bust" data-mood={mood} data-variant={variant} />
}
