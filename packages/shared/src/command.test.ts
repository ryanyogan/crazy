import { expect, it } from 'vite-plus/test'
import {
  type Command,
  type CommandState,
  type Op,
  SNOOZE_CHOICES,
  SNOOZE_MINUTES,
  apply,
  command,
  covers,
  decide,
  hourChoice,
  namesAnotherDay,
  namesUnknownWork,
} from './command'
import type { DayEvent, HourWording } from './timeline'
import type { TimeEntryFacts, TimerEntry, TodayTimer } from './timer'
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
    startedAt: null,
    swappedOnDay: null,
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
  return {
    day: '2025-09-17',
    brief: null,
    todos,
    events: [],
    hours: [],
    signals,
    sentBack: 0,
    timer: null,
  }
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

it('turns every Promise that is not already a Todo into one, and leaves the rest alone', () => {
  const promise = (id: string, text: string, fields: Partial<Signal> = {}) =>
    mention(id, { kind: 'promise', text, ...fields })
  const state = day(
    [todo('runbook', { source: slack('design') })],
    [
      // One still to make, one the user added earlier, and one whose Source
      // already has an open Todo — which is that Todo, not a second one.
      promise('priya', 'Send the rate-limit numbers'),
      promise('landlord', 'Reply about key handover', { todoId: 'keys' }),
      promise('design', 'Share the migration runbook'),
    ],
  )

  const { decision, after } = run(state, {
    type: 'signal.addAll',
    adds: [
      { signalId: 'priya', todoId: 'made-1' },
      { signalId: 'landlord', todoId: 'made-2' },
      { signalId: 'design', todoId: 'made-3' },
    ],
  })

  expect(decision.ok).toBe(true)
  // One Todo made, for the one Promise that needed one. The added Promise
  // decides nothing at all, and the third is marked as the Todo it already is.
  expect(after.todos.map(({ id }) => id)).toEqual(['runbook', 'made-1'])
  expect(after.signals.map(({ id, todoId }) => [id, todoId])).toEqual([
    ['priya', 'made-1'],
    ['landlord', 'keys'],
    ['design', 'runbook'],
  ])
  expect(after.todos[1]).toMatchObject({ title: 'Send the rate-limit numbers', state: 'today' })
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

// ── Give a Todo a Slot ────────────────────────────────────────────────────────

const slot = (todoId: string, hour: number): Command => ({ type: 'todo.slot', todoId, hour })
const clearSlot = (todoId: string): Command => ({ type: 'todo.clearSlot', todoId })

const event = (kind: DayEvent['kind'], title: string, from: number, until: number): DayEvent => ({
  id: title,
  kind,
  title,
  who: null,
  from,
  until,
})

/** Frame 1a's calendar: the standup has half of 11:00, the design review all of 14:00. */
const CALENDAR: DayEvent[] = [
  event('focus', 'Focus', 9 * 60, 11 * 60),
  event('meeting', 'Platform standup', 11 * 60, 11 * 60 + 30),
  event('meeting', 'Onboarding design review', 14 * 60, 15 * 60),
]

/** Crazy's words for an hour, written for the Todos that held it at the time. */
const worded = (hour: number, title: string, writtenFor: string[] = []): HourWording => ({
  hour,
  title,
  note: null,
  source: null,
  writtenFor,
})

/** The day with its calendar and the hours Crazy worded this morning. */
function planned(todos: TodayTodo[], hours: HourWording[] = []): Today {
  return { ...day(todos), events: CALENDAR, hours }
}

const hourOf = (state: Today, hour: number) =>
  view(state).timeline.find((each) => each.hour === hour)

it('gives a Todo a Slot on a free hour, touches it, and words the hour by what it now holds', () => {
  const state = planned(
    [todo('dentist', { title: 'Book dentist', stackPosition: 7 })],
    [worded(8, 'Brief · inbox skim')],
  )

  const { decision, after } = run(state, slot('dentist', 8))

  expect(decision).toEqual({
    ok: true,
    ops: [
      { type: 'slot.set', todoId: 'dentist', day: '2025-09-17', hours: [8], at: now.toISOString() },
      { type: 'todo.set', id: 'dentist', set: { touchedAt: now.toISOString() } },
    ],
  })
  expect(after.todos[0]).toMatchObject({ slotHours: [8], touchedAt: now.toISOString() })
  // Crazy worded 08:00 for an hour with nothing on it. It holds a Todo now, so
  // the words step aside — they are not thrown away.
  expect(hourOf(after, 8)).toMatchObject({ kind: 'slotted', title: 'Book dentist' })
  expect(after.hours).toEqual(state.hours)
})

it('moves a Todo to another hour, leaving the one it held free', () => {
  const state = planned(
    [todo('deposit', { title: 'Send movers deposit', slotHours: [17] })],
    [worded(17, 'Send movers deposit · follow-ups', ['deposit'])],
  )

  const { decision, after } = run(state, slot('deposit', 12))

  expect(decision.ok && decision.ops).toEqual([
    { type: 'slot.set', todoId: 'deposit', day: '2025-09-17', hours: [12], at: now.toISOString() },
    { type: 'todo.set', id: 'deposit', set: { touchedAt: now.toISOString() } },
  ])
  expect(hourOf(after, 12)).toMatchObject({ kind: 'slotted', title: 'Send movers deposit' })
  expect(hourOf(after, 17)).toMatchObject({ kind: 'free', title: 'Free' })
})

it("puts Crazy's wording back when a Todo is moved away and then back again", () => {
  const words = 'Send movers deposit · follow-ups'
  const state = planned(
    [todo('deposit', { title: 'Send movers deposit', slotHours: [17] })],
    [worded(17, words, ['deposit'])],
  )

  const moved = run(state, slot('deposit', 8)).after
  expect(hourOf(moved, 17)).toMatchObject({ title: 'Free' })

  const back = run(moved, slot('deposit', 17)).after
  expect(hourOf(back, 17)).toMatchObject({ kind: 'slotted', title: words })
})

it('keeps a Todo as many hours long as it was when it is moved', () => {
  const state = planned([todo('spike', { title: 'Spike', slotHours: [9, 10] })])

  const { after } = run(state, slot('spike', 12))

  expect(after.todos[0]?.slotHours).toEqual([12, 13])
  expect(hourOf(after, 12)?.title).toBe('Spike')
  expect(hourOf(after, 13)?.title).toBe('↳ Spike')
  // The focus block it left is named again, now that nothing is in it.
  expect(hourOf(after, 9)).toMatchObject({ kind: 'focus', title: 'Focus' })
})

it('takes a Todo off the day, and the Take on now loses the hours it fitted', () => {
  const state = planned(
    [todo('spike', { stackPosition: 1, slotHours: [9, 10] })],
    [worded(9, 'Finish Cloudflare session-token spike', ['spike'])],
  )
  expect(view(state).takeOnNow?.hours).toEqual({ from: 9, until: 11 })

  const { decision, after } = run(state, clearSlot('spike'))

  expect(decision).toEqual({
    ok: true,
    ops: [
      { type: 'slot.set', todoId: 'spike', day: '2025-09-17', hours: [], at: now.toISOString() },
      { type: 'todo.set', id: 'spike', set: { touchedAt: now.toISOString() } },
    ],
  })
  expect(after.todos[0]?.slotHours).toEqual([])
  expect(view(after).takeOnNow).toMatchObject({ todo: { id: 'spike' }, hours: null })
  expect(hourOf(after, 9)).toMatchObject({ kind: 'focus', title: 'Focus' })
})

it('frees the hour of a Todo that is completed or snoozed, worded as any free hour is', () => {
  const words = 'Send movers deposit · follow-ups'
  const state = planned(
    [todo('deposit', { title: 'Send movers deposit', slotHours: [17] })],
    [worded(17, words, ['deposit'])],
  )
  expect(hourOf(state, 17)).toMatchObject({ kind: 'slotted', title: words })

  // One hour, freed three ways, reads the same way each time.
  const freed = { kind: 'free', title: 'Free' }
  expect(hourOf(run(state, complete('deposit')).after, 17)).toMatchObject(freed)
  expect(hourOf(run(state, clearSlot('deposit')).after, 17)).toMatchObject(freed)
  const snoozed = run(state, snooze('deposit', 30)).after
  expect(hourOf(snoozed, 17)).toMatchObject(freed)

  // And when the snooze ends, the Todo is back on its hour in Crazy's words.
  const later = new Date(now.getTime() + 31 * 60_000)
  expect(
    viewToday(snoozed, later, timeZone).timeline.find((each) => each.hour === 17),
  ).toMatchObject({ kind: 'slotted', title: words })
})

it('refuses an hour a meeting fills, and takes one it only half fills', () => {
  const state = planned([todo('dentist')])

  expect(run(state, slot('dentist', 14)).decision).toEqual({
    ok: false,
    reason: '14:00 is a meeting, and Crazy never moves a meeting.',
  })
  // The standup ends at 11:30, so the rest of the hour is the user's, as frame
  // 1a's own 16:00 is: the 1:1 at 16:30 shares it with "Prep 1:1 notes".
  expect(run(state, slot('dentist', 11)).decision).toMatchObject({ ok: true })
})

it('refuses an hour that two meetings fill between them', () => {
  const backToBack: Today = {
    ...planned([todo('dentist')]),
    events: [
      event('meeting', 'Platform standup', 8 * 60, 8 * 60 + 30),
      event('meeting', 'Handover', 8 * 60 + 30, 9 * 60),
    ],
  }

  expect(run(backToBack, slot('dentist', 8)).decision).toEqual({
    ok: false,
    reason: '08:00 is a meeting, and Crazy never moves a meeting.',
  })
})

it('refuses to move a Todo onto hours a meeting would take the second of', () => {
  const state = planned([todo('spike', { slotHours: [9, 10] })])

  expect(run(state, slot('spike', 13)).decision).toEqual({
    ok: false,
    reason: '14:00 is a meeting, and Crazy never moves a meeting.',
  })
  expect(run(state, slot('spike', 12)).decision).toMatchObject({ ok: true })
})

it('refuses to give a Slot to a Todo that is not in the Priority stack', () => {
  const reason = 'Only a Todo in the Priority stack can be given a Slot.'
  expect(
    run(planned([todo('someday', { state: 'backlog' })]), slot('someday', 8)).decision,
  ).toEqual({ ok: false, reason })
  expect(run(planned([todo('finished', { state: 'done' })]), slot('finished', 8)).decision).toEqual(
    {
      ok: false,
      reason,
    },
  )
  expect(run(planned([]), slot('gone', 8)).decision).toEqual({
    ok: false,
    reason: 'That Todo no longer exists.',
  })
})

it('refuses to plan an hour for a snoozed Todo, which has left the day', () => {
  const until = new Date(now.getTime() + 30 * 60_000).toISOString()
  const state = planned([todo('spike', { snoozedUntil: until })])

  expect(run(state, slot('spike', 8)).decision).toEqual({
    ok: false,
    reason: 'A snoozed Todo is out of the day until its snooze ends.',
  })
  // Taking it off the day is still allowed: the user is saying they are not doing it then.
  expect(
    run(planned([todo('spike', { snoozedUntil: until, slotHours: [9] })]), clearSlot('spike'))
      .decision,
  ).toMatchObject({ ok: true })
})

it('touches nothing when a Todo that has left the day is taken off its hour', () => {
  // A completed Todo keeps its Slots, and asking to clear them must not stamp
  // it as touched: that would change what the Rollover does with it.
  for (const state of ['done', 'backlog', 'archived'] as const) {
    expect(
      run(planned([todo('gone', { state, slotHours: [17] })]), clearSlot('gone')).decision,
    ).toEqual({ ok: true, ops: [] })
  }
})

it('names an hour in a list to pick from, and says in a word or two why it is refused', () => {
  const dentist = todo('dentist')
  const spike = todo('spike', { slotHours: [9, 10] })
  const ask = (each: TodayTodo, hour: number) => hourChoice(each, hour, CALENDAR, now)

  expect(ask(dentist, 8)).toBe('08:00')
  expect(ask(dentist, 11)).toBe('11:00')
  expect(ask(dentist, 14)).toBe('14:00 — a meeting')
  // A two-hour Todo is refused by the hour after the one offered, and says which.
  expect(ask(spike, 13)).toBe('13:00 — a meeting at 14:00')
  expect(ask(spike, 23)).toBe('23:00 — past the end of the day')
})

it('refuses a Slot that would run past the end of the day', () => {
  const state = planned([todo('spike', { slotHours: [9, 10] })])
  expect(run(state, slot('spike', 23)).decision).toEqual({
    ok: false,
    reason: 'The day ends before that Todo would.',
  })
  expect(command.safeParse(slot('spike', 24)).success).toBe(false)
  expect(command.safeParse(slot('spike', -1)).success).toBe(false)
  expect(command.safeParse(slot('spike', 8.5)).success).toBe(false)
})

it('changes nothing when a Todo is dropped on the hour it already holds', () => {
  const state = planned(
    [todo('deposit', { slotHours: [17] })],
    [worded(17, 'Send movers deposit', ['deposit'])],
  )
  const { decision, after } = run(state, slot('deposit', 17))

  expect(decision).toEqual({ ok: true, ops: [] })
  expect(after).toBe(state)
  // And a Todo with no Slot that is taken off the day is left as it is.
  expect(run(planned([todo('dentist')]), clearSlot('dentist')).decision).toEqual({
    ok: true,
    ops: [],
  })
})

it('leaves a Todo holding the same hours however many times the patch is applied', () => {
  const state = planned(
    [todo('deposit', { slotHours: [17] })],
    [worded(17, 'Movers deposit', ['deposit'])],
  )
  const decision = decide(state, slot('deposit', 12), now)
  if (!decision.ok) throw new Error('expected the command to be accepted')

  const once = apply(state, decision.ops)
  expect(apply(once, decision.ops)).toEqual(once)
  // The Slots laid a second time do not even make a new state for the screen to read.
  expect(
    apply(
      once,
      decision.ops.filter((each) => each.type === 'slot.set'),
    ),
  ).toBe(once)
  expect(once.todos[0]?.slotHours).toEqual([12])
  // Every word Crazy wrote is still there; 17:00 simply no longer holds the Todo.
  expect(once.hours).toEqual(state.hours)
})

it('leaves a cached day other than the one a Slot was given on alone, and says so', () => {
  const state = planned(
    [todo('deposit', { slotHours: [17] })],
    [worded(17, 'Movers deposit', ['deposit'])],
  )
  const tomorrow: Op[] = [
    { type: 'slot.set', todoId: 'deposit', day: '2025-09-18', hours: [9], at: now.toISOString() },
  ]

  expect(apply(state, tomorrow)).toBe(state)
  // A tab left open across midnight is showing yesterday. That it cannot apply
  // the operation is how it learns so, and reads everything again.
  expect(namesAnotherDay(state, tomorrow)).toBe(true)
  expect(namesAnotherDay(state, guessFor(state, slot('deposit', 12)))).toBe(false)
  // A cached state that does not say which day it holds asks nothing of a Slot.
  expect(namesAnotherDay({}, tomorrow)).toBe(false)
})

// ── Start and Swap the Take on now ────────────────────────────────────────────

const start = (todoId: string): Command => ({ type: 'todo.start', todoId })
const swap = (todoId: string): Command => ({ type: 'todo.swap', todoId })

/** Frame 1a's stack, as far down as these tests look. */
const offered = () =>
  day([
    todo('spike', { stackPosition: 1, slotHours: [9, 10] }),
    todo('reply', { stackPosition: 2, slotHours: [12] }),
    todo('pr', { stackPosition: 3 }),
  ])

it('starts the Take on now: it is under way, touched, and still the Take on now', () => {
  const state = offered()
  const { decision, after } = run(state, start('spike'))

  expect(decision).toEqual({
    ok: true,
    ops: [
      {
        type: 'todo.set',
        id: 'spike',
        set: { startedAt: now.toISOString(), touchedAt: now.toISOString() },
      },
    ],
  })
  expect(after.todos[0]).toMatchObject({
    state: 'today',
    startedAt: now.toISOString(),
    touchedAt: now.toISOString(),
  })
  // Taking something on does not move it, and the card now draws its started state.
  expect(view(after).stack.map(({ id }) => id)).toEqual(['spike', 'reply', 'pr'])
  expect(view(after).takeOnNow).toMatchObject({ todo: { id: 'spike' }, started: true })
})

it('swaps the Take on now: the next fitting Todo takes its place, one place above it', () => {
  const state = offered()
  expect(view(state).takeOnNow?.todo.id).toBe('spike')

  const { decision, after } = run(state, swap('spike'))

  expect(decision).toEqual({
    ok: true,
    ops: [{ type: 'todo.set', id: 'spike', set: { swappedOnDay: '2025-09-17' } }],
  })
  // The next fitting Todo is the Take on now, with the hours it fits.
  expect(view(after).takeOnNow).toMatchObject({
    todo: { id: 'reply' },
    hours: { from: 12, until: 13 },
  })
  // The declined one sits one place lower, and no lower than that.
  expect(view(after).stack.map(({ id }) => id)).toEqual(['reply', 'spike', 'pr'])
})

it('changes no state and does not touch a Todo that is swapped', () => {
  const touchedAt = '2025-09-16T09:00:00.000Z'
  const { after } = run(day([todo('spike', { stackPosition: 1, touchedAt })]), swap('spike'))

  // Dodging something all day is not engaging with it: the Rollover must still
  // send it back (CONTEXT.md, "Swap" and "Touched").
  expect(after.todos[0]).toMatchObject({ state: 'today', touchedAt, doneAt: null })
})

it('keeps a swapped Todo lowered for the rest of that local day, and no further', () => {
  const { after } = run(offered(), swap('spike'))
  const order = (moment: Date) => viewToday(after, moment, timeZone).stack.map(({ id }) => id)
  const offers = (moment: Date) => viewToday(after, moment, timeZone).takeOnNow?.todo.id

  // Later the same day it is still a place lower and still not on offer.
  const evening = new Date('2025-09-18T02:30:00.000Z') // 21:30 on Ryan's wall clock
  expect(order(evening)).toEqual(['reply', 'spike', 'pr'])
  expect(offers(evening)).toBe('reply')

  // Past the user's own midnight it is back at the top, offered again.
  const tomorrow = new Date('2025-09-18T13:41:00.000Z')
  expect(order(tomorrow)).toEqual(['spike', 'reply', 'pr'])
  expect(offers(tomorrow)).toBe('spike')
})

it('leaves no Take on now card when the last fitting Todo is swapped', () => {
  const alone = day([todo('spike', { stackPosition: 1 })])
  const { after } = run(alone, swap('spike'))

  // It is still in the stack — its state did not change — but nothing is offered.
  expect(view(after).stack.map(({ id }) => id)).toEqual(['spike'])
  expect(view(after).takeOnNow).toBeNull()
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

it('a Slot another tab had already given is read again rather than left as guessed', () => {
  // The browser's cache has the deposit at 17:00, so it guesses a move; D1 has
  // it at 08:00 already, where another tab dropped it, so the Coordinator finds
  // nothing to do. The browser must not be left holding its own guess.
  const guess = guessFor(planned([todo('deposit', { slotHours: [17] })]), slot('deposit', 8))
  const coordinator = decide(
    planned([todo('deposit', { slotHours: [8] })]),
    slot('deposit', 8),
    now,
  )

  expect(coordinator).toEqual({ ok: true, ops: [] })
  expect(covers(guess, coordinator.ok ? coordinator.ops : [])).toBe(false)
})

it('a Slot moved to another hour than the browser guessed needs no second read', () => {
  // Both name the same rows — the Todo's Slots for the day, and the Todo — so
  // laying the Coordinator's word over the guess is enough to be right.
  const guess = guessFor(planned([todo('deposit', { slotHours: [17] })]), slot('deposit', 8))
  const coordinator = guessFor(planned([todo('deposit', { slotHours: [16] })]), slot('deposit', 8))

  expect(covers(guess, coordinator)).toBe(true)
})

it('a Todo and its Slots are different rows', () => {
  const guess: Op[] = [
    { type: 'slot.set', todoId: 'spike', day: '2025-09-17', hours: [8], at: now.toISOString() },
  ]
  const coordinator: Op[] = [
    { type: 'todo.set', id: 'spike', set: { touchedAt: now.toISOString() } },
  ]

  expect(covers(guess, coordinator)).toBe(false)
})

it('the optimistic screen stands when the Coordinator touched every row the browser guessed', () => {
  const stack: Today = {
    ...planned([todo('spike', { stackPosition: 1, slotHours: [9, 10] })]),
    signals: [mention('priya')],
  }
  for (const input of [
    add('new', 'Book dentist'),
    snooze('spike', 30),
    complete('spike'),
    addSignal('priya', 'new'),
    slot('spike', 12),
    clearSlot('spike'),
    start('spike'),
    swap('spike'),
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

// ── The timer ───────────────────────────────────────────────────────────────
// Cori's moment: the same Wednesday, 10:42 on her wall clock, 1h 42m into
// Meridian's synthesis (frame 3a).

const MERIDIAN = 'client/meridian'
const DISCOVERY = 'project/discovery'

/** The world a timer command is decided against: who is running, and whose work is whose. */
function timing(entries: TimeEntryFacts[], fields: Partial<CommandState> = {}): CommandState {
  return {
    day: '2025-09-17',
    todos: [],
    signals: [],
    events: [],
    billing: true,
    timeEntries: entries,
    projects: [{ id: DISCOVERY, clientId: MERIDIAN }],
    clients: [{ id: MERIDIAN }],
    ...fields,
  }
}

const running = (id = 'entry/wed'): TimeEntryFacts => ({
  id,
  clientId: MERIDIAN,
  projectId: DISCOVERY,
  endedAt: null,
})

const startTimer = (fields: Partial<Extract<Command, { type: 'timer.start' }>> = {}): Command => ({
  type: 'timer.start',
  id: 'entry/new',
  clientId: MERIDIAN,
  projectId: DISCOVERY,
  ...fields,
})

it('starts the timer: a Time entry with no end, begun at the moment of the command', () => {
  const decision = decide(timing([]), startTimer(), now)

  expect(decision).toEqual({
    ok: true,
    ops: [
      {
        type: 'timeEntry.insert',
        entry: {
          id: 'entry/new',
          clientId: MERIDIAN,
          projectId: DISCOVERY,
          todoId: null,
          note: '',
          billable: true,
          startedAt: now.toISOString(),
          createdAt: now.toISOString(),
        },
      },
    ],
  })
})

it('refuses to start a second timer while one runs, rather than stopping it quietly', () => {
  const decision = decide(timing([running()]), startTimer(), now)

  expect(decision).toEqual({
    ok: false,
    reason: 'A timer is already running. Stop it before starting another.',
  })
})

it('tracks work for no Client as Internal, and does not call it billable', () => {
  const decision = decide(timing([]), startTimer({ clientId: null, projectId: null }), now)

  expect(decision.ok && decision.ops[0]).toMatchObject({
    type: 'timeEntry.insert',
    entry: { clientId: null, projectId: null, billable: false },
  })
})

it('takes the Client from the Project, and refuses a Client that contradicts it', () => {
  const fromProject = decide(timing([]), startTimer({ clientId: null }), now)
  expect(fromProject.ok && fromProject.ops[0]).toMatchObject({
    entry: { clientId: MERIDIAN, projectId: DISCOVERY },
  })

  const contradicting = decide(timing([]), startTimer({ clientId: 'client/quill' }), now)
  expect(contradicting).toEqual({
    ok: false,
    reason: "That Client is not the Project's Client.",
  })
})

it('stops the running timer at the moment of the command', () => {
  const decision = decide(timing([running()]), { type: 'timer.stop' }, now)

  expect(decision).toEqual({
    ok: true,
    ops: [{ type: 'timeEntry.set', id: 'entry/wed', set: { endedAt: now.toISOString() } }],
  })
})

it('refuses to stop when nothing is running, rather than inventing an entry to end', () => {
  const stopped: TimeEntryFacts = { ...running(), endedAt: '2025-09-17T15:00:00.000Z' }

  expect(decide(timing([stopped]), { type: 'timer.stop' }, now)).toEqual({
    ok: false,
    reason: 'No timer is running.',
  })
})

it("words the running entry, and refuses to word an entry that is not the user's", () => {
  const state = timing([running()])
  const note = (entryId: string): Command => ({
    type: 'timer.setNote',
    entryId,
    note: 'Interviews 4–7',
  })

  expect(decide(state, note('entry/wed'), now)).toEqual({
    ok: true,
    ops: [{ type: 'timeEntry.set', id: 'entry/wed', set: { note: 'Interviews 4–7' } }],
  })
  expect(decide(state, note('entry/somebody-elses'), now)).toEqual({
    ok: false,
    reason: 'That Time entry is not one of yours.',
  })
})

it('refuses every timer command with the Billing module off: there is no timer', () => {
  const off = timing([running()], { billing: false })
  const commands: Command[] = [
    startTimer(),
    { type: 'timer.stop' },
    { type: 'timer.setNote', entryId: 'entry/wed', note: 'anything' },
  ]

  for (const input of commands) {
    expect(decide(off, input, now)).toEqual({
      ok: false,
      reason: 'The timer belongs to the Billing module, which is off.',
    })
  }
})

it('lays a started and stopped timer over the bar the browser is showing', () => {
  const was: TimerEntry = {
    id: 'entry/tue',
    clientId: MERIDIAN,
    clientName: 'Meridian Health',
    projectId: DISCOVERY,
    projectName: 'Discovery research',
    note: 'Interviews 2–3',
    billable: true,
    startedAt: '2025-09-16T14:00:00.000Z',
    endedAt: '2025-09-16T17:00:00.000Z',
  }
  const bar: TodayTimer = { running: null, last: was, today: [] }

  const started = decide(timing([]), startTimer(), now)
  const afterStart = apply({ timer: bar }, started.ok ? started.ops : [])
  expect(afterStart.timer?.running).toMatchObject({
    id: 'entry/new',
    // The patch carries ids; the names come from what the browser already held.
    clientName: 'Meridian Health',
    projectName: 'Discovery research',
    endedAt: null,
  })

  const stopped = decide(timing([running('entry/new')]), { type: 'timer.stop' }, now)
  const afterStop = apply(afterStart, stopped.ok ? stopped.ops : [])
  expect(afterStop.timer?.running).toBe(null)
  expect(afterStop.timer?.last).toMatchObject({ id: 'entry/new', endedAt: now.toISOString() })
})

it('reads the day again when a patch starts a timer on work this browser cannot name', () => {
  const bar: TodayTimer = { running: null, last: null, today: [] }
  const ops = decide(timing([]), startTimer(), now)

  expect(ops.ok && namesUnknownWork({ timer: bar }, ops.ops)).toBe(true)
  // With the Billing module off there is no bar to catch up, and nothing to read.
  expect(ops.ok && namesUnknownWork({ timer: null }, ops.ops)).toBe(false)
})
