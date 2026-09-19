import {
  type DayEvent,
  type Today,
  type TodayTodo,
  addDays,
  calendarEventKind,
  energy,
  signalKind,
  sourceKind,
  startOfDay,
  todoState,
  wallClock,
  writtenFor,
} from '@crazy/shared'
import type { ReadDb } from '../client'
import { readTimer, readTimerPicker } from './timer'

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
  const dayStart = startOfDay(day, timeZone)
  const dayEnd = startOfDay(addDays(day, 1), timeZone)
  const events = await db.calendarEvent.findMany({
    where: { userId, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    orderBy: { startsAt: 'asc' },
  })

  /** Minutes into this day, for a moment that may fall outside it. */
  const minuteOfDay = (moment: Date) => {
    if (moment <= dayStart) return 0
    if (moment >= dayEnd) return 24 * 60
    const { hour, minute } = wallClock(moment, timeZone)
    return hour * 60 + minute
  }

  return events.map((row): DayEvent => ({
    id: row.id,
    kind: calendarEventKind.parse(row.kind),
    title: row.title,
    who: row.who,
    from: minuteOfDay(row.startsAt),
    until: minuteOfDay(row.endsAt),
  }))
}

/**
 * A user's day as D1 holds it at one moment. What the Today screen makes of it
 * (the Priority stack, the Take on now, the timeline) is `viewToday`'s to
 * derive. The timer comes with it only for a user whose Billing module is on:
 * with it off there is no timer, and the bar does not render.
 */
export async function readToday(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
  billing = false,
): Promise<Today> {
  const { day } = wallClock(now, timeZone)
  const dayStart = startOfDay(day, timeZone)
  const dayEnd = startOfDay(addDays(day, 1), timeZone)

  const [brief, todos, sentBack, events, hours, signals, timer, picker] = await Promise.all([
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
        project: { select: { name: true } },
        slots: { where: { day }, select: { hour: true }, orderBy: { hour: 'asc' } },
      },
    }),
    db.todo.count({ where: { userId, state: 'backlog', sentBackAt: { gte: dayStart } } }),
    readDayEvents(db, userId, day, timeZone),
    db.timelineHour.findMany({ where: { userId, day }, orderBy: { hour: 'asc' } }),
    db.signal.findMany({ where: { userId, kind: 'mention' }, orderBy: { at: 'desc' } }),
    billing ? readTimer(db, userId, now, timeZone) : null,
    // The picker's lists come with the timer and for the same reason: with the
    // Billing module off there is no timer, and nothing to choose work for.
    billing ? readTimerPicker(db, userId, now, timeZone) : null,
  ])

  return {
    day,
    brief,
    todos: todos.map((row): TodayTodo => ({
      id: row.id,
      title: row.title,
      state: todoState.parse(row.state),
      project: row.project?.name ?? null,
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
    timer,
    picker,
  }
}
