import { expect, it } from 'vite-plus/test'
import { type Applied, hasApplied, hear, markApplied, reconnectDelay, serverMessage } from './live'

const fresh: Applied = { upTo: 5, ahead: [] }

it('knows a patch it has applied from one it has not', () => {
  expect(hasApplied(fresh, 5)).toBe(true)
  expect(hasApplied(fresh, 3)).toBe(true)
  expect(hasApplied(fresh, 6)).toBe(false)
})

it('advances as patches arrive in order', () => {
  expect(markApplied(markApplied(fresh, 6), 7)).toEqual({ upTo: 7, ahead: [] })
})

it("remembers its own command's patch when it arrives before the ones committed ahead of it", () => {
  // Another device committed 6; this one's command was stamped 7 and answered first.
  const own = markApplied(fresh, 7)
  expect(own).toEqual({ upTo: 5, ahead: [7] })
  expect(hasApplied(own, 7)).toBe(true)
  expect(hasApplied(own, 6)).toBe(false)
  // It reconnects from 5, is replayed 6 and 7, applies 6 and ignores 7.
  expect(markApplied(own, 6)).toEqual({ upTo: 7, ahead: [] })
})

it('ignores a sequence number it has already applied', () => {
  const own = markApplied(fresh, 7)
  expect(markApplied(own, 7)).toBe(own)
  expect(markApplied(own, 4)).toBe(own)
})

const done = [{ type: 'todo.set' as const, id: 'dentist', set: { state: 'done' as const } }]

it("applies another device's patch once, however often it is delivered", () => {
  const first = hear(fresh, { type: 'patch', seq: 6, ops: done })
  expect(first).toEqual({ applied: { upTo: 6, ahead: [] }, then: 'apply', ops: done })
  expect(hear(first.applied, { type: 'patch', seq: 6, ops: done }).then).toBe('nothing')
})

it('ignores its own patch when the socket brings it after the answer to its command', () => {
  const own = markApplied(fresh, 6)
  expect(hear(own, { type: 'patch', seq: 6, ops: done })).toEqual({ applied: own, then: 'nothing' })
})

it('reads everything again when told to, and carries on from where the Coordinator stands', () => {
  expect(hear(fresh, { type: 'refetch', seq: 240 })).toEqual({
    applied: { upTo: 240, ahead: [] },
    then: 'refetch',
  })
  // Even backwards: a Coordinator whose log was wiped counts from 0 again.
  expect(hear(fresh, { type: 'refetch', seq: 0 }).applied).toEqual({ upTo: 0, ahead: [] })
})

it('learns where the sequence stands from the greeting when it connected without knowing', () => {
  const unknown: Applied = { upTo: 0, ahead: [] }
  expect(hear(unknown, { type: 'hello', seq: 12, wokeAt: null }).applied.upTo).toBe(12)
  // A greeting never takes a client backwards, nor forgets a patch of its own still ahead.
  expect(hear(markApplied(fresh, 9), { type: 'hello', seq: 5, wokeAt: null }).applied).toEqual({
    upTo: 5,
    ahead: [9],
  })
})

it('backs off from a second to half a minute, never hammering', () => {
  const waits = [0, 1, 2, 3, 4, 5, 6, 10].map((attempt) => reconnectDelay(attempt, 0))
  expect(waits).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000])
})

it('spreads reconnections out by up to half the wait', () => {
  expect(reconnectDelay(2, 0.5)).toBe(3000)
  expect(reconnectDelay(2, 0.999)).toBeGreaterThanOrEqual(2000)
})

it('reads the messages a Coordinator sends and nothing else', () => {
  expect(serverMessage.safeParse({ type: 'hello', seq: 0, wokeAt: null }).success).toBe(true)
  expect(
    serverMessage.safeParse({
      type: 'patch',
      seq: 3,
      ops: [{ type: 'todo.set', id: 'spike', set: { state: 'done' } }],
    }).success,
  ).toBe(true)
  expect(serverMessage.safeParse({ type: 'cf_agent_state', state: {} }).success).toBe(false)
})
