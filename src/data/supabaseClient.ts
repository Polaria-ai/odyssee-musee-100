/**
 * Client Supabase navigateur (clé publishable uniquement — jamais la clé de service).
 * Propriétaire : agent données.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

/**
 * Client navigateur (clé publishable). `null` si non configuré, ou si `VITE_SUPABASE_URL` /
 * `VITE_SUPABASE_ANON_KEY` sont mal renseignées (`createClient` lève alors une erreur synchrone) :
 * dans les deux cas le jeu tourne hors ligne, il ne doit jamais planter au démarrage pour une
 * variable d'environnement mal saisie.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key) {
    client = null
    return client
  }
  try {
    client = createClient(url, key, { auth: { persistSession: false } })
  } catch {
    client = null
  }
  return client
}
