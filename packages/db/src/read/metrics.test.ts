import { localTimeToInstant, type MetricRange, viewMetrics } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, persistOps, seedPersona } from '../write'
import { readMetrics } from './metrics'

// Frame 1f's moment: the same Wednesday 17 Sep 2025, 08:41 every other frame
// shows, with the "30 days" range the frame draws selected.
const timeZone = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, timeZone)!
const now = at('2025-09-17T08:41')
const userId = 'user_ryan_metrics'

async function metrics(range: MetricRange = '30d', moment = now, user = userId) {
  const held = await readMetrics(createReadDb(env.DB), user, moment, timeZone, range)
  return { ...held, ...viewMetrics(held) }
}

beforeAll(async () => {
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId, now, timeZone })
})

it('counts the backlog into the bands frame 1f draws, by how long each has sat', async () => {
  const { backlog, backlogTitle, ageingBars } = await metrics()

  // The two older bands are the frame's own: 5 in 30–60d, and the six One-offs
  // that cross ninety days, which frame 1d counts too. The two younger ones run
  // over it, because every Project's backlog is the persona's as well now
  // (frame 1d) and the frame was drawn before those Todos existed. A debt for
  // the designer: the two frames cannot both be right about one backlog.
  expect(backlogTitle).toBe('Backlog ageing · 51 items')
  expect(backlog.buckets.map((bucket) => [bucket.label, bucket.count])).toEqual([
    ['< 7d', 21],
    ['7–30d', 19],
    ['30–60d', 5],
    ['60–90d', 6],
  ])
  // Every bar is a share of the largest, rounded as the frame rounds it.
  expect(ageingBars.map((bar) => bar.length)).toEqual(['100%', '90%', '24%', '29%'])
})

it('counts where the range’s Todos came from, Providers first and typed-in last', async () => {
  const { sourceBars } = await metrics()

  expect(sourceBars.map((bar) => [bar.chip, bar.value, bar.length])).toEqual([
    ['LN', '41', '100%'],
    ['SL', '27', '66%'],
    ['NO', '12', '29%'],
    ['GM', '9', '22%'],
    ['You', '33', '80%'],
  ])
})

it('counts fewer Todos over a week than over a month, and more over a quarter', async () => {
  const total = async (range: MetricRange) =>
    (await metrics(range)).sources.reduce((sum, source) => sum + source.count, 0)

  const [week, month, quarter] = await Promise.all([total('week'), total('30d'), total('quarter')])

  expect(week).toBeLessThan(month)
  expect(month).toBe(122)
  expect(quarter).toBeGreaterThan(month)
  // The backlog is the backlog whatever range is chosen: it is not a span.
  expect((await metrics('week')).backlog.total).toBe(51)
})

it('reads the figures Crazy modelled for the chosen range, and its thirty-day strip', async () => {
  const month = await metrics()

  expect(
    month.modelled?.headlines.map((figure) => [figure.label, figure.value, figure.note]),
  ).toEqual([
    ['Completion', '82%', '+6 vs last 30d'],
    ['Carry-over', '18%', '−4 vs last 30d'],
    ['Focus hours', '14.5', 'this week · 21 avg'],
    ['Median item age', '1.3d', 'backlog 9.8d'],
    ['Take-on streak', '11', 'days'],
    ['Response debt', '3', 'mentions > 24h'],
  ])
  expect(month.focusBars.map((bar) => bar.length)).toEqual([
    '22%',
    '68%',
    '100%',
    '35%',
    '40%',
    '74%',
    '30%',
    '62%',
    '28%',
    '18%',
  ])
  expect(month.focusBars.filter((bar) => bar.peak).map((bar) => bar.label)).toEqual(['10'])

  // The strip is thirty days at every range, because that is what it says.
  const week = await metrics('week')
  expect(week.modelled?.headlines[0]?.value).toBe('88%')
  expect(week.heat).toHaveLength(30)
  expect(week.heat.map((day) => day.level)).toEqual(month.heat.map((day) => day.level))
  expect(month.heat.map((day) => day.level).slice(0, 8)).toEqual([3, 4, 2, 4, 4, 1, 0, 3])
  expect(month.heat[29]?.day).toBe('2025-09-17')
})

it('shows no modelled figure on a day Crazy has not modelled', async () => {
  const tomorrow = await metrics('30d', at('2025-09-18T08:41'))

  expect(tomorrow.modelled).toBeNull()
  expect(tomorrow.heat).toEqual([])
  // What the screen counts is still counted, because nothing writes it down.
  expect(tomorrow.backlog.total).toBeGreaterThan(0)
})

it('reads only the rows of the user asking', async () => {
  const other = await metrics('30d', now, 'user_metrics_someone_else')

  expect(other.modelled).toBeNull()
  expect(other.backlog.total).toBe(0)
  expect(other.sourceBars).toEqual([])
})

it('moves a Todo out of the backlog’s ageing the moment it is completed', async () => {
  const user = 'user_metrics_ticker'
  const db = createDb(env.DB)
  await seedPersona(db, { persona: 'ryan', userId: user, now, timeZone })
  const before = await metrics('30d', now, user)

  await persistOps(db, user, [
    {
      type: 'todo.set',
      id: `${user}/todo/archive-soon-5`,
      set: { state: 'done', doneAt: now.toISOString() },
    },
  ])

  const after = await metrics('30d', now, user)
  expect(after.backlog.total).toBe(before.backlog.total - 1)
  expect(after.backlog.buckets[3]?.count).toBe((before.backlog.buckets[3]?.count ?? 0) - 1)
  // It arrived before the thirty days, so where Todos come from does not move.
  expect(after.sourceBars).toEqual(before.sourceBars)
})
