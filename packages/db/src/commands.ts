import {
  OPEN_TODO_STATES,
  type Command,
  type CommandState,
  type Op,
  type SignalFacts,
  type TodoFacts,
  signalKind,
  signalsNamed,
  sourceKind,
  todoState,
  todosNamed,
} from '@crazy/shared'
import type { Db } from './client'
import type { Prisma } from './generated/prisma/client'

// The Coordinator's two dealings with D1 around a command: load what the
// command names, and persist what was decided. The rules are not here; they
// are `decide` in @crazy/shared.

const toDate = (iso: string | null | undefined) =>
  iso === undefined ? undefined : iso === null ? null : new Date(iso)

/** The rows a command is decided against, and only the user's own. */
export async function loadCommandState(
  db: Db,
  userId: string,
  command: Command,
): Promise<CommandState> {
  const signalIds = signalsNamed(command)
  const signalRows =
    signalIds.length === 0
      ? []
      : await db.signal.findMany({ where: { userId, id: { in: signalIds } } })
  const signals = signalRows.map((row): SignalFacts => ({
    id: row.id,
    kind: signalKind.parse(row.kind),
    who: row.person,
    text: row.text,
    source: {
      connectionId: row.connectionId,
      itemId: row.sourceItemId,
      kind: sourceKind.parse(row.sourceKind),
      ref: row.sourceRef,
      url: row.sourceUrl,
    },
    todoId: row.todoId,
  }))

  // The Todos the command names, and any open Todo a named Signal's Source already has.
  const named: Prisma.TodoWhereInput[] = [{ id: { in: todosNamed(command) } }]
  for (const signal of signals) {
    named.push({
      sourceConnectionId: signal.source.connectionId,
      sourceItemId: signal.source.itemId,
      state: { in: [...OPEN_TODO_STATES] },
    })
  }
  const todoRows = await db.todo.findMany({
    where: { userId, OR: named },
    select: {
      id: true,
      state: true,
      sourceConnectionId: true,
      sourceKind: true,
      sourceItemId: true,
      sourceRef: true,
      sourceUrl: true,
    },
  })
  const todos = todoRows.map((row): TodoFacts => ({
    id: row.id,
    state: todoState.parse(row.state),
    source:
      row.sourceConnectionId === null || row.sourceItemId === null || row.sourceKind === null
        ? null
        : {
            connectionId: row.sourceConnectionId,
            itemId: row.sourceItemId,
            kind: sourceKind.parse(row.sourceKind),
            ref: row.sourceRef,
            url: row.sourceUrl,
          },
  }))

  return { todos, signals }
}

/**
 * Writes operations to D1, in order. D1 has no transactions: each operation
 * sets columns to values, so a run that stops half way is finished by running
 * it again. An insert is the exception: a row that is already there makes it
 * fail, which is also what keeps one user's insert from landing on another's row.
 */
export async function persistOps(db: Db, userId: string, ops: readonly Op[]): Promise<void> {
  for (const op of ops) {
    switch (op.type) {
      case 'todo.set': {
        const { doneAt, touchedAt, snoozedUntil, ...rest } = op.set
        await db.todo.updateMany({
          where: { id: op.id, userId },
          data: {
            ...rest,
            doneAt: toDate(doneAt),
            touchedAt: toDate(touchedAt) ?? undefined,
            snoozedUntil: toDate(snoozedUntil),
          },
        })
        break
      }
      case 'todo.insert': {
        const { source, createdAt, touchedAt, ...rest } = op.todo
        await db.todo.create({
          data: {
            ...rest,
            userId,
            sourceConnectionId: source?.connectionId ?? null,
            sourceKind: source?.kind ?? null,
            sourceItemId: source?.itemId ?? null,
            sourceRef: source?.ref ?? null,
            sourceUrl: source?.url ?? null,
            createdAt: new Date(createdAt),
            touchedAt: new Date(touchedAt),
          },
        })
        break
      }
      case 'signal.set':
        await db.signal.updateMany({ where: { id: op.id, userId }, data: op.set })
    }
  }
}
