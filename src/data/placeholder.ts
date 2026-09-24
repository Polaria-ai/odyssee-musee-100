// STUB — propriétaire : agent données.
import type { ExhibitWingId, Person } from '../types'
import { EXHIBIT_WINGS } from '../types'

/** 100 fiches d'attente fictives, clairement marquées, en attendant la vraie liste. */
export function generatePlaceholderPeople(count = 100): Person[] {
  return Array.from({ length: count }, (_, i) => {
    const wing: ExhibitWingId = EXHIBIT_WINGS[i % 3]
    const n = i + 1
    return {
      id: `portrait-${String(n).padStart(3, '0')}`,
      order: n,
      name: `Portrait n°${n}`,
      role: { fr: 'Portrait à venir', en: 'Portrait coming soon' },
      organization: '—',
      country: 'EU',
      wing,
      bio: { fr: 'Cette fiche attend la liste officielle.', en: 'This card is waiting for the official list.' },
      story: { fr: '', en: '' },
      photoUrl: null,
      placeholder: true,
    }
  })
}
