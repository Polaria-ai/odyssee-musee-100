/**
 * Faux serveur Realtime (protocole Phoenix vsn 2.0.0) pour exécuter le VRAI SDK Supabase
 * (`@supabase/supabase-js` / `realtime-js` 2.117.1 / `@supabase/phoenix` 0.4.5) sans réseau.
 *
 * Pourquoi : `usePresence.test.ts` injecte un `FakeClient` qui renvoie un canal neuf à chaque appel, ce qui
 * avait caché les bugs du 30/09 (le SDK renvoie l'instance EXISTANTE pour un même topic, `on('presence')`
 * lève sur un canal « joining », phoenix rejoint seul un canal « errored », `send()` bascule en REST quand
 * le canal est fermé...). Ici c'est le SDK réel qui tourne ; seul le réseau est simulé.
 *
 * Ce que le serveur fait, comme le vrai :
 *  - `phx_join` : réponse `ok` (`postgres_changes: []`), puis `presence_state` si le client écoute la présence ;
 *  - `presence` (track / untrack) : `phx_ref` par méta, `presence_diff` à tous les membres (soi compris) ;
 *  - `broadcast` (trame BINAIRE kind 3 envoyée par le SDK) : relayé aux AUTRES abonnés en trame binaire kind 4
 *    (`self: false`), sans réponse sauf `broadcast.ack` ;
 *  - `phx_leave` : retrait du membre (diff de départ aux autres) et réponse `ok` ;
 *  - `heartbeat` ;
 *  - départ d'une WebSocket (fermeture ou coupure) : retrait de tous ses membres.
 *
 * Et on peut le scripter : refuser / ne pas répondre aux N prochains joins d'un topic, refuser les connexions
 * WebSocket, couper les sockets, envoyer un message `system` d'erreur puis `phx_close` sur un canal, etc.
 *
 * Quotas du plan gratuit (supabase/realtime, `realtime_channel.ex`), simulables par les options du constructeur :
 *  - `maxConnections` : au-delà de N utilisateurs connectés (sockets ouvertes qui ont déjà joint un canal, comptées jusqu'à
 *    leur fermeture, même sans canal), le `phx_join` d'une NOUVELLE socket est refusé (`phx_reply` en `error`, raison
 *    « Too many connected users », `too_many_connections`) ; une socket déjà comptée garde le droit de changer de canal ;
 *  - `maxJoinsPerSecond` : au-delà de N `phx_join` dans la dernière seconde, le join est refusé
 *    (« ClientJoinRateLimitReached: Too many joins per second », `too_many_joins`).
 *
 * Il ne dépend d'aucun timer tant que `latencyMs` vaut 0 (livraison par micro-tâche) : les tests à horloge
 * simulée (`vi.useFakeTimers`) avancent sans qu'il faille « pousser » le réseau.
 *
 * Fichier de test uniquement : aucune importation depuis le code du jeu, aucun import de node:*.
 */
import type { SupabaseClientOptions } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------------------------
// Types publics

/** Trame client -> serveur, décodée (JSON ou binaire). */
export interface ServerFrame {
  /** Horloge (Date.now(), donc simulée sous fake timers). */
  t: number
  connId: number
  label: string
  joinRef: string | null
  ref: string | null
  topic: string
  event: string
  payload: unknown
  /** Vrai pour un broadcast utilisateur (trame binaire kind 3). */
  binary: boolean
}

export interface RestBroadcastCall {
  t: number
  label: string
  method: string
  url: string
  pathname: string
  body: string | null
}

export interface MemberInfo {
  connId: number
  label: string
  topic: string
  key: string
  joinRef: string
  /** Charge utile du dernier `track`, `null` si pas (ou plus) tracké. */
  tracked: Record<string, unknown> | null
  presence: boolean
}

export interface FakeWebSocket {
  readonly CONNECTING: number
  readonly OPEN: number
  readonly CLOSING: number
  readonly CLOSED: number
  readonly readyState: number
  readonly url: string
  readonly protocol: string
  binaryType: string
  bufferedAmount: number
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev: { code: number; reason: string; wasClean: boolean }) => void) | null
  onerror: ((ev: unknown) => void) | null
  send(data: unknown): void
  close(code?: number, reason?: string): void
  addEventListener(type: string, listener: (ev: never) => void): void
  removeEventListener(type: string, listener: (ev: never) => void): void
}

export type FakeWebSocketConstructor = new (url: string, protocols?: string | string[]) => FakeWebSocket

/** Sélecteur de connexions : un libellé de client, ou un prédicat. `undefined` = toutes. */
export type ConnSelector = string | ((conn: ConnInfo) => boolean) | undefined

export interface ConnInfo {
  id: number
  label: string
  url: string
  readyState: number
}

export type JoinBehavior = 'ok' | 'silence' | { error: string } | { delayMs: number }

export interface FakeRealtimeServerOptions {
  /** Latence aller et retour simulée (ms). 0 (défaut) = micro-tâche, sans timer. */
  latencyMs?: number
  /** Statut HTTP renvoyé par le faux `fetch` pour `POST /realtime/v1/api/broadcast` (défaut 202). */
  restBroadcastStatus?: number
  /** Utilisateurs connectés simultanés au plus (plan gratuit : 200). Défaut : illimité. */
  maxConnections?: number
  /** Jointures par seconde au plus (plan gratuit : 100). Défaut : illimité. */
  maxJoinsPerSecond?: number
}

/** Libellés exacts du serveur Realtime pour les refus de jointure (voir `quota.ts`). */
export const SERVER_REASON_TOO_MANY_CONNECTIONS = 'Too many connected users'
export const SERVER_REASON_TOO_MANY_JOINS = 'ClientJoinRateLimitReached: Too many joins per second'
export const SERVER_MESSAGE_TOO_MANY_MESSAGES = 'Too many messages per second'
export const SERVER_MESSAGE_TOO_MANY_PRESENCE = 'Too many presence messages per second'

// ---------------------------------------------------------------------------------------------
// Utilitaires

const READY = { connecting: 0, open: 1, closing: 2, closed: 3 } as const
const TOPIC_PREFIX = 'realtime:'

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

/** Accepte `musee:v1:room-1` ou `realtime:musee:v1:room-1`. */
function fullTopic(topic: string): string {
  return topic.startsWith(TOPIC_PREFIX) ? topic : TOPIC_PREFIX + topic
}

type TopicMatcher = string | RegExp | ((fullTopic: string) => boolean)

function matchesTopic(m: TopicMatcher, topic: string): boolean {
  if (typeof m === 'string') return m === '*' || fullTopic(m) === topic
  if (m instanceof RegExp) return m.test(topic) || m.test(topic.slice(TOPIC_PREFIX.length))
  return m(topic)
}

function later(ms: number, fn: () => void): void {
  // Référence résolue à l'appel : sous `vi.useFakeTimers()`, c'est le setTimeout simulé.
  if (ms > 0) globalThis.setTimeout(fn, ms)
  else queueMicrotask(fn)
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function isArrayBufferLike(v: unknown): v is ArrayBuffer {
  return v instanceof ArrayBuffer || (!!v && (v as { constructor?: { name?: string } }).constructor?.name === 'ArrayBuffer')
}

/** Décode une trame binaire « user broadcast push » (kind 3) envoyée par le SDK. */
function decodeBinaryPush(buffer: ArrayBuffer): { joinRef: string | null; ref: string | null; topic: string; userEvent: string; payload: unknown } | null {
  const view = new DataView(buffer)
  if (view.getUint8(0) !== 3) return null
  const joinRefSize = view.getUint8(1)
  const refSize = view.getUint8(2)
  const topicSize = view.getUint8(3)
  const userEventSize = view.getUint8(4)
  const metadataSize = view.getUint8(5)
  const encoding = view.getUint8(6)
  const dec = new TextDecoder()
  let offset = 7
  const take = (n: number): string => {
    const s = dec.decode(buffer.slice(offset, offset + n))
    offset += n
    return s
  }
  const joinRef = take(joinRefSize)
  const ref = take(refSize)
  const topic = take(topicSize)
  const userEvent = take(userEventSize)
  take(metadataSize)
  const body = buffer.slice(offset)
  const payload = encoding === 1 ? JSON.parse(dec.decode(body)) : body
  return { joinRef: joinRef || null, ref: ref || null, topic, userEvent, payload }
}

/** Encode une trame binaire « user broadcast » (kind 4) telle que le vrai serveur la relaie. */
function encodeBinaryBroadcast(topic: string, userEvent: string, payload: unknown): ArrayBuffer {
  const enc = new TextEncoder()
  const t = enc.encode(topic)
  const e = enc.encode(userEvent)
  const p = enc.encode(JSON.stringify(payload ?? {}))
  const out = new Uint8Array(5 + t.length + e.length + p.length)
  out[0] = 4
  out[1] = t.length
  out[2] = e.length
  out[3] = 0
  out[4] = 1
  out.set(t, 5)
  out.set(e, 5 + t.length)
  out.set(p, 5 + t.length + e.length)
  return toArrayBuffer(out)
}

// ---------------------------------------------------------------------------------------------
// Serveur

interface Meta {
  phx_ref: string
  [k: string]: unknown
}

interface Member {
  conn: Conn
  topic: string
  joinRef: string
  key: string
  presence: boolean
  ack: boolean
  self: boolean
  meta: Meta | null
}

interface Conn extends ConnInfo {
  ws: FakeSocketImpl
  members: Map<string, Member>
  /** Vrai dès le premier canal joint, jusqu'à la fermeture de la socket (comme le compteur d'utilisateurs du serveur). */
  counted: boolean
}

interface JoinRule {
  topic: TopicMatcher
  sel: ConnSelector
  behavior: JoinBehavior
  remaining: number
}

interface ConnectRule {
  sel: ConnSelector
  remaining: number
}

class FakeSocketImpl implements FakeWebSocket {
  static readonly CONNECTING = READY.connecting
  static readonly OPEN = READY.open
  static readonly CLOSING = READY.closing
  static readonly CLOSED = READY.closed
  readonly CONNECTING = READY.connecting
  readonly OPEN = READY.open
  readonly CLOSING = READY.closing
  readonly CLOSED = READY.closed
  readyState: number = READY.connecting
  readonly protocol = ''
  binaryType = 'blob'
  bufferedAmount = 0
  onopen: FakeWebSocket['onopen'] = null
  onmessage: FakeWebSocket['onmessage'] = null
  onclose: FakeWebSocket['onclose'] = null
  onerror: FakeWebSocket['onerror'] = null
  private listeners = new Map<string, Set<(ev: never) => void>>()
  readonly conn: Conn

  constructor(
    private readonly server: FakeRealtimeServer,
    label: string,
    readonly url: string,
  ) {
    this.conn = { id: server._nextConnId(), label, url, readyState: READY.connecting, ws: this, members: new Map(), counted: false }
    server._registerConn(this.conn)
    server._onNewSocket(this)
  }

  /** Synchronise `conn.readyState` (vue publique du serveur) avec la socket. */
  setState(s: number): void {
    this.readyState = s
    this.conn.readyState = s
  }

  dispatch(type: 'open' | 'message' | 'close' | 'error', ev: unknown): void {
    const handler = (this as unknown as Record<string, unknown>)['on' + type]
    if (typeof handler === 'function') (handler as (e: unknown) => void).call(this, ev)
    for (const l of this.listeners.get(type) ?? []) (l as (e: unknown) => void)(ev)
  }

  addEventListener(type: string, listener: (ev: never) => void): void {
    let set = this.listeners.get(type)
    if (!set) this.listeners.set(type, (set = new Set()))
    set.add(listener)
  }
  removeEventListener(type: string, listener: (ev: never) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  send(data: unknown): void {
    if (this.readyState === READY.connecting) throw new Error("InvalidStateError: Failed to execute 'send' on 'WebSocket': Still in CONNECTING state.")
    if (this.readyState !== READY.open) return // comme un navigateur : envoi sur socket fermée = perdu, sans exception
    this.server._onClientFrame(this.conn, data)
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === READY.closed || this.readyState === READY.closing) return
    const wasConnecting = this.readyState === READY.connecting
    this.setState(READY.closing)
    this.server._onSocketGone(this.conn)
    later(this.server.latencyMs, () => {
      if (this.readyState === READY.closed) return
      this.setState(READY.closed)
      if (wasConnecting) this.dispatch('error', { type: 'error' })
      this.dispatch('close', { code: code ?? 1000, reason: reason ?? '', wasClean: !wasConnecting })
    })
  }

  /** Livraison serveur -> client (ignorée si la socket n'est pas ouverte). */
  receive(data: string | ArrayBuffer): void {
    if (this.readyState !== READY.open) return
    this.dispatch('message', { data })
  }

  /** Coupure brutale (onerror puis onclose 1006), sans poignée de main. */
  abrupt(code = 1006, reason = ''): void {
    if (this.readyState === READY.closed) return
    this.setState(READY.closed)
    this.server._onSocketGone(this.conn)
    this.dispatch('error', { type: 'error' })
    this.dispatch('close', { code, reason, wasClean: false })
  }
}

export class FakeRealtimeServer {
  /** Mutable : latence ajoutée à chaque livraison (ms). */
  latencyMs: number
  /** Si faux, les `heartbeat` restent sans réponse (connexion « morte »). */
  heartbeatReplies = true
  /** Mutable : utilisateurs connectés simultanés au plus ; `Infinity` = pas de limite. */
  maxConnections: number
  /** Mutable : jointures par seconde au plus ; `Infinity` = pas de limite. */
  maxJoinsPerSecond: number
  /** Nombre de jointures refusées pour cause de quota (connexions ou jointures/s). */
  quotaRefusals = { connections: 0, joins: 0 }

  /** Toutes les trames reçues des clients, dans l'ordre. */
  readonly frames: ServerFrame[] = []
  /** Tous les appels REST `POST .../api/broadcast` du faux fetch (le repli que le jeu ne doit jamais utiliser). */
  readonly restBroadcasts: RestBroadcastCall[] = []
  /** Toutes les requêtes du faux fetch, y compris hors broadcast. */
  readonly fetchCalls: Array<{ t: number; label: string; method: string; url: string }> = []

  private readonly restBroadcastStatus: number
  private readonly conns: Conn[] = []
  private readonly topics = new Map<string, Set<Member>>()
  private readonly joinRules: JoinRule[] = []
  private readonly connectRules: ConnectRule[] = []
  private readonly transports = new Map<string, FakeWebSocketConstructor>()
  private connCounter = 0
  private refCounter = 0
  private keyCounter = 0
  private recentJoinTimes: number[] = []
  private peakUsers = 0
  private memberPeaks = new Map<string, number>()

  constructor(opts: FakeRealtimeServerOptions = {}) {
    this.latencyMs = opts.latencyMs ?? 0
    this.restBroadcastStatus = opts.restBroadcastStatus ?? 202
    this.maxConnections = opts.maxConnections ?? Infinity
    this.maxJoinsPerSecond = opts.maxJoinsPerSecond ?? Infinity
  }

  // ------------------------------------------------------------------------ injection dans le SDK

  /**
   * Classe WebSocket à passer en `realtime.transport`. Un `label` distinct par client Supabase permet de
   * cibler un client précis dans les scripts et de compter ses joins.
   */
  transport(label = 'default'): FakeWebSocketConstructor {
    let cls = this.transports.get(label)
    if (!cls) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- la classe générée doit référencer ce serveur
      const server = this
      cls = class extends FakeSocketImpl {
        constructor(url: string, _protocols?: string | string[]) {
          super(server, label, String(url))
        }
      }
      this.transports.set(label, cls)
    }
    return cls
  }

  /** Faux `fetch` : compte les `POST /realtime/v1/api/broadcast`, répond 202 (ou `restBroadcastStatus`). */
  fetchFor(label = 'default'): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
      const t = Date.now()
      this.fetchCalls.push({ t, label, method, url })
      const pathname = ((): string => {
        try {
          return new URL(url).pathname
        } catch {
          return url
        }
      })()
      if (method === 'POST' && pathname.includes('/realtime/v1/api/broadcast')) {
        this.restBroadcasts.push({ t, label, method, url, pathname, body: typeof init?.body === 'string' ? init.body : null })
        return new Response(null, { status: this.restBroadcastStatus })
      }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
  }

  /**
   * Options prêtes pour `createClient(url, key, server.clientOptions({ label, timeout, ... }))` :
   * transport factice, fetch factice, pas de session ni de rafraîchissement de jeton (aucun timer parasite).
   */
  clientOptions(
    opts: { label?: string; timeout?: number; heartbeatIntervalMs?: number; reconnectAfterMs?: (tries: number) => number } = {},
  ): SupabaseClientOptions<'public'> {
    const label = opts.label ?? 'default'
    const realtime: Record<string, unknown> = { transport: this.transport(label) }
    if (opts.timeout !== undefined) realtime.timeout = opts.timeout
    if (opts.heartbeatIntervalMs !== undefined) realtime.heartbeatIntervalMs = opts.heartbeatIntervalMs
    if (opts.reconnectAfterMs) realtime.reconnectAfterMs = opts.reconnectAfterMs
    return {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: this.fetchFor(label) },
      realtime,
    } as SupabaseClientOptions<'public'>
  }

  // ------------------------------------------------------------------------ observation

  /** Connexions WebSocket ouvertes (éventuellement filtrées). */
  openConnections(sel?: ConnSelector): ConnInfo[] {
    return this.conns.filter((c) => c.readyState === READY.open && this.selects(sel, c))
  }

  /**
   * Utilisateurs connectés au sens du serveur Realtime : sockets ouvertes qui ont joint au moins un canal. Une socket
   * reste comptée jusqu'à sa fermeture, même après le départ de son dernier canal (le SDK la garde ouverte ~50 s) ;
   * une socket ouverte qui n'a encore rien joint, ou dont la jointure a été refusée, ne compte pas.
   */
  connectedUsers(): number {
    return this.conns.filter((c) => c.readyState === READY.open && c.counted).length
  }

  /** Plus grand nombre d'utilisateurs connectés simultanément observé depuis le début. */
  peakConnectedUsers(): number {
    return this.peakUsers
  }

  /** Plus grand nombre de membres joints en même temps à ce topic depuis le début. */
  peakMemberCount(topic: string): number {
    return this.memberPeaks.get(fullTopic(topic)) ?? 0
  }

  /** Plus grand nombre de `phx_join` reçus dans une fenêtre glissante d'une seconde (horloge simulée comprise). */
  peakJoinsPerSecond(): number {
    const times = this.frames.filter((f) => f.event === 'phx_join').map((f) => f.t)
    let peak = 0
    for (let i = 0, j = 0; i < times.length; i++) {
      while (times[i] - times[j] >= 1000) j++
      peak = Math.max(peak, i - j + 1)
    }
    return peak
  }

  /** Nombre de WebSocket créées depuis le début (connexions tentées, refusées comprises). */
  connectionAttempts(sel?: ConnSelector): number {
    return this.conns.filter((c) => this.selects(sel, c)).length
  }

  /** Nombre de `phx_join` reçus (topic et client optionnels). Les re-jointures automatiques de phoenix comptent. */
  joinCount(topic?: string, label?: string): number {
    return this.countFrames('phx_join', topic, label)
  }

  leaveCount(topic?: string, label?: string): number {
    return this.countFrames('phx_leave', topic, label)
  }

  /** Nombre de `presence` track reçus. */
  trackCount(topic?: string, label?: string): number {
    return this.frames.filter((f) => f.event === 'presence' && asRecord(f.payload).event === 'track' && this.frameMatches(f, topic, label)).length
  }

  untrackCount(topic?: string, label?: string): number {
    return this.frames.filter((f) => f.event === 'presence' && asRecord(f.payload).event === 'untrack' && this.frameMatches(f, topic, label)).length
  }

  /** Broadcasts utilisateur reçus par WebSocket (trames binaires). */
  broadcastCount(topic?: string, label?: string): number {
    return this.countFrames('broadcast', topic, label)
  }

  heartbeatCount(): number {
    return this.frames.filter((f) => f.event === 'heartbeat').length
  }

  /** Membres actuellement joints à un topic (ou à tous). */
  members(topic?: string): MemberInfo[] {
    const out: MemberInfo[] = []
    for (const [t, set] of this.topics) {
      if (topic !== undefined && fullTopic(topic) !== t) continue
      for (const m of set) out.push(this.info(m))
    }
    return out
  }

  memberCount(topic: string): number {
    return this.topics.get(fullTopic(topic))?.size ?? 0
  }

  /**
   * Charges utiles `track` actuellement actives (tous topics, ou un seul), ex. pour vérifier qu'un visiteur n'a
   * qu'UNE présence côté serveur : `server.trackedPayloads().filter(p => p.id === 'v1').length === 1`.
   */
  trackedPayloads(topic?: string): Array<Record<string, unknown> & { _topic: string; _label: string }> {
    return this.members(topic)
      .filter((m) => m.tracked)
      .map((m) => ({ ...(m.tracked as Record<string, unknown>), _topic: m.topic, _label: m.label }))
  }

  /** Nombre de joins du script encore en attente (non consommés). */
  pendingJoinRules(): number {
    return this.joinRules.filter((r) => r.remaining > 0).length
  }

  // ------------------------------------------------------------------------ scripts

  /** Les `n` prochains joins de ce topic (et client) reçoivent `phx_reply` status error `{ reason }`. */
  rejectJoins(topic: TopicMatcher, n = 1, reason = 'fake-server: join refused', sel?: ConnSelector): void {
    this.joinRules.push({ topic, sel, behavior: { error: reason }, remaining: n })
  }

  /** Les `n` prochains joins restent sans réponse (le SDK finit en TIMED_OUT). */
  silenceJoins(topic: TopicMatcher, n = 1, sel?: ConnSelector): void {
    this.joinRules.push({ topic, sel, behavior: 'silence', remaining: n })
  }

  /** Les `n` prochains joins sont acceptés, mais après `delayMs`. */
  delayJoins(topic: TopicMatcher, delayMs: number, n = 1, sel?: ConnSelector): void {
    this.joinRules.push({ topic, sel, behavior: { delayMs }, remaining: n })
  }

  clearJoinScripts(): void {
    this.joinRules.length = 0
  }

  /** Les `n` prochaines ouvertures de WebSocket échouent (onerror + onclose 1006). `Infinity` = jusqu'à `allowConnections`. */
  refuseConnections(n = Infinity, sel?: ConnSelector): void {
    this.connectRules.push({ sel, remaining: n })
  }

  allowConnections(): void {
    this.connectRules.length = 0
  }

  /** Coupure brutale des WebSocket ouvertes (réseau perdu). Retourne le nombre de sockets coupées. */
  dropSockets(sel?: ConnSelector): number {
    let n = 0
    for (const c of [...this.conns]) {
      if (c.readyState === READY.open && this.selects(sel, c)) {
        c.ws.abrupt(1006)
        n += 1
      }
    }
    return n
  }

  /** Fermeture propre côté serveur (close frame) des WebSocket ouvertes. */
  closeSockets(sel?: ConnSelector, code = 1001, reason = 'server going away'): number {
    let n = 0
    for (const c of [...this.conns]) {
      if (c.readyState === READY.open && this.selects(sel, c)) {
        this.onSocketGone(c)
        c.ws.setState(READY.closed)
        c.ws.dispatch('close', { code, reason, wasClean: true })
        n += 1
      }
    }
    return n
  }

  /** Message `system` (ex. erreur d'extension) poussé sur le canal. Par défaut : « Too many messages per second ». */
  sendSystem(topic: string, payload?: Record<string, unknown>, sel?: ConnSelector): number {
    let n = 0
    for (const m of this.membersOf(topic, sel)) {
      const sub = m.topic.slice(TOPIC_PREFIX.length)
      this.pushJson(m.conn, m.joinRef, null, m.topic, 'system', {
        message: SERVER_MESSAGE_TOO_MANY_MESSAGES,
        status: 'error',
        extension: 'system',
        channel: sub,
        ...payload,
      })
      n += 1
    }
    return n
  }

  /** `phx_close` serveur : le membre est retiré (diff de départ aux autres) et le SDK reçoit CLOSED. */
  closeChannel(topic: string, sel?: ConnSelector): number {
    let n = 0
    for (const m of this.membersOf(topic, sel)) {
      this.removeMember(m)
      this.pushJson(m.conn, m.joinRef, null, m.topic, 'phx_close', {})
      n += 1
    }
    return n
  }

  /** Scénario du 30/09 : message système « Too many messages per second » puis `phx_close`. */
  rateLimitChannel(topic: string, sel?: ConnSelector, payload?: Record<string, unknown>): number {
    this.sendSystem(topic, payload, sel)
    return this.closeChannel(topic, sel)
  }

  /** Quota de présence : message `system` « Too many presence messages per second » puis `phx_close`. */
  presenceLimitChannel(topic: string, sel?: ConnSelector): number {
    this.sendSystem(topic, { message: SERVER_MESSAGE_TOO_MANY_PRESENCE }, sel)
    return this.closeChannel(topic, sel)
  }

  /** `phx_error` serveur (crash du canal) : le SDK passe en CHANNEL_ERROR puis rejoint seul. */
  crashChannel(topic: string, sel?: ConnSelector): number {
    let n = 0
    for (const m of this.membersOf(topic, sel)) {
      this.removeMember(m)
      this.pushJson(m.conn, m.joinRef, null, m.topic, 'phx_error', {})
      n += 1
    }
    return n
  }

  /** Remet le serveur à zéro (scripts, compteurs, membres). Les sockets encore ouvertes sont coupées sans événement. */
  reset(): void {
    for (const c of this.conns) {
      c.members.clear()
      if (c.readyState !== READY.closed) c.ws.setState(READY.closed)
    }
    this.conns.length = 0
    this.topics.clear()
    this.joinRules.length = 0
    this.connectRules.length = 0
    this.frames.length = 0
    this.restBroadcasts.length = 0
    this.fetchCalls.length = 0
    this.heartbeatReplies = true
    this.recentJoinTimes.length = 0
    this.peakUsers = 0
    this.memberPeaks.clear()
    this.quotaRefusals = { connections: 0, joins: 0 }
  }

  // ------------------------------------------------------------------------ interne (appelé par la socket)

  /** @internal */
  _nextConnId(): number {
    this.connCounter += 1
    return this.connCounter
  }

  /** @internal */
  _registerConn(conn: Conn): void {
    this.conns.push(conn)
  }

  /** @internal Décide du sort d'une nouvelle WebSocket : ouverture ou échec. */
  _onNewSocket(ws: FakeSocketImpl): void {
    const conn = ws.conn
    const rule = this.connectRules.find((r) => r.remaining > 0 && this.selects(r.sel, conn))
    if (rule) {
      rule.remaining -= 1
      later(this.latencyMs, () => {
        if (ws.readyState !== READY.connecting) return
        ws.setState(READY.closed)
        ws.dispatch('error', { type: 'error' })
        ws.dispatch('close', { code: 1006, reason: '', wasClean: false })
      })
      return
    }
    later(this.latencyMs, () => {
      if (ws.readyState !== READY.connecting) return
      ws.setState(READY.open)
      ws.dispatch('open', { type: 'open' })
    })
  }

  /** @internal */
  _onSocketGone(conn: Conn): void {
    this.onSocketGone(conn)
  }

  /** @internal */
  _onClientFrame(conn: Conn, data: unknown): void {
    let joinRef: string | null
    let ref: string | null
    let topic: string
    let event: string
    let payload: unknown
    let binary = false
    if (typeof data === 'string') {
      const arr = JSON.parse(data) as [string | null, string | null, string, string, unknown]
      ;[joinRef, ref, topic, event, payload] = arr
    } else if (isArrayBufferLike(data)) {
      const d = decodeBinaryPush(data)
      if (!d) return
      binary = true
      joinRef = d.joinRef
      ref = d.ref
      topic = d.topic
      event = 'broadcast'
      payload = { type: 'broadcast', event: d.userEvent, payload: d.payload }
    } else {
      return
    }
    this.frames.push({ t: Date.now(), connId: conn.id, label: conn.label, joinRef, ref, topic, event, payload, binary })

    switch (event) {
      case 'heartbeat':
        if (this.heartbeatReplies) this.reply(conn, null, ref, topic, 'ok', {})
        return
      case 'phx_join':
        this.handleJoin(conn, joinRef, ref, topic, asRecord(payload))
        return
      case 'phx_leave':
        this.handleLeave(conn, joinRef, ref, topic)
        return
      case 'presence':
        this.handlePresence(conn, joinRef, ref, topic, asRecord(payload))
        return
      case 'broadcast':
        this.handleBroadcast(conn, joinRef, ref, topic, asRecord(payload))
        return
      default:
        return // access_token, etc. : sans réponse, comme le vrai serveur
    }
  }

  // ------------------------------------------------------------------------ interne (protocole)

  private selects(sel: ConnSelector, conn: ConnInfo): boolean {
    if (sel === undefined) return true
    return typeof sel === 'string' ? conn.label === sel : sel(conn)
  }

  private frameMatches(f: ServerFrame, topic?: string, label?: string): boolean {
    return (topic === undefined || f.topic === fullTopic(topic)) && (label === undefined || f.label === label)
  }

  private countFrames(event: string, topic?: string, label?: string): number {
    return this.frames.filter((f) => f.event === event && this.frameMatches(f, topic, label)).length
  }

  private info(m: Member): MemberInfo {
    const { phx_ref: _ref, ...tracked } = m.meta ?? { phx_ref: '' }
    return {
      connId: m.conn.id,
      label: m.conn.label,
      topic: m.topic,
      key: m.key,
      joinRef: m.joinRef,
      tracked: m.meta ? tracked : null,
      presence: m.presence,
    }
  }

  private membersOf(topic: string, sel?: ConnSelector): Member[] {
    const set = this.topics.get(fullTopic(topic))
    return set ? [...set].filter((m) => this.selects(sel, m.conn)) : []
  }

  private nextRef(): string {
    this.refCounter += 1
    return String(this.refCounter)
  }

  private deliver(conn: Conn, data: string | ArrayBuffer): void {
    later(this.latencyMs, () => conn.ws.receive(data))
  }

  private pushJson(conn: Conn, joinRef: string | null, ref: string | null, topic: string, event: string, payload: unknown): void {
    this.deliver(conn, JSON.stringify([joinRef, ref, topic, event, payload]))
  }

  private reply(conn: Conn, joinRef: string | null, ref: string | null, topic: string, status: 'ok' | 'error', response: unknown): void {
    this.pushJson(conn, joinRef, ref, topic, 'phx_reply', { status, response })
  }

  private nextJoinBehavior(topic: string, conn: Conn): JoinBehavior {
    const rule = this.joinRules.find((r) => r.remaining > 0 && matchesTopic(r.topic, topic) && this.selects(r.sel, conn))
    if (!rule) return 'ok'
    rule.remaining -= 1
    return rule.behavior
  }

  /** Refus de quota du serveur à la jointure, ou `null` : jointures/s d'abord, puis connexions (comme `realtime_channel.ex`). */
  private quotaRefusal(conn: Conn): string | null {
    const now = Date.now()
    this.recentJoinTimes = this.recentJoinTimes.filter((t) => now - t < 1000)
    if (this.recentJoinTimes.length >= this.maxJoinsPerSecond) {
      this.quotaRefusals.joins += 1
      return SERVER_REASON_TOO_MANY_JOINS
    }
    this.recentJoinTimes.push(now)
    // Une socket déjà comptée change de canal sans être recomptée.
    if (!conn.counted && this.connectedUsers() >= this.maxConnections) {
      this.quotaRefusals.connections += 1
      return SERVER_REASON_TOO_MANY_CONNECTIONS
    }
    return null
  }

  private handleJoin(conn: Conn, joinRef: string | null, ref: string | null, topic: string, payload: Record<string, unknown>): void {
    const refusal = this.quotaRefusal(conn)
    if (refusal) {
      this.reply(conn, joinRef, ref, topic, 'error', { reason: refusal })
      return
    }
    const behavior = this.nextJoinBehavior(topic, conn)
    if (behavior === 'silence') return
    if (typeof behavior === 'object' && 'error' in behavior) {
      this.reply(conn, joinRef, ref, topic, 'error', { reason: behavior.error })
      return
    }
    const accept = (): void => {
      if (conn.readyState !== READY.open) return
      // Doublon (même socket, même topic) : le vrai serveur ferme l'ancien canal et en ouvre un neuf.
      const previous = conn.members.get(topic)
      if (previous) this.removeMember(previous)

      const config = asRecord(payload.config)
      const presenceCfg = asRecord(config.presence)
      const broadcastCfg = asRecord(config.broadcast)
      this.keyCounter += 1
      const member: Member = {
        conn,
        topic,
        joinRef: joinRef ?? this.nextRef(),
        key: typeof presenceCfg.key === 'string' && presenceCfg.key ? presenceCfg.key : `fake-key-${this.keyCounter}`,
        presence: presenceCfg.enabled === true,
        ack: broadcastCfg.ack === true,
        self: broadcastCfg.self === true,
        meta: null,
      }
      let set = this.topics.get(topic)
      if (!set) this.topics.set(topic, (set = new Set()))
      set.add(member)
      conn.members.set(topic, member)
      conn.counted = true
      this.peakUsers = Math.max(this.peakUsers, this.connectedUsers())
      this.memberPeaks.set(topic, Math.max(this.memberPeaks.get(topic) ?? 0, set.size))

      this.reply(conn, member.joinRef, ref, topic, 'ok', { postgres_changes: [] })
      this.pushJson(conn, member.joinRef, null, topic, 'system', {
        message: 'Subscribed to PostgreSQL',
        status: 'ok',
        extension: 'postgres_changes',
        channel: topic.slice(TOPIC_PREFIX.length),
      })
      if (member.presence) {
        const state: Record<string, { metas: Meta[] }> = {}
        for (const other of set) if (other.presence && other.meta) state[other.key] = { metas: [other.meta] }
        this.pushJson(conn, member.joinRef, null, topic, 'presence_state', state)
      }
    }
    if (typeof behavior === 'object' && 'delayMs' in behavior) later(behavior.delayMs, accept)
    else accept()
  }

  private handleLeave(conn: Conn, joinRef: string | null, ref: string | null, topic: string): void {
    const member = conn.members.get(topic)
    // Un départ portant un ancien join_ref ne retire pas le canal courant (le vrai serveur l'ignore).
    if (member && (joinRef === null || joinRef === member.joinRef)) this.removeMember(member)
    this.reply(conn, joinRef, ref, topic, 'ok', {})
  }

  private handlePresence(conn: Conn, joinRef: string | null, ref: string | null, topic: string, payload: Record<string, unknown>): void {
    const member = conn.members.get(topic)
    if (!member || !member.presence) return
    if (payload.event === 'track') {
      const old = member.meta
      const meta: Meta = { ...asRecord(payload.payload), phx_ref: this.nextRef() }
      member.meta = meta
      this.presenceDiff(topic, { joins: { [member.key]: { metas: [meta] } }, leaves: old ? { [member.key]: { metas: [old] } } : {} })
    } else if (payload.event === 'untrack') {
      const old = member.meta
      member.meta = null
      if (old) this.presenceDiff(topic, { joins: {}, leaves: { [member.key]: { metas: [old] } } })
    }
    this.reply(conn, joinRef, ref, topic, 'ok', {})
  }

  private handleBroadcast(conn: Conn, _joinRef: string | null, ref: string | null, topic: string, payload: Record<string, unknown>): void {
    const sender = conn.members.get(topic)
    if (!sender) return
    const userEvent = String(payload.event ?? '')
    const frame = encodeBinaryBroadcast(topic, userEvent, payload.payload)
    for (const m of this.topics.get(topic) ?? []) {
      if (m === sender && !sender.self) continue
      this.deliver(m.conn, frame)
    }
    if (sender.ack) this.reply(conn, sender.joinRef, ref, topic, 'ok', {})
  }

  private presenceDiff(topic: string, diff: { joins: Record<string, { metas: Meta[] }>; leaves: Record<string, { metas: Meta[] }> }): void {
    for (const m of this.topics.get(topic) ?? []) {
      if (m.presence) this.pushJson(m.conn, m.joinRef, null, topic, 'presence_diff', diff)
    }
  }

  /** Retire un membre ; s'il était tracké, les autres reçoivent son départ. */
  private removeMember(member: Member): void {
    const set = this.topics.get(member.topic)
    if (!set || !set.delete(member)) return
    if (member.conn.members.get(member.topic) === member) member.conn.members.delete(member.topic)
    if (set.size === 0) this.topics.delete(member.topic)
    if (member.meta) {
      const old = member.meta
      member.meta = null
      this.presenceDiff(member.topic, { joins: {}, leaves: { [member.key]: { metas: [old] } } })
    }
  }

  private onSocketGone(conn: Conn): void {
    for (const m of [...conn.members.values()]) this.removeMember(m)
  }
}
