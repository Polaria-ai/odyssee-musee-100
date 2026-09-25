/**
 * Géométrie du cadre doré mouluré + petit spot mural (WEL-875, module cadres & cartels).
 *
 * Aucun modèle CC0 de « cadre de tableau » n'existe dans les 6 packs Kenney fournis (confirmé par
 * `docs/assets/catalogue.md`, ligne « Chevalet / cadre de présentation : aucun modèle dédié trouvé » —
 * même constat pour un cadre que pour un chevalet) ni un vrai luminaire « applique de galerie » à
 * échelle adaptée (le plus proche, `lampWall.glb` du Furniture Kit, est une applique domestique, déjà
 * assignée au décor des murs du hall par un autre module de ce chantier — voir `docs/assets/frames.md`
 * pour la traçabilité de cette décision). On construit donc les deux en géométrie procédurale, dans le
 * même esprit que le décor signature des ailes (`roomGeometry.ts` : primitives three.js + couleurs par
 * sommet, jamais de texture) — c'est la voie que `docs/DESIGN.md`/la mission prévoient explicitement
 * (« profil biseauté en plusieurs couches, ou modèle CC0 de cadre s'il en existe un — sinon géométrie
 * procédurale soignée »).
 *
 * Tout est fusionné en UNE seule `BufferGeometry` non indexée (moulures + passe-partout + spot),
 * partagée par tous les cadres (comme `FRAME_BORDER_GEO` auparavant) : aucun appel de dessin
 * supplémentaire par rapport à l'ancien cadre à une seule couche, malgré le luminaire ajouté — décisif
 * pour tenir le budget `renderInfo().calls ≤ 150` avec ~100 cadres (voir `docs/DESIGN.md`).
 */
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { palette } from '../styles/tokens'
import { dims } from './constants'

// --- Teintes du cadre (dérivées de la palette du musée, jamais une couleur inventée hors palette) ---
// `palette.gold` (#e8c872) reste la couche médiane, comme l'ancien cadre à une seule couche : la
// régression visuelle pour qui connaît déjà le musée reste minimale. `GOLD_DEEP`/`GOLD_BRIGHT`
// l'encadrent pour donner le relief « plusieurs couches biseautées » demandé.
export const GOLD_DEEP = '#a97b3d' // moulure extérieure, dans l'ombre
export const GOLD_MID = palette.gold // couche médiane (ex-couleur unique du cadre)
export const GOLD_BRIGHT = '#f6e3ab' // fin liseré intérieur, au plus près du passe-partout
export const MAT_CREAM = palette.paper // passe-partout
export const LAMP_LENS = '#fff3c4' // « ampoule » du petit spot, ton chaud

/** Demi-épaisseurs (m) ajoutées à `dims.frameWidth`/`frameHeight` pour chaque couche, décroissantes du fond vers l'avant. */
const LAYER_MARGIN = {
  outer: 0.26,
  mid: 0.16,
  lip: 0.07,
  passepartout: 0.05,
} as const

/**
 * Décalages Z (m, + = vers la caméra) de chaque couche — voir le commentaire de `PortraitFrame.tsx` sur
 * la convention de profondeur. La couche la plus reculée (`outer`, -0.055) reste devant la face du mur
 * (le groupe cadre est déjà posé `FRAME_WALL_OFFSET` = 0,06 m devant cette face, voir `layout.ts`) :
 * aucune couche ne s'enfonce dans le mur, même de quelques millimètres.
 */
const LAYER_Z = {
  outer: -0.055,
  mid: -0.032,
  lip: -0.014,
  passepartout: 0.0,
} as const

/**
 * Z auquel la toile doit être posée pour paraître légèrement en retrait derrière le passe-partout
 * (mission DESIGN.md) : plus reculée que la face avant du passe-partout (`LAYER_Z.passepartout` = 0,
 * demi-épaisseur 0,009 → face avant à z = 0,009), d'un écart net à cette échelle (~1,3 m de large).
 */
export const PAINTING_RECESS_Z = -0.004

const _m = new Matrix4()
const _color = new Color()

function paint(geo: BufferGeometry, hex: string): BufferGeometry {
  _color.set(hex)
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = _color.r
    colors[i * 3 + 1] = _color.g
    colors[i * 3 + 2] = _color.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geo
}

function box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, hex: string): BufferGeometry {
  const geo = new BoxGeometry(sx, sy, sz)
  paint(geo, hex)
  geo.applyMatrix4(_m.makeTranslation(cx, cy, cz))
  return geo
}

function cylinder(cx: number, cy: number, cz: number, radiusTop: number, radiusBottom: number, height: number, hex: string, rotX: number, segments = 8): BufferGeometry {
  const geo = new CylinderGeometry(radiusTop, radiusBottom, height, segments)
  paint(geo, hex)
  if (rotX) geo.rotateX(rotX)
  geo.translate(cx, cy, cz)
  return geo
}

/** `mergeGeometries` exige une indexation homogène (voir le même commentaire dans `roomGeometry.ts`). */
function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  const uniform = parts.map((p) => (p.index ? p.toNonIndexed() : p))
  const merged = mergeGeometries(uniform, false)
  merged.computeBoundingSphere()
  return merged
}

/** Hauteur du centre du spot mural au-dessus du centre du cadre (repère local du cadre, y local = 0 au centre). */
const LAMP_Y_ABOVE_FRAME_TOP = 0.22

/**
 * Construit la géométrie fusionnée d'UN cadre : moulure dorée (3 couches biseautées) + passe-partout
 * crème + petit spot mural doré (bras + vasque + « ampoule »). Appelée une seule fois au chargement du
 * module (voir `FRAME_GEOMETRY` ci-dessous) : jamais dans `useFrame`, jamais réappelée par cadre.
 */
export function buildFrameGeometry(): BufferGeometry {
  const w = dims.frameWidth
  const h = dims.frameHeight
  const parts: BufferGeometry[] = [
    box(0, 0, LAYER_Z.outer, w + LAYER_MARGIN.outer, h + LAYER_MARGIN.outer, 0.05, GOLD_DEEP),
    box(0, 0, LAYER_Z.mid, w + LAYER_MARGIN.mid, h + LAYER_MARGIN.mid, 0.045, GOLD_MID),
    box(0, 0, LAYER_Z.lip, w + LAYER_MARGIN.lip, h + LAYER_MARGIN.lip, 0.03, GOLD_BRIGHT),
    box(0, 0, LAYER_Z.passepartout, w + LAYER_MARGIN.passepartout, h + LAYER_MARGIN.passepartout, 0.018, MAT_CREAM),
  ]

  // Petit spot de galerie : plaque murale (contre la moulure, tout au fond) + bras + vasque inclinée
  // vers le tableau + « ampoule » chaude au museau de la vasque. Reste hors des colliders (purement
  // décoratif, comme le cadre lui-même) et hors du couloir de vue (le cadre entier n'est visible que
  // face à +Z, voir `constants.ts::CIMAISE_THICKNESS`).
  const lampY = h / 2 + LAMP_Y_ABOVE_FRAME_TOP
  parts.push(
    box(0, lampY, LAYER_Z.outer, 0.09, 0.09, 0.03, GOLD_DEEP), // platine murale
    box(0, lampY, -0.04, 0.045, 0.2, 0.045, GOLD_DEEP), // bras vertical
    cylinder(0, lampY - 0.02, 0.05, 0.045, 0.075, 0.14, GOLD_MID, Math.PI * 0.14), // vasque, légèrement inclinée vers le bas
    cylinder(0, lampY - 0.09, 0.1, 0.062, 0.062, 0.012, LAMP_LENS, Math.PI * 0.14), // « ampoule », au museau de la vasque
  )

  return mergeAll(parts)
}

/** Géométrie partagée par tous les cadres (~100) : une seule construction, jamais par instance. */
export const FRAME_GEOMETRY = buildFrameGeometry()

/** Position Y (repère local du cadre) du halo lumineux du spot — juste sous la vasque. */
export const HALO_LOCAL_Y = dims.frameHeight / 2 + LAMP_Y_ABOVE_FRAME_TOP - 0.16
/** Position Z (repère local du cadre) du halo lumineux du spot. */
export const HALO_LOCAL_Z = 0.09
