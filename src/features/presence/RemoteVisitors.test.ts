import { describe, expect, it } from 'vitest'
import { POP_MS, popScale } from './RemoteVisitors'
// Source brute (Vite `?raw`, déclaré par `vite/client`) : sert uniquement à la garantie « par
// conception » ci-dessous, jamais à un test de comportement.
import source from './RemoteVisitors.tsx?raw'

describe('popScale — apparition d’un pair par mise à l’échelle', () => {
  it('part à 0,6 et termine à 1', () => {
    expect(popScale(0)).toBeCloseTo(0.6, 5)
    expect(popScale(POP_MS)).toBe(1)
    expect(popScale(POP_MS * 10)).toBe(1) // au-delà de la durée : reste à 1, jamais d'oscillation
  })

  it('dépasse légèrement 1 au pic (« pop »), avant de redescendre à 1', () => {
    const atPeak = popScale(POP_MS * 0.7)
    expect(atPeak).toBeGreaterThan(1)
    expect(atPeak).toBeCloseTo(1.05, 5)
    const afterPeak = popScale(POP_MS * 0.9)
    expect(afterPeak).toBeLessThan(atPeak)
    expect(afterPeak).toBeGreaterThanOrEqual(1)
  })

  it('est monotone croissante avant le pic, puis décroissante jusqu’à 1', () => {
    const samples = Array.from({ length: 11 }, (_, i) => popScale((POP_MS * i) / 10))
    const peakIndex = samples.indexOf(Math.max(...samples))
    for (let i = 1; i <= peakIndex; i++) expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1])
    for (let i = peakIndex + 1; i < samples.length; i++) expect(samples[i]).toBeLessThanOrEqual(samples[i - 1])
  })

  it('une durée nulle ou négative retombe directement à la taille finale (jamais de division par zéro)', () => {
    expect(popScale(100, 0)).toBe(1)
    expect(popScale(100, -50)).toBe(1)
  })
})

describe('RemoteVisitors — jamais de mutation d’un matériau partagé (par conception)', () => {
  // `AvatarMesh` met en cache des matériaux PARTAGÉS entre toutes ses instances (joueur compris,
  // voir son commentaire `materialFor`/`colorMaterialCache` et ses constantes `SHADOW_MATERIAL`,
  // `EYE_MATERIAL`, etc., qui ne sont pas exportées — rien à espionner depuis l'extérieur). La
  // garantie vérifiable ici est structurelle : ce module ne doit plus jamais parcourir
  // (`traverse`) le groupe d'un pair pour cloner ou modifier `opacity`/`transparent` sur les
  // matériaux qu'il y trouve — exactement le mécanisme qui affichait un carré bleu opaque à la
  // place de l'ombre ronde. L'apparition d'un pair passe uniquement par `group.scale` (propre à
  // chaque pair) et, pour l'étiquette de pseudo, par un matériau créé pour cette seule instance.

  it('ne parcourt plus le groupe d’un pair pour toucher ses matériaux', () => {
    expect(source).not.toContain('.traverse(')
    expect(source).not.toContain('useFadeIn')
  })

  it('ne clone jamais de matériau (c’était le seul moyen sûr de muter un matériau partagé)', () => {
    expect(source).not.toContain('.clone(')
  })

  it('anime l’apparition par l’échelle du groupe du pair, jamais par ses matériaux', () => {
    expect(source).toContain('group.scale.setScalar(popScale(elapsed))')
  })

  it('le fondu de l’étiquette de pseudo agit sur un matériau propre à cette instance (pas de cache)', () => {
    expect(source).toContain('spriteMaterial ref={materialRef}')
  })
})
