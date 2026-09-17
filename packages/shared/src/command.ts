import { z } from 'zod'
import { type TodoState, todoState } from './todo'

// The command seam. Every change a user can make is a command; `decide` holds
// every domain rule and turns a command into patch operations; `apply` lays
// operations over state. The browser runs both against its cache for the
// optimistic update and the Coordinator runs the same two for the real one,
// which is what keeps the optimistic screen truthful. Neither reads the clock.

export const command = z.discriminatedUnion('type', [
  z.object({ type: z.literal('todo.complete'), todoId: z.string().min(1) }),
])
export type Command = z.infer<typeof command>

/** What a command may change about a Todo. Moments are ISO strings: operations travel as JSON. */
export const todoChange = z
  .object({
    state: todoState,
    doneAt: z.iso.datetime().nullable(),
  })
  .partial()
export type TodoChange = z.infer<typeof todoChange>

export const op = z.discriminatedUnion('type', [
  z.object({ type: z.literal('todo.set'), id: z.string(), set: todoChange }),
])
export type Op = z.infer<typeof op>

/** What the Coordinator hands back and broadcasts: operations, stamped in the order they were committed. */
export const patch = z.object({ seq: z.number().int().positive(), ops: z.array(op) })
export type Patch = z.infer<typeof patch>

/** What `decide` needs to know of a Todo. */
export interface TodoFacts {
  id: string
  state: TodoState
}

/** The state a command is decided against: the rows it names, wherever they were loaded from. */
export interface CommandState {
  todos: readonly TodoFacts[]
}

export type Decision = { ok: true; ops: Op[] } | { ok: false; reason: string }

const refuse = (reason: string): Decision => ({ ok: false, reason })

/** The Todo ids a command needs loaded before it can be decided. */
export function todosNamed(input: Command): string[] {
  switch (input.type) {
    case 'todo.complete':
      return [input.todoId]
  }
}

export function decide(state: CommandState, input: Command, now: Date): Decision {
  switch (input.type) {
    case 'todo.complete': {
      const todo = state.todos.find((each) => each.id === input.todoId)
      if (!todo) return refuse('That Todo no longer exists.')
      if (todo.state === 'archived') return refuse('An archived Todo cannot be completed.')
      // Ticked twice, or on two devices at once: it is done, which is what was asked.
      if (todo.state === 'done') return { ok: true, ops: [] }
      return {
        ok: true,
        ops: [{ type: 'todo.set', id: todo.id, set: { state: 'done', doneAt: now.toISOString() } }],
      }
    }
  }
}

/**
 * Lays operations over any state that holds Todos, and returns the new state.
 * An operation on a row the state does not hold changes nothing, so a patch
 * can be applied to every cached read model without asking which it concerns.
 */
export function apply<T extends { id: string }, S extends { todos: readonly T[] }>(
  state: S,
  ops: readonly Op[],
): S {
  let todos = state.todos
  for (const each of ops) {
    switch (each.type) {
      case 'todo.set':
        todos = todos.map((todo) => (todo.id === each.id ? { ...todo, ...each.set } : todo))
    }
  }
  return todos === state.todos ? state : { ...state, todos }
}

/** What the Coordinator answers a command with. A refusal is an answer, not a failure. */
export type CommandResult = { ok: true; patch: Patch } | { ok: false; reason: string }
