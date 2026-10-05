/**
 * Programme de la soirée « L'Odyssée de l'IA » et liste générale des intervenant·es.
 * Sources écrites, sans rien ajouter :
 *  A. Programme Drive « Programme l'Odyssée de l'IA.docx » (15/09/2026, pré-programme) : thèmes des
 *     trois tables rondes.
 *  B. Annonce officielle de L'Opinion aux inscrits (22/09/2026) : liste générale des intervenant·es.
 *  C. « PROGRAMME ODYSSEE DE L'IA au 24.09.docx », envoyé par Ségolène Pintaud le 24/09/2026 :
 *     déroulé, horaires et intervenant·es de chaque séquence. C'est la source de référence.
 * Une personne n'est attribuée à une séquence que si C l'y nomme ET qu'elle figure dans B. Les
 * personnes marquées « en attente de confirmation » dans C ne sont pas attribuées ; leur séquence
 * reste `provisional: true`, comme toute séquence que C signale incomplète. Les indications de
 * régie de C (« Grégoire annonce… », « Muriel monte sur scène… ») ne sont pas reprises.
 * Propriétaire : workflow « Archives de 2040 ».
 */
import type { EveningSession, Localized, SessionSpeaker } from '../types'

// ---------------------------------------------------------------------------
// Liste générale des intervenant·es annoncé·es (source B), quelle que soit leur séquence.
// ---------------------------------------------------------------------------

export interface EveningSpeakerEntry {
  name: string
  role: Localized
  /** Vide pour une personne sans organisation listée en source B (ex. une ministre). */
  organization: string
}

export const EVENING_SPEAKERS: EveningSpeakerEntry[] = [
  { name: 'Grégoire Arnould', role: { fr: 'Journaliste', en: 'Journalist' }, organization: "L'Opinion" },
  { name: 'Louise Boucher', role: { fr: 'General partner', en: 'General partner' }, organization: 'Sisyphus Ventures' },
  { name: 'Gautier Cloix', role: { fr: 'CEO', en: 'CEO' }, organization: 'H Company' },
  { name: 'Raphaël Doan', role: { fr: 'Auteur', en: 'Author' }, organization: '' },
  { name: 'Zineb El Honsali-Abridi', role: { fr: 'Principal', en: 'Principal' }, organization: 'Oliver Wyman' },
  { name: 'Samuel Fitoussi', role: { fr: 'Essayiste et investisseur', en: 'Essayist and investor' }, organization: 'FRST' },
  { name: 'Rémi Godeau', role: { fr: 'Directeur de la rédaction', en: 'Editorial director' }, organization: "L'Opinion" },
  { name: 'Charles Gorintin', role: { fr: 'Cofondateur et CTO', en: 'Co-founder and CTO' }, organization: 'Alan' },
  {
    name: 'Jessyn Katchera',
    role: {
      fr: "Partner et Responsable de l'équipe data & analytics",
      en: 'Partner and Head of the data & analytics team',
    },
    organization: 'Oliver Wyman',
  },
  { name: 'David Lacombled', role: { fr: 'Président', en: 'Chairman' }, organization: 'La Villa Numeris' },
  { name: 'Catherine Laurent', role: { fr: 'Journaliste', en: 'Journalist' }, organization: "L'Opinion" },
  { name: 'Marc Menasé', role: { fr: 'Founding Partner', en: 'Founding Partner' }, organization: 'Founders Future' },
  { name: 'Muriel Motte', role: { fr: 'Journaliste', en: 'Journalist' }, organization: "L'Opinion" },
  {
    name: 'Sébastien Rozanes',
    role: { fr: 'Chief Digital, Data & AI Officer', en: 'Chief Digital, Data & AI Officer' },
    organization: 'FDJ United',
  },
  { name: 'Laurent Solly', role: { fr: 'COO', en: 'COO' }, organization: 'Advanced Machine Intelligence' },
  { name: 'Cyril de Sousa Cardoso', role: { fr: 'CEO', en: 'CEO' }, organization: 'Polaria' },
  {
    name: 'Catherine Vautrin',
    role: {
      fr: 'Ministre des Armées et des Anciens combattants',
      en: 'Minister of the Armed Forces and Veterans',
    },
    organization: '',
  },
]

// ---------------------------------------------------------------------------
// Programme, séquence par séquence (source A), filtré par les règles d'attribution ci-dessus.
// ---------------------------------------------------------------------------

/** Raccourci : retrouve une personne de la liste générale par son nom exact (source B). */
function speaker(name: string, moderator = false): SessionSpeaker {
  const entry = EVENING_SPEAKERS.find((s) => s.name === name)
  if (!entry) throw new Error(`eveningProgram : « ${name} » absent de EVENING_SPEAKERS`)
  const base: SessionSpeaker = { name: entry.name, role: entry.role }
  if (entry.organization) base.organization = entry.organization
  if (moderator) base.moderator = true
  return base
}

export const EVENING_PROGRAM: EveningSession[] = [
  {
    id: 'film',
    order: 1,
    startTime: '18:30',
    durationMin: 7,
    kind: 'film',
    title: { fr: "Film Polaria × L'Opinion", en: "Polaria × L'Opinion film" },
    speakers: [],
    provisional: false,
  },
  {
    id: 'introduction',
    order: 2,
    startTime: '18:37',
    durationMin: 1,
    kind: 'ouverture',
    title: { fr: 'Introduction', en: 'Introduction' },
    speakers: [speaker('Rémi Godeau')],
    provisional: false,
  },
  {
    id: 'generique',
    order: 3,
    startTime: '18:38',
    durationMin: 1,
    kind: 'film',
    title: { fr: 'Générique', en: 'Opening titles' },
    speakers: [],
    provisional: false,
  },
  {
    id: 'presentation',
    order: 4,
    startTime: '18:39',
    durationMin: 6,
    kind: 'presentation',
    title: { fr: 'Présentation', en: 'Presentation' },
    theme: { fr: 'Souveraineté et IA agentique', en: 'Sovereignty and agentic AI' },
    speakers: [speaker('Cyril de Sousa Cardoso'), speaker('Rémi Godeau')],
    provisional: false,
  },
  {
    id: 'keynote-ouverture',
    order: 5,
    startTime: '18:45',
    durationMin: 10,
    kind: 'keynote',
    title: { fr: "Keynote d'ouverture", en: 'Opening keynote' },
    speakers: [speaker('Catherine Vautrin'), speaker('Rémi Godeau', true)],
    provisional: false,
  },
  {
    id: 'les100-presentation',
    order: 6,
    startTime: '18:55',
    durationMin: 5,
    kind: 'les100',
    title: {
      fr: "Présentation exclusive des 100 qui font l'IA en Europe",
      en: 'Exclusive presentation of the 100 shaping AI in Europe',
    },
    speakers: [speaker('Zineb El Honsali-Abridi'), speaker('Grégoire Arnould')],
    provisional: false,
  },
  {
    id: 'magneto-1',
    order: 7,
    startTime: '19:00',
    durationMin: 1,
    kind: 'magneto',
    title: { fr: 'Magnéto 1', en: 'Video reel 1' },
    theme: { fr: 'Dataviz — Infrastructures', en: 'Data visualisation — Infrastructure' },
    speakers: [],
    provisional: false,
  },
  {
    id: 'table-ronde-1',
    order: 8,
    startTime: '19:01',
    durationMin: 14,
    kind: 'table-ronde',
    title: { fr: 'De la promesse aux infrastructures', en: 'From promise to infrastructure' },
    theme: {
      fr:
        "L'IA n'est plus une promesse. Elle est devenue une infrastructure stratégique de croissance, de " +
        'compétitivité et de souveraineté. Signaux positifs et inquiétudes en Europe',
      en:
        'AI is no longer a promise. It has become a strategic infrastructure for growth, competitiveness ' +
        'and sovereignty. Positive signals and concerns in Europe',
    },
    // Deux intervenants « en attente de confirmation » dans C (OVHcloud, Station F) : non attribués.
    speakers: [speaker('Raphaël Doan'), speaker('Muriel Motte', true)],
    provisional: true,
  },
  {
    id: 'face-a-face-1',
    order: 9,
    startTime: '19:15',
    durationMin: 10,
    kind: 'face-a-face',
    title: { fr: 'Face à face : étude de cas I', en: 'Face to face: case study I' },
    speakers: [speaker('Jessyn Katchera'), speaker('Sébastien Rozanes'), speaker('Rémi Godeau', true)],
    provisional: false,
  },
  {
    id: 'magneto-2',
    order: 10,
    startTime: '19:25',
    durationMin: 1,
    kind: 'magneto',
    title: { fr: 'Magnéto 2', en: 'Video reel 2' },
    theme: { fr: 'Dataviz — Industrialisation', en: 'Data visualisation — Industrialisation' },
    speakers: [],
    provisional: false,
  },
  {
    id: 'table-ronde-2',
    order: 11,
    startTime: '19:26',
    durationMin: 14,
    kind: 'table-ronde',
    title: { fr: "De l'invention à l'industrialisation", en: 'From invention to industrialisation' },
    theme: {
      fr:
        'La compétition mondiale porte désormais moins sur la recherche que sur la capacité à passer ' +
        "rapidement de l'invention à l'industrialisation",
      en:
        'Global competition is now less about research than about the ability to move quickly from ' +
        'invention to industrialisation',
    },
    // C : « avec un journaliste ou autre intervenant en cours ».
    speakers: [speaker('Gautier Cloix'), speaker('Catherine Laurent', true)],
    provisional: true,
  },
  {
    id: 'les100-portraits',
    order: 12,
    startTime: '19:40',
    durationMin: 5,
    kind: 'les100',
    title: {
      fr: "Quatre portraits des 100 qui font l'IA en Europe",
      en: 'Four portraits of the 100 shaping AI in Europe',
    },
    speakers: [speaker('Grégoire Arnould'), speaker('Rémi Godeau')],
    provisional: false,
  },
  {
    id: 'keynote-middle',
    order: 13,
    startTime: '19:45',
    durationMin: 10,
    kind: 'keynote',
    title: { fr: 'Keynote du milieu de soirée', en: 'Midpoint keynote' },
    speakers: [speaker('Charles Gorintin'), speaker('Rémi Godeau', true)],
    provisional: false,
  },
  {
    id: 'face-a-face-2',
    order: 14,
    startTime: '19:55',
    durationMin: 10,
    kind: 'face-a-face',
    title: { fr: 'Face à face : étude de cas II', en: 'Face to face: case study II' },
    // C : « en attente de validation », sans intervenant·e.
    speakers: [],
    provisional: true,
  },
  {
    id: 'magneto-3',
    order: 15,
    startTime: '20:05',
    durationMin: 1,
    kind: 'magneto',
    title: { fr: 'Magnéto 3', en: 'Video reel 3' },
    theme: { fr: 'Dataviz — Culture', en: 'Data visualisation — Culture' },
    speakers: [],
    provisional: false,
  },
  {
    id: 'table-ronde-3',
    order: 16,
    startTime: '20:06',
    durationMin: 14,
    kind: 'table-ronde',
    title: { fr: 'De la réaction au changement de culture', en: 'From reaction to cultural change' },
    theme: {
      fr:
        "Concilier protection et rapidité d'exécution, financer les innovations de rupture, considérer " +
        "l'innovation comme une priorité stratégique : le défi est autant culturel qu'économique",
      en:
        'Reconciling protection with speed of execution, financing breakthrough innovations, treating ' +
        'innovation as a strategic priority: the challenge is as cultural as it is economic',
    },
    speakers: [speaker('Louise Boucher'), speaker('Samuel Fitoussi'), speaker('Marc Menasé'), speaker('David Lacombled', true)],
    provisional: false,
  },
  {
    id: 'keynote-cloture',
    order: 17,
    startTime: '20:20',
    durationMin: 10,
    kind: 'cloture',
    title: { fr: 'Keynote de clôture', en: 'Closing keynote' },
    speakers: [speaker('Laurent Solly'), speaker('Rémi Godeau', true)],
    provisional: false,
  },
  {
    id: 'final',
    order: 18,
    startTime: '20:30',
    durationMin: 10,
    kind: 'final',
    title: { fr: 'Final expérimental avec IA agentique', en: 'Experimental finale with agentic AI' },
    speakers: [speaker('Cyril de Sousa Cardoso'), speaker('Rémi Godeau')],
    provisional: false,
  },
  {
    id: 'conclusion',
    order: 19,
    startTime: '20:40',
    durationMin: 2,
    kind: 'cloture',
    title: { fr: 'Conclusion', en: 'Conclusion' },
    speakers: [speaker('Rémi Godeau')],
    provisional: false,
  },
]

/** Seules ces séquences ont une vitrine dans les Archives de 2040. */
export const ARCHIVE_SESSIONS: EveningSession[] = EVENING_PROGRAM.filter((session) => session.kind === 'table-ronde')
export const ARCHIVE_SESSION_IDS: ReadonlySet<string> = new Set(ARCHIVE_SESSIONS.map((session) => session.id))

// ---------------------------------------------------------------------------
// Informations générales de la soirée, pour un panneau d'affichage (source B + point du 24/09).
// ---------------------------------------------------------------------------

export interface EveningMeta {
  event: Localized
  date: string
  doorsTime: string
  startTime: string
  venue: Localized
  address: string
  /** Vrai tant qu'une séquence reste incomplète (intervenant·e en attente dans la source C). */
  provisional: boolean
  provisionalNotice: Localized
  /** Sources autorisées, pour audit (jamais affichées comme des citations). */
  sources: string[]
}

export const EVENING_META: EveningMeta = {
  event: { fr: "L'Odyssée de l'IA", en: "L'Odyssée de l'IA" },
  date: '2026-10-06',
  doorsTime: '18:00',
  startTime: '18:30',
  venue: { fr: 'Théâtre de la Tour Eiffel', en: 'Théâtre de la Tour Eiffel' },
  address: '4 square Rapp, 75007 Paris',
  provisional: true,
  provisionalNotice: {
    fr: 'Programme au 24 septembre, susceptible d’évoluer.',
    en: 'Programme as of 24 September, subject to change.',
  },
  sources: [
    "Programme Drive « Programme l'Odyssée de l'IA.docx » (modifié le 15/09/2026, pré-programme)",
    "Annonce officielle de L'Opinion aux inscrits (22/09/2026)",
    "« PROGRAMME ODYSSEE DE L'IA au 24.09.docx » (Ségolène Pintaud, 24/09/2026)",
    'Compte rendu du point du 24/09/2026 (déroulé de la soirée, Archiviste, QR code)',
  ],
}
