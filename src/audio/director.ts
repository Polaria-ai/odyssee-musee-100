/**
 * Chef d'orchestre sonore, monté une fois dans `App` : démarre/arrête la musique d'ambiance,
 * joue le carillon de changement de salle, et le pas du joueur (lu dans `runtime.player`, hors
 * zustand : pas de re-rendu React). La cadence des pas est lue par une boucle
 * `requestAnimationFrame` légère, indépendante du rendu 3D (`useFrame` appartient au module joueur).
 */
import { useEffect, useRef } from 'react'
import { useGame } from '../state/gameStore'
import { player } from '../state/runtime'
import type { WingId } from '../types'
import { isSoundEnabled, subscribeSound } from './engine'
import { playSfx } from './sfx'
import { setMusicRoom, startMusic, stopMusic } from './music'

const STEP_INTERVAL_WALK = 0.32
const STEP_INTERVAL_RUN = 0.22
// Le joueur marche à ~3,2 m/s et court à ~5,6 m/s (`player/Player.tsx`, non exporté) : seuil à
// mi-chemin, une approximation suffisante pour choisir la cadence des pas.
const RUN_SPEED_THRESHOLD = 4.4
const MAX_LOOP_DT_SECONDS = 0.25

export function useAudioDirector(playing: boolean): void {
  const currentRoom = useGame((s) => s.currentRoom)
  const announcedRoomRef = useRef<WingId | null>(null)

  useEffect(() => {
    if (!playing) return
    let disposed = false
    let raf = 0
    let lastTs: number | null = null
    let stepTimer = 0

    const syncMusic = () => {
      if (isSoundEnabled()) startMusic(useGame.getState().currentRoom ?? 'hall')
      else stopMusic()
    }
    syncMusic()
    const unsubscribe = subscribeSound(syncMusic)

    const hasRaf = typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function'
    if (hasRaf) {
      const loop = (ts: number) => {
        if (disposed) return
        const dt = Math.min((ts - (lastTs ?? ts)) / 1000, MAX_LOOP_DT_SECONDS)
        lastTs = ts
        if (player.moving) {
          stepTimer += dt
          const interval = player.speed > RUN_SPEED_THRESHOLD ? STEP_INTERVAL_RUN : STEP_INTERVAL_WALK
          if (stepTimer >= interval) {
            stepTimer -= interval
            playSfx('step')
          }
        } else {
          stepTimer = 0
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    return () => {
      disposed = true
      if (hasRaf) cancelAnimationFrame(raf)
      unsubscribe()
      stopMusic()
      announcedRoomRef.current = null
    }
  }, [playing])

  useEffect(() => {
    if (!playing || !currentRoom) return
    setMusicRoom(currentRoom)
    if (announcedRoomRef.current !== null && announcedRoomRef.current !== currentRoom) playSfx('room')
    announcedRoomRef.current = currentRoom
  }, [currentRoom, playing])
}
