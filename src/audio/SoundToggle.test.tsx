import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useGame } from '../state/gameStore'
import { setSoundEnabled } from './engine'
import { SoundToggle } from './SoundToggle'

describe('SoundToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    setSoundEnabled(false)
    useGame.setState({ lang: 'fr' })
  })

  afterEach(() => {
    cleanup()
  })

  it('coupé par défaut : aria-pressed=false, icône et libellé « Activer le son »', () => {
    render(<SoundToggle />)
    const button = screen.getByTestId('sound-toggle')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('aria-label', 'Activer le son')
  })

  it('un clic active le son (aria-pressed=true), sans lever d’exception, et le persiste', () => {
    render(<SoundToggle />)
    const button = screen.getByTestId('sound-toggle')
    expect(() => fireEvent.click(button)).not.toThrow()
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('aria-label', 'Couper le son')
    expect(localStorage.getItem('odyssee-musee-100:sound')).toBe('on')
  })

  it('un second clic coupe à nouveau le son', () => {
    render(<SoundToggle />)
    const button = screen.getByTestId('sound-toggle')
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('odyssee-musee-100:sound')).toBe('off')
  })

  it('libellé bilingue : anglais quand la langue du jeu est « en »', () => {
    useGame.setState({ lang: 'en' })
    render(<SoundToggle />)
    expect(screen.getByTestId('sound-toggle')).toHaveAttribute('aria-label', 'Enable sound')
  })
})
