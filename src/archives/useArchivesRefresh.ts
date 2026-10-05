/**
 * Rafraîchit les archives publiées pendant la visite. Le programme et les archives ne sont chargés
 * qu'une fois, au démarrage (`App.tsx`) ; or le QR code du jeu est projeté au final de la soirée et
 * les archives sont publiées plus tard, après relecture. Sans ce rafraîchissement, un visiteur entré
 * avant la publication ne les voyait qu'en rechargeant la page (répétition du 27/09, WEL-907).
 *
 * Sobre pour Supabase : on ne relit que dans la salle des Archives (à l'entrée, puis toutes les
 * `ARCHIVES_REFRESH_MS`), et seulement onglet visible. Une réponse en échec ne change rien.
 */
import { useEffect } from 'react'
import type { SessionArchive } from '../types'
import { useGame } from '../state/gameStore'
import { loadPublishedArchives } from '../data/evening'
import { cardStrings } from './cardStrings'

export const ARCHIVES_REFRESH_MS = 60_000

/** Vrai si deux jeux d'archives sont identiques (mêmes séquences, mêmes contenus). Fonction pure. */
export function sameArchives(a: Record<string, SessionArchive>, b: Record<string, SessionArchive>): boolean {
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false
  return ka.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]))
}

function pageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

export function useArchivesRefresh(active: boolean): void {
  const inArchives = useGame((s) => s.currentRoom === 'archives')

  useEffect(() => {
    if (!active || !inArchives) return
    let cancelled = false

    const refresh = async () => {
      if (!pageVisible()) return
      const next = await loadPublishedArchives()
      if (cancelled || !next) return
      const g = useGame.getState()
      if (sameArchives(g.archives, next)) return
      const added = Object.keys(next).some((id) => !g.archives[id])
      g.setArchives(next)
      if (added) g.showToast(cardStrings.archivesNewToast)
    }

    void refresh()
    const id = setInterval(() => void refresh(), ARCHIVES_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [active, inArchives])
}
