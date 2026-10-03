/**
 * Nettoyage local et déterministe de la texture d'un personnage Meshy (WEL-928, Archiviste).
 *
 * Deux défauts se voient sur le manteau et le pantalon anthracite de l'Archiviste, et tous deux viennent de
 * l'atlas Meshy : fragmenté en milliers d'îlots, séparés de noir inutilisé, avec les mèches de cheveux gris
 * clair collées aux îlots du vêtement.
 *
 *  A. Taches. Le remaillage laisse, dans les zones sombres et unies d'un vêtement, des amas de texels nettement
 *     plus sombres que le tissu qui les entoure (surtout le long des bords d'îlots). Ils sont détectés puis
 *     remplacés par la couleur environnante (`detectStains`, `fillStains`).
 *  B. Veines claires (hypothèse). Le filtrage de la texture (bilinéaire, puis mipmaps à distance) mélange, sur le
 *     bord d'un îlot, le noir du vide et le gris des cheveux voisins : de fines craquelures claires courent sur le
 *     manteau. On étend donc la couleur de chaque îlot dans le vide qui l'entoure (`padAtlas`, « marge » ou
 *     dilatation des bords) : seuls des texels INUTILISÉS changent, jamais un texel que le maillage affiche.
 *
 * EFFET MESURÉ (vérification indépendante du 03/10/2026) : faible. Les taches changées sont 3 043 texels (0,15 % des
 * texels utilisés) ; des amas sombres de 6 texels ou plus passent de 53 à 30. Les veines claires, elles, ne
 * disparaissent pas : − 2 % de pixels clairs neutres sur le bas du corps rendu en trois quarts (1 512 contre 1 482),
 * des veines blanches restent visibles sur le manteau, comme sur la veste de Cyril. Le gain réel de la marge est un
 * WebP plus léger (GLB : 409 392 → 398 360 octets), pas un tissu plus lisse.
 *
 * Étapes, dans l'ordre :
 *  1. Zones. Les triangles du maillage sont rastérisés dans l'espace UV : on sait quels texels sont réellement
 *     UTILISÉS par le personnage, et de quel os dépend chaque îlot. Les îlots de la tête, du cou et des mains (os
 *     `PROTECTED_JOINTS`) sont PROTÉGÉS, élargis de `protectGrow` texels pour la détection des taches : visage,
 *     yeux, cheveux et mains ne sont jamais modifiés.
 *  2. Détection (A). Un texel utilisé et non protégé est suspect s'il est neutre (peu saturé), s'il se trouve dans
 *     une zone sombre (niveau local entre `zoneMin` et `zoneMax`, sur 255) et s'il est sous `ratio` fois ce niveau.
 *     Le niveau local est une moyenne tronquée (les texels très sombres ne comptent pas) sur une fenêtre de rayon
 *     `radius`, calculée sur les seuls texels utilisés : elle ne dérive pas vers le noir de l'atlas. L'îlot UV du
 *     texel doit lui aussi être anthracite (`islandLevels`) : un îlot noir collé au manteau n'est pas une tache.
 *     Seuls les AMAS comptent, d'au moins `minCluster` et d'au plus `maxCluster` texels : le grain isolé du tissu
 *     n'est pas une tache, et une grande zone sombre (le t-shirt noir sous le manteau, qui partage l'îlot du
 *     manteau : des centaines de texels) est voulue. Sans ces deux garde-fous, la première version peignait une étoile grise sur
 *     le t-shirt de l'Archiviste. Une zone entièrement noire (niveau local < `zoneMin`) n'est jamais touchée.
 *  3. Remplissage (A). Chaque texel de tache prend la moyenne des texels sains voisins de sa zone, couche par
 *     couche depuis le bord de l'amas : aucun hasard, le résultat est identique d'une exécution à l'autre.
 *     Détection et remplissage se répètent `passes` fois : remplir une tache relève le niveau local de ses
 *     voisines, qui deviennent à leur tour détectables (sur l'Archiviste : 79, 36, 24, 20, 19 puis 19 amas). Seuls
 *     les voisins du MÊME îlot UV servent de modèle. Ce qui reste est fait d'amas sans voisin sain : ils sont
 *     laissés tels quels plutôt que repeints avec une couleur qui n'est pas la leur.
 *  4. Marge (B). Couche par couche, jusqu'à `padRadius` texels (40 sur l'atlas 2048, soit 20 sur la texture livrée de
 *     1024 : au-delà, les mipmaps à distance ne mélangent plus le vide à un îlot), le vide prend la couleur des
 *     îlots voisins ; le vêtement passe avant les autres îlots dans la moyenne. `padOtherSpeed` (1 par défaut)
 *     peut ralentir les îlots qui ne sont pas du vêtement. Essais sur l'Archiviste (rendu 3D rapproché, éclairci) :
 *     marge 16 → 40, vitesses égales = un peu moins de veines claires sur le manteau (écart faible, voir « EFFET MESURÉ »), et un WebP plus léger (une marge
 *     lisse se compresse mieux qu'un fond noir bordé de franges : −11 Ko sur le GLB à qualité égale).
 *  5. Contrôle par différence. Le rapport donne le nombre de texels changés par étape et leur part ; les texels
 *     changés qui ne sont NI une tache NI du vide, et les texels PROTÉGÉS changés, doivent être nuls (sinon la
 *     fonction lève une erreur).
 *
 * Fonctions pures sur des tableaux typés (testées dans `clean-texture-stains.test.ts`) ; seule
 * `cleanCharacterTexture` lit un document glTF Transform et décode/encode l'image (sharp).
 */
import sharp from 'sharp'

/** Os dont les îlots d'atlas ne sont jamais modifiés : tête, cheveux, yeux, cou et mains. */
export const PROTECTED_JOINTS = ['Head', 'neck', 'head_end', 'headfront', 'LeftHand', 'RightHand']

export const DEFAULTS = {
  /** Rayon (texels, atlas 2048) de la fenêtre qui donne le niveau local de la zone. */
  radius: 12,
  /** Un texel est suspect sous cette part du niveau de sa zone. */
  ratio: 0.62,
  /** Bornes (luminance 0–255) du niveau local d'une zone « anthracite ». En dessous : zone noire, intacte. */
  zoneMin: 14,
  zoneMax: 70,
  /** Écart max entre canaux (0–255) d'un texel « neutre ». Une peau ou un tissu coloré n'est jamais une tache. */
  chromaMax: 28,
  /** Tours de détection + remplissage des taches (un tour relève le niveau local et en révèle d'autres). */
  passes: 6,
  /** Taille minimale (texels connexes) d'un amas. */
  minCluster: 4,
  /** Taille maximale : au-delà, ce n'est plus une tache mais une zone sombre voulue (le t-shirt noir sous le manteau). */
  maxCluster: 150,
  /** Élargissement de l'amas avant remplissage (son halo sombre), limité aux texels encore assombris. */
  grow: 1,
  /** Un texel du halo est repris s'il est sous cette part du niveau de sa zone (plus tolérant que `ratio`). */
  haloRatio: 0.9,
  /** Élargissement des îlots protégés (texels). */
  protectGrow: 3,
  /** Fraction du niveau local sous laquelle un texel n'entre pas dans la moyenne tronquée. */
  trim: 0.75,
  /** Marge : rayon (texels, atlas 2048) dont la couleur des îlots est étendue dans le vide. 0 : pas de marge. */
  padRadius: 40,
  /** Vitesse d'extension des îlots qui ne sont pas du vêtement (1 = comme le vêtement, 0,5 = moitié moins vite). */
  padOtherSpeed: 1,
  /** Un îlot est du « vêtement » si sa luminance est sous cette valeur et son écart entre canaux sous `chromaMax`. */
  clothLuminanceMax: 70,
}

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * Rastérise les triangles de tous les maillages du document dans l'espace UV (`TEXCOORD_0`, origine en haut à
 * gauche comme l'image) : `used` = texel couvert par au moins un triangle ; `protect` = texel couvert par un
 * triangle dont l'os dominant est protégé, élargi de `protectGrow` ; `island` = numéro (à partir de 1, 0 = vide)
 * de l'îlot UV du triangle qui couvre le texel.
 */
export function rasterizeZones(document, width, height, { protectedJoints = PROTECTED_JOINTS, protectGrow = DEFAULTS.protectGrow } = {}) {
  const used = new Uint8Array(width * height)
  const protect = new Uint8Array(width * height)
  const island = new Int32Array(width * height)
  let islandCount = 0
  const root = document.getRoot()
  const jointNames = root.listSkins()[0]?.listJoints().map((j) => j.getName()) ?? []
  const protectedSet = new Set(protectedJoints)
  const protectedIndex = new Uint8Array(Math.max(jointNames.length, 1))
  jointNames.forEach((name, i) => (protectedIndex[i] = protectedSet.has(name) ? 1 : 0))

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const uvAcc = prim.getAttribute('TEXCOORD_0')
      const idxAcc = prim.getIndices()
      if (!uvAcc || !idxAcc) continue
      const uv = uvAcc.getArray()
      const idx = idxAcc.getArray()
      const joints = prim.getAttribute('JOINTS_0')?.getArray()
      const weights = prim.getAttribute('WEIGHTS_0')?.getArray()
      // Îlots UV : des triangles qui partagent un sommet appartiennent au même îlot (les coutures de l'atlas
      // dupliquent les sommets, donc elles séparent les îlots). Union-find sur les indices de sommets.
      const parent = new Int32Array(uvAcc.getCount()).map((_, i) => i)
      const find = (v) => {
        while (parent[v] !== v) v = parent[v] = parent[parent[v]]
        return v
      }
      for (let t = 0; t < idx.length; t += 3) {
        parent[find(idx[t])] = find(idx[t + 1])
        parent[find(idx[t + 1])] = find(idx[t + 2])
      }
      const labels = new Map()
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t], b = idx[t + 1], c = idx[t + 2]
        const r = find(a)
        if (!labels.has(r)) labels.set(r, ++islandCount)
        const label = labels.get(r)
        // Poids de protection du triangle : somme des poids des influences protégées de ses 3 sommets.
        let protectedWeight = 0
        let totalWeight = 0
        if (joints && weights) {
          for (const v of [a, b, c]) {
            for (let k = 0; k < 4; k++) {
              const w = weights[v * 4 + k]
              totalWeight += w
              if (protectedIndex[joints[v * 4 + k]]) protectedWeight += w
            }
          }
        }
        const isProtected = totalWeight > 0 && protectedWeight / totalWeight >= 0.5
        const p0x = uv[a * 2] * width, p0y = uv[a * 2 + 1] * height
        const p1x = uv[b * 2] * width, p1y = uv[b * 2 + 1] * height
        const p2x = uv[c * 2] * width, p2y = uv[c * 2 + 1] * height
        const den = (p1y - p2y) * (p0x - p2x) + (p2x - p1x) * (p0y - p2y)
        if (Math.abs(den) < 1e-9) continue
        const x0 = Math.max(0, Math.floor(Math.min(p0x, p1x, p2x)) - 1), x1 = Math.min(width - 1, Math.ceil(Math.max(p0x, p1x, p2x)) + 1)
        const y0 = Math.max(0, Math.floor(Math.min(p0y, p1y, p2y)) - 1), y1 = Math.min(height - 1, Math.ceil(Math.max(p0y, p1y, p2y)) + 1)
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const sx = x + 0.5, sy = y + 0.5
            const l0 = ((p1y - p2y) * (sx - p2x) + (p2x - p1x) * (sy - p2y)) / den
            const l1 = ((p2y - p0y) * (sx - p2x) + (p0x - p2x) * (sy - p2y)) / den
            const l2 = 1 - l0 - l1
            // Marge de 2 % : un texel dont le centre touche à peine le triangle est utilisé par le filtrage bilinéaire.
            if (l0 >= -0.02 && l1 >= -0.02 && l2 >= -0.02) {
              used[y * width + x] = 1
              island[y * width + x] = label
              if (isProtected) protect[y * width + x] = 1
            }
          }
        }
      }
    }
  }
  return { used, protect: dilate(protect, width, height, protectGrow), protectCore: protect, island, islandCount }
}

/** Dilatation carrée d'un masque binaire de `radius` texels (séparable, déterministe). */
export function dilate(mask, width, height, radius) {
  if (radius <= 0) return Uint8Array.from(mask)
  const tmp = new Uint8Array(mask.length)
  const out = new Uint8Array(mask.length)
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (!mask[row + x]) continue
      const a = Math.max(0, x - radius), b = Math.min(width - 1, x + radius)
      for (let i = a; i <= b; i++) tmp[row + i] = 1
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (!tmp[y * width + x]) continue
      const a = Math.max(0, y - radius), b = Math.min(height - 1, y + radius)
      for (let j = a; j <= b; j++) out[j * width + x] = 1
    }
  }
  return out
}

/** Somme sur une fenêtre carrée de rayon `radius` (sommes cumulées séparables). */
function boxSum(src, width, height, radius) {
  const tmp = new Float64Array(width * height)
  const out = new Float64Array(width * height)
  const prefix = new Float64Array(Math.max(width, height) + 1)
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) prefix[x + 1] = prefix[x] + src[row + x]
    for (let x = 0; x < width; x++) tmp[row + x] = prefix[Math.min(width - 1, x + radius) + 1] - prefix[Math.max(0, x - radius)]
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) prefix[y + 1] = prefix[y] + tmp[y * width + x]
    for (let y = 0; y < height; y++) out[y * width + x] = prefix[Math.min(height - 1, y + radius) + 1] - prefix[Math.max(0, y - radius)]
  }
  return out
}

/**
 * Niveau local de luminance de chaque texel : moyenne tronquée, sur une fenêtre de rayon `radius`, des texels
 * `valid` dont la luminance n'est pas très inférieure à la moyenne simple (les taches ne tirent donc pas le
 * niveau vers le bas). 0 là où aucun texel valide n'entoure.
 */
export function localLevel(lum, valid, width, height, radius, trim = DEFAULTS.trim) {
  const n = width * height
  const weighted = new Float64Array(n)
  const count = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    count[i] = valid[i] ? 1 : 0
    weighted[i] = valid[i] ? lum[i] : 0
  }
  const sum1 = boxSum(weighted, width, height, radius)
  const cnt1 = boxSum(count, width, height, radius)
  // Deuxième passe : on retire les texels sous `trim` × la moyenne simple de leur voisinage.
  for (let i = 0; i < n; i++) {
    const mean1 = cnt1[i] > 0 ? sum1[i] / cnt1[i] : 0
    const keep = valid[i] && lum[i] >= trim * mean1
    count[i] = keep ? 1 : 0
    weighted[i] = keep ? lum[i] : 0
  }
  const sum2 = boxSum(weighted, width, height, radius)
  const cnt2 = boxSum(count, width, height, radius)
  const level = new Float32Array(n)
  for (let i = 0; i < n; i++) level[i] = cnt2[i] > 0 ? sum2[i] / cnt2[i] : 0
  return level
}

/**
 * Niveau de luminance de chaque îlot UV : moyenne tronquée (comme `localLevel`) de ses texels `valid`. Un îlot
 * décide à lui seul s'il est « anthracite » (niveau entre `zoneMin` et `zoneMax`) : le t-shirt noir d'un
 * personnage, collé au manteau dans la fenêtre de `localLevel`, reste noir et n'est jamais pris pour une tache.
 * Index 0 (vide) et îlots sans texel valide : 0.
 */
export function islandLevels(lum, valid, island, count, trim = DEFAULTS.trim) {
  const sum = new Float64Array(count + 1)
  const num = new Float64Array(count + 1)
  for (let i = 0; i < lum.length; i++) {
    if (!valid[i]) continue
    sum[island[i]] += lum[i]
    num[island[i]]++
  }
  const kept = new Float64Array(count + 1)
  const keptNum = new Float64Array(count + 1)
  for (let i = 0; i < lum.length; i++) {
    if (!valid[i]) continue
    const mean = sum[island[i]] / num[island[i]]
    if (lum[i] >= trim * mean) {
      kept[island[i]] += lum[i]
      keptNum[island[i]]++
    }
  }
  const out = new Float32Array(count + 1)
  for (let k = 1; k <= count; k++) out[k] = keptNum[k] > 0 ? kept[k] / keptNum[k] : 0
  return out
}

/** Amas de texels `candidate` connexes (8 voisins) d'au moins `minCluster` et d'au plus `maxCluster` texels : masque des texels retenus et nombre d'amas. */
export function keepClusters(candidate, width, height, minCluster, maxCluster = Infinity) {
  const n = width * height
  const seen = new Uint8Array(n)
  const keep = new Uint8Array(n)
  const stack = []
  let clusters = 0
  for (let start = 0; start < n; start++) {
    if (!candidate[start] || seen[start]) continue
    stack.length = 0
    stack.push(start)
    seen[start] = 1
    const members = []
    while (stack.length) {
      const p = stack.pop()
      members.push(p)
      const x = p % width, y = (p - x) / width
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          const q = yy * width + xx
          if (candidate[q] && !seen[q]) {
            seen[q] = 1
            stack.push(q)
          }
        }
      }
    }
    if (members.length >= minCluster && members.length <= maxCluster) {
      clusters++
      for (const p of members) keep[p] = 1
    }
  }
  return { mask: keep, clusters }
}

/**
 * Masque des taches d'une image RVB (`channels` octets par texel, 3 ou 4). `used` et `protect` viennent de
 * `rasterizeZones`. Les texels protégés ne sont jamais dans le masque, l'élargissement non plus.
 */
export function detectStains(pixels, channels, width, height, { used, protect, island, islandCount = 0 }, options = {}) {
  const o = { ...DEFAULTS, ...options }
  const n = width * height
  const lum = new Float32Array(n)
  const neutral = new Uint8Array(n)
  const valid = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const r = pixels[i * channels], g = pixels[i * channels + 1], b = pixels[i * channels + 2]
    lum[i] = luminance(r, g, b)
    neutral[i] = Math.max(r, g, b) - Math.min(r, g, b) <= o.chromaMax ? 1 : 0
    valid[i] = used[i] && !protect[i] ? 1 : 0
  }
  const level = localLevel(lum, valid, width, height, o.radius, o.trim)
  // Un îlot noir (t-shirt) ou clair (peau, cheveux) n'est pas une zone anthracite, même si la fenêtre de
  // `localLevel` déborde sur un îlot voisin : `islandOk` le dit à la place de la fenêtre.
  const levels = island ? islandLevels(lum, valid, island, islandCount, o.trim) : null
  const islandOk = (i) => !levels || (levels[island[i]] >= o.zoneMin && levels[island[i]] <= o.zoneMax)
  const candidate = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (!valid[i] || !neutral[i] || !islandOk(i)) continue
    const zone = level[i]
    if (zone >= o.zoneMin && zone <= o.zoneMax && lum[i] < o.ratio * zone) candidate[i] = 1
  }
  const { mask: core, clusters } = keepClusters(candidate, width, height, o.minCluster, o.maxCluster)
  // Halo : l'amas est élargi de `grow` texels, mais seulement dans les texels qui sont eux aussi assombris
  // (neutres, dans la même zone sombre, sous `haloRatio` × son niveau) : jamais dans un texel clair voisin.
  const soft = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const zone = level[i]
    soft[i] = valid[i] && neutral[i] && islandOk(i) && zone >= o.zoneMin && zone <= o.zoneMax && lum[i] < o.haloRatio * zone ? 1 : 0
  }
  const mask = o.grow > 0 ? dilate(core, width, height, o.grow) : core
  let stains = 0
  for (let i = 0; i < n; i++) {
    if (mask[i] && !(core[i] || soft[i])) mask[i] = 0
    if (mask[i]) stains++
  }
  return { mask, clusters, stains, level }
}

/**
 * Remplace les texels du masque par la moyenne des texels sains voisins, couche par couche depuis le bord de
 * chaque amas (fenêtre 5×5, seuls les texels déjà sains ou déjà remplis comptent). `trusted` : texels dont la
 * couleur est fiable, c'est-à-dire de la même zone que la tache (utilisés, hors masque, neutres, d'une luminance
 * proche du niveau de la zone) : jamais un texel de peau ou de cheveux voisin dans l'atlas. Renvoie une COPIE ;
 * l'original n'est pas modifié. `island` (facultatif) : seuls les voisins du MÊME îlot UV comptent (jamais la couleur
 * d'un îlot voisin dans l'atlas).
 */
export function fillStains(pixels, channels, width, height, mask, trusted, island = null) {
  const out = Uint8Array.from(pixels)
  const known = new Uint8Array(width * height)
  for (let i = 0; i < known.length; i++) known[i] = !mask[i] && trusted[i] ? 1 : 0
  let remaining = []
  for (let i = 0; i < mask.length; i++) if (mask[i]) remaining.push(i)
  while (remaining.length) {
    const filled = []
    const next = []
    for (const p of remaining) {
      const x = p % width, y = (p - x) / width
      const sum = new Float64Array(channels)
      let count = 0
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          const q = yy * width + xx
          if (!known[q] || (island && island[q] !== island[p])) continue
          for (let c = 0; c < channels; c++) sum[c] += out[q * channels + c]
          count++
        }
      }
      if (count === 0) {
        next.push(p)
        continue
      }
      for (let c = 0; c < channels; c++) out[p * channels + c] = Math.round(sum[c] / count)
      filled.push(p)
    }
    if (!filled.length) break // amas sans aucun voisin sain : on le laisse tel quel
    for (const p of filled) known[p] = 1
    remaining = next
  }
  return out
}

/**
 * Marge des îlots (« edge padding ») : étend, couche par couche sur `radius` texels, la couleur des texels
 * UTILISÉS dans le vide (texels inutilisés) qui les entoure. `isCloth(i)` désigne les texels d'îlots de
 * vêtement : ils avancent à chaque couche, les autres tous les `round(1 / otherSpeed)` couches. Un texel vide
 * prend la moyenne des voisins (8) qui avancent à cette couche, ceux du vêtement d'abord. Renvoie une COPIE et
 * le masque des texels remplis ; seuls des texels inutilisés sont écrits.
 */
export function padAtlas(pixels, channels, width, height, used, isCloth, radius, otherSpeed = 0.5) {
  const out = Uint8Array.from(pixels)
  const n = width * height
  const kind = new Uint8Array(n) // 0 vide, 1 vêtement, 2 autre
  for (let i = 0; i < n; i++) kind[i] = used[i] ? (isCloth(i) ? 1 : 2) : 0
  const filled = new Uint8Array(n)
  if (radius <= 0) return { pixels: out, filled }
  const period = Math.max(1, Math.round(1 / Math.max(otherSpeed, 1e-6)))
  const around = (p, visit) => {
    const x = p % width, y = (p - x) / width
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy
      if (yy < 0 || yy >= height) continue
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const xx = x + dx
        if (xx < 0 || xx >= width) continue
        visit(yy * width + xx)
      }
    }
  }
  // Front initial : les texels vides voisins d'un texel utilisé.
  let frontier = []
  const queued = new Uint8Array(n)
  for (let p = 0; p < n; p++) {
    if (kind[p]) around(p, (q) => {
      if (!kind[q] && !queued[q]) {
        queued[q] = 1
        frontier.push(q)
      }
    })
  }
  const sum = [0, 0, 0, 0]
  for (let layer = 1; layer <= radius && frontier.length; layer++) {
    const otherMoves = (layer - 1) % period === 0
    const assign = []
    const waiting = []
    for (const p of frontier) {
      sum.fill(0)
      let cloth = 0, other = 0
      const clothSum = [0, 0, 0, 0], otherSum = [0, 0, 0, 0]
      around(p, (q) => {
        const k = kind[q]
        if (k === 1) {
          cloth++
          for (let c = 0; c < channels; c++) clothSum[c] += out[q * channels + c]
        } else if (k === 2 && otherMoves) {
          other++
          for (let c = 0; c < channels; c++) otherSum[c] += out[q * channels + c]
        }
      })
      if (cloth > 0) assign.push([p, 1, clothSum.map((v) => Math.round(v / cloth))])
      else if (other > 0) assign.push([p, 2, otherSum.map((v) => Math.round(v / other))])
      else waiting.push(p)
    }
    const next = waiting
    for (const [p, k, color] of assign) {
      for (let c = 0; c < channels; c++) out[p * channels + c] = color[c]
      kind[p] = k
      filled[p] = 1
    }
    for (const [p] of assign) {
      around(p, (q) => {
        if (!kind[q] && !queued[q]) {
          queued[q] = 1
          next.push(q)
        }
      })
    }
    frontier = next
  }
  return { pixels: out, filled }
}

/**
 * Différence avant/après : texels changés au total, dans les taches (`stains`), dans le vide rempli (`padded`),
 * AILLEURS (doit rester nul) et parmi les texels utilisés ET protégés (doit rester nul) ; plus fort écart.
 */
export function compareTextures(before, after, channels, width, height, { used, protectCore, stains, padded } = {}) {
  let changed = 0, inStains = 0, inPadding = 0, elsewhere = 0, changedProtected = 0, maxDelta = 0
  for (let i = 0; i < width * height; i++) {
    let delta = 0
    for (let c = 0; c < channels; c++) delta = Math.max(delta, Math.abs(before[i * channels + c] - after[i * channels + c]))
    if (delta === 0) continue
    changed++
    if (delta > maxDelta) maxDelta = delta
    if (used && protectCore && used[i] && protectCore[i]) changedProtected++
    if (stains && stains[i]) inStains++
    else if (padded && padded[i]) inPadding++
    else elsewhere++
  }
  return { changed, inStains, inPadding, elsewhere, changedProtected, maxDelta, share: changed / (width * height) }
}

/**
 * Nettoie la texture de couleur du premier matériau du document (texture encodée en PNG/JPEG/WebP) : détecte,
 * remplit, contrôle. Renvoie le PNG nettoyé et un rapport ; `null` pour l'image si rien n'a été changé.
 */
export async function cleanCharacterTexture(document, options = {}) {
  const o = { ...DEFAULTS, ...options }
  const material = document.getRoot().listMaterials()[0]
  const texture = material?.getBaseColorTexture()
  if (!texture) throw new Error('Aucune texture de couleur à nettoyer')
  const decoded = await sharp(Buffer.from(texture.getImage())).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = decoded.info
  const pixels = new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.length)
  const zones = rasterizeZones(document, width, height, o)

  // A. Taches, en `passes` tours : remplir une tache relève le niveau local de ses voisines, qui apparaissent
  // alors à leur tour (la moitié des taches de la première détection se retrouvaient sinon au deuxième passage).
  const stainMask = new Uint8Array(width * height)
  const rounds = []
  let current = pixels
  for (let pass = 0; pass < o.passes; pass++) {
    const { mask, clusters, stains, level } = detectStains(current, channels, width, height, zones, o)
    if (!stains) break
    const trusted = new Uint8Array(width * height)
    for (let i = 0; i < trusted.length; i++) {
      if (!zones.used[i] || zones.protect[i] || mask[i]) continue
      const r = current[i * channels], g = current[i * channels + 1], b = current[i * channels + 2]
      const l = luminance(r, g, b)
      // « Sain » : neutre et proche du niveau de sa zone (ni tache, ni peau, ni cheveux voisins dans l'atlas).
      if (Math.max(r, g, b) - Math.min(r, g, b) <= o.chromaMax && level[i] >= o.zoneMin && l >= 0.75 * level[i] && l <= 1.45 * level[i]) trusted[i] = 1
    }
    current = fillStains(current, channels, width, height, mask, trusted, zones.island)
    for (let i = 0; i < mask.length; i++) if (mask[i]) stainMask[i] = 1
    rounds.push({ clusters, texels: stains })
  }
  const filled = current

  // B. Marge des îlots (sur l'image déjà débarrassée de ses taches).
  const isCloth = (i) => {
    if (zones.protectCore[i]) return false
    const r = filled[i * channels], g = filled[i * channels + 1], b = filled[i * channels + 2]
    return luminance(r, g, b) < o.clothLuminanceMax && Math.max(r, g, b) - Math.min(r, g, b) <= o.chromaMax
  }
  const { pixels: after, filled: padded } = padAtlas(filled, channels, width, height, zones.used, isCloth, o.padRadius, o.padOtherSpeed)

  const diff = compareTextures(pixels, after, channels, width, height, { used: zones.used, protectCore: zones.protectCore, stains: stainMask, padded })
  if (diff.changedProtected > 0) throw new Error(`Contrôle : ${diff.changedProtected} texels protégés (visage, cheveux, yeux, mains) ont changé`)
  if (diff.elsewhere > 0) throw new Error(`Contrôle : ${diff.elsewhere} texels qui ne sont ni une tache ni du vide ont changé`)
  let usedTexels = 0, protectedTexels = 0, paddedTexels = 0, stainTexels = 0
  for (let i = 0; i < zones.used.length; i++) {
    stainTexels += stainMask[i]
    usedTexels += zones.used[i]
    protectedTexels += zones.protectCore[i] & zones.used[i]
    paddedTexels += padded[i]
  }
  const png = diff.changed > 0 ? await sharp(Buffer.from(after.buffer, after.byteOffset, after.length), { raw: { width, height, channels } }).png().toBuffer() : null
  return {
    png,
    before: pixels,
    after,
    mask: stainMask,
    padded,
    zones,
    width,
    height,
    channels,
    report: { width, height, usedTexels, protectedTexels, clusters: rounds[0]?.clusters ?? 0, rounds, stainTexels, paddedTexels, ...diff },
  }
}
