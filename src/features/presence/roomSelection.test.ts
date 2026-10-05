import { describe, expect, it } from 'vitest'
import {
  MAX_ROOMS,
  ROOM_CAPACITY,
  nextRoomIndex,
  roomName,
  sanitizeNamespace,
  shouldStayInRoom,
  sortByJoinOrder,
  targetRoomForRank,
} from './roomSelection'

function members(...pairs: Array<[string, number]>) {
  return pairs.map(([id, joinTs]) => ({ id, joinTs }))
}

describe('roomName', () => {
  it('nomme la salle avec le préfixe attendu', () => {
    expect(roomName(1)).toBe('musee:v1:room-1')
    expect(roomName(12)).toBe('musee:v1:room-12')
  })
})

describe('sortByJoinOrder', () => {
  it('trie par joinTs croissant', () => {
    const sorted = sortByJoinOrder(members(['c', 30], ['a', 10], ['b', 20]))
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('départage les ex-æquo par id, de façon stable pour tout le monde', () => {
    const a = sortByJoinOrder(members(['z', 5], ['a', 5]))
    const b = sortByJoinOrder(members(['a', 5], ['z', 5]))
    expect(a.map((m) => m.id)).toEqual(['a', 'z'])
    expect(b.map((m) => m.id)).toEqual(['a', 'z'])
  })

  it('ne modifie pas le tableau reçu', () => {
    const input = members(['b', 2], ['a', 1])
    sortByJoinOrder(input)
    expect(input.map((m) => m.id)).toEqual(['b', 'a'])
  })
})

describe('shouldStayInRoom', () => {
  it('reste si la salle est sous la capacité', () => {
    const list = members(['a', 1], ['b', 2])
    expect(shouldStayInRoom('a', list, 8)).toBe(true)
    expect(shouldStayInRoom('b', list, 8)).toBe(true)
  })

  it('reste tout juste à la capacité exacte', () => {
    const list = Array.from({ length: ROOM_CAPACITY }, (_, i) => ({ id: `p${i}`, joinTs: i }))
    for (const m of list) expect(shouldStayInRoom(m.id, list)).toBe(true)
  })

  it('au-delà de la capacité, seuls les derniers arrivés partent', () => {
    // 9 membres, capacité 8 : arrivés dans l'ordre p0..p8, p8 est le dernier arrivé.
    const list = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, joinTs: i }))
    for (let i = 0; i < 8; i++) expect(shouldStayInRoom(`p${i}`, list, 8)).toBe(true)
    expect(shouldStayInRoom('p8', list, 8)).toBe(false)
  })

  it('classement déterministe : tous les clients calculent la même décision pour chacun', () => {
    // 9 membres, ordre d'arrivée inversé par rapport à l'id : p0 est le DERNIER arrivé (joinTs le
    // plus grand), p8 le premier. Seul le dernier arrivé doit partir (capacité 8, 9 membres).
    const list = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, joinTs: 100 - i }))
    const decisions = list.map((m) => [m.id, shouldStayInRoom(m.id, list, 8)] as const)
    const staying = decisions.filter(([, stay]) => stay).map(([id]) => id)
    expect(new Set(staying)).toEqual(new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']))
    expect(decisions.find(([id]) => id === 'p0')?.[1]).toBe(false)
  })

  it('ne part jamais tout seul : au moins `capacity` restent quand la salle déborde', () => {
    const list = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, joinTs: i }))
    const staying = list.filter((m) => shouldStayInRoom(m.id, list, 8))
    expect(staying).toHaveLength(8)
  })
})

describe('nextRoomIndex', () => {
  it('avance tant que la salle max n’est pas atteinte', () => {
    expect(nextRoomIndex(1)).toBe(2)
    expect(nextRoomIndex(MAX_ROOMS - 1)).toBe(MAX_ROOMS)
  })

  it('retourne null au-delà de la dernière salle (mode solo)', () => {
    expect(nextRoomIndex(MAX_ROOMS)).toBeNull()
  })
})

describe('espaces de salles (tests E2E)', () => {
  it('préfixe le canal quand un espace est donné', () => {
    expect(roomName(2, 'e2e-ab12')).toBe('musee:v1:e2e-ab12:room-2')
    expect(roomName(2, null)).toBe('musee:v1:room-2')
  })
  it('nettoie l’espace demandé', () => {
    expect(sanitizeNamespace('E2E_ab/12!')).toBe('e2eab12')
    expect(sanitizeNamespace('')).toBeNull()
    expect(sanitizeNamespace('###')).toBeNull()
    expect(sanitizeNamespace('a'.repeat(50))).toHaveLength(32)
  })
})

describe('targetRoomForRank', () => {
  it('les `capacity` premiers (rang 0..capacity-1) restent dans la salle courante', () => {
    for (let rank = 0; rank < 8; rank++) expect(targetRoomForRank(3, rank, 8, 12)).toBe(3)
  })

  it('les suivants sautent directement de floor(rank / capacity) salles', () => {
    expect(targetRoomForRank(1, 8, 8, 12)).toBe(2)
    expect(targetRoomForRank(1, 15, 8, 12)).toBe(2)
    expect(targetRoomForRank(1, 16, 8, 12)).toBe(3)
    expect(targetRoomForRank(2, 24, 8, 12)).toBe(5)
  })

  it('null quand la cible dépasse la dernière salle (musée plein)', () => {
    expect(targetRoomForRank(12, 8, 8, 12)).toBeNull()
    expect(targetRoomForRank(11, 16, 8, 12)).toBeNull()
    expect(targetRoomForRank(11, 8, 8, 12)).toBe(12) // la dernière salle reste atteignable
  })

  it('ne recule jamais : la cible est toujours >= la salle courante', () => {
    for (let room = 1; room <= 12; room++) {
      for (let rank = 0; rank < 100; rank++) {
        const target = targetRoomForRank(room, rank, 8, 12)
        expect(target === null || target >= room).toBe(true)
      }
    }
  })

  it('respecte une capacité et un nombre de salles réglés', () => {
    expect(targetRoomForRank(1, 2, 2, 3)).toBe(2)
    expect(targetRoomForRank(1, 6, 2, 3)).toBeNull()
  })
})

describe('capacité retenue le 01/10 : 8 salles de 30 visiteurs', () => {
  it('240 places pour ~200 joueurs : au-delà de 200 connexions, c’est le serveur qui refuse (voir quota.ts)', () => {
    expect(ROOM_CAPACITY).toBe(30)
    expect(MAX_ROOMS).toBe(8)
    expect(ROOM_CAPACITY * MAX_ROOMS).toBe(240)
  })

  it('les 30 premiers restent, le rang 30 passe en salle suivante, le rang 60 deux salles plus loin', () => {
    for (let rank = 0; rank < ROOM_CAPACITY; rank++) expect(targetRoomForRank(1, rank, ROOM_CAPACITY, MAX_ROOMS)).toBe(1)
    expect(targetRoomForRank(1, 30, ROOM_CAPACITY, MAX_ROOMS)).toBe(2)
    expect(targetRoomForRank(1, 59, ROOM_CAPACITY, MAX_ROOMS)).toBe(2)
    expect(targetRoomForRank(1, 60, ROOM_CAPACITY, MAX_ROOMS)).toBe(3)
  })

  it('la huitième salle est la dernière : un rang qui la dépasse mène au solo', () => {
    expect(targetRoomForRank(7, 30, ROOM_CAPACITY, MAX_ROOMS)).toBe(8)
    expect(targetRoomForRank(8, 30, ROOM_CAPACITY, MAX_ROOMS)).toBeNull()
    expect(targetRoomForRank(1, 8 * ROOM_CAPACITY, ROOM_CAPACITY, MAX_ROOMS)).toBeNull()
  })
})
