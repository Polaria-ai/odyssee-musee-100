/** Types du script `build-floor-textures.mjs` (importé par ses tests). */
export const OUT_SIZE: number
export const OUT_DIR: string
export const BUDGET_BYTES: number

export interface FloorBuildConfig {
  src: string
  seamless: number
  flatten: number
  flattenSigma: number
  lo: number
  hi: number
  depth: number
  gamma: number
  normalSize: number
  normalStrength: number
}

export const FLOORS: Record<'marble' | 'terrazzo' | 'microcement' | 'carpet', FloorBuildConfig>

export function seamRatio(values: ArrayLike<number>, n: number): number
export function readDetailFile(input: string | Uint8Array): Promise<{ mean: number; min: number; max: number; size: number; values: Uint8Array }>
export function sourceDir(): string | undefined
export function buildFloor(
  kind: string,
  srcDir?: string,
): Promise<{
  detailWebp: Buffer
  normalWebp: Buffer
  detailBytes: Buffer
  detailSize: number
  stats: { mean: number; min: number; seam: number }
}>
