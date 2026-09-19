import {
  OPEN_TODO_STATES,
  SETTINGS_DEFAULTS,
  type Command,
  type CommandState,
  type ConnectionFacts,
  type Op,
  type SignalFacts,
  type TodoFacts,
  type ProjectFacts,
  type TimeEntryFacts,
  needsConnections,
  needsEveryOpenTodo,
  needsTheDay,
  needsTheTimer,
  spanNamed,
  timeEntriesNamed,
  workNamed,
  side,
  signalKind,
  signalsNamed,
  sourceNamed,
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

/** What `decide` is told about one of the user's Time entries. */
const ENTRY_FACTS = {
  id: true,
  clientId: true,
  projectId: true,
  todoId: true,
  startedAt: true,
  endedAt: true,
  suggestedClientId: true,
  suggestedProjectId: true,
  client: { select: { name: true } },
} as const

type EntryRow = {
  id: string
  clientId: string | null
  projectId: string | null
  todoId: string | null
  startedAt: Date
  endedAt: Date | null
  suggestedClientId: string | null
  suggestedProjectId: string | null
  client: { name: string } | null
}

const entryFacts = (row: EntryRow): TimeEntryFacts => ({
  id: row.id,
  clientId: row.clientId,
  projectId: row.projectId,
  todoId: row.todoId,
  startedAt: row.startedAt.toISOString(),
  endedAt: row.endedAt?.toISOString() ?? null,
  suggestedClientId: row.suggestedClientId,
  suggestedProjectId: row.suggestedProjectId,
  clientName: row.client?.name ?? null,
})

/**
 * The Time entries a timer or Time-entry command is decided against: the one
 * with no end — the running timer, wherever the command is about it or not —
 * and any entry the command names by id. Only the user's own are ever loaded,
 * so an entry that is not here is not theirs to change.
 *
 * A command that moves an entry's hours also needs every entry those hours
 * would run over, because no two spells of a user's may overlap. They are read
 * by the window the hours would occupy rather than by reading the timesheet:
 * the span is known only once the named entry is in hand, so it is a second
 * query and never a scan of every row.
 */
async function loadTimeEntries(
  db: Db,
  userId: string,
  command: Command,
  entryIds: string[],
  now: Date,
): Promise<TimeEntryFacts[]> {
  const rows = await db.timeEntry.findMany({
    where: { userId, OR: [{ endedAt: null }, { id: { in: entryIds } }] },
    select: ENTRY_FACTS,
  })
  const entries = rows.map(entryFacts)

  const span = spanNamed(
    command,
    entries.find((entry) => entryIds.includes(entry.id)),
    now,
  )
  if (!span) return entries
  const near = await db.timeEntry.findMany({
    where: {
      userId,
      startedAt: { lt: span.to },
      OR: [{ endedAt: null }, { endedAt: { gt: span.from } }],
    },
    select: ENTRY_FACTS,
  })
  const held = new Map(entries.map((entry) => [entry.id, entry]))
  for (const row of near) held.set(row.id, entryFacts(row))
  return [...held.values()]
}

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
  const source = sourceNamed(command)
  if (source) {
    named.push({
      sourceConnectionId: source.connectionId,
      sourceItemId: source.itemId,
      state: { in: [...OPEN_TODO_STATES] },
    })
  }
  // The Rollover is decided against everything still open: the day, and the backlog that ages.
  if (needsEveryOpenTodo(command)) named.push({ state: { in: [...OPEN_TODO_STATES] } })
  const todoRows = await db.todo.findMany({
    where: { userId, OR: named },
    select: {
      id: true,
      state: true,
      snoozedUntil: true,
      swappedOnDay: true,
      touchedAt: true,
      carryCount: true,
      sourceConnectionId: true,
      sourceKind: true,
      sourceItemId: true,
      sourceRef: true,
      sourceUrl: true,
      projectId: true,
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
    swappedOnDay: row.swappedOnDay,
    touchedAt: row.touchedAt.toISOString(),
    carryCount: row.carryCount,
    projectId: row.projectId,
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

  // A timer command is decided against the running Time entry — the one with no
  // end — and any entry it names by id. Only the user's own are ever loaded, so
  // an entry that is not here is not theirs to change.
  const entryIds = timeEntriesNamed(command)
  const timeEntries = needsTheTimer(command)
    ? await loadTimeEntries(db, userId, command, entryIds, now)
    : undefined

  // The work a timer names: the Project decides the Client, so the Project's
  // own row has to be read before a start can be decided. A timer started from
  // a Todo names no Project of its own — the Todo's is the work — so that one
  // is read as well, from the Todo that has just been loaded. Confirming a
  // suggestion names neither: what it applies is on the entry's own row, so
  // that Client and Project are read from there (`timeEntry.confirmSuggestion`).
  const work = workNamed(command)
  const suggested = timeEntries?.filter((entry) => entryIds.includes(entry.id)) ?? []
  const wanted = [
    work?.projectId,
    ...suggested.map((entry) => entry.suggestedProjectId),
    ...(needsTheTimer(command) ? todos.map((todo) => todo.projectId) : []),
  ].filter((each) => each !== null && each !== undefined)
  const wantedClients = [
    work?.clientId,
    ...suggested.map((entry) => entry.suggestedClientId),
  ].filter((each) => each !== null && each !== undefined)
  const [projects, clients] = await Promise.all([
    wanted.length > 0
      ? db.project.findMany({
          where: { userId, id: { in: [...new Set(wanted)] } },
          select: { id: true, clientId: true },
        })
      : ([] as ProjectFacts[]),
    wantedClients.length > 0
      ? db.client.findMany({
          where: { userId, id: { in: [...new Set(wantedClients)] } },
          select: { id: true },
        })
      : [],
  ])

  return {
    day,
    timeZone,
    todos,
    signals,
    events,
    connections,
    billing: settings?.billing ?? SETTINGS_DEFAULTS.billing,
    timeEntries,
    projects,
    clients,
    settings: {
      timeZone,
      sentBackDays: settings?.sentBackDays ?? SETTINGS_DEFAULTS.sentBackDays,
      archiveDays: settings?.archiveDays ?? SETTINGS_DEFAULTS.archiveDays,
      lastRolloverDay: settings?.lastRolloverDay ?? null,
    },
  }
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
        // `swappedOnDay` is a day, not a moment, and travels as itself.
        const { doneAt, touchedAt, snoozedUntil, startedAt, sentBackAt, ...rest } = op.set
        await db.todo.updateMany({
          where: { id: op.id, userId },
          data: {
            ...rest,
            doneAt: toDate(doneAt),
            touchedAt: toDate(touchedAt) ?? undefined,
            snoozedUntil: toDate(snoozedUntil),
            startedAt: toDate(startedAt),
            sentBackAt: toDate(sentBackAt) ?? undefined,
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
      case 'billing.set':
        await db.userSettings.updateMany({ where: { userId }, data: { billing: op.on } })
        break
      case 'rollover.ran':
        await db.userSettings.updateMany({ where: { userId }, data: { lastRolloverDay: op.day } })
        break
      case 'connection.insert': {
        const { createdAt, ...rest } = op.connection
        await db.connection.create({ data: { ...rest, userId, createdAt: new Date(createdAt) } })
        break
      }
      case 'connection.set':
        await db.connection.updateMany({ where: { id: op.id, userId }, data: op.set })
        break
      case 'timeEntry.insert': {
        const { startedAt, endedAt, createdAt, ...rest } = op.entry
        // The partial unique index on the entries with no end is the backstop
        // under the rule `decide` holds: a second running entry cannot land.
        await db.timeEntry.create({
          data: {
            ...rest,
            userId,
            startedAt: new Date(startedAt),
            endedAt: endedAt === null ? null : new Date(endedAt),
            createdAt: new Date(createdAt),
          },
        })
        break
      }
      case 'timeEntry.set': {
        const { startedAt, endedAt, ...rest } = op.set
        await db.timeEntry.updateMany({
          where: { id: op.id, userId },
          data: { ...rest, startedAt: toDate(startedAt) ?? undefined, endedAt: toDate(endedAt) },
        })
        break
      }
      // Hours that were never worked are worse than no record at all, so a
      // mistaken entry goes. `deleteMany` with the user on it is what keeps one
      // user's removal from landing on another's row.
      case 'timeEntry.delete':
        await db.timeEntry.deleteMany({ where: { id: op.id, userId } })
        break
      case 'project.insert': {
        const { createdAt, ...rest } = op.project
        // No Circle: Crazy infers Circles, and a Project named by hand has none
        // until it has looked, so it has no Side of its own yet either.
        await db.project.create({
          data: { ...rest, userId, circleId: null, createdAt: new Date(createdAt) },
        })
      }
    }
  }
}
