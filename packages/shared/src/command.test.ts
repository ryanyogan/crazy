import { expect, it } from 'vite-plus/test'
import { type Command, apply, command, decide } from './command'
import { type Today, viewToday } from './today'
import type { TodayTodo } from './todo'

const now = new Date('2025-09-17T13:41:00.000Z')

function todo(id: string, fields: Partial<TodayTodo> = {}): TodayTodo {
  return {
    id,
    title: id,
    state: 'today',
    project: null,
    estimateMinutes: null,
    energy: null,
    carryCount: 0,
    stackPosition: null,
    reason: null,
    source: null,
    slotHours: [],
    createdAt: '2025-09-16T09:00:00.000Z',
    doneAt: null,
    ...fields,
  }
}

function day(todos: TodayTodo[]): Today {
  return { day: '2025-09-17', brief: null, todos, events: [], hours: [], mentions: [], sentBack: 0 }
}

/** Decides a command against the day and, when it is accepted, applies what it decided. */
function run(state: Today, input: Command) {
  const decision = decide(state, input, now)
  return { decision, after: decision.ok ? apply(state, decision.ops) : state }
}

const complete = (todoId: string): Command => ({ type: 'todo.complete', todoId })

it('completes a `today` Todo: it is done as of now and leaves the Priority stack', () => {
  const { decision, after } = run(day([todo('spike'), todo('reply')]), complete('spike'))

  expect(decision).toEqual({
    ok: true,
    ops: [{ type: 'todo.set', id: 'spike', set: { state: 'done', doneAt: now.toISOString() } }],
  })
  const view = viewToday(after, 8)
  expect(view.stack.map(({ id }) => id)).toEqual(['reply'])
  expect(view.done.map(({ id, doneAt }) => [id, doneAt])).toEqual([['spike', now.toISOString()]])
})

it('completes a `backlog` Todo without it ever having been in the day', () => {
  const { after } = run(day([todo('someday', { state: 'backlog' })]), complete('someday'))
  expect(after.todos[0]).toMatchObject({ state: 'done', doneAt: now.toISOString() })
})

it('changes nothing when the Todo is already done, and keeps when it was first done', () => {
  const earlier = '2025-09-17T12:00:00.000Z'
  const before = day([todo('spike', { state: 'done', doneAt: earlier })])
  const { decision, after } = run(before, complete('spike'))

  expect(decision).toEqual({ ok: true, ops: [] })
  expect(after).toBe(before)
})

it('refuses to complete an archived Todo', () => {
  const { decision } = run(day([todo('old', { state: 'archived' })]), complete('old'))
  expect(decision).toEqual({ ok: false, reason: 'An archived Todo cannot be completed.' })
})

it('refuses a Todo it cannot find', () => {
  expect(run(day([]), complete('gone')).decision).toEqual({
    ok: false,
    reason: 'That Todo no longer exists.',
  })
})

it('promotes the next Todo in the stack when the Take on now is completed', () => {
  const state = day([
    todo('spike', { stackPosition: 1, slotHours: [9, 10] }),
    todo('reply', { stackPosition: 2, slotHours: [12] }),
  ])
  expect(viewToday(state, 8).takeOnNow?.todo.id).toBe('spike')

  const { after } = run(state, complete('spike'))
  expect(viewToday(after, 8).takeOnNow).toMatchObject({
    todo: { id: 'reply' },
    hours: { from: 12, until: 13 },
  })
})

it('leaves no Take on now when the last `today` Todo is completed', () => {
  const { after } = run(day([todo('spike', { stackPosition: 1 })]), complete('spike'))
  expect(viewToday(after, 8).takeOnNow).toBeNull()
})

it('leaves the Take on now alone when a Todo further down is completed', () => {
  const state = day([todo('spike', { stackPosition: 1 }), todo('reply', { stackPosition: 2 })])
  const { after } = run(state, complete('reply'))
  expect(viewToday(after, 8).takeOnNow?.todo.id).toBe('spike')
})

it('applies the same operations twice to the same end, as a patch that arrives again would', () => {
  const state = day([todo('spike')])
  const decision = decide(state, complete('spike'), now)
  if (!decision.ok) throw new Error('expected the command to be accepted')
  const once = apply(state, decision.ops)
  expect(apply(once, decision.ops)).toEqual(once)
})

it('ignores an operation on a Todo the state does not hold', () => {
  const state = day([todo('spike')])
  expect(apply(state, [{ type: 'todo.set', id: 'elsewhere', set: { state: 'done' } }])).toEqual(
    state,
  )
})

it('accepts only commands it knows, fully formed', () => {
  expect(command.safeParse({ type: 'todo.complete', todoId: 'spike' }).success).toBe(true)
  expect(command.safeParse({ type: 'todo.complete' }).success).toBe(false)
  expect(command.safeParse({ type: 'todo.explode', todoId: 'spike' }).success).toBe(false)
})
