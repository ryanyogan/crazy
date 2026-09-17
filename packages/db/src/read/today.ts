import {
  type DayEvent,
  type Today,
  type TodayTodo,
  addDays,
  calendarEventKind,
  energy,
  sourceKind,
  startOfDay,
  todoState,
  wallClock,
} from '@crazy/shared'
import type { ReadDb } from '../client'

/**
 * A user's day as D1 holds it at one moment. What the Today screen makes of it
 * (the Priority stack, the Take on now, the timeline) is `viewToday`'s to derive.
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

  const [brief, todos, sentBack, events, hours, mentions] = await Promise.all([
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
    db.calendarEvent.findMany({
      where: { userId, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      orderBy: { startsAt: 'asc' },
    }),
    db.timelineHour.findMany({ where: { userId, day }, orderBy: { hour: 'asc' } }),
    db.signal.findMany({ where: { userId, kind: 'mention' }, orderBy: { at: 'desc' } }),
  ])

  /** Minutes into this day, for a moment that may fall outside it. */
  const minuteOfDay = (moment: Date) => {
    if (moment <= dayStart) return 0
    if (moment >= dayEnd) return 24 * 60
    const { hour, minute } = wallClock(moment, timeZone)
    return hour * 60 + minute
  }

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
        row.sourceKind === null
          ? null
          : { kind: sourceKind.parse(row.sourceKind), ref: row.sourceRef, url: row.sourceUrl },
      slotHours: row.slots.map((slot) => slot.hour),
      createdAt: row.createdAt.toISOString(),
      doneAt: row.doneAt?.toISOString() ?? null,
    })),
    events: events.map((row): DayEvent => ({
      id: row.id,
      kind: calendarEventKind.parse(row.kind),
      title: row.title,
      who: row.who,
      from: minuteOfDay(row.startsAt),
      until: minuteOfDay(row.endsAt),
    })),
    hours: hours.map((row) => ({
      hour: row.hour,
      title: row.title,
      note: row.note,
      source: row.sourceKind === null ? null : sourceKind.parse(row.sourceKind),
    })),
    mentions: mentions.map((row) => ({
      id: row.id,
      who: row.person,
      text: row.text,
      at: row.at.toISOString(),
      source: { kind: sourceKind.parse(row.sourceKind), ref: row.sourceRef, url: row.sourceUrl },
      todoId: row.todoId,
    })),
    sentBack,
  }
}
