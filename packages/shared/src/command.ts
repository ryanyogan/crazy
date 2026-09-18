import { z } from 'zod'
import { type DayEvent, LAST_HOUR, hoursIfSlottedAt, meetingHolds } from './timeline'
import { type Signal, formatHour } from './today'
import {
  OPEN_TODO_STATES,
  type SignalKind,
  type Source,
  type TodayTodo,
  type TodoState,
  isSnoozed,
  sameSource,
  source,
  todoState,
} from './todo'

// The command seam. Every change a user can make is a command; `decide` holds
// every domain rule and turns a command into patch operations; `apply` lays
// operations over state. The browser runs both against its cache for the
// optimistic update and the Coordinator runs the same two for the real one,
// which is what keeps the optimistic screen truthful. Neither reads the clock.

const id = z.string().min(1)
/** An hour of the day on the user's wall clock, which is what a Slot is one of. */
const hour = z.number().int().min(0).max(LAST_HOUR)
/** A user's local date: "2025-09-17", never a moment. */
const day = z.string().min(1)

/** How long a Todo can be snoozed for: at least a minute, at most a week. */
export const SNOOZE_MINUTES = { min: 1, max: 7 * 24 * 60 } as const

/** The snoozes a user is offered, in the words they are offered in. */
export const SNOOZE_CHOICES = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 24 * 60, label: '24 hours' },
] as const

export const command = z.discriminatedUnion('type', [
  z.object({ type: z.literal('todo.complete'), todoId: id }),
  // The browser names the new Todo, so its optimistic row and the real one are the same row.
  z.object({ type: z.literal('todo.add'), id, title: z.string().trim().min(1).max(500) }),
  z.object({
    type: z.literal('todo.snooze'),
    todoId: id,
    minutes: z.number().int().min(SNOOZE_MINUTES.min).max(SNOOZE_MINUTES.max),
  }),
  z.object({ type: z.literal('signal.add'), signalId: id, todoId: id }),
  // Slotting, and moving a Slot, are the same command: the Todo ends up holding
  // the hour named and no other, on the day the user is looking at.
  z.object({ type: z.literal('todo.slot'), todoId: id, hour }),
  z.object({ type: z.literal('todo.clearSlot'), todoId: id }),
])
export type Command = z.infer<typeof command>

/** What a command may change about a Todo. Moments are ISO strings: operations travel as JSON. */
export const todoChange = z
  .object({
    state: todoState,
    touchedAt: z.iso.datetime(),
    snoozedUntil: z.iso.datetime().nullable(),
    doneAt: z.iso.datetime().nullable(),
  })
  .partial()
export type TodoChange = z.infer<typeof todoChange>

/** A Todo as it is born: what a command decides, and what D1 stores. The rest starts empty. */
export const newTodo = z.object({
  id,
  title: z.string().min(1),
  state: todoState,
  source: source.nullable(),
  createdAt: z.iso.datetime(),
  touchedAt: z.iso.datetime(),
})
export type NewTodo = z.infer<typeof newTodo>

export const signalChange = z.object({ todoId: z.string().nullable() }).partial()
export type SignalChange = z.infer<typeof signalChange>

export const op = z.discriminatedUnion('type', [
  z.object({ type: z.literal('todo.set'), id, set: todoChange }),
  z.object({ type: z.literal('todo.insert'), todo: newTodo }),
  z.object({ type: z.literal('signal.set'), id, set: signalChange }),
  // Every Slot the Todo holds on that day, as a whole: laid twice it says the same.
  z.object({
    type: z.literal('slot.set'),
    todoId: id,
    day,
    hours: z.array(hour),
    /** When the Slots were given, which is what a new one is created at. */
    at: z.iso.datetime(),
  }),
])
export type Op = z.infer<typeof op>

/** What the Coordinator hands back and broadcasts: operations, stamped in the order they were committed. */
export const patch = z.object({ seq: z.number().int().positive(), ops: z.array(op) })
export type Patch = z.infer<typeof patch>

/** What `decide` needs to know of a Todo. */
export interface TodoFacts {
  id: string
  state: TodoState
  source: Source | null
  /** While this moment is still to come the Todo has left the day; null when not snoozed. */
  snoozedUntil: string | null
  /** The hours it holds a Slot on, on the day the state is of (`needsTheDay`). */
  slotHours: readonly number[]
}

/** What `decide` needs to know of a Signal. */
export type SignalFacts = Pick<Signal, 'id' | 'kind' | 'who' | 'text' | 'source' | 'todoId'>

/** The state a command is decided against: the rows it names, wherever they were loaded from. */
export interface CommandState {
  /** Which day it is on the user's wall clock: the day a Slot falls on. */
  day: string
  todos: readonly TodoFacts[]
  signals: readonly SignalFacts[]
  /** The day's calendar, so that a command cannot displace a meeting; empty unless `needsTheDay`. */
  events: readonly DayEvent[]
}

export type Decision = { ok: true; ops: Op[] } | { ok: false; reason: string }

const refuse = (reason: string): Decision => ({ ok: false, reason })

/**
 * The Todo ids a command needs loaded before it can be decided. A command that
 * adds a Signal also needs every open Todo with the Signal's Source; the loader
 * finds those from the Signal (`signalsNamed`).
 */
export function todosNamed(input: Command): string[] {
  switch (input.type) {
    case 'todo.complete':
    case 'todo.snooze':
    case 'todo.slot':
    case 'todo.clearSlot':
      return [input.todoId]
    case 'todo.add':
      return [input.id]
    case 'signal.add':
      return [input.todoId]
  }
}

/** The Signal ids a command needs loaded before it can be decided. */
export function signalsNamed(input: Command): string[] {
  switch (input.type) {
    case 'signal.add':
      return [input.signalId]
    default:
      return []
  }
}

/**
 * Whether a command plans the day's hours, and so is decided against the day
 * itself: the day's calendar and the Slots the Todos it names already hold.
 * The others are decided against the rows they name alone.
 */
export function needsTheDay(input: Command): boolean {
  return input.type === 'todo.slot' || input.type === 'todo.clearSlot'
}

/** What stands between a Todo and an hour, once there is something. */
type SlotBlock =
  | { why: 'state' }
  | { why: 'snoozed' }
  | { why: 'day-end' }
  | { why: 'meeting'; hour: number }

/** What the Todo is asking of the day, and what the day says back. */
type Slottable = Pick<TodoFacts, 'state' | 'snoozedUntil' | 'slotHours'>

function slotBlock(
  todo: Slottable,
  hour: number,
  events: readonly DayEvent[],
  now: Date,
): SlotBlock | null {
  if (todo.state !== 'today') return { why: 'state' }
  if (isSnoozed(todo, now)) return { why: 'snoozed' }
  const hours = hoursIfSlottedAt(todo, hour)
  if (hours.some((each) => each > LAST_HOUR)) return { why: 'day-end' }
  const taken = hours.find((each) => meetingHolds(events, each))
  return taken === undefined ? null : { why: 'meeting', hour: taken }
}

/**
 * Why the day cannot take a Todo at that hour, in a sentence, or null when it
 * can. The rule lives here and not in a component: `decide` refuses in these
 * words, and the screen says them to the user when a drop lands on an hour
 * that cannot take it.
 */
export function slotRefusal(
  todo: Slottable,
  hour: number,
  events: readonly DayEvent[],
  now: Date,
): string | null {
  const blocked = slotBlock(todo, hour, events, now)
  if (!blocked) return null
  switch (blocked.why) {
    case 'state':
      return 'Only a Todo in the Priority stack can be given a Slot.'
    case 'snoozed':
      return 'A snoozed Todo is out of the day until its snooze ends.'
    case 'day-end':
      return 'The day ends before that Todo would.'
    case 'meeting':
      return `${formatHour(blocked.hour)} is a meeting, and Crazy never moves a meeting.`
  }
}

/**
 * How one hour reads in a list of hours to choose from: the hour, and in a word
 * or two why it cannot take this Todo. The same rule as `slotRefusal`, said in
 * the room a picker has.
 */
export function hourChoice(
  todo: Slottable,
  hour: number,
  events: readonly DayEvent[],
  now: Date,
): string {
  const blocked = slotBlock(todo, hour, events, now)
  if (!blocked) return formatHour(hour)
  const brief =
    blocked.why === 'meeting'
      ? blocked.hour === hour
        ? 'a meeting'
        : `a meeting at ${formatHour(blocked.hour)}`
      : blocked.why === 'day-end'
        ? 'past the end of the day'
        : blocked.why === 'snoozed'
          ? 'snoozed'
          : 'not in the stack'
  return `${formatHour(hour)} — ${brief}`
}

/** The same hours, in the same order. */
const sameHours = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((each, index) => each === b[index])

/**
 * The operations that leave a Todo holding exactly `hours` on the day, and none
 * at all when it holds them already, so that slotting where it sits changes
 * nothing. Planning an hour is a touch (CONTEXT.md, "Touched"). Crazy's wording
 * for the hours is left alone: it simply stops describing an hour it was not
 * written for, and describes it again if the user puts it back (`timeline`).
 */
function slotOps(todo: TodoFacts, day: string, hours: number[], at: string): Op[] {
  const held = [...todo.slotHours].sort((a, b) => a - b)
  if (sameHours(held, hours)) return []
  return [
    { type: 'slot.set', todoId: todo.id, day, hours, at },
    { type: 'todo.set', id: todo.id, set: { touchedAt: at } },
  ]
}

/**
 * Nobody is a Todo yet: the Signal is worded by what it noticed until Crazy
 * writes better. A Waiting on never becomes a Todo, so it cannot be worded as one.
 */
export function todoTitleFor(
  signal: Pick<SignalFacts, 'who' | 'text'> & { kind: Exclude<SignalKind, 'waiting_on'> },
): string {
  switch (signal.kind) {
    case 'mention':
      return `Reply to ${signal.who}: ${signal.text}`
    case 'promise':
      return signal.text
  }
}

const isOpen = (todo: TodoFacts) => (OPEN_TODO_STATES as readonly TodoState[]).includes(todo.state)

export function decide(state: CommandState, input: Command, now: Date): Decision {
  const at = now.toISOString()
  switch (input.type) {
    case 'todo.complete': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      if (todo.state === 'archived') return refuse('An archived Todo cannot be completed.')
      // Ticked twice, or on two devices at once: it is done, which is what was asked.
      if (todo.state === 'done') return { ok: true, ops: [] }
      return {
        ok: true,
        ops: [{ type: 'todo.set', id: todo.id, set: { state: 'done', doneAt: at } }],
      }
    }

    case 'todo.add': {
      if (state.todos.some((each) => each.id === input.id))
        return refuse('That Todo already exists.')
      // Typed in: a One-off with no Source, in the day it was typed into. Creating is a touch.
      const todo: NewTodo = {
        id: input.id,
        title: input.title,
        state: 'today',
        source: null,
        createdAt: at,
        touchedAt: at,
      }
      return { ok: true, ops: [{ type: 'todo.insert', todo }] }
    }

    case 'todo.snooze': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      if (todo.state !== 'today') return refuse('Only a Todo in the Priority stack can be snoozed.')
      const until = new Date(now.getTime() + input.minutes * 60_000).toISOString()
      // Snoozing is a touch: a Todo put off on purpose is carried over, not sent back.
      return {
        ok: true,
        ops: [{ type: 'todo.set', id: todo.id, set: { snoozedUntil: until, touchedAt: at } }],
      }
    }

    case 'signal.add': {
      const signal = state.signals.find((each) => each.id === input.signalId)
      if (!signal) return refuse('That Signal no longer exists.')
      const { kind } = signal
      if (kind === 'waiting_on') {
        return refuse('A Waiting on never becomes a Todo: it closes when they respond.')
      }
      // Added twice, or on two devices at once: it is a Todo, which is what was asked.
      if (signal.todoId !== null) return { ok: true, ops: [] }
      // One Source, one open Todo: the Signal is that Todo's, and nothing new is made.
      const open = state.todos.find(
        (each) => isOpen(each) && each.source !== null && sameSource(each.source, signal.source),
      )
      if (open) {
        // Adding is the user deciding it enters their day, so a Todo waiting in the
        // backlog comes into it, and that move is a touch. One already in `today` is
        // left alone: attaching a Mention to it is not a touch (CONTEXT.md, "Touched").
        const enters: Op[] =
          open.state === 'backlog'
            ? [{ type: 'todo.set', id: open.id, set: { state: 'today', touchedAt: at } }]
            : []
        return {
          ok: true,
          ops: [...enters, { type: 'signal.set', id: signal.id, set: { todoId: open.id } }],
        }
      }
      if (state.todos.some((each) => each.id === input.todoId)) {
        return refuse('That Todo already exists.')
      }
      const todo: NewTodo = {
        id: input.todoId,
        title: todoTitleFor({ ...signal, kind }),
        state: 'today',
        source: signal.source,
        createdAt: at,
        touchedAt: at,
      }
      return {
        ok: true,
        ops: [
          { type: 'todo.insert', todo },
          { type: 'signal.set', id: signal.id, set: { todoId: todo.id } },
        ],
      }
    }

    case 'todo.slot': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      const refusal = slotRefusal(todo, input.hour, state.events, now)
      if (refusal) return refuse(refusal)
      return { ok: true, ops: slotOps(todo, state.day, hoursIfSlottedAt(todo, input.hour), at) }
    }

    case 'todo.clearSlot': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      // A Todo that has left the day has nothing to take off it, and must not be
      // touched by the asking: a touch would change what the Rollover does with
      // it. A snoozed Todo is still in `today`, and can be taken off its hour.
      if (todo.state !== 'today') return { ok: true, ops: [] }
      return { ok: true, ops: slotOps(todo, state.day, [], at) }
    }
  }
}

/** A Todo as read models hold it, the moment it is born. */
function born(todo: NewTodo): TodayTodo {
  return {
    ...todo,
    project: null,
    estimateMinutes: null,
    energy: null,
    carryCount: 0,
    stackPosition: null,
    reason: null,
    slotHours: [],
    snoozedUntil: null,
    doneAt: null,
  }
}

/** What a patch is laid over: the Today read model, the one cached state that holds Todos. */
export interface Applicable {
  todos: readonly TodayTodo[]
  signals?: readonly { id: string; todoId: string | null }[]
  /** The day these rows are of; a state that does not say which cannot hold Slots. */
  day?: string
}

/**
 * Lays operations over any state that holds Todos, and returns the new state.
 * An operation on a row the state does not hold changes nothing, so a patch
 * can be applied to every cached read model without asking which it concerns;
 * and inserting a row the state already holds replaces it, so a patch applied
 * twice (once as the answer to a command, once over the socket) ends the same.
 */
export function apply<S extends Applicable>(state: S, ops: readonly Op[]): S {
  let todos = state.todos
  let signals = state.signals
  for (const each of ops) {
    switch (each.type) {
      case 'todo.set':
        todos = todos.map((todo) => (todo.id === each.id ? { ...todo, ...each.set } : todo))
        break
      case 'todo.insert': {
        const row = born(each.todo)
        todos = todos.some((todo) => todo.id === row.id)
          ? todos.map((todo) => (todo.id === row.id ? row : todo))
          : [...todos, row]
        break
      }
      case 'signal.set':
        signals = signals?.map((signal) =>
          signal.id === each.id ? { ...signal, ...each.set } : signal,
        )
        break
      // Slots belong to one day, so a state of another day (or one that does
      // not say which) is left alone.
      case 'slot.set': {
        if (state.day !== each.day) break
        const held = todos.find((todo) => todo.id === each.todoId)
        // A Todo the state does not hold, or one already on those hours, leaves
        // the cache as it is: an applied patch must not churn what nothing read.
        if (!held || sameHours(held.slotHours, each.hours)) break
        todos = todos.map((todo) =>
          todo.id === each.todoId ? { ...todo, slotHours: [...each.hours] } : todo,
        )
      }
    }
  }
  if (todos === state.todos && signals === state.signals) return state
  // The rows keep their own shapes; only the columns an operation names have changed.
  return { ...state, todos, ...(signals === state.signals ? {} : { signals }) } as S
}

/**
 * Whether operations name a day other than the one a cached state is of. A Slot
 * written on another day is how a tab learns that the user's day has turned
 * over while it was open: `apply` rightly leaves such an operation alone, and
 * what the tab is showing is yesterday, so it reads everything again.
 */
export function namesAnotherDay(state: Pick<Applicable, 'day'>, ops: readonly Op[]): boolean {
  const { day } = state
  if (day === undefined) return false
  return ops.some((each) => each.type === 'slot.set' && each.day !== day)
}

/**
 * The row an operation touches. Todo ids and Signal ids are separate
 * namespaces, and a Todo's Slots on one day are a row of their own.
 */
function rowTouched(each: Op): string {
  switch (each.type) {
    case 'todo.insert':
      return `todo:${each.todo.id}`
    case 'todo.set':
      return `todo:${each.id}`
    case 'signal.set':
      return `signal:${each.id}`
    case 'slot.set':
      return `slot:${each.todoId}:${each.day}`
  }
}

/**
 * Whether every row the browser's guess touched is touched by `ops` too. The
 * browser decides against its cache, which does not hold everything D1 does
 * (a `backlog` Todo, say), so the Coordinator may rightly decide fewer or
 * other operations: the browser guesses `todo.insert` + `signal.set` for a
 * Mention, and the Coordinator answers `[]` (another tab added it first) or
 * the `signal.set` alone (the Source already has an open Todo). Laying that
 * patch over the optimistic cache leaves the guessed Todo behind, so when the
 * patch does not cover the guess the browser must fetch the truth instead.
 */
export function covers(guess: readonly Op[], ops: readonly Op[]): boolean {
  const touched = new Set(ops.map(rowTouched))
  return guess.every((each) => touched.has(rowTouched(each)))
}

/** What the Coordinator answers a command with. A refusal is an answer, not a failure. */
export type CommandResult = { ok: true; patch: Patch } | { ok: false; reason: string }
