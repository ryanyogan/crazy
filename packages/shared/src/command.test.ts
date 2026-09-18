import { expect, it } from 'vite-plus/test'
import {
  type Command,
  type Op,
  SNOOZE_CHOICES,
  SNOOZE_MINUTES,
  apply,
  command,
  covers,
  decide,
} from './command'
import { type Signal, type Today, viewToday } from './today'
import type { Source, TodayTodo } from './todo'

// Frame 1a's moment: Wednesday 17 Sep 2025, 08:41 on Ryan's wall clock.
const now = new Date('2025-09-17T13:41:00.000Z')
const timeZone = 'America/Chicago'
const view = (state: Today) => viewToday(state, now, timeZone)

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
    touchedAt: '2025-09-16T09:00:00.000Z',
    snoozedUntil: null,
    doneAt: null,
    ...fields,
  }
}

const slack = (itemId: string, ref: string | null = null): Source => ({
  connectionId: 'slack-work',
  itemId,
  kind: 'slack_message',
  ref,
  url: null,
})

function mention(id: string, fields: Partial<Signal> = {}): Signal {
  return {
    id,
    kind: 'mention',
    who: 'Priya',
    text: 'can you confirm the edge worker rate limit?',
    at: '2025-09-16T20:21:00.000Z',
    source: slack(id),
    todoId: null,
    ...fields,
  }
}

function day(todos: TodayTodo[], signals: Signal[] = []): Today {
  return { day: '2025-09-17', brief: null, todos, events: [], hours: [], signals, sentBack: 0 }
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
  const seen = view(after)
  expect(seen.stack.map(({ id }) => id)).toEqual(['reply'])
  expect(seen.done.map(({ id, doneAt }) => [id, doneAt])).toEqual([['spike', now.toISOString()]])
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
  expect(view(state).takeOnNow?.todo.id).toBe('spike')

  const { after } = run(state, complete('spike'))
  expect(view(after).takeOnNow).toMatchObject({
    todo: { id: 'reply' },
    hours: { from: 12, until: 13 },
  })
})

it('leaves no Take on now when the last `today` Todo is completed', () => {
  const { after } = run(day([todo('spike', { stackPosition: 1 })]), complete('spike'))
  expect(view(after).takeOnNow).toBeNull()
})

it('leaves the Take on now alone when a Todo further down is completed', () => {
  const state = day([todo('spike', { stackPosition: 1 }), todo('reply', { stackPosition: 2 })])
  const { after } = run(state, complete('reply'))
  expect(view(after).takeOnNow?.todo.id).toBe('spike')
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
  expect(command.safeParse({ type: 'todo.add', id: 'new', title: '   ' }).success).toBe(false)
  expect(command.safeParse({ type: 'todo.snooze', todoId: 'spike', minutes: 0 }).success).toBe(
    false,
  )
  expect(command.safeParse({ type: 'todo.snooze', todoId: 'spike', minutes: 1.5 }).success).toBe(
    false,
  )
})

// ── Add a Todo ────────────────────────────────────────────────────────────────

const add = (id: string, title: string): Command => ({ type: 'todo.add', id, title })

it('adds a typed-in Todo to the day as a One-off with no Source, created and touched now', () => {
  const { decision, after } = run(
    day([todo('spike', { stackPosition: 1 })]),
    add('new', 'Book dentist'),
  )

  expect(decision).toEqual({
    ok: true,
    ops: [
      {
        type: 'todo.insert',
        todo: {
          id: 'new',
          title: 'Book dentist',
          state: 'today',
          source: null,
          createdAt: now.toISOString(),
          touchedAt: now.toISOString(),
        },
      },
    ],
  })
  const added = after.todos.find(({ id }) => id === 'new')
  expect(added).toMatchObject({ project: null, source: null, carryCount: 0, slotHours: [] })
  // It follows the placed Todos in the stack; the Take on now is unmoved.
  expect(view(after).stack.map(({ id }) => id)).toEqual(['spike', 'new'])
  expect(view(after).takeOnNow?.todo.id).toBe('spike')
})

it('trims the title it is given', () => {
  expect(command.parse({ type: 'todo.add', id: 'new', title: '  Book dentist \n' })).toEqual({
    type: 'todo.add',
    id: 'new',
    title: 'Book dentist',
  })
})

it('refuses to add a Todo under an id that is already taken', () => {
  expect(run(day([todo('spike')]), add('spike', 'Again')).decision).toEqual({
    ok: false,
    reason: 'That Todo already exists.',
  })
})

it('inserts a Todo once however many times the same patch is applied', () => {
  const state = day([])
  const decision = decide(state, add('new', 'Book dentist'), now)
  if (!decision.ok) throw new Error('expected the command to be accepted')
  const once = apply(state, decision.ops)
  expect(apply(once, decision.ops)).toEqual(once)
  expect(once.todos).toHaveLength(1)
})

// ── Snooze a Todo ─────────────────────────────────────────────────────────────

const snooze = (todoId: string, minutes: number): Command => ({
  type: 'todo.snooze',
  todoId,
  minutes,
})

it('snoozes a Todo: it is touched and leaves the stack until the snooze ends', () => {
  const state = day([todo('spike', { stackPosition: 1 }), todo('reply', { stackPosition: 2 })])
  const { decision, after } = run(state, snooze('spike', 30))

  const until = new Date(now.getTime() + 30 * 60_000).toISOString()
  expect(decision).toEqual({
    ok: true,
    ops: [
      { type: 'todo.set', id: 'spike', set: { snoozedUntil: until, touchedAt: now.toISOString() } },
    ],
  })
  expect(after.todos.find(({ id }) => id === 'spike')).toMatchObject({ state: 'today' })
  expect(view(after).stack.map(({ id }) => id)).toEqual(['reply'])
  expect(view(after).snoozed.map(({ id }) => id)).toEqual(['spike'])
  // The Take on now is derived, so snoozing it promotes the next Todo.
  expect(view(after).takeOnNow?.todo.id).toBe('reply')

  // Once the snooze has ended it is back in its place.
  const later = new Date(new Date(until).getTime() + 1)
  expect(viewToday(after, later, timeZone).stack.map(({ id }) => id)).toEqual(['spike', 'reply'])
  expect(viewToday(after, later, timeZone).snoozed).toEqual([])
})

it('refuses to snooze a Todo that is not in the stack', () => {
  const reason = 'Only a Todo in the Priority stack can be snoozed.'
  expect(run(day([todo('someday', { state: 'backlog' })]), snooze('someday', 30)).decision).toEqual(
    {
      ok: false,
      reason,
    },
  )
  expect(run(day([todo('finished', { state: 'done' })]), snooze('finished', 30)).decision).toEqual({
    ok: false,
    reason,
  })
  expect(run(day([]), snooze('gone', 30)).decision).toEqual({
    ok: false,
    reason: 'That Todo no longer exists.',
  })
})

// ── Add a Mention as a Todo ───────────────────────────────────────────────────

const addSignal = (signalId: string, todoId: string): Command => ({
  type: 'signal.add',
  signalId,
  todoId,
})

it("adds a Mention as a Todo whose Source is the Mention's item, and marks the Mention as added", () => {
  const state = day([todo('spike', { stackPosition: 1 })], [mention('priya')])
  const { decision, after } = run(state, addSignal('priya', 'new'))

  expect(decision).toEqual({
    ok: true,
    ops: [
      {
        type: 'todo.insert',
        todo: {
          id: 'new',
          title: 'Reply to Priya: can you confirm the edge worker rate limit?',
          state: 'today',
          source: slack('priya'),
          createdAt: now.toISOString(),
          touchedAt: now.toISOString(),
        },
      },
      { type: 'signal.set', id: 'priya', set: { todoId: 'new' } },
    ],
  })
  expect(after.signals[0]?.todoId).toBe('new')
  expect(view(after).stack.map(({ id, source }) => [id, source?.kind ?? null])).toEqual([
    ['spike', null],
    ['new', 'slack_message'],
  ])
})

it('creates nothing new when a Mention already added is added again', () => {
  const state = day(
    [todo('reply', { source: slack('priya') })],
    [mention('priya', { todoId: 'reply' })],
  )
  const { decision, after } = run(state, addSignal('priya', 'new'))
  expect(decision).toEqual({ ok: true, ops: [] })
  expect(after).toBe(state)
})

it("creates nothing new when the Mention's Source already has an open Todo, and marks it as that one", () => {
  const state = day([todo('reply', { source: slack('priya') })], [mention('priya')])
  const { decision, after } = run(state, addSignal('priya', 'new'))

  expect(decision).toEqual({
    ok: true,
    ops: [{ type: 'signal.set', id: 'priya', set: { todoId: 'reply' } }],
  })
  expect(after.todos).toHaveLength(1)
  expect(after.signals[0]?.todoId).toBe('reply')
})

it("brings a Mention's Todo into the day when its Source's only open Todo is in the backlog", () => {
  const state = day(
    [todo('reply', { state: 'backlog', source: slack('priya') })],
    [mention('priya')],
  )
  const { decision, after } = run(state, addSignal('priya', 'new'))

  expect(decision).toEqual({
    ok: true,
    ops: [
      { type: 'todo.set', id: 'reply', set: { state: 'today', touchedAt: now.toISOString() } },
      { type: 'signal.set', id: 'priya', set: { todoId: 'reply' } },
    ],
  })
  expect(after.todos).toHaveLength(1)
  // What the user pressed Add for: it is in their day, and it was touched by the move.
  expect(view(after).stack.map(({ id }) => id)).toEqual(['reply'])
  expect(after.todos[0]).toMatchObject({ touchedAt: now.toISOString() })
})

it('leaves a Todo already in the day untouched when a Mention is added to it', () => {
  const touchedAt = '2025-09-16T09:00:00.000Z'
  const state = day([todo('reply', { source: slack('priya'), touchedAt })], [mention('priya')])
  const { decision, after } = run(state, addSignal('priya', 'new'))

  expect(decision).toEqual({
    ok: true,
    ops: [{ type: 'signal.set', id: 'priya', set: { todoId: 'reply' } }],
  })
  expect(after.todos[0]).toMatchObject({ state: 'today', touchedAt })
})

it('makes a new Todo when the only Todo with that Source is done', () => {
  const state = day([todo('reply', { state: 'done', source: slack('priya') })], [mention('priya')])
  const { after } = run(state, addSignal('priya', 'new'))
  expect(after.todos.map(({ id, state }) => [id, state])).toEqual([
    ['reply', 'done'],
    ['new', 'today'],
  ])
})

it('refuses to add a Waiting on', () => {
  const state = day(
    [],
    [mention('sam', { kind: 'waiting_on', who: 'Sam', text: 'owes you a review' })],
  )
  expect(run(state, addSignal('sam', 'new')).decision).toEqual({
    ok: false,
    reason: 'A Waiting on never becomes a Todo: it closes when they respond.',
  })
})

it('refuses a Signal it cannot find', () => {
  expect(run(day([]), addSignal('gone', 'new')).decision).toEqual({
    ok: false,
    reason: 'That Signal no longer exists.',
  })
})

it('leaves a cached read model that holds no Mentions alone when a patch is about one', () => {
  const state = { todos: [todo('spike')] }
  expect(apply(state, [{ type: 'signal.set', id: 'priya', set: { todoId: 'new' } }])).toBe(state)
})

// ── When the optimistic screen can be kept ────────────────────────────────────

/** What the browser guessed against its cache, for a command the Coordinator then decided. */
function guessFor(state: Today, input: Command): Op[] {
  const decision = decide(state, input, now)
  if (!decision.ok) throw new Error('expected the command to be accepted')
  return decision.ops
}

it("a Mention another tab added first leaves no guessed Todo behind: the Coordinator's empty patch does not cover the guess", () => {
  // The browser's cache still has the Mention unadded, so it guessed a whole new Todo.
  const guess = guessFor(day([], [mention('priya')]), addSignal('priya', 'new'))
  const coordinator: Op[] = []

  expect(covers(guess, coordinator)).toBe(false)
})

it("a Mention whose Source already has a Todo the browser never cached: the Coordinator's patch does not cover the guessed Todo", () => {
  const guess = guessFor(day([], [mention('priya')]), addSignal('priya', 'new'))
  // D1 holds a `backlog` Todo with that Source, which the day's cache never had.
  const coordinator = guessFor(
    day([todo('reply', { state: 'backlog', source: slack('priya') })], [mention('priya')]),
    addSignal('priya', 'new'),
  )

  expect(covers(guess, coordinator)).toBe(false)
  // The Mention was guessed right; it is the Todo the browser invented that is not there.
  expect(covers([guess[1]!], coordinator)).toBe(true)
})

it('the optimistic screen stands when the Coordinator touched every row the browser guessed', () => {
  const stack = day([todo('spike', { stackPosition: 1 })], [mention('priya')])
  for (const input of [
    add('new', 'Book dentist'),
    snooze('spike', 30),
    complete('spike'),
    addSignal('priya', 'new'),
  ]) {
    const guess = guessFor(stack, input)
    expect(covers(guess, guess)).toBe(true)
  }
})

it('the optimistic screen stands when the Coordinator touched rows the browser did not guess', () => {
  const guess = guessFor(day([todo('spike')]), complete('spike'))
  const alsoElsewhere: Op[] = [...guess, { type: 'todo.set', id: 'reply', set: { state: 'today' } }]

  expect(covers(guess, alsoElsewhere)).toBe(true)
})

it('a command the browser guessed nothing for is covered by whatever comes back', () => {
  expect(covers([], [])).toBe(true)
  expect(covers([], guessFor(day([todo('spike')]), complete('spike')))).toBe(true)
})

it('a Todo and a Mention that share an id are different rows', () => {
  const guess: Op[] = [{ type: 'todo.set', id: 'priya', set: { state: 'today' } }]
  const coordinator: Op[] = [{ type: 'signal.set', id: 'priya', set: { todoId: 'new' } }]

  expect(covers(guess, coordinator)).toBe(false)
})

it('offers only snoozes the command seam accepts', () => {
  for (const choice of SNOOZE_CHOICES) {
    expect(choice.minutes).toBeGreaterThanOrEqual(SNOOZE_MINUTES.min)
    expect(choice.minutes).toBeLessThanOrEqual(SNOOZE_MINUTES.max)
    expect(command.safeParse(snooze('spike', choice.minutes)).success).toBe(true)
  }
})
