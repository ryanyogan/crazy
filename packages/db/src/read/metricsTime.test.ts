import { type MetricRange, localTimeToInstant, moneyShort, viewMetricsTime } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, seedPersona } from '../write'
import { readInvoices } from './invoices'
import { readMetricsTime } from './metricsTime'

// Frame 4a's moment: the same Wednesday 17 Sep 2025, 10:42 on Cori's wall clock
// that frames 2a, 2b and 3a show, with the "30 days" range the frame draws.
const timeZone = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, timeZone)!
const now = at('2025-09-17T10:42')
const userId = 'user_cori_metrics_time'

const db = () => createReadDb(env.DB)

async function metrics(range: MetricRange = '30d', user = userId) {
  const held = await readMetricsTime(db(), user, now, timeZone, range)
  return { ...held, view: viewMetricsTime(held) }
}

beforeAll(async () => {
  await seedPersona(createDb(env.DB), { persona: 'cori', userId, now, timeZone })
})

it('counts the last eight weeks by Client, with everything nobody pays for in one band', async () => {
  const { weeks, view } = await metrics()

  // Eight weeks, oldest first, ending with the week the moment falls in.
  expect(weeks.map((week) => week.label)).toEqual([
    'W31',
    'W32',
    'W33',
    'W34',
    'W35',
    'W36',
    'W37',
    'W38',
  ])
  // The three newest are September's, which tickets 19–21 pinned: the week in
  // hand holds Monday, Tuesday and this morning's 1h 42m, and nothing else.
  expect(view.weeks.at(-1)).toMatchObject({ label: 'W38', total: '14h' })

  // Every second of a week is in exactly one band: the Clients, then the work
  // that can go on nobody's bill.
  for (const week of weeks) {
    const banded =
      week.byClient.reduce((sum, each) => sum + each.seconds, 0) + week.unbillableSeconds
    expect(banded).toBe(week.seconds)
  }
  // Each Client keeps its place in the order she took them on, whatever a week
  // came to, so its colour never moves.
  expect(weeks[0]!.byClient.map((each) => each.clientId)).toEqual(
    weeks.at(-1)!.byClient.map((each) => each.clientId),
  )
  expect(view.legend.map((each) => each.label)).toEqual([
    'Meridian Health',
    'Quill & Co',
    'Bramble',
    'Not billable',
  ])
})

it('splits the range into what can be billed and what cannot', async () => {
  const month = await metrics()

  expect(month.billableSeconds).toBeLessThan(month.trackedSeconds)
  expect(month.trackedSeconds - month.billableSeconds).toBeGreaterThan(0)
  // The billable share and the untagged hours are the same rows the Time
  // screen counts, so the two screens cannot say different things about them.
  expect(month.view.tiles.find((tile) => tile.key === 'billable')?.note).toBe('119h · target 75%')
  // Cori's three spells on her own Admin Project are not among them: work she
  // put on a Project of her own is nobody's to bill, and is not asked about.
  expect(month.view.tiles.find((tile) => tile.key === 'untagged')?.note).toBe(
    '2 entries need a Client',
  )

  // A week counts less than a month, and a quarter more.
  const [week, quarter] = await Promise.all([metrics('week'), metrics('quarter')])
  expect(week.trackedSeconds).toBeLessThan(month.trackedSeconds)
  expect(quarter.trackedSeconds).toBeGreaterThan(month.trackedSeconds)
  // The eight weeks and the month's money are their own spans whatever range
  // is chosen, because their own kickers say so.
  expect(week.weeks.map((each) => each.seconds)).toEqual(month.weeks.map((each) => each.seconds))
  expect(quarter.unbilledCents).toBe(month.unbilledCents)
})

it('says what is unbilled to the cent the Invoices screen says it', async () => {
  const { unbilled, unbilledCents, view } = await metrics()
  const invoices = await readInvoices(db(), userId, now, timeZone)

  // Frame 4a's own three figures, and frame 1f's $13,755 under them.
  expect(unbilled.map((each) => [each.name, moneyShort(each.cents, 'USD')])).toEqual([
    ['Meridian Health', '$5,880'],
    ['Quill & Co', '$4,275'],
    ['Bramble', '$3,600'],
  ])
  expect(moneyShort(unbilledCents, 'USD')).toBe('$13,755')
  expect(view.unbilledNote).toBe('$13,755 unbilled · oldest entry 14 days')

  // And it is the Invoices screen's own figure, not a second count of it: what
  // has been drafted for the month, plus billable hours on no invoice at all.
  expect(unbilledCents).toBe(invoices.totals.draftedCents + invoices.hold.unbilledCents)
  expect(unbilled.map((each) => each.cents)).toEqual(
    invoices.invoices.map((invoice) => invoice.totalCents),
  )
  // An invoice that has gone is not unbilled: August's were paid.
  expect(
    (await readInvoices(db(), userId, now, timeZone, '2025-08-15')).totals.paidCents,
  ).toBeGreaterThan(0)
})

it('says where each Client stands against what they bought, and against the calendar', async () => {
  const { view } = await metrics()

  // What she has bought comes first, in the order she took the Clients on; a
  // Client with no cap has nothing to run over.
  expect(view.burn.map((row) => [row.name, row.figure, row.pace])).toEqual([
    ['Meridian Health · 40h project fee', '27.9h / 40h', '55%'],
    ['Bramble · 20h retainer', '17.8h / 20h', '55%'],
    ['Quill & Co · no cap', '22.5h', null],
  ])
  // Bramble's retainer is the line the Today screen draws too ("2h 10m left").
  expect(view.burn[1]!.note).toContain('2h 10m left')
  expect(view.burn[0]!.length).toBe('70%')
})

it('measures estimates against what the Todos behind the timers actually took', async () => {
  const { estimates, view } = await metrics()

  // Only Todos that carry both an estimate and a timer, gathered by the kind of
  // work they are — which is the word Crazy already has for it, energy.
  expect(view.estimates.map((row) => [row.label, row.ratio])).toEqual([
    ['Deep focus', '1.1×'],
    ['People & admin', '1.4×'],
    ['Quick wins', '0.7×'],
  ])
  expect(estimates.every((group) => group.todoCount > 0)).toBe(true)
  expect(view.described.estimates).toContain('Deep focus, estimated')
})

it('reads the figures Crazy modelled, and keeps another user out of them', async () => {
  const { modelled, view } = await metrics()

  expect(modelled?.targetHoursPerWeek).toBe(30)
  expect(modelled?.targetBillable).toBe(0.75)
  expect(modelled?.notes.when_you_work).toContain('Deep-work peak')
  expect(view.hoursNote).toBe('Target 30 billable h/wk · hit 3 of 7 weeks · best week 36.3h (W37)')

  // Somebody else's Metrics are their own: nothing of hers reaches them.
  const stranger = await metrics('30d', 'user_someone_else')
  expect(stranger.trackedSeconds).toBe(0)
  expect(stranger.unbilled).toEqual([])
  expect(stranger.modelled).toBe(null)
  expect(stranger.view.tiles[0]!.value).toBe('0h')
})
