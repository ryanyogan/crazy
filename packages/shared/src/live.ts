import { z } from 'zod'
import { type Op, op } from './command'

// What travels over the socket between a browser and the user's Coordinator,
// and the two pieces of arithmetic a client needs: which sequence numbers it
// has already applied, and how long to wait before reconnecting.

/** The path the web app accepts the socket on; `?since=` is the last sequence number applied. */
export const LIVE_PATH = '/live'

export const serverMessage = z.discriminatedUnion('type', [
  /** A committed command. */
  z.object({ type: z.literal('patch'), seq: z.number().int().positive(), ops: z.array(op) }),
  /** Sent once a connection is caught up: where the sequence stands and when the Coordinator last woke. */
  z.object({
    type: z.literal('hello'),
    seq: z.number().int().nonnegative(),
    wokeAt: z.iso.datetime().nullable(),
  }),
  /** The client is further behind than the replay buffer reaches, or its data was replaced: read again. */
  z.object({ type: z.literal('refetch'), seq: z.number().int().nonnegative() }),
])
export type ServerMessage = z.infer<typeof serverMessage>

/**
 * The sequence numbers a client has applied: all of them up to `upTo`, and
 * some ahead of it. A client's own command comes back over HTTP, often before
 * the socket has delivered the patches committed just before it.
 */
export interface Applied {
  upTo: number
  ahead: readonly number[]
}

export function hasApplied(applied: Applied, seq: number): boolean {
  return seq <= applied.upTo || applied.ahead.includes(seq)
}

export function markApplied(applied: Applied, seq: number): Applied {
  if (hasApplied(applied, seq)) return applied
  const ahead = new Set([...applied.ahead, seq])
  let upTo = applied.upTo
  while (ahead.delete(upTo + 1)) upTo += 1
  return { upTo, ahead: [...ahead].sort((a, b) => a - b) }
}

/** What a client does about a message, and what it has applied once it has. */
export type Heard =
  | { applied: Applied; then: 'apply'; ops: Op[] }
  | { applied: Applied; then: 'refetch' }
  | { applied: Applied; then: 'nothing' }

/**
 * A client's whole answer to the socket. A patch is applied once, whichever
 * way it arrived first. `refetch` and `hello` say where the sequence stands.
 * After `refetch` the client reads everything again, so it stands exactly
 * there, even if that is behind where it thought it was (a Coordinator whose
 * log was wiped starts again from 0). `hello` only ever moves a client
 * forwards: one that connected without knowing where it was.
 */
export function hear(applied: Applied, message: ServerMessage): Heard {
  switch (message.type) {
    case 'patch':
      if (hasApplied(applied, message.seq)) return { applied, then: 'nothing' }
      return { applied: markApplied(applied, message.seq), then: 'apply', ops: message.ops }
    case 'refetch':
      return { applied: { upTo: message.seq, ahead: [] }, then: 'refetch' }
    case 'hello':
      return { applied: caughtUpTo(applied, message.seq), then: 'nothing' }
  }
}

function caughtUpTo(applied: Applied, seq: number): Applied {
  if (seq <= applied.upTo) return applied
  let next: Applied = { upTo: seq, ahead: [] }
  for (const ahead of applied.ahead) next = markApplied(next, ahead)
  return next
}

const FIRST_RETRY_MS = 1_000
const LONGEST_RETRY_MS = 30_000

/**
 * How long to wait before reconnection attempt `attempt` (0 for the first):
 * doubling from a second to half a minute, each wait cut by up to half at
 * random so that a user's tabs do not all come back at once. `random` is in [0, 1).
 */
export function reconnectDelay(attempt: number, random: number): number {
  const ceiling = Math.min(LONGEST_RETRY_MS, FIRST_RETRY_MS * 2 ** Math.max(0, attempt))
  return Math.round(ceiling * (1 - random / 2))
}
