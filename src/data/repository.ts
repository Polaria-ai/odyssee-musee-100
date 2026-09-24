// STUB — propriétaire : agent données.
import type { DataSource, Person } from '../types'
import { generatePlaceholderPeople } from './placeholder'

/** Charge les 100 : Supabase, puis `/data/people.json`, puis fiches d'attente. Ne rejette jamais. */
export async function loadPeople(): Promise<{ people: Person[]; source: DataSource }> {
  return { people: generatePlaceholderPeople(), source: 'placeholder' }
}
