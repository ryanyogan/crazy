import { expect, it } from 'vite-plus/test'
import { type Applied, hasApplied, markApplied, reconnectDelay, serverMessage } from './live'

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
