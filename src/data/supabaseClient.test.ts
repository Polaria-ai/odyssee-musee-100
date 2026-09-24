import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))

describe('getSupabase', () => {
  beforeEach(() => {
    vi.resetModules()
    createClientMock.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('renvoie null sans appeler createClient si les variables d’environnement sont absentes', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', undefined)
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', undefined)
    const { getSupabase } = await import('./supabaseClient')
    expect(getSupabase()).toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('renvoie le client construit quand les variables sont valides', async () => {
    const fakeClient = { from: vi.fn() }
    createClientMock.mockReturnValue(fakeClient)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    const { getSupabase } = await import('./supabaseClient')
    expect(getSupabase()).toBe(fakeClient)
  })

  it('renvoie null (et ne lève pas) si createClient lève, par ex. une URL mal renseignée', async () => {
    createClientMock.mockImplementation(() => {
      throw new Error('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.')
    })
    vi.stubEnv('VITE_SUPABASE_URL', 'pas-une-url')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    const { getSupabase } = await import('./supabaseClient')
    expect(() => getSupabase()).not.toThrow()
    expect(getSupabase()).toBeNull()
  })

  it('mémorise le résultat (createClient appelé une seule fois par module chargé)', async () => {
    const fakeClient = { from: vi.fn() }
    createClientMock.mockReturnValue(fakeClient)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    const { getSupabase } = await import('./supabaseClient')
    getSupabase()
    getSupabase()
    expect(createClientMock).toHaveBeenCalledTimes(1)
  })
})
