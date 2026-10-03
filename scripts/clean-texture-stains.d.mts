/** Types du script `clean-texture-stains.mjs` (importé par ses tests). */
import type { Document } from '@gltf-transform/core'

export const PROTECTED_JOINTS: string[]

export interface CleanOptions {
  radius: number
  ratio: number
  zoneMin: number
  zoneMax: number
  chromaMax: number
  passes: number
  minCluster: number
  maxCluster: number
  grow: number
  haloRatio: number
  protectGrow: number
  trim: number
  padRadius: number
}
export const DEFAULTS: CleanOptions

export interface Zones {
  /** 1 = texel couvert par au moins un triangle du maillage. */
  used: Uint8Array
  /** 1 = texel d'un îlot protégé (tête, cou, mains), élargi de `protectGrow`. */
  protect: Uint8Array
  /** Idem sans l'élargissement. */
  protectCore: Uint8Array
  /** Numéro de l'îlot UV qui couvre le texel (à partir de 1, 0 = vide). */
  island: Int32Array
  islandCount: number
}

export function rasterizeZones(document: Document, width: number, height: number, options?: { protectedJoints?: string[]; protectGrow?: number }): Zones
export function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array
export function islandLevels(lum: ArrayLike<number>, valid: Uint8Array, island: Int32Array, count: number, trim?: number): Float32Array
export function localLevel(lum: ArrayLike<number>, valid: Uint8Array, width: number, height: number, radius: number, trim?: number): Float32Array
export function keepClusters(candidate: Uint8Array, width: number, height: number, minCluster: number, maxCluster?: number): { mask: Uint8Array; clusters: number }
export function detectStains(
  pixels: Uint8Array,
  channels: number,
  width: number,
  height: number,
  zones: Pick<Zones, 'used' | 'protect'> & Partial<Pick<Zones, 'island' | 'islandCount'>>,
  options?: Partial<CleanOptions>,
): { mask: Uint8Array; clusters: number; stains: number; level: Float32Array }
export function fillStains(pixels: Uint8Array, channels: number, width: number, height: number, mask: Uint8Array, trusted: Uint8Array, island?: Int32Array | null): Uint8Array
export interface TextureDiff {
  changed: number
  inStains: number
  inPadding: number
  elsewhere: number
  changedProtected: number
  maxDelta: number
  share: number
}
export function compareTextures(
  before: Uint8Array,
  after: Uint8Array,
  channels: number,
  width: number,
  height: number,
  masks?: { used?: Uint8Array; protectCore?: Uint8Array; stains?: Uint8Array; padded?: Uint8Array },
): TextureDiff

export interface CleanResult {
  /** PNG de la texture nettoyée, `null` si rien n'a changé. */
  png: Buffer | null
  before: Uint8Array
  after: Uint8Array
  /** Texels de taches remplacés (union des tours). */
  mask: Uint8Array
  /** Texels vides remplis par la marge. */
  padded: Uint8Array
  zones: Zones
  width: number
  height: number
  channels: number
  report: TextureDiff & {
    width: number
    height: number
    usedTexels: number
    protectedTexels: number
    clusters: number
    rounds: { clusters: number; texels: number }[]
    stainTexels: number
    paddedTexels: number
  }
}
export function cleanCharacterTexture(document: Document, options?: Partial<CleanOptions>): Promise<CleanResult>
