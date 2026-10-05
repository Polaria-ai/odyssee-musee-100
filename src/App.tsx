/** Assemblage des écrans et des surimpressions. Propriétaire : intégration. */
import { Suspense, lazy, useEffect, useState } from 'react'
import { isOverlayOpen, useGame } from './state/gameStore'
import { placePlayer, resetInput } from './state/runtime'
import { loadPeople } from './data/repository'
import { buildMuseumLayout } from './world/layout'
import { loadEvening } from './data/evening'
import { buildArchivesLayout, mergeArchivesIntoLayout } from './archives/layout'
import { ArchiveCard } from './archives/ArchiveCard'
import { archivistDialogue } from './archives/archivistScript'
import { remiDialogue } from './npc/remiScript'
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
import { useAudioDirector } from './audio'
import { Signature } from './features/signature/Signature'

// Les chats IA (Rémi · IA et l'Archiviste · IA, et, derrière eux, le buste 3D) sortent du paquet d'entrée : ils sont
// chargés à la première ouverture, puis restent montés pour garder chaque conversation jusqu'à la fin de la session.
// Ils ne s'ouvrent qu'au comptoir (« Parler à Rémi ») ou au socle de l'Archiviste (« Parler à l'Archiviste ») : leur code
// est donc préchargé dès que le joueur s'approche de l'un ou de l'autre, pour que le geste du visiteur ne tombe pas sur
// un écran vide le temps du téléchargement.
const loadAiChats = () => import('./features/remiChat/RemiChat').then((m) => ({ default: m.AiChats }))
const loadRemiBust = () => import('./features/remiChat/bust/BustCanvas')
const AiChats = lazy(loadAiChats)

function RemiChatSlot() {
  const open = useGame((s) => s.remiChatOpen)
  const nearCurator = useGame((s) => s.nearCurator)
  const nearArchivist = useGame((s) => s.nearArchivist)
  const [opened, setOpened] = useState(false)
  const near = nearCurator || nearArchivist
  useEffect(() => {
    if (!near) return
    void loadAiChats()
    void loadRemiBust()
  }, [near])
  if (open && !opened) setOpened(true)
  if (!open && !opened) return null
  return (
    <Suspense fallback={null}>
      <AiChats />
    </Suspense>
  )
}

export function App() {
  const screen = useGame((s) => s.screen)
  const layout = useGame((s) => s.layout)
  const overlay = useGame(isOverlayOpen)
  const remiChatOpen = useGame((s) => s.remiChatOpen)

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

  // Entrée dans le musée : placement au point d'apparition et accueil de Rémi, dans la bulle scriptée en bas de
  // l'écran. Le visiteur arrive directement dans le jeu, le musée sous les yeux ; le chat avec Rémi · IA ne
  // s'ouvre qu'au comptoir (« Parler à Rémi »).
  useEffect(() => {
    if (screen !== 'play' || !layout) return
    placePlayer(layout.spawn.position.x, layout.spawn.position.z, layout.spawn.rotationY)
    resetInput()
    const g = useGame.getState()
    if (Object.keys(g.visited).length === 0) g.startDialogue(remiDialogue({ kind: 'welcome' }))
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
    // `data-remi-chat` : le chat est translucide (on voit le musée à travers), le HUD du jeu est donc masqué en CSS
    // pendant qu'il est ouvert (voir `src/features/remiChat/remiChat.css`).
    <div className="app" data-screen={screen} data-remi-chat={remiChatOpen || undefined}>
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
          <RemiChatSlot />
        </>
      )}
      <Toast />
    </div>
  )
}
