// Propriétaire : agent joueur.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { bridges, input } from '../state/runtime'
import './TouchJoystick.css'

const MAX_RADIUS = 60 // px : rayon max de déplacement du bouton
const DEAD_ZONE = 0.12 // 12 % du rayon
const RUN_THRESHOLD = 0.9 // 90 % du rayon → course
const TAP_MAX_DURATION_MS = 250
const TAP_MAX_DISTANCE_PX = 10
// Filet de sécurité : le marqueur est normalement retiré par `onAnimationEnd` (anneau CSS, 480 ms).
// Mais avec `prefers-reduced-motion: reduce`, l'animation est coupée (`animation: none` dans
// TouchJoystick.css) et `animationend` ne se déclenche jamais — sans ce filet, chaque tap laisserait
// un marqueur pour toujours (fuite de nœuds DOM, tableau qui grossit indéfiniment).
const TAP_MARKER_FALLBACK_MS = 580

interface ScreenPoint {
  x: number
  y: number
}

interface TapMarker extends ScreenPoint {
  id: number
}

/**
 * Surimpression DOM plein écran, sous le HUD (z-index bas dans `TouchJoystick.css`) : les boutons
 * du HUD restent cliquables car ils sont dessinés au-dessus. Joystick flottant qui apparaît sous le
 * pouce au toucher ; un tap court pose une cible de déplacement automatique.
 */
export function TouchJoystick() {
  const knobRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const originRef = useRef<ScreenPoint>({ x: 0, y: 0 })
  const downTimeRef = useRef(0)
  const maxMoveRef = useRef(0)
  const markerSeq = useRef(0)
  const markerTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const [visible, setVisible] = useState(false)
  const [origin, setOrigin] = useState<ScreenPoint>({ x: 0, y: 0 })
  const [markers, setMarkers] = useState<TapMarker[]>([])

  // Si le composant est démonté pendant qu'un doigt est posé (ex. une fiche s'ouvre), on remet l'entrée à zéro,
  // et on annule les filets de sécurité des marqueurs de tap encore en attente.
  useEffect(
    () => () => {
      input.moveX = 0
      input.moveY = 0
      input.run = false
      for (const timer of markerTimersRef.current.values()) clearTimeout(timer)
      markerTimersRef.current.clear()
    },
    [],
  )

  const setKnobOffset = useCallback((dx: number, dy: number) => {
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
  }, [])

  const resetJoystick = useCallback(() => {
    pointerIdRef.current = null
    input.moveX = 0
    input.moveY = 0
    input.run = false
    setVisible(false)
    setKnobOffset(0, 0)
  }, [setKnobOffset])

  const removeMarker = useCallback((id: number) => {
    setMarkers((prev) => (prev.some((m) => m.id === id) ? prev.filter((m) => m.id !== id) : prev))
    const timer = markerTimersRef.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      markerTimersRef.current.delete(id)
    }
  }, [])

  const spawnTapMarker = useCallback(
    (point: ScreenPoint) => {
      const id = ++markerSeq.current
      setMarkers((prev) => [...prev, { id, ...point }])
      // Filet de sécurité (voir TAP_MARKER_FALLBACK_MS) : garantit le retrait même sans `animationend`.
      markerTimersRef.current.set(
        id,
        setTimeout(() => removeMarker(id), TAP_MARKER_FALLBACK_MS),
      )
    },
    [removeMarker],
  )

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== null) return // un doigt pilote déjà le joystick
      pointerIdRef.current = e.pointerId
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Pas de capture de pointeur (jsdom, vieux navigateur) : le joystick reste utilisable.
      }
      originRef.current = { x: e.clientX, y: e.clientY }
      downTimeRef.current = performance.now()
      maxMoveRef.current = 0
      setOrigin({ x: e.clientX, y: e.clientY })
      setVisible(true)
      setKnobOffset(0, 0)
    },
    [setKnobOffset],
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return
      const dx = e.clientX - originRef.current.x
      const dy = e.clientY - originRef.current.y
      const dist = Math.hypot(dx, dy)
      maxMoveRef.current = Math.max(maxMoveRef.current, dist)

      const clamped = Math.min(dist, MAX_RADIUS)
      const knobX = dist > 0 ? (dx / dist) * clamped : 0
      const knobY = dist > 0 ? (dy / dist) * clamped : 0
      setKnobOffset(knobX, knobY)

      const norm = clamped / MAX_RADIUS
      if (norm < DEAD_ZONE) {
        input.moveX = 0
        input.moveY = 0
        input.run = false
        return
      }
      // Repère écran : le haut de l'écran donne un moveY négatif (voir state/runtime.ts).
      const magnitude = (norm - DEAD_ZONE) / (1 - DEAD_ZONE)
      input.moveX = (dx / dist) * magnitude
      input.moveY = (dy / dist) * magnitude
      input.run = norm > RUN_THRESHOLD
    },
    [setKnobOffset],
  )

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return
      const duration = performance.now() - downTimeRef.current
      if (duration < TAP_MAX_DURATION_MS && maxMoveRef.current < TAP_MAX_DISTANCE_PX) {
        const point = bridges.screenToFloor?.(e.clientX, e.clientY) ?? null
        if (point) {
          input.tapTarget = point
          spawnTapMarker({ x: e.clientX, y: e.clientY })
        }
      }
      resetJoystick()
    },
    [resetJoystick, spawnTapMarker],
  )

  const handlePointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return
      resetJoystick()
    },
    [resetJoystick],
  )

  return (
    <div
      className="joystick-zone"
      data-testid="joystick-zone"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {visible && (
        <div className="joystick-base" style={{ left: origin.x, top: origin.y }}>
          <div ref={knobRef} className="joystick-knob" data-testid="joystick-knob" />
        </div>
      )}
      {markers.map((m) => (
        <div
          key={m.id}
          className="joystick-tap-marker"
          style={{ left: m.x, top: m.y }}
          onAnimationEnd={() => removeMarker(m.id)}
        />
      ))}
    </div>
  )
}
