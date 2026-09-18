import { z } from 'zod'
import type { Signal } from './today'
import {
  OPEN_TODO_STATES,
  type SignalKind,
  type Source,
  type TodayTodo,
  type TodoState,
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
}

/** What `decide` needs to know of a Signal. */
export type SignalFacts = Pick<Signal, 'id' | 'kind' | 'who' | 'text' | 'source' | 'todoId'>

/** The state a command is decided against: the rows it names, wherever they were loaded from. */
export interface CommandState {
  todos: readonly TodoFacts[]
  signals: readonly SignalFacts[]
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
    }
  }
  if (todos === state.todos && signals === state.signals) return state
  // The rows keep their own shapes; only the columns an operation names have changed.
  return { ...state, todos, ...(signals === state.signals ? {} : { signals }) } as S
}

/** The row an operation touches. Todo ids and Signal ids are separate namespaces. */
function rowTouched(each: Op): string {
  switch (each.type) {
    case 'todo.insert':
      return `todo:${each.todo.id}`
    case 'todo.set':
      return `todo:${each.id}`
    case 'signal.set':
      return `signal:${each.id}`
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
