import {
  type TieIn,
  type Week,
  type WeekLine,
  type WeekMeeting,
  type WeekMilestone,
  type WeekTodo,
  addDays,
  side as sideOf,
  startOfDay,
  startOfWeek,
  todoState,
  wallClock,
} from '@crazy/shared'
import type { ReadDb } from '../client'

/**
 * A user's week as D1 holds it at one moment: Monday to Sunday on their wall
 * clock. What the Week screen makes of it — done of planned, focus hours,
 * carried over, and each day's shape and caption — is `viewWeek`'s to derive,
 * so no figure is ever stored. Only the wording is read as it stands: the Week
 * brief, the note beside a day's figures, the few words for one Todo or
 * meeting, and the tie-ins, each written for this week.
 */
export async function readWeek(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
): Promise<Week> {
  const { day } = wallClock(now, timeZone)
  const monday = startOfWeek(day)
  const sunday = addDays(monday, 6)
  // The week in instants, for the rows stamped with a moment rather than a day.
  // Taking both ends through the user's zone keeps a week that changes its
  // clocks 167 or 169 hours long, so no moment falls out of it.
  const weekStart = startOfDay(monday, timeZone)
  const weekEnd = startOfDay(addDays(sunday, 1), timeZone)

  const [brief, todos, meetings, lines, notes, projects] = await Promise.all([
    db.brief.findUnique({
      where: { userId_kind_day: { userId, kind: 'weekly', day: monday } },
      select: { body: true, bodyShort: true },
    }),
    // What the week holds: Todos finished inside it, the ones in `today`, and
    // the open ones placed on one of its days. An archived Todo is none of those.
    db.todo.findMany({
      where: {
        userId,
        OR: [
          { state: 'done', doneAt: { gte: weekStart, lt: weekEnd } },
          { state: 'today' },
          {
            state: 'backlog',
            slots: { some: { userId, day: { gte: monday, lte: sunday } } },
          },
        ],
      },
      select: {
        id: true,
        state: true,
        estimateMinutes: true,
        carryCount: true,
        projectId: true,
        doneAt: true,
        project: { select: { circle: { select: { side: true } } } },
        slots: {
          where: { userId, day: { gte: monday, lte: sunday } },
          select: { day: true },
          orderBy: { day: 'asc' },
        },
      },
    }),
    db.calendarEvent.findMany({
      where: { userId, kind: 'meeting', startsAt: { gte: weekStart, lt: weekEnd } },
      select: { id: true, startsAt: true, endsAt: true },
      orderBy: { startsAt: 'asc' },
    }),
    db.weekDayLine.findMany({
      where: { userId, day: { gte: monday, lte: sunday } },
      orderBy: [{ day: 'asc' }, { position: 'asc' }],
      select: { id: true, day: true, text: true, todoId: true, calendarEventId: true },
    }),
    db.weekDayNote.findMany({
      where: { userId, day: { gte: monday, lte: sunday } },
      select: { day: true, text: true },
    }),
    // The Projects a milestone or a tie-in puts in this week, oldest first,
    // which is the order the tie-in cards are laid out in.
    db.project.findMany({
      where: {
        userId,
        OR: [
          { milestoneDay: { gte: monday, lte: sunday } },
          { tieIns: { some: { userId, week: monday } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        milestoneDay: true,
        tieIns: { where: { userId, week: monday }, select: { text: true, when: true } },
      },
    }),
  ])

  const MINUTE = 60 * 1000

  return {
    monday,
    day,
    brief,
    todos: todos.map((row): WeekTodo => ({
      id: row.id,
      state: todoState.parse(row.state),
      estimateMinutes: row.estimateMinutes,
      carryCount: row.carryCount,
      side: row.project?.circle ? sideOf.parse(row.project.circle.side) : null,
      projectId: row.projectId,
      doneDay: row.doneAt === null ? null : wallClock(row.doneAt, timeZone).day,
      slotDays: [...new Set(row.slots.map((slot) => slot.day))],
    })),
    // A meeting belongs to the day it starts on, however late it runs.
    meetings: meetings.map((row): WeekMeeting => ({
      id: row.id,
      day: wallClock(row.startsAt, timeZone).day,
      minutes: Math.max(0, (row.endsAt.getTime() - row.startsAt.getTime()) / MINUTE),
    })),
    lines: lines.map((row): WeekLine => ({
      id: row.id,
      day: row.day,
      text: row.text,
      todoId: row.todoId,
      calendarEventId: row.calendarEventId,
    })),
    notes,
    milestones: projects.flatMap((row): WeekMilestone[] =>
      row.milestoneDay === null ? [] : [{ day: row.milestoneDay, projectId: row.id }],
    ),
    tieIns: projects.flatMap((row): TieIn[] =>
      row.tieIns.map((tieIn) => ({ project: row.name, text: tieIn.text, when: tieIn.when })),
    ),
  }
}
