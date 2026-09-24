// STUB — propriétaire : agent données.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

/** Client navigateur (clé publishable). `null` si non configuré : le jeu tourne hors ligne. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
  return client
}
