/**
 * Garde-fou de la charte 3D pour les cadres, cartels, textures peintes et socles à tampon : « aucune
 * couleur en dur dans un décor » (`docs/CHARTE-3D.md`). Ces fichiers lisent leurs teintes dans
 * `charter3d` ; on relit leur source (import `?raw`, sans dépendance à Node) pour qu'un hexadécimal, un
 * `rgb()`/`rgba()` ou un retour à `palette.*` (bois, or, crème de l'ancienne charte) échoue ici plutôt
 * qu'à l'œil sur une capture. Les commentaires sont ignorés (ils citent les anciennes teintes).
 */
import { describe, expect, it } from 'vitest'
import textures from './textures.ts?raw'
import frameCartel from './frameCartel.ts?raw'
import bubbleTexture from './bubbleTexture.ts?raw'
import frameGeometry from './frameGeometry.ts?raw'
import portraitFrame from './PortraitFrame.tsx?raw'
import stampStations from '../features/stamps/StampStations.tsx?raw'
import stampIcon from '../features/stamps/StampIcon.tsx?raw'

const SOURCES: Record<string, string> = {
  'textures.ts': textures,
  'frameCartel.ts': frameCartel,
  'bubbleTexture.ts': bubbleTexture,
  'frameGeometry.ts': frameGeometry,
  'PortraitFrame.tsx': portraitFrame,
  'StampStations.tsx': stampStations,
  'StampIcon.tsx': stampIcon,
}

/** Source sans commentaires (blocs et lignes) ni contenu des littéraux de chaîne de type commentaire JSX. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

describe.each(Object.entries(SOURCES))('%s — couleurs de la charte 3D', (_name, source) => {
  const body = code(source)

  it('aucune couleur hexadécimale en dur (tout vient de charter3d)', () => {
    expect(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
  })

  it('aucun rgb()/rgba()/hsl() en dur', () => {
    expect(body.match(/\b(?:rgba?|hsla?)\(/g) ?? []).toEqual([])
  })

  it('plus aucune teinte héritée de la palette V1 (bois, or, crème, encre brune)', () => {
    expect(body).not.toMatch(/palette\.(cream|ink|wood|woodDark|gold|shadow|leaf|leafDark|paper|inkSoft)/)
    expect(body).not.toMatch(/\b(GOLD_DEEP|GOLD_MID|GOLD_BRIGHT|MAT_CREAM)\b/)
  })
})

describe('polices des canvas — charte (Poppins ≤ 600, JetBrains Mono ≤ 500)', () => {
  const canvasSources = { 'textures.ts': textures, 'frameCartel.ts': frameCartel, 'bubbleTexture.ts': bubbleTexture }

  it.each(Object.entries(canvasSources))('%s : aucune police « system-ui » ni graisse 700 en dur', (_name, source) => {
    const body = code(source)
    expect(body).not.toMatch(/system-ui/)
    expect(body).not.toMatch(/['"`]\s*(?:bold|[789]00)\b/)
  })

  it.each(Object.entries(canvasSources))('%s : toute police passe par canvasFont', (_name, source) => {
    const assignments = code(source).match(/\.font\s*=\s*[^\n]+/g) ?? []
    for (const assignment of assignments) expect(assignment).toMatch(/canvasFont\(/)
  })
})
