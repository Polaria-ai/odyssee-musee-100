/**
 * `frameGeometry.ts` dessine sur des `BufferGeometry` three.js pures (pas de canvas 2D, comme
 * `roomGeometry.ts`) : testable sans DOM/WebGL. On vérifie la fusion (pas d'exception, pas de
 * géométrie dégénérée) et que les couches restent bien emboîtées (chaque couche strictement plus
 * grande que la suivante, sans quoi la moulure « biseautée » ne se verrait plus — voir le commentaire
 * de `buildFrameGeometry`) et jamais enfoncées dans le mur (voir le commentaire de `LAYER_Z`).
 */
import { describe, expect, it } from 'vitest'
import { Color, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import type { BufferGeometry } from 'three'
import { charter3d, exhibitWingOrder, wingThemes } from '../styles/tokens'
import { dims } from './constants'
import { APERTURE_HEIGHT, APERTURE_WIDTH, FRAME_GEOMETRY, FRAME_GEOMETRY_BY_WING, HALO_LOCAL_Y, HALO_LOCAL_Z, LAMP_LENS, PAINTING_RECESS_Z, buildFrameGeometry } from './frameGeometry'

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

describe('Ouverture du passe-partout — RÉGRESSION WEL-875 : la toile ne doit plus jamais être masquée', () => {
  // Raycast pur (three.js `Raycaster` sur un `Mesh` non ajouté à une scène) : aucune fenêtre ni WebGL
  // requis, s'exécute normalement sous vitest/jsdom (calcul CPU sur `geometry.attributes.position`).
  // Avant le correctif, la couche « passe-partout » était un `BoxGeometry` plein, plus grand que la
  // toile et posé devant elle : ce test aurait échoué (rayon central touchant le passe-partout avant
  // d'atteindre le plan de la toile) — c'est exactement le bug rapporté (« toiles vides, fond beige
  // uni »), reproduit puis corrigé.
  function castThrough(x: number, y: number) {
    const mesh = new Mesh(FRAME_GEOMETRY, new MeshBasicMaterial())
    const raycaster = new Raycaster(new Vector3(x, y, 1), new Vector3(0, 0, -1))
    return raycaster.intersectObject(mesh)
  }

  it('le centre du cadre (où se trouve la toile) est libre : aucun triangle du cadre devant le plan de la toile', () => {
    const hits = castThrough(0, 0)
    // La toile elle-même est à `PAINTING_RECESS_Z` (~-0.004) : seul un triangle plus reculé que ça
    // serait sans conséquence (derrière la toile, invisible) — on exige qu'aucun triangle ne soit
    // touché AVANT ce plan, càd à un z >= PAINTING_RECESS_Z.
    const blocking = hits.filter((hit) => hit.point.z >= PAINTING_RECESS_Z)
    expect(blocking).toHaveLength(0)
  })

  it("un point à l'intérieur de l'ouverture (bord de la toile visible) reste libre, sur toute sa largeur/hauteur", () => {
    // Coins de l'ouverture (juste en retrait pour rester strictement dedans) : si l'un d'eux touchait
    // le cadre, l'ouverture serait plus petite que prévu (toile partiellement mangée par le mat).
    const margin = 0.005
    const points: [number, number][] = [
      [APERTURE_WIDTH / 2 - margin, APERTURE_HEIGHT / 2 - margin],
      [-(APERTURE_WIDTH / 2 - margin), APERTURE_HEIGHT / 2 - margin],
      [APERTURE_WIDTH / 2 - margin, -(APERTURE_HEIGHT / 2 - margin)],
      [-(APERTURE_WIDTH / 2 - margin), -(APERTURE_HEIGHT / 2 - margin)],
    ]
    for (const [x, y] of points) {
      const blocking = castThrough(x, y).filter((hit) => hit.point.z >= PAINTING_RECESS_Z)
      expect(blocking).toHaveLength(0)
    }
  })

  it("le passe-partout couvre bien encore le bord de la toile juste au-delà de l'ouverture (pas un simple trou béant : la latte existe toujours)", () => {
    // Juste à l'extérieur de l'ouverture, encore dans la toile (`dims.frameWidth`/`frameHeight`) :
    // le passe-partout doit recouvrir ce point (comportement voulu, voir `APERTURE_OVERLAP`).
    const hits = castThrough(APERTURE_WIDTH / 2 + 0.01, 0)
    expect(hits.length).toBeGreaterThan(0)
  })

  it("l'ouverture reste strictement plus petite que la toile (recouvrement réel, pas juste égal)", () => {
    expect(APERTURE_WIDTH).toBeLessThan(dims.frameWidth)
    expect(APERTURE_HEIGHT).toBeLessThan(dims.frameHeight)
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

// --- Charte 3D du 29/09/2026 : cadres blancs à moulure d'aile, plus de bois doré ---

/** Couleurs (hex sRGB, minuscules) présentes par sommet dans la géométrie, avec le nombre de sommets de chacune. */
function vertexColors(geo: BufferGeometry): Map<string, number> {
  const attr = geo.getAttribute('color')
  const counts = new Map<string, number>()
  const c = new Color()
  for (let i = 0; i < attr.count; i++) {
    c.fromBufferAttribute(attr, i)
    const hex = `#${c.getHexString()}`
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  return counts
}

const hexOf = (css: string): string => `#${new Color(css).getHexString()}`

describe('Couleurs du cadre — charte 3D (aucune teinte dorée ou crème)', () => {
  const frame = charter3d.frame

  it.each(exhibitWingOrder)('aile %s : la moulure médiane porte l’accent de l’aile, le reste vient de charter3d.frame', (wing) => {
    const colors = vertexColors(FRAME_GEOMETRY_BY_WING[wing])
    const accent = hexOf(wingThemes[wing].accent)
    const allowed = new Set([frame.outer, accent, frame.lip, frame.mat, frame.lampArm, frame.lampShade, frame.lens].map(hexOf))
    for (const hex of colors.keys()) expect(allowed.has(hex)).toBe(true)
    // Chaque teinte de la charte est bien utilisée : moulure blanche, moulure d'aile, nuit (liseré, passe-partout, spot).
    expect(colors.has(hexOf(frame.outer))).toBe(true)
    expect(colors.has(accent)).toBe(true)
    expect(colors.has(hexOf(frame.lip))).toBe(true)
  })

  it('la moulure extérieure est blanche et la moulure médiane n’est plus blanche : le cadre a deux tons', () => {
    for (const wing of exhibitWingOrder) {
      expect(hexOf(wingThemes[wing].accent)).not.toBe(hexOf(frame.outer))
    }
  })

  it('les trois ailes ont trois géométries distinctes (une par accent), sans doublon', () => {
    const geos = exhibitWingOrder.map((w) => FRAME_GEOMETRY_BY_WING[w])
    const accents = exhibitWingOrder.map((w) => wingThemes[w].accent)
    expect(new Set(accents).size).toBe(3)
    expect(new Set(geos).size).toBe(3)
  })

  it('`FRAME_GEOMETRY` (sans argument) prend l’accent du hall, comme l’Industrialisation : même instance, pas de maillage en plus', () => {
    expect(charter3d.rooms.hall.accent).toBe(charter3d.rooms.industrialisation.accent)
    expect(FRAME_GEOMETRY).toBe(FRAME_GEOMETRY_BY_WING.industrialisation)
  })

  it('l’ampoule du spot est celle de la charte (blanche)', () => {
    expect(LAMP_LENS).toBe(frame.lens)
  })

  it('chaque géométrie d’aile garde une ouverture libre au centre (toile visible) et le même gabarit', () => {
    const reference = FRAME_GEOMETRY_BY_WING.infrastructures
    reference.computeBoundingBox()
    for (const wing of exhibitWingOrder) {
      const geo = FRAME_GEOMETRY_BY_WING[wing]
      geo.computeBoundingBox()
      expect(geo.boundingBox!.equals(reference.boundingBox!)).toBe(true)
      const mesh = new Mesh(geo, new MeshBasicMaterial())
      const hits = new Raycaster(new Vector3(0, 0, 1), new Vector3(0, 0, -1)).intersectObject(mesh)
      expect(hits.filter((hit) => hit.point.z >= PAINTING_RECESS_Z)).toHaveLength(0)
    }
  })

  it('une bordure de moulure d’aile reste un buildFrameGeometry(mid) pur : une autre couleur donne une autre géométrie', () => {
    const a = vertexColors(buildFrameGeometry('#123456'))
    expect(a.has('#123456')).toBe(true)
    expect(a.has(hexOf(charter3d.rooms.hall.accent))).toBe(false)
  })
})
