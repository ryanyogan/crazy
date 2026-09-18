import {
  type Circle,
  type Circles,
  type Overlap,
  addDays,
  side,
  sourceKind,
  startOfDay,
  startOfWeek,
  wallClock,
} from '@crazy/shared'
import type { ReadDb } from '../client'

/**
 * A user's Circles and this week's Overlaps as D1 holds them at one moment.
 * What the screen makes of them — which Circle sits where in the figure, and in
 * what order the Overlaps read — is `viewCircles`'s to derive.
 *
 * An Overlap is never a row: it is a Todo matched to more than one Circle, so
 * the matches are what is read and a Todo with one match is simply not one. It
 * is *this week's* when Crazy noticed it this week — when the last of those
 * matches was made — and the Todo has not been archived since.
 */
export async function readCircles(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
): Promise<Circles> {
  const { day } = wallClock(now, timeZone)
  const from = startOfWeek(day)
  const weekStart = startOfDay(from, timeZone)
  const weekEnd = startOfDay(addDays(from, 7), timeZone)

  const [circles, matched] = await Promise.all([
    db.circle.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    db.todo.findMany({
      where: {
        userId,
        state: { not: 'archived' },
        // Every Todo Crazy matched to a Circle at some point in the week; which
        // of them it noticed *last* in the week is settled below.
        circles: { some: { userId, createdAt: { gte: weekStart, lt: weekEnd } } },
      },
      select: {
        id: true,
        title: true,
        circles: {
          where: { userId },
          select: { circleId: true, createdAt: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
        overlapNote: {
          where: { userId },
          select: { text: true, people: true, timing: true, figureTitle: true, figureNote: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ])

  /** When Crazy last matched this Todo to a Circle. */
  const noticedAt = (matches: { createdAt: Date }[]) =>
    matches.reduce(
      (latest, match) => (match.createdAt > latest ? match.createdAt : latest),
      new Date(0),
    )

  return {
    circles: circles.map((row): Circle => ({
      id: row.id,
      name: row.name,
      side: side.parse(row.side),
      people: row.people,
      providers: (row.providers ?? '')
        .split(',')
        .filter(Boolean)
        .map((kind) => sourceKind.parse(kind)),
    })),
    overlaps: matched
      // More than one Circle is what makes a Todo an Overlap, and the last match
      // is when Crazy saw that it was one.
      .filter((todo) => todo.circles.length > 1 && noticedAt(todo.circles) < weekEnd)
      .map((todo): Overlap => {
        const note = todo.overlapNote
        return {
          todoId: todo.id,
          title: todo.title,
          circleIds: todo.circles.map((match) => match.circleId),
          text: note?.text ?? null,
          people: note?.people ?? null,
          timing: note?.timing ?? null,
          figure:
            note?.figureTitle && note.figureNote
              ? { title: note.figureTitle, note: note.figureNote }
              : null,
        }
      }),
  }
}
