/** Expose les compteurs du renderer à `window.__musee.renderInfo()` (tests de perf). Propriétaire : intégration. */
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { debugEnabled } from './debugApi'

export function DebugProbe() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    if (!debugEnabled() || !window.__musee) return
    window.__musee.renderInfo = () => ({
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    })
  }, [gl])
  return null
}
