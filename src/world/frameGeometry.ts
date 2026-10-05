/**
 * Géométrie du cadre mouluré + petit spot mural (WEL-875, module cadres & cartels), à la charte 3D du
 * 29/09/2026 (`docs/CHARTE-3D.md` §4.6) : plus de bois doré.
 *
 * Couches, de l'extérieur vers la toile : moulure extérieure BLANCHE (`frame.outer`, 5 cm), moulure
 * médiane à l'ACCENT DE L'AILE (cyan vif, corail ou bleu néon : une géométrie par aile, un seul matériau
 * partagé, la couleur étant portée par les sommets), liseré et passe-partout nuit (`frame.lip`, `frame.mat`,
 * qui prolongent la toile sombre : la photo « flotte »). Spot mural : platine et bras nuit, vasque et
 * ampoule blanches.
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
 * Tout est fusionné en UNE seule `BufferGeometry` non indexée par aile (moulures + passe-partout + spot),
 * partagée par tous les cadres de l'aile : aucun appel de dessin supplémentaire par rapport à l'ancien
 * cadre à une seule couche, malgré le luminaire ajouté — décisif pour tenir le budget
 * `renderInfo().calls ≤ 150` avec ~100 cadres (voir `docs/DESIGN.md`).
 */
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ExhibitWingId } from '../types'
import { charter3d, exhibitWingOrder, wingThemes } from '../styles/tokens'
import { dims } from './constants'

// --- Teintes du cadre : toutes lues dans la charte 3D (`charter3d.frame`), jamais une couleur en dur ---
const FRAME = charter3d.frame
/** Ampoule du petit spot (blanche) ; réutilisée par le halo (`frameHalo.ts`). */
export const LAMP_LENS = FRAME.lens

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

/**
 * RÉGRESSION CORRIGÉE (WEL-875) : deux couches — « lip » (liseré clair, face avant z = 0,001) et
 * « passe-partout » (face avant z = 0,009) — sont toutes deux posées DEVANT la toile reculée
 * (`PAINTING_RECESS_Z` = -0,004 ; seule la couche « mid », face avant z = -0,0095, reste derrière la
 * toile et n'a donc jamais eu besoin d'ouverture — la toile opaque l'occulte naturellement, comme
 * l'ancien cadre à une seule couche). `lip` et `passepartout` étaient toutes deux des `BoxGeometry`
 * PLEINS (aucune ouverture), plus grands que la toile dans les deux dimensions
 * (`LAYER_MARGIN.lip`/`LAYER_MARGIN.passepartout`) : elles masquaient donc ENTIÈREMENT la toile
 * derrière un aplat uni (de la couleur du passe-partout, le passe-partout étant la couche la plus proche de la
 * caméra), quelle que soit la texture chargée (portrait d'attente ou photo) — le cadre n'a jamais eu
 * de « fenêtre ». `buildFrameGeometry` construit maintenant ces deux couches comme de véritables
 * anneaux (4 lattes chacun, voir `ringLayer`) avec la même ouverture centrale
 * (`APERTURE_WIDTH`/`APERTURE_HEIGHT`, légèrement plus petite que la toile : `APERTURE_OVERLAP` de
 * recouvrement de chaque côté, pour cacher l'arête vive de la toile comme un vrai passe-partout) au
 * lieu d'un pavé plein — la toile redevient visible à travers les deux, tout en gardant le retrait
 * voulu et le fin liseré visible en périphérie du passe-partout (couche `lip`, marge 0,07 > marge
 * `passepartout`, 0,05 : sa bande reste visible au-delà du bord du passe-partout).
 * Non-régression : `frameGeometry.test.ts` (« Ouverture du passe-partout — RÉGRESSION WEL-875 »)
 * fait un raycast pur (three.js `Raycaster`, sans WebGL) au centre du cadre et exige qu'aucun
 * triangle de `FRAME_GEOMETRY` ne soit touché avant la toile.
 */
const APERTURE_OVERLAP = 0.03
/** Largeur/hauteur de l'ouverture (lip + passe-partout) (m) : légèrement < `dims.frameWidth`/`frameHeight`. */
export const APERTURE_WIDTH = dims.frameWidth - APERTURE_OVERLAP * 2
export const APERTURE_HEIGHT = dims.frameHeight - APERTURE_OVERLAP * 2

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

/**
 * Construit une couche en ANNEAU (4 lattes fusionnées : haut, bas, gauche, droite) plutôt qu'un pavé
 * plein — voir le commentaire de `APERTURE_WIDTH`/`APERTURE_HEIGHT` ci-dessus (régression WEL-875 :
 * un pavé plein posé devant la toile la masquait entièrement). L'ouverture centrale
 * (`APERTURE_WIDTH` × `APERTURE_HEIGHT`, commune à toutes les couches qui utilisent cet anneau) laisse
 * voir la toile, recouvrant légèrement son bord (`APERTURE_OVERLAP`) comme un vrai passe-partout ;
 * utilisée pour toute couche dont la face avant est devant la toile reculée (`lip`, `passepartout`).
 */
function ringLayer(outerMargin: number, z: number, depth: number, hex: string): BufferGeometry[] {
  const w = dims.frameWidth
  const h = dims.frameHeight
  const outerW = w + outerMargin
  const outerH = h + outerMargin
  const stripH = (outerH - APERTURE_HEIGHT) / 2
  const stripW = (outerW - APERTURE_WIDTH) / 2
  const vCenterY = (APERTURE_HEIGHT + outerH) / 4 // milieu entre le bord de l'ouverture et le bord extérieur
  const hCenterX = (APERTURE_WIDTH + outerW) / 4
  return [
    box(0, vCenterY, z, outerW, stripH, depth, hex), // latte haute
    box(0, -vCenterY, z, outerW, stripH, depth, hex), // latte basse
    box(-hCenterX, 0, z, stripW, APERTURE_HEIGHT, depth, hex), // latte gauche
    box(hCenterX, 0, z, stripW, APERTURE_HEIGHT, depth, hex), // latte droite
  ]
}

/** Hauteur du centre du spot mural au-dessus du centre du cadre (repère local du cadre, y local = 0 au centre). */
const LAMP_Y_ABOVE_FRAME_TOP = 0.22

/**
 * Construit la géométrie fusionnée d'UN cadre : moulure extérieure blanche + moulure médiane `mid`
 * (l'accent de l'aile) + liseré et passe-partout nuit + petit spot mural (bras + vasque + « ampoule »).
 * Appelée une fois par couleur de moulure médiane au chargement du module (voir `frameGeometryFor`) :
 * jamais dans `useFrame`, jamais réappelée par cadre.
 */
export function buildFrameGeometry(mid: string = charter3d.rooms.hall.accent): BufferGeometry {
  const w = dims.frameWidth
  const h = dims.frameHeight
  const parts: BufferGeometry[] = [
    // `outer`/`mid` : faces avant derrière la toile reculée (`PAINTING_RECESS_Z`) — la toile opaque les
    // occulte naturellement dans la zone de recouvrement, comme l'ancien cadre à une seule couche.
    // Restent des pavés pleins : jamais devant la toile, jamais besoin d'ouverture.
    box(0, 0, LAYER_Z.outer, w + LAYER_MARGIN.outer, h + LAYER_MARGIN.outer, 0.05, FRAME.outer),
    box(0, 0, LAYER_Z.mid, w + LAYER_MARGIN.mid, h + LAYER_MARGIN.mid, 0.045, mid),
    // `lip`/`passepartout` : faces avant DEVANT la toile reculée — anneaux avec ouverture (voir
    // `ringLayer`), sans quoi elles masqueraient la toile (régression WEL-875).
    ...ringLayer(LAYER_MARGIN.lip, LAYER_Z.lip, 0.03, FRAME.lip),
    ...ringLayer(LAYER_MARGIN.passepartout, LAYER_Z.passepartout, 0.018, FRAME.mat),
  ]

  // Petit spot de galerie : plaque murale (contre la moulure, tout au fond) + bras + vasque inclinée
  // vers le tableau + « ampoule » au museau de la vasque. Reste hors des colliders (purement
  // décoratif, comme le cadre lui-même) et hors du couloir de vue (le cadre entier n'est visible que
  // face à +Z, voir `constants.ts::CIMAISE_THICKNESS`).
  const lampY = h / 2 + LAMP_Y_ABOVE_FRAME_TOP
  parts.push(
    box(0, lampY, LAYER_Z.outer, 0.09, 0.09, 0.03, FRAME.lampArm), // platine murale
    box(0, lampY, -0.04, 0.045, 0.2, 0.045, FRAME.lampArm), // bras vertical
    cylinder(0, lampY - 0.02, 0.05, 0.045, 0.075, 0.14, FRAME.lampShade, Math.PI * 0.14), // vasque, légèrement inclinée vers le bas
    cylinder(0, lampY - 0.09, 0.1, 0.062, 0.062, 0.012, LAMP_LENS, Math.PI * 0.14), // « ampoule », au museau de la vasque
  )

  return mergeAll(parts)
}

/** Géométries déjà construites, par couleur de moulure médiane (une par aile, jamais deux fois la même). */
const geometryByMid = new Map<string, BufferGeometry>()

/** Géométrie partagée par tous les cadres d'une moulure médiane `mid` : une seule construction, jamais par instance. */
export function frameGeometryFor(mid: string): BufferGeometry {
  let geo = geometryByMid.get(mid)
  if (!geo) {
    geo = buildFrameGeometry(mid)
    geometryByMid.set(mid, geo)
  }
  return geo
}

/** Cadre à la moulure médiane du hall (corail) : géométrie de repli, égale à celle de l'Industrialisation. */
export const FRAME_GEOMETRY = frameGeometryFor(charter3d.rooms.hall.accent)

/**
 * Une géométrie de cadre par aile d'exposition : la moulure médiane porte l'accent de l'aile (cyan vif,
 * corail, bleu néon). Trois maillages au total pour ~100 portraits, un seul matériau partagé.
 */
export const FRAME_GEOMETRY_BY_WING = Object.fromEntries(exhibitWingOrder.map((wing) => [wing, frameGeometryFor(wingThemes[wing].accent)])) as Record<
  ExhibitWingId,
  BufferGeometry
>

/** Position Y (repère local du cadre) du halo lumineux du spot — juste sous la vasque. */
export const HALO_LOCAL_Y = dims.frameHeight / 2 + LAMP_Y_ABOVE_FRAME_TOP - 0.16
/** Position Z (repère local du cadre) du halo lumineux du spot. */
export const HALO_LOCAL_Z = 0.09
