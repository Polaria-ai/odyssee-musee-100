// STUB — propriétaire : workflow « Archives de 2040 ». Fonctions pures, testées.
import type { ArchivesLayout, EveningSession, MuseumLayout } from '../types'
import { hallReservedSpots, wingThemes } from '../styles/tokens'

/** Centre de la salle des Archives : loin du musée, on y arrive par la Porte de 2040. */
export const ARCHIVES_ORIGIN = { x: 0, z: 80 } as const

/** Plan de la salle des Archives pour les séquences données (une vitrine par séquence). */
export function buildArchivesLayout(sessions: EveningSession[]): ArchivesLayout {
  const t = wingThemes.archives
  const { x, z } = ARCHIVES_ORIGIN
  const bounds = { minX: x - 12, maxX: x + 12, minZ: z - 10, maxZ: z + 10 }
  return {
    room: { id: 'archives', bounds, label: { fr: 'Les Archives de 2040', en: 'The 2040 Archives' }, floorColor: t.floor, wallColor: t.wall, accentColor: t.accent },
    colliders: [],
    slots: sessions.map((s, i) => ({ sessionId: s.id, position: [x - 10 + (i % 10) * 2.2, 1.6, z - 9.6] as [number, number, number], rotationY: 0, viewPoint: { x: x - 10 + (i % 10) * 2.2, z: z - 7.8 } })),
    arrival: { position: { x, z: z + 6 }, rotationY: Math.PI },
    hallPortal: { position: { x: hallReservedSpots.timePortal.x, z: hallReservedSpots.timePortal.z }, rotationY: 0 },
    returnPortal: { position: { x, z: z + 8.5 }, rotationY: 0 },
    archivist: { position: { x, z: z - 3 }, rotationY: 0 },
  }
}

/** Ajoute la salle des Archives au plan du musée (salles, obstacles, emprise). */
export function mergeArchivesIntoLayout(museum: MuseumLayout, archives: ArchivesLayout): MuseumLayout {
  const b = archives.room.bounds
  return {
    ...museum,
    rooms: [...museum.rooms, archives.room],
    colliders: [...museum.colliders, ...archives.colliders],
    bounds: {
      minX: Math.min(museum.bounds.minX, b.minX),
      maxX: Math.max(museum.bounds.maxX, b.maxX),
      minZ: Math.min(museum.bounds.minZ, b.minZ),
      maxZ: Math.max(museum.bounds.maxZ, b.maxZ),
    },
  }
}
