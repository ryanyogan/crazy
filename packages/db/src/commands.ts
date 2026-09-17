import { type Command, type CommandState, type Op, todoState, todosNamed } from '@crazy/shared'
import type { Db } from './client'

// The Coordinator's two dealings with D1 around a command: load what the
// command names, and persist what was decided. The rules are not here; they
// are `decide` in @crazy/shared.

/** The rows a command is decided against, and only the user's own. */
export async function loadCommandState(
  db: Db,
  userId: string,
  command: Command,
): Promise<CommandState> {
  const rows = await db.todo.findMany({
    where: { userId, id: { in: todosNamed(command) } },
    select: { id: true, state: true },
  })
  return { todos: rows.map((row) => ({ id: row.id, state: todoState.parse(row.state) })) }
}

/**
 * Writes operations to D1, in order. D1 has no transactions: each operation
 * sets columns to values, so a run that stops half way is finished by running
 * it again.
 */
export async function persistOps(db: Db, userId: string, ops: readonly Op[]): Promise<void> {
  for (const op of ops) {
    switch (op.type) {
      case 'todo.set': {
        const { doneAt, ...rest } = op.set
        await db.todo.updateMany({
          where: { id: op.id, userId },
          data: {
            ...rest,
            ...(doneAt === undefined ? {} : { doneAt: doneAt === null ? null : new Date(doneAt) }),
          },
        })
      }
    }
  }
}
