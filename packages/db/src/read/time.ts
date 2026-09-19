import {
  type TimeClient,
  type TimeProject,
  type TimeRead,
  type TimeRow,
  type TimeView,
  addDays,
  periodOf,
  startOfDay,
  wallClock,
} from '@crazy/shared'
import type { ReadDb } from '../client'

/**
 * One period of a user's timesheet as D1 holds it: every Time entry with time
 * inside the Day, Week or Month the screen is on, newest first, and the Clients
 * and Projects those entries can name. Only the user's own rows are read, and
 * only the window the period covers — never the whole timesheet.
 *
 * What the screen makes of them — the day groups, the daily totals, the period
 * total, what is billable and how many entries still need a Client — is
 * `viewTime`'s to derive from these rows and a moment. The browser derives it
 * with the same function over its own cache, so an optimistic edit and a read
 * one can never come to different totals.
 */
export async function readTime(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
  view: TimeView,
  /** The local day the period is anchored on; the day the moment falls on by default. */
  anchorDay?: string,
): Promise<TimeRead> {
  const on = anchorDay ?? wallClock(now, timeZone).day
  const { from, to } = periodOf(view, on)
  const periodStart = startOfDay(from, timeZone)
  const periodEnd = startOfDay(addDays(to, 1), timeZone)

  const [entries, clientRows, projectRows] = await Promise.all([
    // Every entry with a second inside the period: one begun before it and
    // still running counts, and so does one begun on its last evening.
    db.timeEntry.findMany({
      where: {
        userId,
        startedAt: { lt: periodEnd },
        OR: [{ endedAt: null }, { endedAt: { gt: periodStart } }],
      },
      include: { client: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    }),
    db.client.findMany({
      where: { userId },
      select: { id: true, name: true, code: true },
      // The order they were taken on, which is the order their colours follow.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    db.project.findMany({
      where: { userId },
      select: { id: true, name: true, clientId: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ])

  const clients: TimeClient[] = clientRows
  const projects: TimeProject[] = projectRows
  const nameOf = <T extends { id: string; name: string }>(
    rows: readonly T[],
    id: string | null,
  ): string | null => (id === null ? null : (rows.find((each) => each.id === id)?.name ?? null))

  const rows: TimeRow[] = entries.map((entry) => ({
    id: entry.id,
    clientId: entry.clientId,
    clientName: entry.client?.name ?? null,
    projectId: entry.projectId,
    projectName: entry.project?.name ?? null,
    note: entry.note,
    billable: entry.billable,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt?.toISOString() ?? null,
    // A suggestion is a guess about a row rather than a link between two, so
    // it is named from the Clients and Projects already in hand.
    suggestedClientId: entry.suggestedClientId,
    suggestedClientName: nameOf(clients, entry.suggestedClientId),
    suggestedProjectId: entry.suggestedProjectId,
    suggestedProjectName: nameOf(projects, entry.suggestedProjectId),
  }))

  return { view, on, from, to, rows, clients, projects }
}
