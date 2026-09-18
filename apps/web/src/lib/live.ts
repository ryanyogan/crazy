import {
  type Applied,
  LIVE_PATH,
  hear,
  markApplied,
  namesAnotherDay,
  reconnectDelay,
  serverMessage,
} from '@crazy/shared'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { applyToCache, todayQuery } from './queries'

// The browser's socket to its user's Coordinator. What another device commits
// arrives here as a patch and is laid over the query cache, so a screen stays
// current without refetching. The rules for what to do with a message are
// `hear` in @crazy/shared; this file owns the socket and nothing else.

export type LiveStatus =
  | { state: 'connecting' | 'reconnecting' | 'offline' }
  /** `wokeAt` is when the Coordinator last woke, as it said in its greeting. */
  | { state: 'live'; wokeAt: string | null }

const CONNECTING: LiveStatus = { state: 'connecting' }
const NOWHERE: Applied = { upTo: 0, ahead: [] }

/** The sequence number a cached read model was read at, if it carries one. */
function seqOf(data: unknown): number | null {
  const seq = (data as { seq?: unknown } | undefined)?.seq
  return typeof seq === 'number' ? seq : null
}

class Live {
  /** Null until something says where the sequence stands: a read model, or the greeting. */
  private known: Applied | null = null
  private socket: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private attempt = 0
  private mounts = 0
  private status = CONNECTING
  private readonly listeners = new Set<() => void>()
  private unwatchCache: (() => void) | undefined

  constructor(private readonly queryClient: QueryClient) {}

  /** A patch that reached this browser some other way: the answer to its own command. */
  applied(seq: number): void {
    const known = this.known ?? this.fromCache()
    if (known) this.known = markApplied(known, seq)
  }

  start(): void {
    if (this.mounts++ > 0) return
    window.addEventListener('online', this.online)
    window.addEventListener('offline', this.offline)
    this.unwatchCache = this.watchCache()
    // Not at once: React mounts, unmounts and mounts again in development.
    this.timer = setTimeout(this.connect, 0)
  }

  stop(): void {
    if (--this.mounts > 0) return
    window.removeEventListener('online', this.online)
    window.removeEventListener('offline', this.offline)
    this.unwatchCache?.()
    this.hangUp()
    this.attempt = 0
    this.show(CONNECTING)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  current = (): LiveStatus => this.status

  private show(status: LiveStatus): void {
    this.status = status
    for (const listener of this.listeners) listener()
  }

  /** The oldest moment any cached read model was read at: everything since must be heard. */
  private fromCache(): Applied | null {
    const seqs = this.queryClient
      .getQueryCache()
      .getAll()
      .map((query) => seqOf(query.state.data))
      .filter((seq) => seq !== null)
    return seqs.length > 0 ? { upTo: Math.min(...seqs), ahead: [] } : null
  }

  /**
   * A fetch can land after patches committed later than it was read at, and
   * would put the cache back behind them. Such a read is simply made again.
   */
  private watchCache(): () => void {
    return this.queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success' || event.action.manual) return
      const seq = seqOf(event.query.state.data)
      if (seq === null || !this.known) return
      if (seq < Math.max(this.known.upTo, ...this.known.ahead)) {
        void this.queryClient.invalidateQueries({ queryKey: event.query.queryKey, exact: true })
      }
    })
  }

  private connect = (): void => {
    if (!navigator.onLine) return this.show({ state: 'offline' })

    this.known ??= this.fromCache()
    const url = new URL(LIVE_PATH, window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    if (this.known) url.searchParams.set('since', String(this.known.upTo))

    const socket = new WebSocket(url)
    this.socket = socket
    socket.addEventListener('message', (event) => {
      if (this.socket === socket) this.heard(event.data)
    })
    // An error is always followed by a close, which is where the retry starts.
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return
      this.socket = null
      this.retry()
    })
  }

  private heard(data: unknown): void {
    let message
    try {
      message = serverMessage.parse(JSON.parse(String(data)))
    } catch {
      // A patch this browser cannot read leaves the cache behind with no way to
      // say how far, and the sequence stays where it was until something says.
      return this.refetch()
    }

    const { applied, ...heard } = hear(this.known ?? NOWHERE, message)
    this.known = applied
    if (heard.then === 'apply') {
      const showing = this.queryClient.getQueryData(todayQuery.queryKey)
      applyToCache(this.queryClient, heard.ops)
      // A Slot written on a day this tab is not showing: the user's day turned
      // over while it sat open, so what it holds is yesterday's and is read again.
      if (showing && namesAnotherDay(showing, heard.ops)) this.refetch()
    }
    if (heard.then === 'refetch') this.refetch()
    if (message.type === 'hello') {
      // Caught up. Only now does the next failure start its waits from the shortest again.
      this.attempt = 0
      this.show({ state: 'live', wokeAt: message.wokeAt })
    }
  }

  /** Nothing here can catch the cache up, so every read model is read again. */
  private refetch(): void {
    void this.queryClient.invalidateQueries()
  }

  private retry(): void {
    if (!navigator.onLine) return this.show({ state: 'offline' })
    this.show({ state: 'reconnecting' })
    this.timer = setTimeout(this.connect, reconnectDelay(this.attempt++, Math.random()))
  }

  private hangUp(): void {
    clearTimeout(this.timer)
    const socket = this.socket
    this.socket = null
    socket?.close()
  }

  private online = (): void => {
    this.hangUp()
    this.attempt = 0
    this.show({ state: 'reconnecting' })
    this.connect()
  }

  private offline = (): void => {
    this.hangUp()
    this.show({ state: 'offline' })
  }
}

// One per QueryClient, which is one per tab in a browser and one per request
// on the server, where nothing ever starts it.
const lives = new WeakMap<QueryClient, Live>()

export function liveFor(queryClient: QueryClient): Live {
  let live = lives.get(queryClient)
  if (!live) lives.set(queryClient, (live = new Live(queryClient)))
  return live
}

/** Keeps the socket open for as long as the Shell is mounted. Mounted once, by the Shell. */
export function useLive(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const live = liveFor(queryClient)
    live.start()
    return () => live.stop()
  }, [queryClient])
}

export function useLiveStatus(): LiveStatus {
  const live = liveFor(useQueryClient())
  return useSyncExternalStore(live.subscribe, live.current, () => CONNECTING)
}
