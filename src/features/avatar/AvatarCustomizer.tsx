// Propriétaire : agent avatar+tampons.
import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useGame } from '../../state/gameStore'
import { useT } from '../../i18n'
import type { AccessoryId, AvatarConfig, OutfitId } from '../../types'
import { AvatarMesh } from '../../player/AvatarMesh'
import {
  ACCESSORIES,
  HAIR_COLORS,
  OUTFITS,
  OUTFIT_COLORS,
  SKIN_TONES,
  randomAppearance,
  resolveDisplayName,
} from './options'
import { strings, outfitLabels, accessoryLabels } from './strings'
import './AvatarCustomizer.css'

/** Fait tourner lentement l'aperçu (aucune allocation par image : on mute `rotation.y`). */
function RotatingPreview({ config }: { config: AvatarConfig }) {
  const groupRef = useRef<Group>(null)
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.6
  })
  return (
    <group ref={groupRef}>
      <AvatarMesh config={config} moving={false} speed={0} />
    </group>
  )
}

/** Petit Canvas dédié à l'aperçu, séparé du Canvas principal (qui reste figé pendant cet écran). */
function PreviewCanvas({ config }: { config: AvatarConfig }) {
  return (
    <Canvas
      className="avatar-customizer__preview-canvas"
      dpr={[1, 1.5]}
      frameloop="always"
      camera={{ fov: 32, near: 0.1, far: 10, position: [0, 1.05, 2.5] }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <color attach="background" args={['#fdf1d6']} />
      <hemisphereLight args={['#fff6e0', '#c8a27a', 1.2]} />
      <directionalLight position={[2, 3, 2]} intensity={1} />
      <Suspense fallback={null}>
        <RotatingPreview config={config} />
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
            onClick={() => onChange(opt.value)}
          >
            {!opt.swatch && opt.label}
          </button>
        ))}
      </div>
    </div>
  )
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

  function handleDone() {
    const finalAvatar: AvatarConfig = { ...draft, name: resolveDisplayName(nameDraft, visitorId, lang) }
    setAvatar(finalAvatar)
    setScreen('play')
  }

  function handleRandom() {
    setDraft((prev) => ({ ...prev, ...randomAppearance() }))
  }

  return (
    <div className="screen avatar-customizer-screen" data-testid="customizer">
      <div className="avatar-customizer">
        <div className="avatar-customizer__preview-col">
          <h1 className="avatar-customizer__title">{t('title')}</h1>
          <div className="avatar-customizer__preview">
            <PreviewCanvas config={draft} />
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

        <div className="avatar-customizer__options-col">
          <div className="avatar-customizer__options">
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
