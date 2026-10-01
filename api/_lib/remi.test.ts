// @vitest-environment node
import { readdirSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as remi from '../remi.js'
import { OPENROUTER_TITLE, UPSTREAM_TIMEOUT_MS } from './config.js'
import { jsonRequest, validPayload } from './test-utils.js'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('api/remi.ts', () => {
  it('exporte un gestionnaire POST au standard Web', () => {
    expect(typeof remi.POST).toBe('function')
    expect(remi.POST.length).toBe(1)
  })

  it('refuse proprement les autres méthodes : 405 + Allow: POST + corps JSON', async () => {
    for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const) {
      const response = remi[method]()
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow'), method).toBe('POST')
      expect(await response.json(), method).toEqual({ type: 'error', code: 'bad_request' })
    }
  })

  it('n’expose qu’une seule route : api/remi.ts (Vercel déploie tout autre fichier de api/ hors chemins _ et .)', () => {
    const entries = readdirSync(new URL('../', import.meta.url), { withFileTypes: true })
    const routes = entries.filter((entry) => !entry.name.startsWith('_') && !entry.name.startsWith('.'))
    expect(routes.map((entry) => entry.name)).toEqual(['remi.ts'])
  })

  it('accorde 20 s à OpenRouter et envoie un titre d’application en ASCII', () => {
    expect(UPSTREAM_TIMEOUT_MS).toBe(20_000)
    expect(OPENROUTER_TITLE).toMatch(/^[\x20-\x7e]+$/)
  })

  it('plafonne la durée de la fonction sous le défaut de la plateforme et au-dessus du délai accordé à OpenRouter', () => {
    expect(remi.config).toEqual({ runtime: 'nodejs', maxDuration: 30 })
  })

  it('sans clé dans l’environnement : répond unavailable sans appeler le réseau', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const response = await remi.POST(jsonRequest(validPayload()))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ type: 'error', code: 'unavailable' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({ evt: 'remi', outcome: 'no_key' })
  })

  it('avec REMI_CHAT_DISABLED=1 : répond unavailable même si une clé est présente', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'cle-de-test-sans-valeur')
    vi.stubEnv('REMI_CHAT_DISABLED', '1')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const response = await remi.POST(jsonRequest(validPayload()))
    expect(response.status).toBe(503)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
