import { type TimerEntry, type TodayTimer, addDays, startOfDay, wallClock } from '@crazy/shared'
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
  note: string
  billable: boolean
  startedAt: Date
  endedAt: Date | null
}

const entry = (row: Row): TimerEntry => ({
  id: row.id,
  clientId: row.clientId,
  clientName: row.client?.name ?? null,
  projectId: row.projectId,
  projectName: row.project?.name ?? null,
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

  const today = touchingToday.map(entry)
  return {
    running: today.find((each) => each.endedAt === null) ?? null,
    last: lastEnded ? entry(lastEnded) : null,
    today,
  }
}
