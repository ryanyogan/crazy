import { expect, test } from 'vite-plus/test'
import { type CommandState, type RolloverFacts, type TodoFacts, decide } from './command'

// Ryan is in Chicago. His midnight on the 18th is 05:00 UTC; the Rollover wakes just after it.
const MIDNIGHT = new Date('2025-09-18T05:00:02Z')
const SETTINGS: RolloverFacts = {
  timeZone: 'America/Chicago',
  sentBackDays: 1,
  archiveDays: 90,
  lastRolloverDay: '2025-09-17',
}

const todo = (id: string, fields: Partial<TodoFacts>): TodoFacts => ({
  id,
  state: 'today',
  source: null,
  snoozedUntil: null,
  swappedOnDay: null,
  slotHours: [],
  touchedAt: '2025-09-17T15:00:00Z',
  carryCount: 0,
  ...fields,
})

const state = (todos: TodoFacts[], settings: Partial<RolloverFacts> = {}): CommandState => ({
  day: '2025-09-18',
  todos,
  signals: [],
  events: [],
  settings: { ...SETTINGS, ...settings },
})

/** What the Rollover changes about each Todo, by id. */
function rolledOver(from: CommandState) {
  const decision = decide(from, { type: 'rollover' }, MIDNIGHT)
  if (!decision.ok) throw new Error(decision.reason)
  return Object.fromEntries(
    decision.ops.flatMap((op) => (op.type === 'todo.set' ? [[op.id, op.set]] : [])),
  )
}

test('a Todo touched that day is carried over, and one left untouched is sent back with its count reset', () => {
  const changes = rolledOver(
    state([
      todo('worked-on', { carryCount: 2 }),
      todo('ignored', { carryCount: 3, touchedAt: '2025-09-16T20:00:00Z' }),
    ]),
  )
  expect(changes['worked-on']).toMatchObject({ carryCount: 3 })
  expect(changes['worked-on']).not.toHaveProperty('state')
  expect(changes.ignored).toMatchObject({
    state: 'backlog',
    carryCount: 0,
    sentBackAt: MIDNIGHT.toISOString(),
  })
})

test('a Todo created at 23:50 counts as Touched', () => {
  // 23:50 in Chicago on the 17th.
  const changes = rolledOver(state([todo('late', { touchedAt: '2025-09-18T04:50:00Z' })]))
  expect(changes.late).toMatchObject({ carryCount: 1 })
})

test('sitting in the stack, or being swapped, is not a touch', () => {
  const changes = rolledOver(
    state([todo('dodged', { touchedAt: '2025-09-16T15:00:00Z', swappedOnDay: '2025-09-17' })]),
  )
  expect(changes.dodged).toMatchObject({ state: 'backlog' })
})

test('with a longer sent-back period an untouched Todo waits where it is until the period is up', () => {
  // Last touched on the 16th: by the 18th's midnight it has gone one whole day untouched.
  const oneDay = todo('waiting', { carryCount: 1, touchedAt: '2025-09-16T15:00:00Z' })
  const twoDays = todo('ignored', { carryCount: 1, touchedAt: '2025-09-15T15:00:00Z' })
  const changes = rolledOver(state([oneDay, twoDays], { sentBackDays: 2 }))
  expect(changes).not.toHaveProperty('waiting')
  expect(changes.ignored).toMatchObject({ state: 'backlog', carryCount: 0 })
})

test('a backlog Todo untouched for the archive period is archived; a younger one is not', () => {
  const changes = rolledOver(
    state([
      todo('old', { state: 'backlog', touchedAt: '2025-06-01T15:00:00Z' }),
      todo('young', { state: 'backlog', touchedAt: '2025-09-01T15:00:00Z' }),
    ]),
  )
  expect(changes).toEqual({ old: { state: 'archived' } })
})

test('woken twice for the same midnight, nothing is carried over a second time', () => {
  const again = decide(
    state([todo('worked-on', {})], { lastRolloverDay: '2025-09-18' }),
    { type: 'rollover' },
    MIDNIGHT,
  )
  expect(again).toEqual({ ok: true, ops: [] })
})

test('a Source reported complete finishes its open Todo, and touches no other', () => {
  const source = {
    connectionId: 'c1',
    itemId: 'HAL-212',
    kind: 'linear_issue',
    ref: null,
    url: null,
  } as const
  const decision = decide(
    state([todo('spike', { source }), todo('other', { source: { ...source, itemId: 'HAL-198' } })]),
    { type: 'source.completed', connectionId: 'c1', itemId: 'HAL-212' },
    MIDNIGHT,
  )
  expect(decision).toEqual({
    ok: true,
    ops: [
      { type: 'todo.set', id: 'spike', set: { state: 'done', doneAt: MIDNIGHT.toISOString() } },
    ],
  })
})
