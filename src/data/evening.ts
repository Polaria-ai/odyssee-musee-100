// STUB — propriétaire : workflow « Archives de 2040 ».
import type { EveningSession, EveningSource, SessionArchive } from '../types'

/** Charge le programme et les archives publiées : Supabase → /data/evening.json → programme embarqué. Ne rejette jamais. */
export async function loadEvening(): Promise<{
  sessions: EveningSession[]
  archives: Record<string, SessionArchive>
  source: EveningSource
}> {
  return { sessions: [], archives: {}, source: 'program' }
}
