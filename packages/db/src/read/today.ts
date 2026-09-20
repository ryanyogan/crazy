import {
  type DayEvent,
  type EventLinks,
  type Later,
  type Today,
  type TodayTodo,
  addDays,
  calendarEventKind,
  clockTime,
  energy,
  signalKind,
  sourceKind,
  startOfDay,
  startOfWeek,
  todoState,
  wallClock,
  writtenFor,
} from '@crazy/shared'
import type { ReadDb } from '../client'

/** A calendar row of the day, with what it is at the Provider: how a Todo's Source finds it. */
type EventRow = {
  id: string
  connectionId: string
  itemId: string
  kind: string
  title: string
  who: string | null
  startsAt: Date
  endsAt: Date
}

async function eventRows(
  db: ReadDb,
  userId: string,
  day: string,
  timeZone: string,
): Promise<EventRow[]> {
  const dayStart = startOfDay(day, timeZone)
  const dayEnd = startOfDay(addDays(day, 1), timeZone)
  return db.calendarEvent.findMany({
    where: { userId, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      connectionId: true,
      itemId: true,
      kind: true,
      title: true,
      who: true,
      startsAt: true,
      endsAt: true,
    },
  })
}

/** The rows placed in minutes into the user's day, clipped to it. */
function placeEvents(rows: readonly EventRow[], day: string, timeZone: string): DayEvent[] {
  const dayStart = startOfDay(day, timeZone)
  const dayEnd = startOfDay(addDays(day, 1), timeZone)

  /** Minutes into this day, for a moment that may fall outside it. */
  const minuteOfDay = (moment: Date) => {
    if (moment <= dayStart) return 0
    if (moment >= dayEnd) return 24 * 60
    const { hour, minute } = wallClock(moment, timeZone)
    return hour * 60 + minute
  }

  return rows.map((row): DayEvent => ({
    id: row.id,
    kind: calendarEventKind.parse(row.kind),
    title: row.title,
    who: row.who,
    from: minuteOfDay(row.startsAt),
    until: minuteOfDay(row.endsAt),
  }))
}

/**
 * The day's calendar, as the timeline and the Slot commands read it: meetings
 * and focus blocks placed in minutes into the user's day, clipped to it.
 */
export async function readDayEvents(
  db: ReadDb,
  userId: string,
  day: string,
  timeZone: string,
): Promise<DayEvent[]> {
  return placeEvents(await eventRows(db, userId, day, timeZone), day, timeZone)
}

/** A word on its own, whatever the case: "Quill" in "Quill weekly", never in "Quills". */
function namesWord(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(haystack)
}

/**
 * Whether the event names this person. Whole words only, on the title and on
 * who the Provider says it is with, and only their full name or their first
 * name — a meeting is never guessed at from a fragment.
 */
function eventNames(event: EventRow, person: string): boolean {
  const said = `${event.title} ${event.who ?? ''}`
  const first = person.split(/\s+/)[0] ?? person
  return namesWord(said, person) || (first.length > 2 && namesWord(said, first))
}

/**
 * A user's day as D1 holds it at one moment. What the Today screen makes of it
 * (the Priority stack, the Take on now, the timeline) is `viewToday`'s to
 * derive. The timer is not here: it belongs to the Shell, which shows it on
 * every screen while it runs, and is read by `readTimer` into its own query
 * (ticket 27) so that the header and the bar cannot disagree.
 */
export async function readToday(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
): Promise<Today> {
  const { day } = wallClock(now, timeZone)
  const dayStart = startOfDay(day, timeZone)
  const dayEnd = startOfDay(addDays(day, 1), timeZone)

  // "Since yesterday" is derived from the moment and the zone, here as in the
  // rundown: nothing records when the user last looked at the screen.
  const yesterdayStart = startOfDay(addDays(day, -1), timeZone)

  const [brief, todos, sentBack, rows, hours, signals, preps, clients, later] = await Promise.all([
    db.brief.findUnique({
      where: { userId_kind_day: { userId, kind: 'daily', day } },
      select: { body: true, bodyShort: true },
    }),
    db.todo.findMany({
      where: {
        userId,
        OR: [{ state: 'today' }, { state: 'done', doneAt: { gte: dayStart, lt: dayEnd } }],
      },
      include: {
        // The Project's Client comes with it: a Project's Client wins, so this
        // is who the Todo's work is billed to and what a timer started from it
        // would be for (CONTEXT.md, "Project").
        project: {
          select: { id: true, name: true, clientId: true, client: { select: { name: true } } },
        },
        slots: { where: { day }, select: { hour: true }, orderBy: { hour: 'asc' } },
      },
    }),
    // The Todos the last Rollover sent back, by name: the Catch up chapter
    // says which they were, not only how many (ticket 28).
    db.todo.findMany({
      where: { userId, state: 'backlog', sentBackAt: { gte: dayStart } },
      select: { id: true, title: true },
      orderBy: { sentBackAt: 'asc' },
    }),
    eventRows(db, userId, day, timeZone),
    db.timelineHour.findMany({ where: { userId, day }, orderBy: { hour: 'asc' } }),
    // Every Mention, and the Promises and Waiting-on that came in since
    // yesterday's local midnight: what the Catch up chapter is a catch-up of.
    db.signal.findMany({
      where: {
        userId,
        OR: [
          { kind: 'mention' },
          { kind: { in: ['promise', 'waiting_on'] }, at: { gte: yesterdayStart } },
        ],
      },
      orderBy: { at: 'desc' },
    }),
    db.meetingPrep.findMany({
      where: { userId, day },
      select: { calendarEventId: true, body: true, bodyShort: true },
    }),
    // Only a name is wanted, to tell whether a meeting's title says whose work
    // it is. A user with the Billing module off has none, and this is empty.
    db.client.findMany({ where: { userId }, select: { id: true, name: true } }),
    readLater(db, userId, day, timeZone),
  ])

  const events = placeEvents(rows, day, timeZone)

  /**
   * The Client an event's title names, where the user has any. The Client's
   * own name, or its first word when no other Client of theirs begins with it
   * — "Quill weekly" is Quill & Co's; a fuzzy guess is never made, because a
   * meeting put against the wrong Client is a wrong invoice later.
   */
  const clientNamed = (event: EventRow): string | null => {
    const named = clients.find((client) => namesWord(event.title, client.name))
    if (named) return named.id
    const byFirst = clients.filter((client) => {
      const first = client.name.split(/\s+/)[0] ?? client.name
      return first.length > 2 && namesWord(event.title, first)
    })
    return byFirst.length === 1 ? byFirst[0]!.id : null
  }

  const links: EventLinks[] = rows.map((event): EventLinks => {
    const prep = preps.find((each) => each.calendarEventId === event.id)
    return {
      eventId: event.id,
      // A Todo made from the meeting: its Source is the very item the calendar
      // row came from, matched on the Connection and the Provider's own id.
      todoIds: todos
        .filter(
          (todo) =>
            todo.sourceKind === 'calendar_event' &&
            todo.sourceConnectionId === event.connectionId &&
            todo.sourceItemId === event.itemId,
        )
        .map((todo) => todo.id),
      signalIds: signals
        .filter((signal) => eventNames(event, signal.person))
        .map((signal) => signal.id),
      clientId: clientNamed(event),
      prep: prep ? { body: prep.body, bodyShort: prep.bodyShort } : null,
    }
  })

  return {
    day,
    brief,
    todos: todos.map((row): TodayTodo => ({
      id: row.id,
      title: row.title,
      state: todoState.parse(row.state),
      project: row.project?.name ?? null,
      projectId: row.project?.id ?? null,
      clientId: row.project?.clientId ?? null,
      clientName: row.project?.client?.name ?? null,
      estimateMinutes: row.estimateMinutes,
      energy: row.energy === null ? null : energy.parse(row.energy),
      carryCount: row.carryCount,
      stackPosition: row.stackPosition,
      reason: row.stackReason,
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
      slotHours: row.slots.map((slot) => slot.hour),
      createdAt: row.createdAt.toISOString(),
      touchedAt: row.touchedAt.toISOString(),
      snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      swappedOnDay: row.swappedOnDay,
      doneAt: row.doneAt?.toISOString() ?? null,
    })),
    events,
    hours: hours.map((row) => ({
      hour: row.hour,
      title: row.title,
      note: row.note,
      source: row.sourceKind === null ? null : sourceKind.parse(row.sourceKind),
      // The Todos the words were written for; the timeline uses them to tell
      // whether they still describe the hour. Stored as JSON: SQLite has no lists.
      writtenFor: writtenFor.parse(JSON.parse(row.writtenFor)),
    })),
    signals: signals.map((row) => ({
      id: row.id,
      kind: signalKind.parse(row.kind),
      who: row.person,
      text: row.text,
      at: row.at.toISOString(),
      source: {
        connectionId: row.connectionId,
        itemId: row.sourceItemId,
        kind: sourceKind.parse(row.sourceKind),
        ref: row.sourceRef,
        url: row.sourceUrl,
      },
      todoId: row.todoId,
    })),
    sentBack,
    links,
    later,
  }
}

/**
 * Where the day is leading: what the rest of this week holds and what tomorrow
 * opens with. The tie-ins and milestones are the Week read model's own rows,
 * read here for the last chapter of the rundown rather than counted a second
 * way; only the part of the week still ahead is asked for, because prep for
 * today is about what today is leading to.
 */
async function readLater(
  db: ReadDb,
  userId: string,
  day: string,
  timeZone: string,
): Promise<Later> {
  const monday = startOfWeek(day)
  const sunday = addDays(monday, 6)
  const tomorrow = addDays(day, 1)

  const [projects, meetings] = await Promise.all([
    db.project.findMany({
      where: {
        userId,
        OR: [
          { milestoneDay: { gte: day, lte: sunday } },
          { tieIns: { some: { userId, week: monday } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        milestone: true,
        milestoneDay: true,
        tieIns: { where: { userId, week: monday }, select: { text: true, when: true } },
      },
    }),
    db.calendarEvent.findMany({
      where: {
        userId,
        kind: 'meeting',
        startsAt: {
          gte: startOfDay(tomorrow, timeZone),
          lt: startOfDay(addDays(tomorrow, 1), timeZone),
        },
      },
      orderBy: { startsAt: 'asc' },
      take: 1,
      select: { title: true, who: true, startsAt: true },
    }),
  ])

  const first = meetings[0]
  return {
    tieIns: projects.flatMap((row) =>
      row.tieIns.map((tieIn) => ({ project: row.name, text: tieIn.text, when: tieIn.when })),
    ),
    milestones: projects.flatMap((row) =>
      row.milestoneDay === null || row.milestoneDay < day || row.milestoneDay > sunday
        ? []
        : [{ project: row.name, milestone: row.milestone ?? '', day: row.milestoneDay }],
    ),
    nextMeeting: first
      ? {
          title: first.title,
          who: first.who,
          day: tomorrow,
          at: clockTime(first.startsAt, timeZone),
        }
      : null,
  }
}
