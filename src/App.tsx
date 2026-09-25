/** Assemblage des écrans et des surimpressions. Propriétaire : intégration. */
import { useEffect } from 'react'
import { isOverlayOpen, useGame } from './state/gameStore'
import { placePlayer, resetInput } from './state/runtime'
import { loadPeople } from './data/repository'
import { buildMuseumLayout } from './world/layout'
import { loadEvening } from './data/evening'
import { buildArchivesLayout, mergeArchivesIntoLayout } from './archives/layout'
import { ArchiveCard } from './archives/ArchiveCard'
import { PortalFade } from './archives/PortalFade'
import { Experience } from './scene/Experience'
import { LoadingScreen } from './ui/LoadingScreen'
import { TitleScreen } from './ui/TitleScreen'
import { Hud } from './ui/Hud'
import { PortraitCard } from './ui/PortraitCard'
import { DialogueBox } from './ui/DialogueBox'
import { Toast } from './ui/Toast'
import { AvatarCustomizer } from './features/avatar/AvatarCustomizer'
import { StampCard } from './features/stamps/StampCard'
import { useStampWatcher } from './features/stamps/useStampWatcher'
import { usePresence } from './features/presence/usePresence'
import { TouchJoystick } from './player/TouchJoystick'
import { useKeyboardControls } from './player/useKeyboardControls'
import { minerveDialogue } from './npc/minerveScript'
import { useAudioDirector } from './audio'

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
      const archivesLayout = buildArchivesLayout(evening.sessions)
      g.setEvening(evening.sessions, evening.archives, evening.source)
      g.setArchivesLayout(archivesLayout)
      g.setMuseum(people, mergeArchivesIntoLayout(buildMuseumLayout(people), archivesLayout), source)
      g.setScreen('title')
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Entrée dans le musée : placement au point d'apparition et accueil de Minerve.
  useEffect(() => {
    if (screen !== 'play' || !layout) return
    placePlayer(layout.spawn.position.x, layout.spawn.position.z, layout.spawn.rotationY)
    resetInput()
    const g = useGame.getState()
    if (Object.keys(g.visited).length === 0) g.startDialogue(minerveDialogue({ kind: 'welcome' }))
  }, [screen, layout])

  useEffect(() => {
    if (overlay) resetInput()
  }, [overlay])

  const playing = screen === 'play'
  useStampWatcher()
  usePresence(playing)
  useAudioDirector(playing)
  useKeyboardControls(playing && !overlay)

  return (
    <div className="app" data-screen={screen}>
      <Experience />
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'title' && <TitleScreen />}
      {screen === 'customize' && <AvatarCustomizer />}
      {playing && (
        <>
          <Hud />
          {!overlay && <TouchJoystick />}
          <PortraitCard />
          <ArchiveCard />
          <StampCard />
          <DialogueBox />
        </>
      )}
      <PortalFade />
      <Toast />
    </div>
  )
}
