// Propriétaire : agent joueur.
import { useEffect, useRef } from 'react'
import { useGame } from '../state/gameStore'
import { input } from '../state/runtime'

interface KeyState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  run: boolean
}

function emptyKeys(): KeyState {
  return { up: false, down: false, left: false, right: false, run: false }
}

/**
 * `code` (position physique de la touche), pas `key` (caractère produit) : ainsi ZQSD sur un
 * clavier AZERTY et WASD sur un clavier QWERTY tombent sur les mêmes touches physiques.
 */
const MOVE_CODES: Partial<Record<string, keyof Omit<KeyState, 'run'>>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
}

const RUN_CODES = new Set(['ShiftLeft', 'ShiftRight'])
const INTERACT_CODES = new Set(['Enter', 'Space', 'KeyE'])

/**
 * Flèches / ZQSD / WASD pour se déplacer, Shift pour courir, Entrée/E/Espace pour l'action
 * principale (`interact`). Échap ferme toujours les surimpressions (fiche, dialogue, carnet
 * de tampons), même quand `enabled` est faux — l'échap doit fonctionner quand une fiche est ouverte.
 */
export function useKeyboardControls(enabled: boolean): void {
  const keys = useRef<KeyState>(emptyKeys())

  useEffect(() => {
    if (!enabled) {
      keys.current = emptyKeys()
      input.moveX = 0
      input.moveY = 0
      input.run = false
    }
  }, [enabled])

  useEffect(() => {
    function applyMoveInput() {
      const k = keys.current
      const moveX = (k.right ? 1 : 0) - (k.left ? 1 : 0)
      const moveY = (k.down ? 1 : 0) - (k.up ? 1 : 0)
      input.moveX = moveX
      input.moveY = moveY
      input.run = k.run
      if (moveX !== 0 || moveY !== 0) input.tapTarget = null
    }

    function resetMoveInput() {
      keys.current = emptyKeys()
      input.moveX = 0
      input.moveY = 0
      input.run = false
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Escape') {
        const g = useGame.getState()
        g.closePerson()
        g.closeDialogue()
        g.setStampCardOpen(false)
        return
      }
      if (!enabled) return
      const moveKey = MOVE_CODES[e.code]
      if (moveKey) {
        keys.current[moveKey] = true
        applyMoveInput()
        e.preventDefault()
        return
      }
      if (RUN_CODES.has(e.code)) {
        keys.current.run = true
        applyMoveInput()
        return
      }
      if (INTERACT_CODES.has(e.code)) {
        useGame.getState().interact()
        e.preventDefault()
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      const moveKey = MOVE_CODES[e.code]
      if (moveKey) {
        keys.current[moveKey] = false
        applyMoveInput()
        return
      }
      if (RUN_CODES.has(e.code)) {
        keys.current.run = false
        applyMoveInput()
      }
    }

    function handleBlur() {
      resetMoveInput()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      resetMoveInput()
    }
  }, [enabled])
}
