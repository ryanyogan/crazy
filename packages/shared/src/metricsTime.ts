import { addDays, isoWeek } from './clock'
import { billedHours, moneyShort, usedHours } from './invoice'
import { formatTracked } from './timer'
import type { ClientArrangement } from './todo'
import { formatHourCount } from './week'

// The Metrics screen's **Time** tab (frame 4a): whether a contractor's month is
// healthy. How much of her time is billable, who it goes to, what money is
// still unbilled, and whether a budget or a retainer is about to run over.
//
// Two kinds of figure sit here, exactly as they do on the Todos tab:
//
//  - **Counted.** Everything about hours and money — the six figures, the
//    weeks by Client, when she works, the unbilled money, the burn and
//    estimate against actual — is counted from her Time entries, her Todos and
//    her invoices when the screen is read. The unbilled money is the Invoices
//    screen's own figure, so the two screens cannot disagree about a cent.
//  - **Modelled.** What cannot be counted because nobody has said it yet: the
//    hours a week she means to bill and the share of her time she means to be
//    billable — a target is a decision, not a measurement — and the two lines
//    of commentary Crazy writes. They are `metric_snapshot` rows, the same
//    standing as the Brief.
//
// Nothing here reads the clock.

/** How many weeks the hours-per-week chart reaches back over (frame 4a's kicker). */
export const METRIC_WEEKS = 8

/** The days of the week the "when you work" chart draws, Monday first. */
export const WORK_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

/** The hours of the day it draws: 08:00 to 18:00, as frame 4a labels them. */
export const WORK_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const

/** How dark a cell of that chart is drawn: 0 is an hour never worked, 4 the busiest. */
export const WORK_LEVELS = 4

/** A session longer than this is one worth counting separately (frame 4a's line). */
export const LONG_SESSION_MINUTES = 90

/** A Client, in the order they were taken on — which is the order their colour follows. */
export interface MetricClient {
  id: string
  name: string
  /** Three letters, as the timeline's chip says it: "MER". */
  code: string
}

/** One week of the hours-per-week chart: the seconds each Client had of it. */
export interface MetricWeek {
  /** The week's Monday, as a local day. */
  monday: string
  /** "W35", as the axis labels it. */
  label: string
  /** Billable seconds per Client, in the order the Clients were taken on. */
  byClient: { clientId: string; seconds: number }[]
  /** Seconds that go on nobody's bill: Internal, and anything marked not billable. */
  unbillableSeconds: number
  /** Every second of the week, billable or not. */
  seconds: number
}

/** One Client's money that is not yet on a bill anyone has been sent. */
export interface UnbilledClient {
  clientId: string
  name: string
  /** What it comes to, in cents, under that Client's own terms. */
  cents: number
  /** The seconds tracked behind it, and the minutes it bills once rounded. */
  seconds: number
  minutes: number
  /** Where their invoice for the period has got to; null where there is none yet. */
  status: 'draft' | 'review' | null
  /** The local day that invoice goes out on, where there is one. */
  issuedDay: string | null
  arrangement: ClientArrangement
  budgetHours: number | null
}

/** Where one Client's month stands against what they have bought. */
export interface ClientBurn {
  clientId: string
  name: string
  arrangement: ClientArrangement
  /** The budget or retainer in hours, where the arrangement has one. */
  budgetHours: number | null
  /** Seconds tracked for them since the first of the month. */
  monthSeconds: number
  rateCents: number
  /** How much of the month has gone, 0–1: where she should be by now. */
  pace: number
  /** How many whole days of the month are still to come. */
  daysLeft: number
}

/** Estimate against actual for one kind of work, over the Todos that carry both. */
export interface EstimateGroup {
  /** The energy the Todos are of, which is Crazy's own word for a kind of work. */
  key: string
  label: string
  estimateSeconds: number
  actualSeconds: number
  todoCount: number
}

/** What Crazy modelled for the Time tab: the targets nobody has measured, and its commentary. */
export interface ModelledTime {
  /** The billable hours a week she means to do; null where she has not said. */
  targetHoursPerWeek: number | null
  /** The share of her tracked time she means to be billable, 0–1; null where she has not said. */
  targetBillable: number | null
  /** The lines Crazy wrote where the screen could not count one. */
  notes: Partial<Record<'when_you_work' | 'estimate_vs_actual', string>>
}

/** The Metrics Time tab's read model: one user's hours and money at one moment. */
export interface MetricsTime {
  range: string
  /** The user's local day it was read on, and the range's first day. */
  day: string
  from: string
  /** The month the unbilled money and the burn are about, as local days. */
  monthFrom: string
  monthTo: string
  clients: MetricClient[]
  currency: string

  // ── Over the chosen range ──────────────────────────────────────────────────
  /** Every second tracked in the range, counted no further than the moment read. */
  trackedSeconds: number
  /** Of those, the seconds on work that can go on a bill. */
  billableSeconds: number
  /** What that billable work is worth under each Client's own terms, in cents. */
  earnedCents: number
  /** Seconds and entries in the range that name no Client at all. */
  noClientSeconds: number
  noClientCount: number
  /** Workdays in the range: Monday to Friday, today included. */
  workdays: number
  /** How many whole weeks the range covers, which utilisation is measured against. */
  weeksInRange: number
  /** How long each ended spell of the range ran, longest last. */
  sessionSeconds: number[]
  /** The median spell of the range before this one; null where there was none. */
  previousMedianSeconds: number | null

  // ── Over their own spans, whatever range is chosen ─────────────────────────
  /** The last eight weeks, oldest first. */
  weeks: MetricWeek[]
  /** Seconds worked in each weekday × hour of the last thirty days, Monday first. */
  heat: number[][]
  /** The minute of the day she first started a timer on each day she worked, sorted. */
  firstStartMinutes: number[]
  /** The minute of the day she last stopped one, sorted. */
  lastStopMinutes: number[]
  /** How often she changed Project within a day, averaged over the days she worked. */
  switchesPerDay: number
  /** The longest spell of this month, and how many of its spells ran long. */
  longestSessionSeconds: number
  longSessionCount: number
  /** The oldest local day holding unbilled billable work; null where there is none. */
  oldestUnbilledDay: string | null

  unbilled: UnbilledClient[]
  /** What they come to: the Invoices screen's own figure for the month. */
  unbilledCents: number
  burn: ClientBurn[]
  estimates: EstimateGroup[]
  /** Null where Crazy has modelled nothing for this user. */
  modelled: ModelledTime | null
}

// ── The rules that need no database ──────────────────────────────────────────

/** "W35": how a week is named on the axis. */
export function weekLabel(monday: string): string {
  return `W${isoWeek(monday)}`
}

/** The Mondays of the `count` weeks ending with the week `day` falls in, oldest first. */
export function weeksBack(monday: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(monday, (index - (count - 1)) * 7))
}

/** A share as a whole percent, which is how the frame draws every bar. */
export function percentOf(value: number, whole: number): string {
  return `${whole <= 0 ? 0 : Math.round((value / whole) * 100)}%`
}

/**
 * How much of her capacity the range's billable work filled: the hours she
 * billed against the hours she meant to bill. Null where she has set no
 * target, because utilisation without a capacity is not a figure at all.
 */
export function utilisation(
  billableSeconds: number,
  targetHoursPerWeek: number | null,
  weeksInRange: number,
): number | null {
  if (targetHoursPerWeek === null || targetHoursPerWeek <= 0 || weeksInRange <= 0) return null
  return billableSeconds / 3600 / (targetHoursPerWeek * weeksInRange)
}

/** The share of tracked time that can go on a bill; null in a range with nothing in it. */
export function billableShare(billableSeconds: number, trackedSeconds: number): number | null {
  return trackedSeconds <= 0 ? null : billableSeconds / trackedSeconds
}

/** The middle of a sorted list of numbers, or null where the list is empty. */
export function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
}

/** "08:52": a minute of the day, as the three rhythm figures read. */
export function minuteOfDay(minutes: number | null): string {
  if (minutes === null) return '—'
  const whole = Math.max(0, Math.round(minutes))
  return `${String(Math.floor(whole / 60) % 24).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

/** "131h": a span of tracked time as a headline figure reads it. */
export function headlineHours(seconds: number): string {
  return `${Math.round(seconds / 3600)}h`
}

/** "+9m", "−4m", or "level": how a median moved against the period before. */
export function sessionDelta(now: number | null, before: number | null): string | null {
  if (now === null || before === null) return null
  const minutes = Math.round((now - before) / 60)
  if (minutes === 0) return 'level'
  return `${minutes > 0 ? '+' : '−'}${Math.abs(minutes)}m`
}

/**
 * How a Client's burn reads under their own arrangement: a project fee against
 * its budget, a retainer against its hours, an hourly Client against nothing
 * at all, because an hourly Client has no cap to run over. The wording is the
 * Today screen's (`clientTerms`) turned to a period rather than a week, so the
 * two screens say the same thing about the same Client.
 */
export function burnLine(burn: ClientBurn, currency: string): string {
  const used = burn.monthSeconds / 3600
  const days = burn.daysLeft === 1 ? '1 day to go' : `${burn.daysLeft} days to go`
  if (burn.budgetHours === null) {
    return burn.arrangement === 'hourly'
      ? `Hourly · ${moneyShort(Math.round((burn.monthSeconds / 3600) * burn.rateCents), currency)} so far · ${days}`
      : `No budget set · ${days}`
  }
  const left = (burn.budgetHours - used) * 3600
  const share = used / burn.budgetHours
  const ahead = share - burn.pace
  // Where she is against where the calendar says she should be. A Client she is
  // ahead of is a Client who will run out early, which is the thing to say.
  const pace =
    Math.abs(ahead) < 0.02
      ? 'on pace'
      : `${percentOf(Math.abs(ahead), 1)} ${ahead > 0 ? 'ahead of pace' : 'behind pace'}`
  return left >= 0
    ? `${pace} · ${formatTracked(left)} left, ${days}`
    : `${formatTracked(-left)} over · ${days}`
}

/** "28.0h / 40h", or "22.5h" where the arrangement has no cap. */
export function burnUsed(burn: ClientBurn): string {
  const used = `${usedHours(burn.monthSeconds)}h`
  return burn.budgetHours === null ? used : `${used} / ${burn.budgetHours}h`
}

/**
 * What the line under a Client's unbilled money says: how many hours are
 * behind it, and why it has not gone out. The hours are the Invoices screen's
 * own — billed hours for a Client charged by the hour, hours used against a
 * retainer, because a retainer's fee is owed whatever the hours.
 */
export function unbilledNote(client: UnbilledClient, today: string): string {
  const hours =
    client.arrangement === 'retainer' && client.budgetHours !== null
      ? `Retainer · ${usedHours(client.seconds)}h used`
      : `${billedHours(client.minutes)}h`
  if (client.status === null) return `${hours} · no invoice drafted yet`
  const state = client.status === 'review' ? 'ready to review' : 'still drafting'
  return [hours, state, outDay(client.issuedDay, today)].filter((each) => each !== null).join(' · ')
}

const WEEKDAY_LONG = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })
const DAY_AND_MONTH = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
})

/**
 * When an invoice goes out, as a line under a figure says it: a weekday while
 * it is inside the week ahead, a date beyond that, and nothing at all once the
 * day has come. The same rule the Invoices screen's own kicker follows.
 */
function outDay(issuedDay: string | null, today: string): string | null {
  if (issuedDay === null) return null
  if (issuedDay <= today) return 'out today'
  const date = new Date(`${issuedDay}T00:00:00Z`)
  return issuedDay <= addDays(today, 6)
    ? `out ${WEEKDAY_LONG.format(date)}`
    : `out ${DAY_AND_MONTH.format(date)}`
}

/** How many whole days apart two local days are. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  )
}

// ── What the screen draws ────────────────────────────────────────────────────

/** One figure of the six across the head of the tab. */
export interface TimeTile {
  key: string
  label: string
  value: string
  note: string | null
}

/** One band of a week's column: a Client's hours, or the hours nobody pays for. */
export interface WeekBand {
  key: string
  /** Null is the band for everything that goes on nobody's bill. */
  clientId: string | null
  label: string
  /** Its height as a share of the tallest week, as a whole percent. */
  length: string
  seconds: number
}

export interface WeekColumn {
  label: string
  /** The week's hours, as the figure under its label reads: "31h". */
  total: string
  /** Bottom first, which is the order the Clients were taken on. */
  bands: WeekBand[]
}

export interface BarRow {
  key: string
  clientId: string | null
  name: string
  /** The figure on the right of the name. */
  figure: string
  length: string
  /** Where the black tick sits, where the row has one. */
  pace: string | null
  note: string
}

export interface EstimateRow {
  key: string
  label: string
  /** The two bars: what she thought, and what it took. */
  estimate: string
  actual: string
  /** "1.4×", or "—" where there is nothing to divide. */
  ratio: string
}

export interface MetricsTimeView {
  tiles: TimeTile[]
  /** The legend of the hours chart: every Client, then what nobody pays for. */
  legend: { key: string; clientId: string | null; label: string }[]
  weeks: WeekColumn[]
  hoursNote: string
  /** The hours across the top of the "when you work" chart. */
  heatHours: string[]
  heat: { day: string; cells: { hour: string; level: number; seconds: number }[] }[]
  /** The three figures under it: when she starts, when she stops, how much she moves. */
  rhythm: { key: string; value: string; label: string }[]
  unbilled: BarRow[]
  unbilledNote: string
  burn: BarRow[]
  estimates: EstimateRow[]
  estimatesNote: string
  /** What each chart says to someone who cannot see it. */
  described: { hours: string; heat: string; unbilled: string; burn: string; estimates: string }
}

const NOT_BILLABLE = 'Not billable'

/** Everything the Time tab draws, from one read and nothing else. */
export function viewMetricsTime(metrics: MetricsTime): MetricsTimeView {
  const { currency, modelled } = metrics
  const target = modelled?.targetHoursPerWeek ?? null
  const billable = billableShare(metrics.billableSeconds, metrics.trackedSeconds)
  const used = utilisation(metrics.billableSeconds, target, metrics.weeksInRange)

  const sorted = [...metrics.sessionSeconds].sort((a, b) => a - b)
  const middle = median(sorted)
  const average =
    sorted.length === 0 ? null : Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
  const moved = sessionDelta(middle, metrics.previousMedianSeconds)

  const tiles: TimeTile[] = [
    {
      key: 'tracked',
      label: 'Tracked',
      value: headlineHours(metrics.trackedSeconds),
      note:
        metrics.workdays <= 0
          ? null
          : `${metrics.range === 'week' ? 'this week' : `${daysBetween(metrics.from, metrics.day) + 1} days`} · ${formatHourCount(
              metrics.trackedSeconds / 3600 / metrics.workdays,
            )}h per workday`,
    },
    {
      key: 'billable',
      label: 'Billable',
      value: billable === null ? '—' : percentOf(billable, 1),
      note:
        billable === null
          ? 'Nothing tracked in this range'
          : `${headlineHours(metrics.billableSeconds)}${
              modelled?.targetBillable == null
                ? ''
                : ` · target ${percentOf(modelled.targetBillable, 1)}`
            }`,
    },
    {
      key: 'utilisation',
      label: 'Utilisation',
      value: used === null ? '—' : percentOf(used, 1),
      note: target === null ? 'No billable target set yet' : `of ${target}h/wk target`,
    },
    {
      key: 'effective-rate',
      label: 'Effective rate',
      value:
        metrics.trackedSeconds <= 0
          ? '—'
          : // To the dollar: a rate averaged over a month is not a figure with
            // cents in it, and the row beside it is read at a glance.
            moneyShort(
              Math.round(metrics.earnedCents / (metrics.trackedSeconds / 3600) / 100) * 100,
              currency,
            ),
      note: 'per tracked hour, all work',
    },
    {
      key: 'untagged',
      label: 'Untagged time',
      value: `${formatHourCount(metrics.noClientSeconds / 3600)}h`,
      note:
        metrics.noClientCount === 0
          ? 'Every entry names a Client'
          : `${metrics.noClientCount} ${metrics.noClientCount === 1 ? 'entry needs' : 'entries need'} a Client`,
    },
    {
      key: 'session',
      label: 'Avg session',
      value: average === null ? '—' : formatTracked(average),
      note:
        middle === null
          ? 'Nothing has been stopped in this range'
          : `median ${formatTracked(middle)}${moved === null ? '' : ` · ${moved} vs before`}`,
    },
  ]

  const legend = [
    ...metrics.clients.map((client) => ({
      key: client.id,
      clientId: client.id as string | null,
      label: client.name,
    })),
    { key: 'unbillable', clientId: null, label: NOT_BILLABLE },
  ]

  const tallest = Math.max(0, ...metrics.weeks.map((week) => week.seconds))
  const weeks: WeekColumn[] = metrics.weeks.map((week) => ({
    label: week.label,
    total: `${Math.round(week.seconds / 3600)}h`,
    bands: [
      ...week.byClient.map((each) => ({
        key: each.clientId,
        clientId: each.clientId as string | null,
        label: metrics.clients.find((client) => client.id === each.clientId)?.name ?? each.clientId,
        length: percentOf(each.seconds, tallest),
        seconds: each.seconds,
      })),
      {
        key: 'unbillable',
        clientId: null,
        label: NOT_BILLABLE,
        length: percentOf(week.unbillableSeconds, tallest),
        seconds: week.unbillableSeconds,
      },
    ],
  }))

  // The busiest cell is the darkest; an hour never worked is left empty.
  const busiest = Math.max(0, ...metrics.heat.flat())
  const heat = metrics.heat.map((row, index) => ({
    day: WORK_WEEKDAYS[index] ?? '',
    cells: row.map((seconds, hour) => ({
      hour: String(WORK_HOURS[hour] ?? ''),
      seconds,
      level:
        seconds <= 0 || busiest <= 0
          ? 0
          : Math.min(WORK_LEVELS, Math.ceil((seconds / busiest) * WORK_LEVELS)),
    })),
  }))

  const unbilledLargest = Math.max(0, ...metrics.unbilled.map((each) => each.cents))
  const unbilled: BarRow[] = metrics.unbilled.map((client) => ({
    key: client.clientId,
    clientId: client.clientId,
    name: client.name,
    figure: moneyShort(client.cents, currency),
    length: percentOf(client.cents, unbilledLargest),
    pace: null,
    note: unbilledNote(client, metrics.day),
  }))

  const burn: BarRow[] = metrics.burn.map((client) => ({
    key: client.clientId,
    clientId: client.clientId,
    name: `${client.name} · ${burnTitle(client)}`,
    figure: burnUsed(client),
    length:
      client.budgetHours === null
        ? percentOf(
            client.monthSeconds,
            Math.max(...metrics.burn.map((each) => each.monthSeconds), 1),
          )
        : percentOf(Math.min(client.monthSeconds / 3600, client.budgetHours), client.budgetHours),
    pace: client.budgetHours === null ? null : percentOf(client.pace, 1),
    note: burnLine(client, currency),
  }))

  const estimateLargest = Math.max(
    0,
    ...metrics.estimates.flatMap((group) => [group.estimateSeconds, group.actualSeconds]),
  )
  const estimates: EstimateRow[] = metrics.estimates.map((group) => ({
    key: group.key,
    label: group.label,
    estimate: percentOf(group.estimateSeconds, estimateLargest),
    actual: percentOf(group.actualSeconds, estimateLargest),
    ratio:
      group.estimateSeconds <= 0
        ? '—'
        : `${(group.actualSeconds / group.estimateSeconds).toFixed(1)}×`,
  }))

  // The week in hand is still being worked, so it is not counted against her.
  const whole = metrics.weeks.slice(0, -1)
  const hit = target === null ? 0 : whole.filter((week) => billableOf(week) / 3600 >= target).length
  const best = metrics.weeks.reduce<MetricWeek | null>(
    (most, week) => (most === null || week.seconds > most.seconds ? week : most),
    null,
  )

  return {
    tiles,
    legend,
    weeks,
    hoursNote: [
      target === null
        ? null
        : `Target ${target} billable h/wk · hit ${hit} of ${whole.length} weeks`,
      best === null || best.seconds === 0
        ? null
        : `best week ${formatHourCount(best.seconds / 3600)}h (${best.label})`,
    ]
      .filter((each) => each !== null)
      .join(' · '),
    heatHours: WORK_HOURS.map((hour) => String(hour)),
    heat,
    rhythm: [
      {
        key: 'first',
        value: minuteOfDay(median(metrics.firstStartMinutes)),
        label: 'median first timer',
      },
      {
        key: 'last',
        value: minuteOfDay(median(metrics.lastStopMinutes)),
        label: 'median last stop',
      },
      {
        key: 'switches',
        value: metrics.switchesPerDay.toFixed(1),
        label: 'project switches / day',
      },
    ],
    unbilled,
    unbilledNote:
      metrics.unbilled.length === 0
        ? 'Nothing is waiting to be billed for this month.'
        : [
            `${moneyShort(metrics.unbilledCents, currency)} unbilled`,
            metrics.oldestUnbilledDay === null
              ? null
              : `oldest entry ${daysBetween(metrics.oldestUnbilledDay, metrics.day)} days`,
          ]
            .filter((each) => each !== null)
            .join(' · '),
    burn,
    estimates,
    estimatesNote: [
      'Light = estimated, dark = actual.',
      modelled?.notes.estimate_vs_actual ?? null,
      metrics.longestSessionSeconds === 0
        ? null
        : `Longest session ${formatTracked(metrics.longestSessionSeconds)}, ${metrics.longSessionCount} ${
            metrics.longSessionCount === 1 ? 'session' : 'sessions'
          } over ${LONG_SESSION_MINUTES} min this month.`,
    ]
      .filter((each) => each !== null)
      .join(' '),
    described: {
      hours:
        weeks.length === 0
          ? 'Nothing has been tracked in the last eight weeks.'
          : `Hours a week, oldest first: ${weeks
              .map(
                (week) =>
                  `${week.label}, ${week.total} (${week.bands
                    .filter((band) => band.seconds > 0)
                    .map((band) => `${band.label} ${formatTracked(band.seconds)}`)
                    .join(', ')})`,
              )
              .join('; ')}.`,
      heat:
        busiest <= 0
          ? 'Nothing has been tracked in the last thirty days.'
          : `Hours worked by weekday and hour: ${heat
              .map(
                (row) =>
                  `${row.day}, ${row.cells
                    .filter((cell) => cell.seconds > 0)
                    .map((cell) => `${cell.hour}:00 ${formatTracked(cell.seconds)}`)
                    .join(', ')}`,
              )
              .join('; ')}.`,
      unbilled:
        unbilled.length === 0
          ? 'Nothing is unbilled.'
          : `${unbilled.map((row) => `${row.name}, ${row.figure}, ${row.note}`).join('; ')}.`,
      burn:
        burn.length === 0
          ? 'No Client has a budget or a retainer.'
          : `${burn.map((row) => `${row.name}, ${row.figure}, ${row.note}`).join('; ')}.`,
      estimates:
        estimates.length === 0
          ? 'No Todo with an estimate has had a timer on it yet.'
          : `${metrics.estimates
              .map(
                (group) =>
                  `${group.label}, estimated ${formatTracked(group.estimateSeconds)}, tracked ${formatTracked(
                    group.actualSeconds,
                  )}, over ${group.todoCount} ${group.todoCount === 1 ? 'Todo' : 'Todos'}`,
              )
              .join('; ')}.`,
    },
  }
}

/** Billable seconds of a week: everything that went to a Client. */
function billableOf(week: MetricWeek): number {
  return week.byClient.reduce((total, each) => total + each.seconds, 0)
}

/** "40h project fee", "20h Sep retainer", "no cap": what a Client has bought. */
function burnTitle(burn: ClientBurn): string {
  switch (burn.arrangement) {
    case 'project_fee':
      return burn.budgetHours === null ? 'project fee' : `${burn.budgetHours}h project fee`
    case 'retainer':
      return burn.budgetHours === null ? 'retainer' : `${burn.budgetHours}h retainer`
    case 'hourly':
      return 'no cap'
  }
}
