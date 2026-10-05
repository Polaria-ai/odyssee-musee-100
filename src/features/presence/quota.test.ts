import { describe, expect, it } from 'vitest'
import { classifyQuota, errorTexts, quotaFromSystemPayload } from './quota'

describe('classifyQuota — libellés du serveur et du SDK', () => {
  const quotas: Array<[string, string]> = [
    ['too_many_connections', 'too_many_connections'],
    ['Too many connected users', 'too_many_connections'],
    ['ConnectionRateLimitReached: Too many connected users', 'too_many_connections'],
    ['too_many_channels', 'too_many_channels'],
    ['ChannelRateLimitReached: Too many channels', 'too_many_channels'],
    ['too_many_joins', 'too_many_joins'],
    ['ClientJoinRateLimitReached: Too many joins per second', 'too_many_joins'],
    ['Too many messages per second', 'too_many_messages'],
    ['too many messages per second', 'too_many_messages'],
    ['Too many presence messages per second', 'presence_limit'],
    ['ClientPresenceRateLimitReached', 'presence_limit'],
    ['Client presence rate limit exceeded', 'presence_limit'],
    ['DatabaseConnectionRateLimitReached: Too many database connections attempts per second', 'rate_limit'],
    ['rate limit exceeded', 'rate_limit'],
    ['rate_limit_exceeded', 'rate_limit'],
    ['quota exceeded', 'rate_limit'],
    ['HTTP 429', 'http_429'],
    ['Too Many Requests', 'http_429'],
  ]
  it.each(quotas)('« %s » est un quota (%s)', (text, kind) => {
    expect(classifyQuota(text)).toBe(kind)
  })

  const ordinary = [
    'socket closed: 1006',
    'socket closed: 1006 (abnormal)',
    'channel error: transport failure',
    'channel error: connection lost',
    'TIMED_OUT',
    'CHANNEL_ERROR',
    'CLOSED',
    'track error',
    'track timed out',
    'unsubscribe sans réponse',
    'Subscribed to PostgreSQL',
    'mismatch between server and client bindings for postgres changes',
    'db_unavailable',
    'boom',
    'client cassé',
    'HTTP 1429 ou 4290', // un nombre qui contient 429 n'est pas un 429
    '',
  ]
  it.each(ordinary)('« %s » reste une erreur ordinaire', (text) => {
    expect(classifyQuota(text)).toBeNull()
  })

  it('examine plusieurs textes dans l’ordre et ignore ce qui n’est pas une chaîne', () => {
    expect(classifyQuota(undefined, null, 42, '', 'CHANNEL_ERROR', 'Too many joins per second')).toBe('too_many_joins')
    expect(classifyQuota()).toBeNull()
  })
})

describe('errorTexts', () => {
  it('rend le message d’une Error et la raison portée par sa cause (réponse brute du serveur)', () => {
    const err = new Error('Too many connected users', { cause: { reason: 'Too many connected users' } })
    expect(errorTexts(err)).toEqual(['Too many connected users', 'Too many connected users'])
    expect(classifyQuota(...errorTexts(new Error('error', { cause: { reason: 'ClientJoinRateLimitReached' } })))).toBe('too_many_joins')
  })

  it('accepte une chaîne, rien, ou un objet sans texte', () => {
    expect(errorTexts('boom')).toEqual(['boom'])
    expect(errorTexts(undefined)).toEqual([])
    expect(errorTexts(null)).toEqual([])
    expect(errorTexts({ code: 1006 })).toEqual([])
  })
})

describe('quotaFromSystemPayload — message système du serveur', () => {
  it('un message d’erreur qui désigne un quota en est un', () => {
    expect(quotaFromSystemPayload({ extension: 'system', status: 'error', message: 'Too many messages per second', channel: 'x' })).toEqual({
      kind: 'too_many_messages',
      message: 'Too many messages per second',
    })
    expect(quotaFromSystemPayload({ status: 'error', message: 'Too many presence messages per second' })?.kind).toBe('presence_limit')
  })

  it('un message de succès ou une erreur ordinaire n’en est pas un', () => {
    expect(quotaFromSystemPayload({ extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL' })).toBeNull()
    expect(quotaFromSystemPayload({ status: 'ok', message: 'Too many messages per second' })).toBeNull() // jamais sans status error
    expect(quotaFromSystemPayload({ status: 'error', message: 'Unable to subscribe to changes with given parameters' })).toBeNull()
  })

  it('tolère une charge utile illisible', () => {
    expect(quotaFromSystemPayload(null)).toBeNull()
    expect(quotaFromSystemPayload('error')).toBeNull()
    expect(quotaFromSystemPayload({ status: 'error' })).toBeNull()
  })
})
