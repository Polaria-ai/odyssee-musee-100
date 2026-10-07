/**
 * Les textures de la salle des Archives se dessinent sur un canvas 2D (absent de jsdom) : on ne teste ici
 * que ce qui est pur — la dérivation des bouts transparents de dégradé depuis les jetons de la charte.
 */
import { describe, expect, it } from 'vitest'
import { charter3d } from '../../styles/tokens'
import { entranceSignText, withAlpha } from './textures'

describe('panneau d’entrée publié', () => {
  it('affiche les3 tables et22 idées, avec instruction tactile FR/EN', () => {
    expect(entranceSignText('fr', 3, 22)).toEqual({ status: '3 tables rondes · 22 idées clés', instruction: 'Touchez une idée clé pour la lire' })
    expect(entranceSignText('en', 3, 22)).toEqual({ status: '3 panels · 22 key ideas', instruction: 'Tap a key idea to read it' })
  })
  it('garde un état en attente quand rien n’est publié', () => {
    expect(entranceSignText('fr', 0, 0).status).toBe('3 tables rondes · transcriptions en attente')
    expect(entranceSignText('en', 0, 0).status).toBe('3 panels · transcripts pending')
  })
})

describe('withAlpha', () => {
  it('garde la teinte du jeton et ne change que l’opacité', () => {
    expect(withAlpha('rgba(5,11,30,0.45)', 0)).toBe('rgba(5, 11, 30, 0)')
    expect(withAlpha(charter3d.archives.floor.nodeGlow, 0)).toBe('rgba(109, 228, 229, 0)')
    expect(withAlpha(charter3d.archives.floor.vignetteEdge, 0.2)).toBe('rgba(5, 11, 30, 0.2)')
  })

  it('refuse une couleur qui n’est pas un rgba()', () => {
    expect(() => withAlpha('#ffffff', 0)).toThrow()
  })
})
