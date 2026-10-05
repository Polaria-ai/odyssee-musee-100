/**
 * Matériau du buste : le Lambert mat du personnage (texture de couleur + lueur propre légère, comme
 * `makeMatteMaterial` du musée) auquel on ajoute un liseré cyan de contre-jour. Les vestes sombres de
 * Rémi ne renvoient presque rien d'une lumière rasante : seul un terme de Fresnel dans l'émissif garantit
 * un contour lisible sur toute la silhouette. Deux lignes de GLSL (un produit scalaire et une puissance),
 * pas d'ombres, pas de texture en plus : rien de lourd pour un téléphone.
 */
import { Color, MeshLambertMaterial, type Texture } from 'three'
import { CHARACTER_SELF_LIGHT } from '../../../characters/characterRig'
import { charter3d } from '../../../styles/tokens'

/** Intensité du liseré au bord (0 = aucun) et finesse (puissance : plus haut = plus fin). */
export const RIM_STRENGTH = 0.9
export const RIM_POWER = 4.2

const MARKER = '#include <emissivemap_fragment>'

/** Insère le terme de Fresnel après le calcul de l'émissif. Sans effet (et sans erreur) si le marqueur disparaît. */
export function injectRim(fragmentShader: string, color: Color = new Color(charter3d.base.cyanVif)): string {
  if (!fragmentShader.includes(MARKER)) return fragmentShader
  const rgb = [color.r, color.g, color.b].map((c) => c.toFixed(4)).join(', ')
  return fragmentShader.replace(
    MARKER,
    `${MARKER}
	float remiRim = pow( 1.0 - saturate( dot( normalize( normal ), normalize( vViewPosition ) ) ), ${RIM_POWER.toFixed(2)} );
	totalEmissiveRadiance += vec3( ${rgb} ) * ( remiRim * ${RIM_STRENGTH.toFixed(2)} );`,
  )
}

export function createBustMaterial(map: Texture | null, fallbackColor?: Color): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: CHARACTER_SELF_LIGHT })
  if (!map && fallbackColor) material.color.copy(fallbackColor)
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = injectRim(shader.fragmentShader)
  }
  material.customProgramCacheKey = () => 'remi-bust-rim'
  return material
}
