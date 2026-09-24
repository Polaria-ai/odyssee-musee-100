// STUB — propriétaire : agent joueur.
import type { MuseumLayout } from '../types'
import { AvatarMesh } from './AvatarMesh'
import { useGame } from '../state/gameStore'

/** Joueur : déplacement, collisions, caméra 3e personne, détection du portrait proche. */
export function Player(_props: { layout: MuseumLayout }) {
  const avatar = useGame((s) => s.avatar)
  return <AvatarMesh config={avatar} />
}
