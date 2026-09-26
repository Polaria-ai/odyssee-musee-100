// Propriétaire : agent avatar+tampons.
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Box3 } from 'three'
import type { Group } from 'three'
import { useGame } from '../../state/gameStore'
import { useT } from '../../i18n'
import type { AccessoryId, AvatarConfig, OutfitId } from '../../types'
import { AvatarMesh } from '../../player/AvatarMesh'
import { playSfx } from '../../audio'
import {
  ACCESSORIES,
  HAIR_COLORS,
  OUTFITS,
  OUTFIT_COLORS,
  SKIN_TONES,
  randomAppearance,
  resolveDisplayName,
} from './options'
import {
  clampDragOffset,
  decayVelocity,
  degToRad,
  dragToAngularStep,
  fitVerticalBounds,
  previewSwayAngle,
  wrapAngle,
  PREVIEW_BASE_YAW_DEG,
} from './preview'
import { strings, outfitLabels, accessoryLabels } from './strings'
import './AvatarCustomizer.css'

/** Champ de vision vertical de l'aperçu (doit rester identique entre le Canvas et le cadrage calculé). */
const PREVIEW_FOV = 32
/** Marge autour du personnage dans le cadre carré : de l'air au-dessus de la tête (casquette, béret…). */
const PREVIEW_MARGIN = 1.35
const PREVIEW_BASE_YAW = degToRad(PREVIEW_BASE_YAW_DEG)

/** État de glisser de l'aperçu, muté directement par les gestionnaires pointer (aucun re-render React). */
interface PreviewDrag {
  /** Rotation additionnelle accumulée par le doigt (radians), conservée après un lâcher. */
  offset: number
  /** Vitesse angulaire courante (rad/s), pour l'inertie après un lâcher. */
  velocity: number
  dragging: boolean
  lastX: number
  lastT: number
}

function createPreviewDrag(): PreviewDrag {
  return { offset: 0, velocity: 0, dragging: false, lastX: 0, lastT: 0 }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Cadre la caméra sur le personnage réellement rendu — mesuré via `Box3`, jamais deviné à partir de
 * proportions fixes (celles-ci vivent dans `src/player/AvatarMesh.tsx`, hors contrat de ce module,
 * et varient déjà selon l'accessoire, ex. casquette). Corrige le bug où la tête sortait du cadre :
 * sans caméra explicite, react-three-fiber vise (0,0,0) par défaut, c'est-à-dire les pieds du
 * personnage, pas son centre.
 *
 * Orientation : pose de repos « trois quarts face » (le visage reste lisible, à la différence de
 * l'ancienne rotation continue qui montrait surtout le profil et le dos), balancement doux ± 30°
 * autour de cette pose, et rotation au glisser du doigt avec une légère inertie après un lâcher.
 * Aucune allocation three.js par image : on mute seulement `rotation.y` et les nombres de `drag`.
 */
function RotatingPreview({ config, drag }: { config: AvatarConfig; drag: MutableRefObject<PreviewDrag> }) {
  const groupRef = useRef<Group>(null)
  const { camera } = useThree()
  const elapsed = useRef(0)
  const reducedMotion = useMemo(prefersReducedMotion, [])

  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return
    group.updateMatrixWorld(true)
    const box = new Box3().setFromObject(group)
    if (box.isEmpty()) return
    const { distance, targetY } = fitVerticalBounds({ minY: box.min.y, maxY: box.max.y }, PREVIEW_FOV, PREVIEW_MARGIN)
    camera.position.set(0, targetY, distance)
    camera.lookAt(0, targetY, 0)
    // La rotation du groupe (balancement + glisser) ne change pas son étendue verticale : seuls la
    // tenue et l'accessoire, qui changent la géométrie affichée, doivent redéclencher le cadrage.
  }, [config.outfit, config.accessory, camera])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const d = drag.current
    if (!d.dragging && d.velocity !== 0) {
      // Même borne qu'au glisser (`clampDragOffset`) : l'inertie ne doit pas pouvoir faire ce que
      // le doigt seul ne pourrait pas non plus, à savoir montrer le dos du personnage. Une fois la
      // borne atteinte, on coupe la vitesse plutôt que de la laisser pousser indéfiniment sans effet.
      const proposed = wrapAngle(d.offset + d.velocity * delta)
      const clamped = clampDragOffset(proposed)
      d.velocity = clamped === proposed ? decayVelocity(d.velocity, delta) : 0
      d.offset = clamped
    }
    elapsed.current += delta
    const sway = reducedMotion ? 0 : previewSwayAngle(elapsed.current)
    group.rotation.y = PREVIEW_BASE_YAW + sway + d.offset
  })
  return (
    <group ref={groupRef}>
      <AvatarMesh config={config} moving={false} speed={0} />
    </group>
  )
}

/** Petit Canvas dédié à l'aperçu, séparé du Canvas principal (qui reste figé pendant cet écran). */
function PreviewCanvas({ config, drag }: { config: AvatarConfig; drag: MutableRefObject<PreviewDrag> }) {
  return (
    <Canvas
      className="avatar-customizer__preview-canvas"
      dpr={[1, 1.5]}
      frameloop="always"
      camera={{ fov: PREVIEW_FOV, near: 0.1, far: 10, position: [0, 0.6, 2.7] }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <color attach="background" args={['#10214f']} />
      <hemisphereLight args={['#fff6e0', '#c8a27a', 1.2]} />
      <directionalLight position={[2, 3, 2]} intensity={1} />
      <Suspense fallback={null}>
        <RotatingPreview config={config} drag={drag} />
      </Suspense>
    </Canvas>
  )
}

interface PastilleOption<T extends string> {
  value: T
  label?: string
  swatch?: string
}

/** Groupe de pastilles accessible (pattern `radiogroup`), cibles tactiles ≥ 48 px. */
function PastilleGroup<T extends string>({
  id,
  legend,
  options,
  value,
  onChange,
}: {
  /** Identifiant DOM stable (ASCII, sans espace) — distinct du libellé traduit, qui peut contenir des espaces. */
  id: string
  legend: string
  options: PastilleOption<T>[]
  value: T
  onChange: (next: T) => void
}) {
  const labelId = `pg-${id}`
  return (
    <div className="pastille-group">
      <span className="pastille-group__label" id={labelId}>
        {legend}
      </span>
      <div className="pastille-group__row" role="radiogroup" aria-labelledby={labelId}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={opt.value === value}
            aria-label={opt.label ?? opt.value}
            className={`pastille${opt.swatch ? ' pastille--swatch' : ''}`}
            style={opt.swatch ? { background: opt.swatch } : undefined}
            onClick={() => {
              playSfx('click')
              onChange(opt.value)
            }}
          >
            {!opt.swatch && opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Démarre un glisser : capture le pointeur pour continuer à recevoir les déplacements hors du cadre. */
function handlePreviewPointerDown(drag: MutableRefObject<PreviewDrag>, e: ReactPointerEvent<HTMLDivElement>) {
  const d = drag.current
  d.dragging = true
  d.velocity = 0
  d.lastX = e.clientX
  d.lastT = e.timeStamp
  e.currentTarget.setPointerCapture(e.pointerId)
}

/**
 * Accumule la rotation pendant le glisser ; ne fait aucun `setState` (pas de re-render par pixel).
 * `clampDragOffset` borne le résultat : un glisser franc (la largeur de l'aperçu suffit) ne doit
 * jamais faire tourner le personnage jusqu'à son dos (voir `PREVIEW_MAX_DRAG_OFFSET_DEG`).
 */
function handlePreviewPointerMove(drag: MutableRefObject<PreviewDrag>, e: ReactPointerEvent<HTMLDivElement>) {
  const d = drag.current
  if (!d.dragging) return
  const deltaX = e.clientX - d.lastX
  const deltaT = e.timeStamp - d.lastT
  const { offsetDelta, velocity } = dragToAngularStep(deltaX, deltaT)
  d.offset = clampDragOffset(wrapAngle(d.offset + offsetDelta))
  d.velocity = velocity
  d.lastX = e.clientX
  d.lastT = e.timeStamp
}

/** Fin de glisser (relâché ou annulé) : la vitesse retenue alimente l'inertie dans `useFrame`. */
function handlePreviewPointerEnd(drag: MutableRefObject<PreviewDrag>, e: ReactPointerEvent<HTMLDivElement>) {
  const d = drag.current
  d.dragging = false
  if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
}

/** Écran « Qui es-tu ? » avant d'entrer dans le musée. */
export function AvatarCustomizer() {
  const t = useT(strings)
  const tOutfit = useT(outfitLabels)
  const tAccessory = useT(accessoryLabels)
  const lang = useGame((s) => s.lang)
  const visitorId = useGame((s) => s.visitorId)
  const storedAvatar = useGame((s) => s.avatar)
  const setAvatar = useGame((s) => s.setAvatar)
  const setScreen = useGame((s) => s.setScreen)

  const [draft, setDraft] = useState<AvatarConfig>(() => ({ ...storedAvatar }))
  const [nameDraft, setNameDraft] = useState(storedAvatar.name)
  const dragRef = useRef<PreviewDrag>(createPreviewDrag())

  function handleDone() {
    playSfx('click')
    const finalAvatar: AvatarConfig = { ...draft, name: resolveDisplayName(nameDraft, visitorId, lang) }
    setAvatar(finalAvatar)
    setScreen('play')
  }

  function handleRandom() {
    playSfx('click')
    setDraft((prev) => ({ ...prev, ...randomAppearance() }))
  }

  return (
    <div className="screen avatar-customizer-screen" data-testid="customizer">
      <div className="avatar-customizer">
        <div className="avatar-customizer__preview-col">
          <h1 className="avatar-customizer__title">{t('title')}</h1>
          <div
            className="avatar-customizer__preview"
            onPointerDown={(e) => handlePreviewPointerDown(dragRef, e)}
            onPointerMove={(e) => handlePreviewPointerMove(dragRef, e)}
            onPointerUp={(e) => handlePreviewPointerEnd(dragRef, e)}
            onPointerCancel={(e) => handlePreviewPointerEnd(dragRef, e)}
          >
            <PreviewCanvas config={draft} drag={dragRef} />
          </div>
          <input
            type="text"
            className="avatar-customizer__name"
            data-testid="avatar-name"
            maxLength={16}
            placeholder={t('namePlaceholder')}
            aria-label={t('nameLabel')}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
          />
        </div>

        {/*
          Panneau options + actions : colonne flex propre, avec l'action « C'est parti ! » ancrée en
          bas (pas dans le flux défilant) pour rester visible sans défiler, même sur un petit écran
          (iPhone 13 portrait) — seules les pastilles d'options défilent, au-dessus.
        */}
        <div className="avatar-customizer__panel">
          <div className="avatar-customizer__options-col">
            <PastilleGroup
              id="skin-tone"
              legend={t('skinToneLabel')}
              value={draft.skinTone}
              onChange={(skinTone) => setDraft((d) => ({ ...d, skinTone }))}
              options={SKIN_TONES.map((c, i) => ({ value: c, swatch: c, label: `${t('skinToneLabel')} ${i + 1}` }))}
            />
            <PastilleGroup
              id="hair-color"
              legend={t('hairColorLabel')}
              value={draft.hairColor}
              onChange={(hairColor) => setDraft((d) => ({ ...d, hairColor }))}
              options={HAIR_COLORS.map((c, i) => ({ value: c, swatch: c, label: `${t('hairColorLabel')} ${i + 1}` }))}
            />
            <PastilleGroup<OutfitId>
              id="outfit"
              legend={t('outfitLabel')}
              value={draft.outfit}
              onChange={(outfit) => setDraft((d) => ({ ...d, outfit }))}
              options={OUTFITS.map((o) => ({ value: o, label: tOutfit(o) }))}
            />
            <PastilleGroup
              id="outfit-color"
              legend={t('outfitColorLabel')}
              value={draft.outfitColor}
              onChange={(outfitColor) => setDraft((d) => ({ ...d, outfitColor }))}
              options={OUTFIT_COLORS.map((c, i) => ({ value: c, swatch: c, label: `${t('outfitColorLabel')} ${i + 1}` }))}
            />
            <PastilleGroup<AccessoryId>
              id="accessory"
              legend={t('accessoryLabel')}
              value={draft.accessory}
              onChange={(accessory) => setDraft((d) => ({ ...d, accessory }))}
              options={ACCESSORIES.map((a) => ({ value: a, label: tAccessory(a) }))}
            />
          </div>

          <div className="avatar-customizer__actions">
            <button type="button" className="btn-pill btn-pill--secondary" onClick={handleRandom}>
              {t('random')}
            </button>
            <button type="button" className="btn-pill btn-pill--primary" data-testid="customizer-done" onClick={handleDone}>
              {t('done')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
