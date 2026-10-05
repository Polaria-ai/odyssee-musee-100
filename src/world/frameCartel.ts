/**
 * Cartel d'un cadre (charte 3D du 29/09/2026, `docs/CHARTE-3D.md` §4.6) : nom + organisation sur fond nuit,
 * contour et filet séparateur dans l'accent de l'aile de la personne. Il remplace la plaque de laiton.
 * Redessiné en 512×128 (contre 256×96 pour le cartel générique de `textures.ts`) pour rester net à la
 * distance de jeu une fois agrandi sur le cadre.
 *
 * Le dessin est celui de `textures.ts::paintCartelPlate` (partagé avec le cartel générique) et le texte de
 * la ligne « organisation » vient de `cartelOrganizationText` (testée dans `textures.test.ts`) : ce
 * fichier ne fait que fixer la taille du canvas et le cache par personne + langue. Poppins (600 pour le
 * nom, 500 pour l'organisation), texte blanc : 17,6:1 et 10,9:1 sur le fond nuit.
 */
import type { CanvasTexture } from 'three'
import type { Lang, Person } from '../types'
import { paintCartelPlate, paintedTexture } from './textures'

const WIDTH = 512
const HEIGHT = 128

const cache = new Map<string, CanvasTexture>()

/** Cartel haute résolution. Mis en cache par personne + langue (bascule FR/EN sans texture orpheline, voir `textures.ts`). */
export function drawFrameCartel(person: Person, lang: Lang): CanvasTexture {
  const key = `${person.id}|${lang}`
  let tex = cache.get(key)
  if (!tex) {
    tex = paintedTexture(WIDTH, HEIGHT, (ctx) => paintCartelPlate(ctx, WIDTH, HEIGHT, person, lang))
    cache.set(key, tex)
  }
  return tex
}
