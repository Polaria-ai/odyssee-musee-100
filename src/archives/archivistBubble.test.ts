import { describe, expect, it } from 'vitest'
import { BUBBLE_BEHIND_FAR, BUBBLE_BEHIND_HALF_WIDTH, BUBBLE_BEHIND_NEAR, playerCoversBubble } from './archivistBubble'
import { ARCHIVIST_TALK_RADIUS } from './room/constants'

describe('playerCoversBubble', () => {
  it('cache la bulle quand le joueur est juste derrière l’Archiviste (au nord), dans l’axe de la caméra', () => {
    expect(playerCoversBubble(0, -1.3)).toBe(true)
    expect(playerCoversBubble(0.5, -0.9)).toBe(true)
    expect(playerCoversBubble(-0.5, -2)).toBe(true)
  })

  it('garde la bulle quand le joueur est devant elle (au sud, côté caméra) ou sur le côté', () => {
    expect(playerCoversBubble(0, 1.6)).toBe(false)
    expect(playerCoversBubble(1.6, 1.6)).toBe(false)
    expect(playerCoversBubble(-1.6, -1.6)).toBe(false)
    expect(playerCoversBubble(2, 0)).toBe(false)
  })

  it('garde la bulle quand le joueur est derrière elle mais assez loin, ou à côté de la zone', () => {
    expect(playerCoversBubble(0, -(BUBBLE_BEHIND_FAR + 0.1))).toBe(false)
    expect(playerCoversBubble(BUBBLE_BEHIND_HALF_WIDTH + 0.05, -1.3)).toBe(false)
    expect(playerCoversBubble(0, -(BUBBLE_BEHIND_NEAR - 0.05))).toBe(false)
  })

  it('reste dans la portée de conversation : le bouton « Parler » est toujours disponible quand la bulle est cachée', () => {
    expect(BUBBLE_BEHIND_FAR).toBeLessThan(ARCHIVIST_TALK_RADIUS)
  })
})
