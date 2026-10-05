/** Expose les compteurs du renderer à `window.__musee.renderInfo()` (tests de perf). Propriétaire : intégration. */
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'
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
    const probe = new Vector3()
    window.__musee.worldToScreen = (x, y, z) => {
      probe.set(x, y, z).project(camera)
      const rect = gl.domElement.getBoundingClientRect()
      return {
        clientX: rect.left + ((probe.x + 1) / 2) * rect.width,
        clientY: rect.top + ((1 - probe.y) / 2) * rect.height,
      }
    }
  }, [gl, camera])
  return null
}
