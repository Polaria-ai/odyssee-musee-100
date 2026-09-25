/** Expose les compteurs du renderer à `window.__musee.renderInfo()` (tests de perf). Propriétaire : intégration. */
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { debugEnabled } from './debugApi'

export function DebugProbe() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (!debugEnabled() || !window.__musee) return
    window.__musee.renderInfo = () => ({
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    })
    // Lit `camera.position` à la demande (pas de copie ici) : la référence de l'objet `Camera` est
    // stable tant que le Canvas n'est pas remonté, seules ses coordonnées changent chaque image.
    window.__musee.cameraPosition = () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z })
  }, [gl, camera])
  return null
}
