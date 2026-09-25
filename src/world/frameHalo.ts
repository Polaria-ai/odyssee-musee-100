/**
 * Halo additif discret du petit spot mural (WEL-875) : un seul dégradé radial, mis en cache, comme
 * `bubbleTexture.ts`. Géométrie et matériau PARTAGÉS par défaut entre tous les cadres (`sharedHaloMaterial`) ;
 * un cadre accroché à une cimaise qui s'estompe (`fade`, voir `PortraitFrame.tsx`) obtient son propre
 * clone pour suivre son fondu sans jamais toucher ce matériau partagé (même règle que le cadre lui-même).
 */
import { AdditiveBlending, CanvasTexture, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import { LAMP_LENS } from './frameGeometry'

const SIZE = 0.52

/** Plan du halo, partagé par tous les cadres (jamais recréé par instance). */
export const HALO_GEOMETRY = new PlaneGeometry(SIZE, SIZE * 0.72)

let cachedTexture: CanvasTexture | null = null

/** Dégradé radial chaud (centre plein, bords transparents) — dessiné une seule fois. */
export function haloTexture(): CanvasTexture {
  if (cachedTexture) return cachedTexture
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Contexte canvas 2D indisponible')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,243,196,0.9)')
  gradient.addColorStop(0.55, 'rgba(255,232,160,0.35)')
  gradient.addColorStop(1, 'rgba(255,232,160,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  cachedTexture = new CanvasTexture(canvas)
  cachedTexture.colorSpace = SRGBColorSpace
  cachedTexture.needsUpdate = true
  return cachedTexture
}

let sharedMaterial: MeshBasicMaterial | null = null
/** Matériau additif partagé (opacité fixe, discrète) — jamais muté ici : voir la note d'en-tête. */
export function sharedHaloMaterial(): MeshBasicMaterial {
  if (!sharedMaterial) {
    sharedMaterial = new MeshBasicMaterial({ map: haloTexture(), color: LAMP_LENS, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
  }
  return sharedMaterial
}

/** Clone dédié à un cadre en cours de fondu (cimaise occultante) — seul cas où l'opacité est modifiée par cadre. */
export function fadeableHaloMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ map: haloTexture(), color: LAMP_LENS, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
}
