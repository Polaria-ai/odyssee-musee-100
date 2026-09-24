/**
 * Poignée de test exposée sur `window.__musee` en dev ou avec `?e2e=1`.
 * Sert aux tests Playwright (téléportation, lecture d'état). Propriétaire : intégration.
 */
import { useGame } from '../state/gameStore'
import { input, placePlayer, player } from '../state/runtime'

export interface MuseeDebugApi {
  state: () => ReturnType<typeof useGame.getState>
  player: typeof player
  input: typeof input
  teleport: (x: number, z: number, rotY?: number) => void
  /** Téléporte devant le portrait de `personId` et renvoie true si trouvé. */
  goToPerson: (personId: string) => boolean
  /** Compteurs du renderer (dernière image), fournis par DebugProbe. */
  renderInfo?: () => { calls: number; triangles: number; geometries: number; textures: number }
}

declare global {
  interface Window {
    __musee?: MuseeDebugApi
  }
}

export function debugEnabled(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return new URLSearchParams(window.location.search).has('e2e')
  } catch {
    return false
  }
}

export function installDebugApi(): void {
  if (typeof window === 'undefined' || !debugEnabled()) return
  window.__musee = {
    state: () => useGame.getState(),
    player,
    input,
    teleport: (x, z, rotY = 0) => placePlayer(x, z, rotY),
    goToPerson: (personId) => {
      const frame = useGame.getState().layout?.frames.find((f) => f.personId === personId)
      if (!frame) return false
      placePlayer(frame.viewPoint.x, frame.viewPoint.z, frame.rotationY + Math.PI)
      return true
    },
  }
}
