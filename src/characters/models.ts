/**
 * Personnages 3D générés (Magnific → Meshy) : chemins, hauteurs de jeu et noms de clips.
 * Propriétaire : agent personnages. Configuration pure (aucun import three/React), testable seule.
 *
 * Hauteur de jeu (`height`, en mètres, 1 unité = 1 mètre) :
 * le joueur chibi mesure `dims.playerHeight` = 1,15 m et la caméra à orientation fixe cadre environ
 * 11 m de sol en largeur (`cameraRig.targetVisibleWidth`). Un personnage « réaliste » de 1,8 m ferait
 * 1,56 × le joueur : il écraserait le cadrage, cacherait ses voisins et casserait l'échelle du musée
 * (portes, cadres, comptoir d'accueil). Une première version à 1,45 m et 1,5 m (29/09) se lisait trop
 * petite à l'écran : ces personnages ont des proportions d'adulte (petite tête), contrairement à
 * l'ancien avatar chibi, et Rémi disparaissait derrière le comptoir. D'où 1,7 m pour Cyril (≈ 1,48 ×
 * le joueur d'origine) et 1,8 m pour Rémi (≈ 1,57 ×), vérifié sur captures. L'Archiviste (WEL-928) a la
 * taille de Cyril, 1,7 m : une femme adulte, plus petite que Rémi. La hauteur est celle du personnage dans sa
 * pose d'attente (clip « idle », tête comprise) : `GlbCharacter` met le modèle à l'échelle pour l'atteindre
 * exactement.
 *
 * Squelette Meshy à 24 os (le MÊME pour les trois : mêmes noms, même ordre), un seul maillage texturé
 * (~12 400 triangles pour Cyril et Rémi, 12 467 pour l'Archiviste : 15 585 à la source, allégé pour tenir le
 * budget du fichier), compression meshopt, texture WebP 1024. Sources et provenance : `scripts/build-characters.mjs`, `docs/ASSETS.md`.
 */

/** Nom logique d'un clip (celui que le jeu demande), distinct du nom du clip dans le fichier GLB. */
export type ClipName = 'idle' | 'walk' | 'wave' | 'talk'

export interface CharacterDef {
  /** Chemin public du GLB (voir `src/assets/useModel.ts`). */
  readonly path: string
  /** Hauteur visée dans le jeu, en mètres, pose « idle » (voir l'en-tête). */
  readonly height: number
  /** Nom logique → nom du clip dans le GLB. Toujours un clip `idle` : c'est le repos et le repli. */
  readonly clips: { readonly idle: string } & Readonly<Partial<Record<ClipName, string>>>
  /**
   * Marge de la sphère de culling autour de la pose « idle » (voir `CULLING_MARGIN` dans `characterRig.ts`,
   * 1,6 par défaut : un personnage en bord d'écran ne disparaît pas quand un bras sort de la sphère).
   * Un personnage qui reste sur place, toujours loin du bord de l'écran quand il bouge les bras (l'Archiviste),
   * en demande moins : trop large, la sphère déborde dans le champ de la caméra alors que le personnage est
   * hors écran, et son maillage entier est dessiné pour rien (+ 12 467 triangles au spawn du hall sur Pixel 7).
   */
  readonly cullMargin?: number
}

export const CHARACTERS = {
  cyril: {
    path: '/models/characters/cyril.glb',
    height: 1.7,
    clips: { idle: 'idle', walk: 'walk' },
  },
  remi: {
    path: '/models/characters/remi.glb',
    height: 1.8,
    clips: { idle: 'idle', wave: 'wave' },
  },
  archiviste: {
    path: '/models/characters/archiviste.glb',
    height: 1.7,
    clips: { idle: 'idle', wave: 'wave', talk: 'talk' },
    // Debout sur son socle : le salut et les gestes de « talk » n'ont lieu que joueur à moins de 2,6 m, donc
    // elle est alors près du centre de l'écran. 1,25 couvre le bras levé et laisse la sphère hors du champ
    // quand elle est hors écran (WEL-928, vérification du 03/10).
    cullMargin: 1.25,
  },
} as const satisfies Record<string, CharacterDef>

export type CharacterId = keyof typeof CHARACTERS

/** Noms logiques de clips que définit le personnage `C` (ex. `ClipOf<'remi'>` = `'idle' | 'wave'`). */
export type ClipOf<C extends CharacterId> = keyof (typeof CHARACTERS)[C]['clips'] & ClipName

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[]

/** Le clip est-il défini pour ce personnage ? (sinon `GlbCharacter` retombe sur « idle »). */
export function hasClip(character: CharacterId, clip: ClipName): boolean {
  return clip in CHARACTERS[character].clips
}
