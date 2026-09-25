/**
 * `roomGeometry.ts` dessine sur des `BufferGeometry` three.js pures (pas de canvas 2D, contrairement à
 * `textures.ts`) : testable sans DOM. On vérifie ici surtout `farWallX` (déplacée dans `layout.ts` depuis
 * WEL-874 — source de vérité des positions de décor — et ré-importée ici), dont dépend tout le décor
 * signature d'une aile est/ouest (`wingSignatureDecor`) — régression : le décor de l'aile
 * infrastructures se retrouvait plaqué contre la porte du hall plutôt que le mur du fond (voir
 * commentaire de `farWallX`).
 */
import { describe, expect, it } from 'vitest'
import type { RoomLayout } from '../types'
import { buildComingSoonBarrierGeometry, buildDoorArchesGeometry, buildRoomGeometry } from './roomGeometry'
import { buildMuseumArchitecture, farWallX } from './layout'
import { generatePlaceholderPeople } from '../data/placeholder'
import { dims } from './constants'

function roomWithBounds(minX: number, maxX: number): RoomLayout {
  return {
    id: 'infrastructures',
    bounds: { minX, maxX, minZ: -7, maxZ: 7 },
    label: { fr: 'Test', en: 'Test' },
    floorColor: '#000000',
    wallColor: '#000000',
    accentColor: '#000000',
  }
}

describe('farWallX — mur du fond d’une aile est/ouest, quel que soit son sens', () => {
  it('aile qui s’éloigne du hall vers les X négatifs (infrastructures, dir = -1) : le mur du fond est en minX', () => {
    // Mêmes ordres de grandeur que le plan réel (hall en x = -11, aile qui s'étend jusqu'à x = -44.6).
    const room = roomWithBounds(-44.6, -11)
    expect(farWallX(room, 0.3)).toBeCloseTo(-44.3, 5)
  })

  it('aile qui s’éloigne du hall vers les X positifs (culture, dir = +1) : le mur du fond est en maxX', () => {
    const room = roomWithBounds(11, 44.6)
    expect(farWallX(room, 0.3)).toBeCloseTo(44.3, 5)
  })

  it('ne se trompe jamais de côté : reste toujours du côté le plus loin de x = 0 (le hall)', () => {
    const negative = roomWithBounds(-44.6, -11)
    const positive = roomWithBounds(11, 44.6)
    expect(Math.abs(farWallX(negative, 0.3))).toBeGreaterThan(Math.abs(negative.bounds.maxX))
    expect(Math.abs(farWallX(positive, 0.3))).toBeGreaterThan(Math.abs(positive.bounds.minX))
  })
})

describe('buildRoomGeometry / buildComingSoonBarrierGeometry — fusion sans exception', () => {
  it('fusionne sol + murs + décor de chaque salle sans lever d’exception, pour une répartition qui peuple les trois ailes', () => {
    const people = generatePlaceholderPeople(100)
    const architecture = buildMuseumArchitecture(people)
    for (const { room, walls } of architecture.rooms) {
      const geo = buildRoomGeometry(room, walls, room.id === 'hall' ? architecture.decor : undefined)
      geo.computeBoundingBox()
      expect(geo.boundingBox, `géométrie vide pour la salle ${room.id}`).toBeTruthy()
      expect(geo.boundingBox!.max.x).toBeGreaterThan(geo.boundingBox!.min.x)
    }
  })

  it('la barrière décorative d’une aile « Bientôt » est une géométrie non dégénérée', () => {
    const geo = buildComingSoonBarrierGeometry({ x: 0, z: 0 }, 0)
    geo.computeBoundingBox()
    expect(geo.boundingBox!.max.x).toBeGreaterThan(geo.boundingBox!.min.x)
    expect(geo.boundingBox!.max.y).toBeGreaterThan(geo.boundingBox!.min.y)
  })

  // Item 4 (embellissement architecture) : l'arche arrondie ajoute un demi-cercle au-dessus du linteau
  // plat — la géométrie doit donc culminer nettement plus haut que le simple linteau (ARCH_HEIGHT = 0,4 m).
  it('les trois ailes peuplées : l’arche de porte dépasse le linteau plat (demi-cercle ajouté)', () => {
    const people = generatePlaceholderPeople(100)
    const architecture = buildMuseumArchitecture(people)
    const geo = buildDoorArchesGeometry(architecture.doorArches)
    expect(geo, 'les trois ailes sont peuplées : au moins une arche attendue').toBeTruthy()
    geo!.computeBoundingBox()
    const archTop = geo!.boundingBox!.max.y
    const archBottom = geo!.boundingBox!.min.y
    expect(archTop - archBottom).toBeGreaterThan(0.4) // > ARCH_HEIGHT (0,4, linteau plat seul) : le demi-cercle dépasse
    expect(archTop).toBeLessThan(dims.wallHeight) // ne perce jamais le plafond
  })

  it('aucune arche (toutes les ailes vides) : géométrie nulle', () => {
    expect(buildDoorArchesGeometry([])).toBeNull()
  })
})
