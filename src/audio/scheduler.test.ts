import { describe, expect, it } from 'vitest'
import { notesInWindow, type LoopPattern } from './scheduler'

interface Note {
  time: number
  degree: number
}

describe('notesInWindow', () => {
  const pattern: LoopPattern<Note> = {
    loopDuration: 2,
    notes: [
      { time: 0, degree: 0 },
      { time: 1, degree: 2 },
    ],
  }

  it('renvoie les notes de la fenêtre demandée, dans la première boucle', () => {
    expect(notesInWindow(pattern, 0, 1)).toEqual([{ time: 0, degree: 0 }])
    expect(notesInWindow(pattern, 0.5, 1.5)).toEqual([{ time: 1, degree: 2 }])
  })

  it('traverse la frontière de boucle et recalcule un temps absolu', () => {
    expect(notesInWindow(pattern, 1.5, 2.5)).toEqual([{ time: 2, degree: 0 }])
  })

  it('couvre plusieurs boucles dans une fenêtre large, dans l’ordre', () => {
    const notes = notesInWindow(pattern, 0, 4)
    expect(notes.map((n) => n.time)).toEqual([0, 1, 2, 3])
  })

  it('fenêtre vide ou inversée : aucune note', () => {
    expect(notesInWindow(pattern, 1, 1)).toEqual([])
    expect(notesInWindow(pattern, 2, 1)).toEqual([])
  })

  it('la borne haute est exclusive : une note pile sur `to` n’est pas incluse', () => {
    expect(notesInWindow(pattern, 0, 1).some((n) => n.time === 1)).toBe(false)
    expect(notesInWindow(pattern, 0, 1.0000001).some((n) => n.time === 1)).toBe(true)
  })

  it('ne modifie ni le motif ni ses notes d’origine', () => {
    const before = JSON.stringify(pattern)
    notesInWindow(pattern, 0, 4)
    expect(JSON.stringify(pattern)).toBe(before)
  })

  it('boucle de durée nulle ou négative : toujours vide, jamais de boucle infinie', () => {
    expect(notesInWindow({ loopDuration: 0, notes: [{ time: 0, degree: 0 }] }, 0, 10)).toEqual([])
    expect(notesInWindow({ loopDuration: -1, notes: [{ time: 0, degree: 0 }] }, 0, 10)).toEqual([])
  })
})
