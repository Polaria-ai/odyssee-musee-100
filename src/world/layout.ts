// STUB — propriétaire : agent monde. Fonction pure et déterministe.
import type { MuseumLayout, Person } from '../types'
import { wingThemes } from '../styles/tokens'

/** Calcule le plan du musée (salles, murs, cadres) pour la liste donnée. */
export function buildMuseumLayout(people: Person[]): MuseumLayout {
  const t = wingThemes.hall
  return {
    rooms: [{ id: 'hall', bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, label: { fr: 'Grand hall', en: 'Great hall' }, floorColor: t.floor, wallColor: t.wall, accentColor: t.accent }],
    colliders: [],
    frames: people.map((p, i) => ({ personId: p.id, wing: p.wing, position: [-9 + (i % 10) * 2, 1.9, -9.8] as [number, number, number], rotationY: 0, viewPoint: { x: -9 + (i % 10) * 2, z: -8 } })),
    spawn: { position: { x: 0, z: 6 }, rotationY: Math.PI },
    curator: { position: { x: 0, z: 0 }, rotationY: 0 },
    stampStations: [],
    bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
  }
}
