/**
 * Palette et mesures du musée.
 *
 * Décision de Baptiste du 29/09/2026 : la charte « 2026 : l'Odyssée de l'IA » s'applique PARTOUT, y
 * compris aux matières 3D (fond, sols, murs, tapis, mobilier, cadres). La décision du 26/09 (interface +
 * accents seulement, matières chaudes conservées) est annulée. Tout ce qui est 3D lit désormais
 * `charter3d` ci-dessous ; la table « surface → jeton → valeur → raison » et le modèle de rendu sont dans
 * `docs/CHARTE-3D.md`.
 *
 * `palette` (V1 crème/bois/vert feuille) ne reste que pour les personnages (avatar, étiquettes
 * de présence) tant qu'ils ne sont pas refaits : ne plus l'utiliser pour un décor. Les clés propres au
 * décor (`leaf`, `leafDark`, `paper`, `inkSoft`) sont redirigées vers la charte, en filet de sécurité.
 * Les mêmes valeurs de l'interface existent en variables CSS dans `src/styles/global.css`.
 */
import type { ExhibitWingId, WingId } from '../types'

export const palette = {
  // Héritage V1 : gelé, réservé aux personnages (src/npc/**, src/player/AvatarMesh.tsx, présence).
  cream: '#fff8e7',
  ink: '#4a3728',
  wood: '#c8a27a',
  woodDark: '#8c6a4a',
  gold: '#e8c872',
  shadow: '#3b2a1e',
  white: '#ffffff',
  // Clés propres au décor, redirigées vers la charte (alias de sécurité, voir docs/CHARTE-3D.md).
  paper: '#0a1738', // nuit (ex-papier crème)
  inkSoft: '#2d4fb0', // bleu trait (ex-brun doux)
  leaf: '#57bfd6', // cyan (ex-vert feuille)
  leafDark: '#4d8cff', // bleu néon (ex-vert sombre)
  // Ciel / fond de la scène : bleu nuit de la charte de l'Odyssée (skill de Cyril).
  sky: '#071336',
} as const

/**
 * Palette de l'événement « 2026 : l'Odyssée de l'IA » (skill conference-dataviz-odyssee-ia-2026).
 * Interface ET musée 3D (voir `charter3d`).
 */
export const eventPalette = {
  corail: '#e8785c',
  corailDeep: '#b04a33',
  bleu: '#1d49c1',
  bleuDeep: '#113198',
  bleuNuit: '#071336',
  bleuNeon: '#4d8cff',
  cyan: '#57bfd6',
  cyanVif: '#6de4e5',
  alarm: '#d6248c',
  blanc: '#ffffff',
} as const

/** Jeu de couleurs d'une salle (voir `charter3d.rooms`). */
export interface RoomCharter {
  /** Sol : première teinte (damier, planche A des chevrons), teinte de base (moquette). */
  floor: string
  /** Sol : seconde teinte (damier, planche B des chevrons) ou bordure (moquette). */
  floorAlt: string
  wall: string
  /** Seconde teinte des murs (briques de l'aile Industrialisation) ; égale à `wall` ailleurs. */
  wallAlt: string
  /** Lambris bas (0,95 m). */
  wainscot: string
  /** Plinthe (0,16 m) des murs et des cimaises. */
  plinth: string
  /** Fin liseré posé sur le haut du lambris. */
  listel: string
  /** Corniche haute : lumineuse, à la couleur de la salle. */
  cornice: string
  /** Bande posée sur le dessus des murs coupés côté caméra. */
  cap: string
  accent: string
}

/**
 * Charte 3D du musée. Valeurs = albédos à passer aux matériaux et aux canvas ; la couleur affichée
 * dépend des lumières de `scene` (rendu SANS tone mapping : `<Canvas flat>`).
 * Dérivations, en mélange sRGB : `brume` = blanc + 12 % de bleu néon ; `mur` = bleu + 12 % de blanc ;
 * `floorAlt` du hall = bleu profond + 35 % de bleu ; des Infrastructures = bleu profond + 12 % de cyan
 * vif ; de l'Industrialisation = bleu profond + 12 % de corail ; `floor` de la Culture = bleu profond
 * + 25 % de bleu ; `floorAlt` des Archives = bleu profond + 55 % de nuit ; `wallAlt` de
 * l'Industrialisation = mur + 50 % de bleu. Le test `charter3d.test.ts` vérifie ces dérivations, les
 * contrastes AA et la hiérarchie de luminance ciel < sol < mur.
 */
export const charter3d = {
  /** Jetons de base. Aucune autre couleur en dur dans un décor : tout vient d'ici. */
  base: {
    ciel: '#071336', // fond de scène, brouillard
    nuit: '#0a1738', // panneaux, toiles, cartels
    nuitProfond: '#050b1e', // plinthes, texte posé sur un aplat d'accent
    bleu: '#1d49c1',
    bleuProfond: '#113198',
    bleuTrait: '#2d4fb0', // mobilier (déjà `--wood` de l'interface)
    blanc: '#ffffff',
    brume: '#eaf1ff', // blanc bleuté des matières claires (colonnes, socles, tronc)
    mur: '#385fc8', // murs de toutes les salles
    corail: '#e8785c',
    corailProfond: '#b04a33',
    cyan: '#57bfd6',
    cyanVif: '#6de4e5',
    bleuNeon: '#4d8cff',
    magenta: '#d6248c', // UN SEUL usage : accès fermé (barrière et plaque « Bientôt »)
    attente: '#5a6a98', // encre d'un tampon pas encore obtenu (déjà `PENDING_COLOR`)
  },

  /** Ciel, brouillard, lumières. `flat` : `<Canvas flat>` (pas d'ACES, qui fausserait les bleus et le corail). */
  scene: {
    background: '#071336',
    fog: { color: '#071336', near: 28, far: 70 },
    flat: true,
    hemisphere: { sky: '#f4f7ff', ground: '#b4c0f0', intensity: 2 },
    directional: { color: '#fffaf2', intensity: 1.75, position: [5, 11, 12] as [number, number, number] },
    rays: '#cfe0ff', // rayons de la verrière du hall (additifs)
  },

  /** Architecture par salle. `floor`/`floorAlt` : damier (ailes), chevrons (hall), moquette + bordure (culture). */
  rooms: {
    hall: { floor: '#113198', floorAlt: '#1539a6', wall: '#385fc8', wallAlt: '#385fc8', wainscot: '#1d49c1', plinth: '#113198', listel: '#ffffff', cornice: '#e8785c', cap: '#e8785c', accent: '#e8785c' },
    infrastructures: { floor: '#113198', floorAlt: '#1c46a1', wall: '#385fc8', wallAlt: '#385fc8', wainscot: '#1d49c1', plinth: '#113198', listel: '#ffffff', cornice: '#6de4e5', cap: '#6de4e5', accent: '#6de4e5' },
    industrialisation: { floor: '#113198', floorAlt: '#2b3a91', wall: '#385fc8', wallAlt: '#2b54c5', wainscot: '#1d49c1', plinth: '#113198', listel: '#ffffff', cornice: '#e8785c', cap: '#e8785c', accent: '#e8785c' },
    culture: { floor: '#1437a2', floorAlt: '#1d49c1', wall: '#385fc8', wallAlt: '#385fc8', wainscot: '#1d49c1', plinth: '#113198', listel: '#ffffff', cornice: '#4d8cff', cap: '#4d8cff', accent: '#4d8cff' },
    archives: { floor: '#113198', floorAlt: '#0d2363', wall: '#385fc8', wallAlt: '#385fc8', wainscot: '#1d49c1', plinth: '#113198', listel: '#ffffff', cornice: '#57bfd6', cap: '#57bfd6', accent: '#57bfd6' },
  } satisfies Record<WingId, RoomCharter>,

  /** Sol du hall : disque du logo (scanlines) et chemins de tapis vers chaque porte. */
  hallFloor: {
    rugBacking: '#0a1738',
    rugBar: '#ffffff',
    rugBarAccent: '#e8785c', // les trois barres corail du logo
    pathEdge: '#ffffff', // liseré de bord des chemins
    path: { infrastructures: '#6de4e5', industrialisation: '#e8785c', culture: '#4d8cff', archives: '#57bfd6' },
  },

  /** Câbles au sol de l'aile Infrastructures. */
  cables: { main: '#6de4e5', thin: '#ffffff' },

  /** Mobilier procédural du hall et des ailes. */
  furniture: {
    counter: { body: '#e8785c', top: '#ffffff', bell: '#0a1738' },
    rope: { post: '#ffffff', cord: '#e8785c', cordClosed: '#d6248c' },
    tree: { trunk: '#eaf1ff', leafMain: '#6de4e5', leafLeft: '#4d8cff', leafRight: '#e8785c', crown: '#ffffff', bench: '#ffffff' },
    gearDisc: '#ffffff', // dents = accent de l'aile
    easel: { legs: '#ffffff', board: '#4d8cff' },
  },

  /** Signalétique : bannière, panneaux de porte, plaques. Contour/pictogramme/flèche d'un panneau de porte = accent de l'aile. */
  signage: {
    banner: { fill: '#071336', border: '#e8785c', title: '#ffffff', subtitle: '#e8785c' },
    wingPanel: { fill: '#0a1738', text: '#ffffff' },
    comingSoon: { fill: '#0a1738', border: '#d6248c', text: '#ffffff' },
    plate: { fill: '#0a1738', border: '#e8785c', name: '#ffffff', title: 'rgba(255,255,255,0.78)' },
  },

  /** Cadre des portraits : moulure extérieure blanche, moulure médiane = accent de l'aile (une géométrie par aile). */
  frame: {
    outer: '#ffffff',
    lip: '#0a1738',
    mat: '#0a1738',
    lampArm: '#0a1738',
    lampShade: '#ffffff',
    lens: '#ffffff',
    halo: { core: 'rgba(234,241,255,0.9)', mid: 'rgba(234,241,255,0.35)', edge: 'rgba(234,241,255,0)' },
    // Blanc (et non corail) : ajouté au passe-partout nuit, le corail virait au bordeaux (revue du 29/09).
    highlightEmissive: '#ffffff',
    bubble: { fill: '#e8785c', stroke: '#ffffff', glyph: '#050b1e' },
  },

  /** Toile d'attente d'un portrait. Silhouette et bandeau = accent de l'aile, silhouette tracée en scanlines. */
  portrait: {
    canvas: { width: 256, height: 315 }, // rapport 1,3 / 1,6 du cadre : plus d'étirement vertical
    fill: '#0a1738',
    bandShare: 0.19, // part de la hauteur occupée par le bandeau du numéro
    bandText: '#050b1e',
    scanline: { pitch: 11, bar: 6 }, // px : rapport barre / pas ≈ 0,56, comme le disque du logo
    kicker: 'rgba(255,255,255,0.72)',
  },

  /** Cartel sous le cadre : filet et contour = accent de l'aile. */
  cartel: { fill: '#0a1738', name: '#ffffff', org: 'rgba(255,255,255,0.78)' },

  /** Socles à tampon (l'encre d'un tampon obtenu = accent de l'aile). */
  stamp: { column: '#eaf1ff', handle: '#ffffff', idleInk: '#5a6a98', spark: '#ffffff' },

  /** Salle des Archives de 2040. */
  archives: {
    floor: {
      base: '#113198',
      vignetteEdge: 'rgba(5,11,30,0.45)',
      pathGlow: 'rgba(87,191,214,0.28)',
      pathLine: 'rgba(109,228,229,0.9)',
      nodeGlow: 'rgba(109,228,229,0.55)',
      node: '#ffffff',
    },
    pillar: '#eaf1ff',
    // Sans lueur cyan : vue de biais, elle virait au vert ardoise sur le bleu nuit (revue du 29/09).
    panel: { color: '#0a1738', emissive: '#57bfd6', emissiveIntensity: 0 },
    bench: '#eaf1ff',
    lectern: '#0a1738',
    threshold: '#57bfd6',
    sign: { fill: 'rgba(10,23,56,0.94)', border: '#57bfd6', title: '#ffffff', date: '#6de4e5', provisional: '#e8785c' },
    crystals: { a: '#6de4e5', b: '#e8785c' },
    antenna: '#4d8cff',
    vitrine: {
      socle: '#eaf1ff',
      socleEmissive: '#6de4e5',
      socleHighlight: '#ffffff',
      socleHighlightEmissive: '#6de4e5',
      capsuleIdle: '#57bfd6',
      capsuleArchived: '#e8785c',
      screenFill: 'rgba(10,23,56,0.92)',
      screenIdle: '#6de4e5',
      screenArchived: '#e8785c',
      screenText: '#ffffff',
      screenSub: 'rgba(255,255,255,0.75)',
    },
    archivist: {
      torso: '#57bfd6',
      head: '#ffffff',
      ring: '#6de4e5',
      particle: '#ffffff',
      beam: '#57bfd6',
      plinth: '#eaf1ff',
      plinthRim: '#57bfd6',
      bubbleFill: '#0a1738',
      bubbleStroke: '#57bfd6',
      bubbleDots: '#ffffff',
    },
    bubble: { fill: '#57bfd6', stroke: '#ffffff', glyph: '#050b1e' },
  },

  /** Teintes des modèles Kenney (`src/world/props/tints.ts`), par variante et par matériau d'origine. */
  props: {
    stone: '#eaf1ff', // colonnes
    stanchion: '#eaf1ff', // potelets
    wood: { body: '#eaf1ff', trim: '#2d4fb0' }, // bancs, tables, bureaux, étagères, bibliothèques
    planter: { pot: '#ffffff', soil: '#0a1738', plant: '#57bfd6' },
    lamp: { metal: '#ffffff', shade: '#e8785c' },
    rug: { field: '#e8785c', border: '#b04a33' },
    books: { a: '#4d8cff', b: '#ffffff', c: '#e8785c', d: '#6de4e5' },
    flowers: { stem: '#57bfd6', red: '#e8785c', yellow: '#ffffff', purple: '#4d8cff' },
    culture: { velvet: '#4d8cff', wood: '#ffffff' },
    sculpture: { stone: '#ffffff', base: '#4d8cff' },
  },

  /** Typographie des canvas : Poppins (≤ 600) pour les mots, JetBrains Mono (≤ 500) pour les chiffres. */
  text: {
    onNight: '#ffffff',
    onNightSoft: 'rgba(255,255,255,0.78)',
    onAccent: '#050b1e',
    maxWeight: 600,
    display: "Poppins, 'Futura', 'Avenir Next', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  },
}

export interface WingTheme {
  floor: string
  wall: string
  accent: string
  trim: string
}

/**
 * Chaque salle lit la charte 3D : sol, murs, accent. `trim` = liseré de corniche = couleur d'accent de la
 * salle (`roomGeometry.ts` s'en sert pour la corniche). Ces valeurs alimentent `RoomLayout.floorColor`,
 * `wallColor` et `accentColor` (voir `world/layout.ts`) : le sol et les murs suivent sans autre changement.
 */
const { rooms } = charter3d
export const wingThemes: Record<WingId, WingTheme> = {
  // Grand hall : dalles bleu profond, murs bleus, accent corail (tapis, corniche, bannière).
  hall: { floor: rooms.hall.floor, wall: rooms.hall.wall, accent: rooms.hall.accent, trim: rooms.hall.cornice },
  // Infrastructures : cyan vif de la charte.
  infrastructures: { floor: rooms.infrastructures.floor, wall: rooms.infrastructures.wall, accent: rooms.infrastructures.accent, trim: rooms.infrastructures.cornice },
  // Industrialisation : corail de la charte, murs en briques bleues.
  industrialisation: { floor: rooms.industrialisation.floor, wall: rooms.industrialisation.wall, accent: rooms.industrialisation.accent, trim: rooms.industrialisation.cornice },
  // Culture : bleu néon de la charte.
  culture: { floor: rooms.culture.floor, wall: rooms.culture.wall, accent: rooms.culture.accent, trim: rooms.culture.cornice },
  // Archives de 2040 : cyan de la charte (contrepoint), mêmes murs que le reste du musée.
  archives: { floor: rooms.archives.floor, wall: rooms.archives.wall, accent: rooms.archives.accent, trim: rooms.archives.cornice },
}

/**
 * Porte sud du hall vers les Archives de 2040 (plan en croix, décision de Baptiste du 27/09 :
 * plus de portail, la salle est accrochée au hall, derrière le point d'arrivée). Contrat partagé :
 * le monde perce le mur sud du hall à cet endroit, le module archives perce son mur nord en face.
 */
export const archivesDoor = { x: 0, width: 3.6 } as const

export const exhibitWingOrder: readonly ExhibitWingId[] = ['infrastructures', 'industrialisation', 'culture']

/** Échelle : 1 unité = 1 mètre. */
export const dims = {
  wallHeight: 4.2,
  wallThickness: 0.4,
  frameWidth: 1.3,
  frameHeight: 1.6,
  frameCenterY: 1.9,
  playerRadius: 0.35,
  playerHeight: 1.15,
  interactRadius: 2.2,
} as const

/**
 * Caméra 3e personne à orientation fixe (regarde vers −Z), partagée par le joueur
 * (qui la pilote) et le monde (qui estompe les cloisons situées entre elle et le joueur).
 * `pitchDeg` : plongée ; la distance réelle s'adapte au format d'écran entre min et max.
 */
export const cameraRig = {
  pitchDeg: 48,
  fovDeg: 42,
  /** Largeur de sol visible visée à la profondeur du joueur, en mètres. */
  targetVisibleWidth: 11,
  minDistance: 9,
  maxDistance: 17,
  /** Hauteur du point visé au-dessus des pieds du joueur. */
  lookHeight: 1,
} as const

/** Position de caméra pour un joueur en (x, z) et une distance donnée (fonction pure). */
export function cameraPositionFor(x: number, z: number, distance: number): { x: number; y: number; z: number } {
  const pitch = (cameraRig.pitchDeg * Math.PI) / 180
  return {
    x,
    y: cameraRig.lookHeight + Math.sin(pitch) * distance,
    z: z + Math.cos(pitch) * distance,
  }
}
