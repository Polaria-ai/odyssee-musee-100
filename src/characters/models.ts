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
 * le joueur d'origine) et 1,8 m pour Rémi (≈ 1,57 ×), vérifié sur captures. La hauteur est celle du
 * personnage dans sa pose d'attente (clip « idle », tête comprise) : `GlbCharacter` met le modèle à
 * l'échelle pour l'atteindre exactement.
 *
 * Squelette Meshy à 24 os, un seul maillage texturé (~12 400 triangles), compression meshopt,
 * texture WebP 1024. Sources et provenance : `scripts/build-characters.mjs`, `docs/ASSETS.md`.
 */

/** Nom logique d'un clip (celui que le jeu demande), distinct du nom du clip dans le fichier GLB. */
export type ClipName = 'idle' | 'walk' | 'wave'

export interface CharacterDef {
  /** Chemin public du GLB (voir `src/assets/useModel.ts`). */
  readonly path: string
  /** Hauteur visée dans le jeu, en mètres, pose « idle » (voir l'en-tête). */
  readonly height: number
  /** Nom logique → nom du clip dans le GLB. Toujours un clip `idle` : c'est le repos et le repli. */
  readonly clips: { readonly idle: string } & Readonly<Partial<Record<ClipName, string>>>
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
} as const satisfies Record<string, CharacterDef>

export type CharacterId = keyof typeof CHARACTERS

/** Noms logiques de clips que définit le personnage `C` (ex. `ClipOf<'remi'>` = `'idle' | 'wave'`). */
export type ClipOf<C extends CharacterId> = keyof (typeof CHARACTERS)[C]['clips'] & ClipName

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[]

/** Le clip est-il défini pour ce personnage ? (sinon `GlbCharacter` retombe sur « idle »). */
export function hasClip(character: CharacterId, clip: ClipName): boolean {
  return clip in CHARACTERS[character].clips
}
