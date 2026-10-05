/**
 * Chargement des modèles 3D (GLB) optimisés par `scripts/optimize-assets.mjs`.
 * Compression meshopt (décodeur embarqué, aucun CDN) ; jamais Draco (décodeur chargé depuis gstatic, bloqué par la CSP).
 * Propriétaire : intégration.
 */
import { useGLTF } from '@react-three/drei'

/** Charge un modèle depuis `public/models/…` (chemin absolu, ex. `/models/world/bench.glb`). À utiliser sous <Suspense>. */
export function useModel(path: string) {
  return useGLTF(path, false, true)
}

/** Précharge un modèle (au niveau module, hors rendu). */
export function preloadModel(path: string): void {
  useGLTF.preload(path, false, true)
}
