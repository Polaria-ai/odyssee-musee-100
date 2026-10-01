/** Assemblage des écrans et des surimpressions. Propriétaire : intégration. */
import { useEffect } from 'react'
import { isOverlayOpen, useGame } from './state/gameStore'
import { placePlayer, resetInput } from './state/runtime'
import { loadPeople } from './data/repository'
import { buildMuseumLayout } from './world/layout'
import { loadEvening } from './data/evening'
import { buildArchivesLayout, mergeArchivesIntoLayout } from './archives/layout'
import { ArchiveCard } from './archives/ArchiveCard'
import { archivistDialogue } from './archives/archivistScript'
import { Experience } from './scene/Experience'
import { LoadingScreen } from './ui/LoadingScreen'
import { TitleScreen } from './ui/TitleScreen'
import { Hud } from './ui/Hud'
import { PortraitCard } from './ui/PortraitCard'
import { DialogueBox } from './ui/DialogueBox'
import { Toast } from './ui/Toast'
import { StampCard } from './features/stamps/StampCard'
import { useStampWatcher } from './features/stamps/useStampWatcher'
import { useArchivesRefresh } from './archives/useArchivesRefresh'
import { usePresence } from './features/presence/usePresence'
import { TouchJoystick } from './player/TouchJoystick'
import { useKeyboardControls } from './player/useKeyboardControls'
import { RemiChat } from './features/remiChat/RemiChat'
import { useAudioDirector } from './audio'
import { Signature } from './features/signature/Signature'

export function App() {
  const screen = useGame((s) => s.screen)
  const layout = useGame((s) => s.layout)
  const overlay = useGame(isOverlayOpen)

  useEffect(() => {
    let cancelled = false
    // Les 100 et le programme de la soirée arrivent ensemble : le plan n'est calculé qu'une fois
    // (un second calcul relancerait l'effet d'entrée et renverrait le joueur au point d'apparition).
    void Promise.all([loadPeople(), loadEvening()]).then(([{ people, source }, evening]) => {
      if (cancelled) return
      const g = useGame.getState()
      const museum = buildMuseumLayout(people)
      const hall = museum.rooms.find((r) => r.id === 'hall')?.bounds ?? museum.bounds
      // Plan en croix : la salle des Archives s'accroche au sud du hall (porte tokens.archivesDoor).
      const archivesLayout = buildArchivesLayout(evening.sessions, hall)
      g.setEvening(evening.sessions, evening.archives, evening.source)
      g.setArchivesLayout(archivesLayout)
      g.setMuseum(people, mergeArchivesIntoLayout(museum, archivesLayout), source)
      g.setScreen('title')
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Entrée dans le musée : placement au point d'apparition et accueil de Rémi, qui ouvre le chat
  // (message d'accueil déjà affiché, voir `src/features/remiChat/useRemiChat.ts`).
  useEffect(() => {
    if (screen !== 'play' || !layout) return
    placePlayer(layout.spawn.position.x, layout.spawn.position.z, layout.spawn.rotationY)
    resetInput()
    const g = useGame.getState()
    if (Object.keys(g.visited).length === 0) g.openRemiChat()
  }, [screen, layout])

  useEffect(() => {
    if (overlay) resetInput()
  }, [overlay])

  // Première entrée dans les Archives de 2040 (à pied, par la porte sud du hall) : l'Archiviste
  // accueille le visiteur, une seule fois (persisté).
  const currentRoom = useGame((s) => s.currentRoom)
  useEffect(() => {
    if (currentRoom !== 'archives') return
    const g = useGame.getState()
    if (g.markArchivesDiscovered() && !g.dialogue) g.startDialogue(archivistDialogue({ kind: 'firstVisit' }))
  }, [currentRoom])

  const playing = screen === 'play'
  useStampWatcher()
  usePresence(playing)
  useArchivesRefresh(playing)
  useAudioDirector(playing)
  useKeyboardControls(playing && !overlay)

  return (
    <div className="app" data-screen={screen}>
      <Experience />
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'title' && <TitleScreen />}
      {playing && (
        <>
          <Hud />
          {!overlay && <TouchJoystick />}
          <PortraitCard />
          <ArchiveCard />
          <StampCard />
          <DialogueBox />
          <Signature />
          <RemiChat />
        </>
      )}
      <Toast />
    </div>
  )
}
