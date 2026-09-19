import {
  COMPLETION_DAYS,
  DEFAULT_METRIC_RANGE,
  METRIC_AGE_BUCKETS,
  METRIC_HEADLINES,
  METRIC_NOTES,
  type MetricHeadline,
  type MetricRange,
  type Metrics,
  type Modelled,
  PROVIDERS,
  type TodoSource,
  addDays,
  metricRangeFrom,
  sourceKindsOf,
  startOfDay,
  wallClock,
} from '@crazy/shared'
import type { ReadDb } from '../client'

/**
 * A user's Metrics screen as D1 holds it at one moment, for one range.
 *
 * Two things are counted here and never stored: how long the backlog's Todos
 * have sat untouched, and which Provider the range's Todos arrived through.
 * Both are counts over an index (`todo(userId, state, touchedAt)` and
 * `todo(userId, createdAt)`), so they move as the user uses the app.
 *
 * Everything else on the screen is Crazy's modelling of the same data, written
 * for this range on this day and read as it stands. A day Crazy has not
 * modelled has no modelled figure, the way a week it has not written about has
 * no Week brief.
 */
export async function readMetrics(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
  range: MetricRange,
): Promise<Metrics> {
  const { day } = wallClock(now, timeZone)
  const from = metricRangeFrom(range, day)
  const rangeStart = startOfDay(from, timeZone)

  /** The moment the day `days` days before today began; -1 is tomorrow's start. */
  const dayStartsAgo = (days: number) => startOfDay(addDays(day, -days), timeZone)

  const [modelled, strip, buckets, sources] = await Promise.all([
    db.metricSnapshot.findMany({
      where: { userId, range, day },
      orderBy: [{ kind: 'asc' }, { figure: 'asc' }, { position: 'asc' }],
      select: { kind: true, figure: true, position: true, label: true, value: true, note: true },
    }),
    // The strip under the screen is thirty days whatever range is chosen —
    // that is what the card says — so it is always read at the thirty-day one.
    db.metricSnapshot.findMany({
      where: {
        userId,
        range: DEFAULT_METRIC_RANGE,
        day,
        OR: [
          { kind: 'series', figure: 'completion_days' },
          { kind: 'note', figure: 'completion_days' },
        ],
      },
      orderBy: { position: 'asc' },
      select: { kind: true, figure: true, label: true, value: true },
    }),
    // One count per band of the backlog, each over the index.
    Promise.all(
      METRIC_AGE_BUCKETS.map((bucket) =>
        db.todo.count({
          where: {
            userId,
            state: 'backlog',
            // Untouched for at least `from` whole days and fewer than `until`,
            // counted on the user's wall clock. A Todo past the archive period
            // should already be archived, so the oldest band ends at 90 days.
            touchedAt: { gte: dayStartsAgo(bucket.until - 1), lt: dayStartsAgo(bucket.from - 1) },
          },
        }),
      ),
    ),
    // One count per Provider, and one for what the user typed themselves.
    Promise.all(
      [...PROVIDERS, null].map(async (provider): Promise<TodoSource> => ({
        provider,
        count: await db.todo.count({
          where: {
            userId,
            createdAt: { gte: rangeStart, lte: now },
            sourceKind: provider === null ? null : { in: sourceKindsOf(provider) },
          },
        }),
      })),
    ),
  ])

  const noteOf = (figure: string): figure is (typeof METRIC_NOTES)[number] =>
    (METRIC_NOTES as readonly string[]).includes(figure)

  const notes: Modelled['notes'] = {}
  for (const row of [...modelled, ...strip]) {
    if (row.kind === 'note' && noteOf(row.figure)) notes[row.figure] = row.value
  }

  return {
    range,
    day,
    from,
    modelled:
      modelled.length === 0
        ? null
        : {
            // The six in the order frame 1f lays them out, not the order D1 read them.
            headlines: Object.entries(METRIC_HEADLINES).flatMap(([figure, label]) => {
              const row = modelled.find(
                (each) => each.kind === 'headline' && each.figure === figure,
              )
              return row === undefined
                ? []
                : [{ figure: figure as MetricHeadline, label, value: row.value, note: row.note }]
            }),
            focusByHour: modelled
              .filter((row) => row.kind === 'series' && row.figure === 'focus_by_hour')
              .map((row) => ({ label: row.label ?? '', hours: Number(row.value) })),
            completionDays: strip
              .filter((row) => row.kind === 'series')
              .map((row) => ({ day: row.label ?? '', share: Number(row.value) }))
              .slice(-COMPLETION_DAYS),
            notes,
          },
    backlog: {
      total: buckets.reduce((sum, count) => sum + count, 0),
      buckets: METRIC_AGE_BUCKETS.map((bucket, index) => ({
        id: bucket.id,
        label: bucket.label,
        count: buckets[index] ?? 0,
      })),
    },
    sources,
  }
}
