import {
  INTERNAL,
  INTERNAL_CODE,
  type ClientWeek,
  type PickerClient,
  type PickerProject,
  type RecentWork,
  type TimerEntry,
  type TimerPicker,
  type TodayTimer,
  addDays,
  clientArrangement,
  startOfDay,
  startOfWeek,
  wallClock,
} from '@crazy/shared'
import type { ReadDb } from '../client'

/** What every timer query reads of a Time entry, Client and Project named. */
const WITH_NAMES = {
  include: { client: { select: { name: true } }, project: { select: { name: true } } },
} as const

type Row = {
  id: string
  clientId: string | null
  client: { name: string } | null
  projectId: string | null
  project: { name: string } | null
  todoId: string | null
  note: string
  billable: boolean
  startedAt: Date
  endedAt: Date | null
}

const entry = (row: Row, todoTitle: string | null = null): TimerEntry => ({
  id: row.id,
  clientId: row.clientId,
  clientName: row.client?.name ?? null,
  projectId: row.projectId,
  projectName: row.project?.name ?? null,
  todoId: row.todoId,
  todoTitle,
  note: row.note,
  billable: row.billable,
  startedAt: row.startedAt.toISOString(),
  endedAt: row.endedAt?.toISOString() ?? null,
})

/**
 * What the timer bar needs, at one moment of the user's day: the Time entry
 * with no end if there is one, every entry that touches today (which is what
 * today's totals are counted from), and the last entry that has ended, which
 * the idle bar reports and preselects from. Nothing is guessed from a calendar.
 */
export async function readTimer(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
): Promise<TodayTimer> {
  const { day } = wallClock(now, timeZone)
  const dayStart = startOfDay(day, timeZone)
  const dayEnd = startOfDay(addDays(day, 1), timeZone)

  const [touchingToday, lastEnded] = await Promise.all([
    // Running, or ended within the day: an entry begun yesterday and stopped
    // this morning counts towards today for the hours it spent in it.
    db.timeEntry.findMany({
      where: {
        userId,
        startedAt: { lt: dayEnd },
        OR: [{ endedAt: null }, { endedAt: { gt: dayStart } }],
      },
      ...WITH_NAMES,
      orderBy: { startedAt: 'desc' },
    }),
    db.timeEntry.findFirst({
      where: { userId, endedAt: { not: null } },
      ...WITH_NAMES,
      orderBy: { endedAt: 'desc' },
    }),
  ])

  // The Todos those entries were started from. There is no relation on the row
  // — a Time entry outlives the Todo that caused it — so the titles are read
  // beside it, and an entry whose Todo has gone simply has none.
  const todoIds = [...touchingToday, lastEnded]
    .map((row) => row?.todoId)
    .filter((each) => each !== null && each !== undefined)
  const todos =
    todoIds.length === 0
      ? []
      : await db.todo.findMany({
          where: { userId, id: { in: [...new Set(todoIds)] } },
          select: { id: true, title: true },
        })
  const titleOf = (todoId: string | null) =>
    todoId === null ? null : (todos.find((each) => each.id === todoId)?.title ?? null)

  const today = touchingToday.map((row) => entry(row, titleOf(row.todoId)))
  return {
    running: today.find((each) => each.endedAt === null) ?? null,
    last: lastEnded ? entry(lastEnded, titleOf(lastEnded.todoId)) : null,
    today,
  }
}

/** Everything the Shell's timer query holds: the bar's rows and the picker's lists. */
export interface TimerRead {
  timer: TodayTimer | null
  picker: TimerPicker | null
  /** Where this week has gone, Client by Client (frame 2a); empty with the module off. */
  week: ClientWeek[]
}

/**
 * What the timer needs wherever it is drawn. It is the Shell's, not the Today
 * screen's: while a Time entry runs the header shows it on every screen, so
 * both read this one query and cannot disagree (ticket 27). With the Billing
 * module off there is no timer and nothing to choose work for, and nothing is
 * read at all.
 */
export async function readTimerAndPicker(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
  billing: boolean,
): Promise<TimerRead> {
  if (!billing) return { timer: null, picker: null, week: [] }
  const [timer, picker, week] = await Promise.all([
    readTimer(db, userId, now, timeZone),
    readTimerPicker(db, userId, now, timeZone),
    readWeekByClient(db, userId, now, timeZone),
  ])
  return { timer, picker, week }
}

/**
 * Where the week has gone, Client by Client, as frame 2a's card draws it: every
 * Client of the user's with the hours put in since Monday, Internal among them
 * because work for nobody is still work, and the month's hours beside them so
 * the card can say where a budget or a retainer stands. Most hours first: for a
 * contractor with one dominant Client, that is the line worth reading.
 *
 * The seconds are counted no further than `now`, which is a parameter here as
 * everywhere; the running entry counts up to it and not past it.
 */
export async function readWeekByClient(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
): Promise<ClientWeek[]> {
  const { day } = wallClock(now, timeZone)
  const weekStart = startOfDay(startOfWeek(day), timeZone)
  const monthStart = startOfDay(`${day.slice(0, 7)}-01`, timeZone)
  const since = weekStart < monthStart ? weekStart : monthStart

  const [clients, entries] = await Promise.all([
    db.client.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        code: true,
        arrangement: true,
        rateCents: true,
        budgetHours: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    db.timeEntry.findMany({
      where: {
        userId,
        startedAt: { lt: now },
        OR: [{ endedAt: null }, { endedAt: { gt: since } }],
      },
      select: { clientId: true, startedAt: true, endedAt: true },
    }),
  ])

  /** Seconds one Client spent between a moment and now, each entry clipped to both. */
  const secondsSince = (of: string | null, from: Date) =>
    entries
      .filter((row) => row.clientId === of)
      .reduce((total, row) => {
        const start = Math.max(row.startedAt.getTime(), from.getTime())
        const until = Math.min(row.endedAt?.getTime() ?? now.getTime(), now.getTime())
        return total + Math.max(0, Math.floor((until - start) / 1000))
      }, 0)

  const lines: ClientWeek[] = clients.map((client, order) => ({
    clientId: client.id,
    name: client.name,
    code: client.code,
    order,
    weekSeconds: secondsSince(client.id, weekStart),
    monthSeconds: secondsSince(client.id, monthStart),
    arrangement: clientArrangement.parse(client.arrangement),
    rateCents: client.rateCents,
    budgetHours: client.budgetHours,
  }))
  // Internal is the absence of a Client, never a stored row, and it is not one
  // of them: it sits last however many hours went into it.
  lines.sort((a, b) => b.weekSeconds - a.weekSeconds)
  lines.push({
    clientId: null,
    name: INTERNAL,
    code: INTERNAL_CODE,
    order: null,
    weekSeconds: secondsSince(null, weekStart),
    monthSeconds: secondsSince(null, monthStart),
    arrangement: null,
    rateCents: null,
    budgetHours: null,
  })
  return lines
}

/** How many pieces of recently timed work the phone's sheet leads with (frame 3b). */
const RECENT = 3

/**
 * What the picker offers, at one moment of the user's day: every Client of
 * theirs with its Projects and the hours put in since Monday, the Projects
 * that belong to no Client gathered under Internal, and the work they timed
 * most recently, which is what a thumb reaches first on a phone.
 *
 * The hours are this week's because a week is the span a person steers by
 * while choosing what to do next; the frame quotes figures from no timesheet.
 * Clients and Projects come in the order they were added, which is the order
 * the frame draws them, and Internal comes last because it is not a Client.
 */
export async function readTimerPicker(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
): Promise<TimerPicker> {
  const { day } = wallClock(now, timeZone)
  const weekStart = startOfDay(startOfWeek(day), timeZone)

  const [clients, projects, thisWeek, lastTimed, lately, running] = await Promise.all([
    db.client.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    db.project.findMany({
      where: { userId },
      select: { id: true, name: true, clientId: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    // Every entry with time inside this week, running ones included; each is
    // counted from Monday at the earliest and no further than now.
    db.timeEntry.findMany({
      where: {
        userId,
        startedAt: { lt: now },
        OR: [{ endedAt: null }, { endedAt: { gt: weekStart } }],
      },
      select: { clientId: true, startedAt: true, endedAt: true },
    }),
    // When each Project was last timed, over all of the user's entries.
    db.timeEntry.groupBy({
      by: ['projectId'],
      where: { userId },
      _max: { startedAt: true },
    }),
    // The newest entries, which the recents are the distinct work among.
    db.timeEntry.findMany({
      where: { userId },
      ...WITH_NAMES,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 40,
    }),
    // The running timer is the Time entry with no end: the work it is on is
    // what the bar already says, so the picker marks it rather than offering it again.
    db.timeEntry.findFirst({
      where: { userId, endedAt: null },
      select: { clientId: true, projectId: true },
    }),
  ])

  const seconds = (of: string | null) =>
    thisWeek
      .filter((row) => row.clientId === of)
      .reduce((total, row) => {
        const from = Math.max(row.startedAt.getTime(), weekStart.getTime())
        const until = Math.min(row.endedAt?.getTime() ?? now.getTime(), now.getTime())
        return total + Math.max(0, Math.floor((until - from) / 1000))
      }, 0)

  const startedAtOf = (projectId: string) =>
    lastTimed.find((row) => row.projectId === projectId)?._max.startedAt?.toISOString() ?? null

  const under = (clientId: string | null): PickerProject[] =>
    projects
      .filter((project) => project.clientId === clientId)
      .map((project) => ({
        id: project.id,
        name: project.name,
        lastStartedAt: startedAtOf(project.id),
        running: project.id === running?.projectId,
      }))

  const grouped: PickerClient[] = clients.map((client) => ({
    id: client.id,
    name: client.name,
    weekSeconds: seconds(client.id),
    projects: under(client.id),
  }))
  // Internal is the absence of a Client, never a stored row: it is made here
  // so that work for nobody has somewhere to sit, and it sits last.
  grouped.push({ id: null, name: INTERNAL, weekSeconds: seconds(null), projects: under(null) })

  const recent: RecentWork[] = []
  for (const row of lately) {
    // What is running now is what the bar already says; the recents are where
    // else the user has been.
    if (row.endedAt === null) continue
    const work = {
      clientId: row.clientId,
      clientName: row.client?.name ?? null,
      projectId: row.projectId,
      projectName: row.project?.name ?? null,
    }
    if (running && running.clientId === row.clientId && running.projectId === row.projectId)
      continue
    if (
      recent.some((each) => each.clientId === work.clientId && each.projectId === work.projectId)
    ) {
      continue
    }
    recent.push({
      ...work,
      startedAt: row.startedAt.toISOString(),
      seconds: Math.max(0, Math.floor((row.endedAt.getTime() - row.startedAt.getTime()) / 1000)),
    })
    if (recent.length === RECENT) break
  }

  return { clients: grouped, recent }
}
