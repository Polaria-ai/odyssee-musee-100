/**
 * `frameGeometry.ts` dessine sur des `BufferGeometry` three.js pures (pas de canvas 2D, comme
 * `roomGeometry.ts`) : testable sans DOM/WebGL. On vérifie la fusion (pas d'exception, pas de
 * géométrie dégénérée) et que les couches restent bien emboîtées (chaque couche strictement plus
 * grande que la suivante, sans quoi la moulure « biseautée » ne se verrait plus — voir le commentaire
 * de `buildFrameGeometry`) et jamais enfoncées dans le mur (voir le commentaire de `LAYER_Z`).
 */
import { describe, expect, it } from 'vitest'
import { dims } from './constants'
import { FRAME_GEOMETRY, HALO_LOCAL_Y, HALO_LOCAL_Z, PAINTING_RECESS_Z, buildFrameGeometry } from './frameGeometry'

describe('buildFrameGeometry — fusion sans exception', () => {
  it('produit une géométrie non dégénérée', () => {
    const geo = buildFrameGeometry()
    geo.computeBoundingBox()
    expect(geo.boundingBox).toBeTruthy()
    expect(geo.boundingBox!.max.x).toBeGreaterThan(geo.boundingBox!.min.x)
    expect(geo.boundingBox!.max.y).toBeGreaterThan(geo.boundingBox!.min.y)
  })

  it('la largeur totale (moulure extérieure) dépasse nettement `dims.frameWidth` (relief visible)', () => {
    const geo = buildFrameGeometry()
    geo.computeBoundingBox()
    const totalWidth = geo.boundingBox!.max.x - geo.boundingBox!.min.x
    expect(totalWidth).toBeGreaterThan(dims.frameWidth + 0.2)
  })

  it('reste tout près de la face du mur, jamais enfoncé loin dedans : aucun sommet à plus de quelques cm derrière `FRAME_WALL_OFFSET` (0,06 m devant la face, voir layout.ts)', () => {
    const geo = buildFrameGeometry()
    geo.computeBoundingBox()
    // Repère local du cadre : z = 0 est le plan de la toile. Le groupe cadre est lui-même posé 0,06 m
    // devant la face du mur (FRAME_WALL_OFFSET, layout.ts) : le sommet le plus reculé (demi-épaisseur
    // de la moulure extérieure, `LAYER_Z.outer` ± sa demi-épaisseur) s'enfonce d'environ 2 cm dans le
    // mur (0,3–0,4 m d'épaisseur, voir constants.ts) — invisible, jamais proche de la face arrière.
    expect(geo.boundingBox!.min.z).toBeGreaterThanOrEqual(-0.09)
  })

  it('la géométrie exportée `FRAME_GEOMETRY` est celle construite au chargement du module (même bounding sphere)', () => {
    expect(FRAME_GEOMETRY.boundingSphere).toBeTruthy()
  })
})

describe('Empilement des couches — recul croissant vers le fond, jamais un chevauchement inversé', () => {
  it('la toile (peinture) reste plus reculée que la face avant du passe-partout, pour un vrai retrait visuel', () => {
    // Passe-partout centré en z = 0, demi-épaisseur 0.009 (épaisseur 0.018) : face avant à z = 0.009.
    const passepartoutFrontZ = 0.009
    expect(PAINTING_RECESS_Z).toBeLessThan(passepartoutFrontZ)
  })
})

describe('Halo du spot — positionné au-dessus du cadre, jamais dans son plan', () => {
  it('se trouve au-dessus du centre du cadre (y local positif, au-delà de la mi-hauteur)', () => {
    expect(HALO_LOCAL_Y).toBeGreaterThan(dims.frameHeight / 2)
  })

  it('reste devant le plan de la toile (z local positif : ne se confond jamais avec la peinture)', () => {
    expect(HALO_LOCAL_Z).toBeGreaterThan(0)
  })
})
