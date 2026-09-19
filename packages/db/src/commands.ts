import {
  OPEN_TODO_STATES,
  SETTINGS_DEFAULTS,
  type Command,
  type CommandState,
  type ConnectionFacts,
  type Op,
  type SignalFacts,
  type TodoFacts,
  needsConnections,
  needsTheDay,
  side,
  signalKind,
  signalsNamed,
  sourceKind,
  todoState,
  todosNamed,
  wallClock,
} from '@crazy/shared'
import type { Db } from './client'
import type { Prisma } from './generated/prisma/client'
import { readDayEvents } from './read/today'

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
  now: Date,
): Promise<CommandState> {
  // Which day it is is the user's own: their zone decides where their hours are.
  const settings = await db.userSettings.findUnique({ where: { userId } })
  const timeZone = settings?.timeZone ?? SETTINGS_DEFAULTS.timeZone
  const { day } = wallClock(now, timeZone)
  const plansTheDay = needsTheDay(command)

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
      snoozedUntil: true,
      sourceConnectionId: true,
      sourceKind: true,
      sourceItemId: true,
      sourceRef: true,
      sourceUrl: true,
    },
  })

  // Only a command that plans the day is decided against the day: the Slots the
  // Todos it names already hold on it, and the calendar its hours have to fit around.
  const [slots, events] = plansTheDay
    ? await Promise.all([
        db.slot.findMany({
          where: { userId, day, todoId: { in: todoRows.map((row) => row.id) } },
          select: { todoId: true, hour: true },
          orderBy: { hour: 'asc' },
        }),
        readDayEvents(db, userId, day, timeZone),
      ])
    : [[], []]

  const todos = todoRows.map((row): TodoFacts => ({
    id: row.id,
    state: todoState.parse(row.state),
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    slotHours: slots.filter((slot) => slot.todoId === row.id).map((slot) => slot.hour),
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

  // A command about a Connection is decided against all the user has: they are few.
  const connections = needsConnections(command)
    ? (
        await db.connection.findMany({
          where: { userId },
          select: { id: true, externalAccountId: true, defaultSide: true },
        })
      ).map((row): ConnectionFacts => ({ ...row, defaultSide: side.parse(row.defaultSide) }))
    : []

  return { day, todos, signals, events, connections }
}

/**
 * Writes operations to D1, in order. D1 has no transactions: each operation
 * sets columns to values, so a run that stops half way is finished by running
 * it again. An insert is the exception: a row that is already there makes it
 * fail, which is also what keeps one user's insert from landing on another's row.
 *
 * `slot.set` is the one operation that takes more than one statement — the
 * Todo's Slots for the day are deleted and then written again — so a run that
 * stops between them leaves the Todo with fewer hours than it had, or none. The
 * command has failed by then: no sequence number is spent, nothing is
 * broadcast, the browser puts its own screen back, says so and reads D1 again,
 * and the user's next attempt states the whole set and puts it right.
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
        break
      case 'slot.set': {
        // The Todo's Slots on that day, said whole: what it held goes, what it
        // holds now is written. Run again, it ends the same. A Slot is named by
        // the Todo, the day and the hour, which is what makes it unique.
        await db.slot.deleteMany({ where: { userId, todoId: op.todoId, day: op.day } })
        for (const hour of op.hours) {
          await db.slot.create({
            data: {
              id: `${op.todoId}/${op.day}/${hour}`,
              userId,
              todoId: op.todoId,
              day: op.day,
              hour,
              createdAt: new Date(op.at),
            },
          })
        }
        break
      }
      case 'settings.set':
        await db.userSettings.updateMany({ where: { userId }, data: op.set })
        break
      case 'connection.insert': {
        const { createdAt, ...rest } = op.connection
        await db.connection.create({ data: { ...rest, userId, createdAt: new Date(createdAt) } })
        break
      }
      case 'connection.set':
        await db.connection.updateMany({ where: { id: op.id, userId }, data: op.set })
    }
  }
}
