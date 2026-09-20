import {
  type ClientBurn,
  type EstimateGroup,
  ENERGIES,
  type Energy,
  type MetricClient,
  METRIC_RANGE_DAYS,
  METRIC_WEEKS,
  type MetricRange,
  type MetricWeek,
  type MetricsTime,
  type ModelledTime,
  type UnbilledClient,
  WORK_HOURS,
  WORK_WEEKDAYS,
  addDays,
  amountCents,
  billedMinutes,
  clientArrangement,
  daysBetween,
  DEFAULT_METRIC_RANGE,
  metricRangeFrom,
  needsClient,
  periodOf,
  secondsIn,
  startOfDay,
  startOfWeek,
  wallClock,
  weekLabel,
  weeksBack,
} from '@crazy/shared'
import type { ReadDb } from '../client'
import { readInvoices } from './invoices'

/**
 * The Metrics screen's Time tab as D1 holds it at one moment (frame 4a): where
 * a contractor's hours went, what they were worth, and what is still unbilled.
 *
 * Every figure about hours is counted here from her own Time entries, over
 * `time_entry(userId, startedAt)`, and every query filters by `userId`. The
 * money that is still unbilled is not counted a second time: it is read off
 * `readInvoices`, the Invoices screen's own read model, so the two screens can
 * never disagree about a cent — which is the one thing this screen may not do.
 *
 * What is modelled rather than counted is what nobody has measured: the hours a
 * week she means to bill, the share of her time she means to be billable, and
 * two lines of Crazy's commentary. They are `metric_snapshot` rows, written
 * once at the thirty-day range, because a target is not a function of how far
 * back the screen is looking.
 */
export async function readMetricsTime(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
  range: MetricRange,
): Promise<MetricsTime> {
  const { day } = wallClock(now, timeZone)
  const from = metricRangeFrom(range, day)
  const rangeStart = startOfDay(from, timeZone)

  // The three spans that are their own whatever range is chosen, because their
  // own kickers say so: the eight weeks of the hours chart, the thirty days of
  // "when you work", and the month the money is about.
  const mondays = weeksBack(startOfWeek(day), METRIC_WEEKS)
  const weeksStart = startOfDay(mondays[0]!, timeZone)
  const heatDays = Array.from({ length: 30 }, (_, index) => addDays(day, index - 29))
  const heatStart = startOfDay(heatDays[0]!, timeZone)
  const month = periodOf('month', day)
  const monthStart = startOfDay(month.from, timeZone)
  // The range before this one, which the median session is compared against.
  const previousFrom = addDays(from, -METRIC_RANGE_DAYS[range])
  const previousStart = startOfDay(previousFrom, timeZone)

  const earliest = new Date(
    Math.min(
      rangeStart.getTime(),
      weeksStart.getTime(),
      heatStart.getTime(),
      monthStart.getTime(),
      previousStart.getTime(),
    ),
  )

  const [rows, clientRows, projectRows, invoices, modelledRows] = await Promise.all([
    // Every spell with a second inside the widest span any card reaches over.
    // A day either side of the window catches a spell that began before it and
    // ran into it, and keeps the read on the index rather than off it.
    db.timeEntry.findMany({
      where: {
        userId,
        startedAt: { gte: new Date(earliest.getTime() - 86_400_000), lt: now },
        OR: [{ endedAt: null }, { endedAt: { gt: earliest } }],
      },
      select: {
        id: true,
        clientId: true,
        projectId: true,
        todoId: true,
        billable: true,
        startedAt: true,
        endedAt: true,
      },
      orderBy: { startedAt: 'asc' },
    }),
    db.client.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        code: true,
        arrangement: true,
        rateCents: true,
        roundingMinutes: true,
        budgetHours: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    db.project.findMany({ where: { userId }, select: { id: true, rateCents: true } }),
    // The month's money, counted once and in one place.
    readInvoices(db, userId, now, timeZone),
    db.metricSnapshot.findMany({
      where: {
        userId,
        range: DEFAULT_METRIC_RANGE,
        day,
        figure: { in: [...MODELLED_FIGURES] },
      },
      select: { kind: true, figure: true, value: true },
    }),
  ])

  const clients: MetricClient[] = clientRows.map((client) => ({
    id: client.id,
    name: client.name,
    code: client.code,
  }))
  const rateOf = (row: { clientId: string | null; projectId: string | null }) => {
    const own = projectRows.find((project) => project.id === row.projectId)?.rateCents
    if (own != null) return own
    return clientRows.find((client) => client.id === row.clientId)?.rateCents ?? 0
  }
  const span = (row: Row) => ({
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  })
  /** The seconds of one spell that fell between two moments, never past `now`. */
  const secondsBetween = (row: Row, fromAt: Date, toAt: Date) =>
    secondsIn(span(row), fromAt, toAt, now)

  // ── The chosen range ───────────────────────────────────────────────────────

  const rangeEnd = new Date(startOfDay(addDays(day, 1), timeZone).getTime())
  let trackedSeconds = 0
  let billableSeconds = 0
  let earnedCents = 0
  let noClientSeconds = 0
  let noClientCount = 0
  for (const row of rows) {
    const seconds = secondsBetween(row, rangeStart, rangeEnd)
    if (seconds <= 0) continue
    trackedSeconds += seconds
    if (needsClient(row)) {
      noClientSeconds += seconds
      noClientCount += 1
    }
    if (row.billable && row.clientId !== null) {
      billableSeconds += seconds
      // What the hour was worth, at the rate it was worth it — not what a bill
      // would say, which rounds once per line and is the invoice's question.
      earnedCents += Math.round((seconds / 3600) * rateOf(row))
    }
  }

  /** How long each ended spell of a window ran, for the average and the median. */
  const sessionsIn = (fromAt: Date, toAt: Date) =>
    rows
      .filter((row) => row.endedAt !== null && row.startedAt >= fromAt && row.startedAt < toAt)
      .map((row) =>
        Math.max(0, Math.floor((row.endedAt!.getTime() - row.startedAt.getTime()) / 1000)),
      )
      .filter((seconds) => seconds > 0)

  const sessionSeconds = sessionsIn(rangeStart, rangeEnd)
  const previousSessions = sessionsIn(previousStart, rangeStart).sort((a, b) => a - b)

  // ── The last eight weeks ───────────────────────────────────────────────────

  const weeks: MetricWeek[] = mondays.map((monday) => {
    const fromAt = startOfDay(monday, timeZone)
    const toAt = startOfDay(addDays(monday, 7), timeZone)
    let unbillableSeconds = 0
    const byClient = clients.map((client) => ({ clientId: client.id, seconds: 0 }))
    let seconds = 0
    for (const row of rows) {
      const spent = secondsBetween(row, fromAt, toAt)
      if (spent <= 0) continue
      seconds += spent
      const held =
        row.billable && row.clientId !== null
          ? byClient.find((each) => each.clientId === row.clientId)
          : undefined
      // Every second that can go on nobody's bill sits in one band, whether it
      // is Internal or work for a Client she has marked not billable.
      if (held) held.seconds += spent
      else unbillableSeconds += spent
    }
    return { monday, label: weekLabel(monday), byClient, unbillableSeconds, seconds }
  })

  // ── When she works, over the last thirty days ──────────────────────────────

  const heat = WORK_WEEKDAYS.map(() => WORK_HOURS.map(() => 0))
  const firstStartMinutes: number[] = []
  const lastStopMinutes: number[] = []
  const switches: number[] = []

  for (const each of heatDays) {
    const dayStart = startOfDay(each, timeZone)
    const dayEnd = startOfDay(addDays(each, 1), timeZone)
    const weekday = (new Date(`${each}T00:00:00Z`).getUTCDay() + 6) % 7
    const worked = rows.filter((row) => secondsBetween(row, dayStart, dayEnd) > 0)
    if (worked.length === 0) continue

    if (weekday < WORK_WEEKDAYS.length) {
      WORK_HOURS.forEach((hour, column) => {
        const hourStart = new Date(dayStart.getTime() + hour * 3_600_000)
        const hourEnd = new Date(hourStart.getTime() + 3_600_000)
        for (const row of worked) heat[weekday]![column]! += secondsBetween(row, hourStart, hourEnd)
      })
    }

    // When the day began and ended at her desk, and how often she moved Project.
    const started = worked.map((row) => Math.max(row.startedAt.getTime(), dayStart.getTime()))
    firstStartMinutes.push(Math.floor((Math.min(...started) - dayStart.getTime()) / 60_000))
    const stopped = worked
      .filter((row) => row.endedAt !== null)
      .map((row) => Math.min(row.endedAt!.getTime(), dayEnd.getTime()))
    if (stopped.length > 0) {
      lastStopMinutes.push(Math.floor((Math.max(...stopped) - dayStart.getTime()) / 60_000))
    }
    const order = [...worked].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    switches.push(
      order.reduce(
        (count, row, index) =>
          index > 0 && row.projectId !== order[index - 1]!.projectId ? count + 1 : count,
        0,
      ),
    )
  }

  // ── This month: the longest spell, and the money ───────────────────────────

  const monthEnd = startOfDay(addDays(month.to, 1), timeZone)
  const monthSessions = sessionsIn(monthStart, monthEnd)
  const monthSecondsFor = (clientId: string | null) =>
    rows.reduce(
      (total, row) =>
        row.clientId === clientId ? total + secondsBetween(row, monthStart, monthEnd) : total,
      0,
    )

  const invoiced = new Map(invoices.invoices.map((invoice) => [invoice.clientId, invoice] as const))
  const unbilled: UnbilledClient[] = []
  for (const client of clientRows) {
    const invoice = invoiced.get(client.id)
    if (invoice) {
      // What has gone to a Client is not unbilled; a draft or one waiting to be
      // checked is money she has earned and not asked for.
      if (invoice.status !== 'draft' && invoice.status !== 'review') continue
      unbilled.push({
        clientId: client.id,
        name: client.name,
        cents: invoice.totalCents,
        seconds: invoice.seconds,
        minutes: invoice.minutes,
        status: invoice.status,
        issuedDay: invoice.issuedDay,
        arrangement: clientArrangement.parse(client.arrangement),
        budgetHours: client.budgetHours,
      })
      continue
    }
    // A Client with hours this month and no invoice yet: counted the way the
    // Invoices screen counts its own "month-end hold", so the two agree.
    const seconds = rows.reduce(
      (total, row) =>
        row.clientId === client.id && row.billable
          ? total + secondsBetween(row, monthStart, monthEnd)
          : total,
      0,
    )
    if (seconds <= 0) continue
    const minutes = billedMinutes(seconds, client.roundingMinutes)
    unbilled.push({
      clientId: client.id,
      name: client.name,
      cents: amountCents(minutes, client.rateCents),
      seconds,
      minutes,
      status: null,
      issuedDay: null,
      arrangement: clientArrangement.parse(client.arrangement),
      budgetHours: client.budgetHours,
    })
  }
  unbilled.sort((a, b) => b.cents - a.cents)

  const stillUnbilled = new Set(unbilled.map((each) => each.clientId))
  const oldestUnbilled = rows.find(
    (row) =>
      row.billable &&
      row.clientId !== null &&
      stillUnbilled.has(row.clientId) &&
      secondsBetween(row, monthStart, monthEnd) > 0,
  )

  // How far through the month she is: where the black tick sits on a burn bar.
  const monthDays = daysBetween(month.from, month.to) + 1
  const elapsed =
    daysBetween(month.from, day) +
    (now.getTime() - startOfDay(day, timeZone).getTime()) / 86_400_000
  const burn: ClientBurn[] = clientRows
    .map((client) => ({
      clientId: client.id,
      name: client.name,
      arrangement: clientArrangement.parse(client.arrangement),
      budgetHours: client.budgetHours,
      monthSeconds: monthSecondsFor(client.id),
      rateCents: client.rateCents,
      pace: Math.min(1, Math.max(0, elapsed / monthDays)),
      daysLeft: Math.max(0, daysBetween(day, month.to)),
    }))
    // What she has bought comes first, in the order she took the Clients on; a
    // Client with no cap has nothing to run over and sits under them.
    .sort((a, b) => Number(a.budgetHours === null) - Number(b.budgetHours === null))

  // ── Estimate against actual ────────────────────────────────────────────────

  const timedTodoIds = [
    ...new Set(
      rows
        .filter((row) => row.todoId !== null && secondsBetween(row, rangeStart, rangeEnd) > 0)
        .map((row) => row.todoId!),
    ),
  ]
  const todos =
    timedTodoIds.length === 0
      ? []
      : await db.todo.findMany({
          where: { userId, id: { in: timedTodoIds }, estimateMinutes: { not: null } },
          select: { id: true, estimateMinutes: true, energy: true },
        })

  const estimates: EstimateGroup[] = []
  for (const todo of todos) {
    const key = (todo.energy ?? 'unsorted') as Energy | 'unsorted'
    const label = key === 'unsorted' ? 'Unsorted' : sentence(ENERGIES[key])
    const group =
      estimates.find((each) => each.key === key) ??
      (estimates.push({ key, label, estimateSeconds: 0, actualSeconds: 0, todoCount: 0 }),
      estimates.at(-1)!)
    group.estimateSeconds += (todo.estimateMinutes ?? 0) * 60
    group.actualSeconds += rows
      .filter((row) => row.todoId === todo.id)
      .reduce((total, row) => total + secondsBetween(row, earliest, rangeEnd), 0)
    group.todoCount += 1
  }
  // The most estimated first: the kinds of work she plans most of are the ones
  // worth knowing she is wrong about.
  estimates.sort((a, b) => b.estimateSeconds - a.estimateSeconds)

  return {
    range,
    day,
    from,
    monthFrom: month.from,
    monthTo: month.to,
    clients,
    currency: invoices.currency,
    trackedSeconds,
    billableSeconds,
    earnedCents,
    noClientSeconds,
    noClientCount,
    workdays: workdaysBetween(from, day),
    weeksInRange: METRIC_RANGE_DAYS[range] / 7,
    sessionSeconds,
    previousMedianSeconds: middleOf(previousSessions),
    weeks,
    heat,
    firstStartMinutes: firstStartMinutes.sort((a, b) => a - b),
    lastStopMinutes: lastStopMinutes.sort((a, b) => a - b),
    switchesPerDay:
      switches.length === 0 ? 0 : switches.reduce((a, b) => a + b, 0) / switches.length,
    longestSessionSeconds: Math.max(0, ...monthSessions),
    longSessionCount: monthSessions.filter((seconds) => seconds >= 90 * 60).length,
    oldestUnbilledDay:
      oldestUnbilled === undefined ? null : wallClock(oldestUnbilled.startedAt, timeZone).day,
    unbilled,
    unbilledCents: invoices.totals.draftedCents + invoices.hold.unbilledCents,
    burn,
    estimates,
    modelled: modelledOf(modelledRows),
  }
}

type Row = {
  clientId: string | null
  projectId: string | null
  todoId: string | null
  billable: boolean
  startedAt: Date
  endedAt: Date | null
}

/** The snapshot figures the Time tab reads; nothing else in the table is its. */
const MODELLED_FIGURES = [
  'time_target_hours',
  'time_target_billable',
  'when_you_work',
  'estimate_vs_actual',
] as const

function modelledOf(
  rows: readonly { kind: string; figure: string; value: string }[],
): ModelledTime | null {
  if (rows.length === 0) return null
  const valueOf = (figure: string) => rows.find((row) => row.figure === figure)?.value
  const hours = valueOf('time_target_hours')
  const billable = valueOf('time_target_billable')
  const notes: ModelledTime['notes'] = {}
  for (const row of rows) {
    if (row.kind !== 'note') continue
    if (row.figure === 'when_you_work' || row.figure === 'estimate_vs_actual') {
      notes[row.figure] = row.value
    }
  }
  return {
    targetHoursPerWeek: hours === undefined ? null : Number(hours),
    targetBillable: billable === undefined ? null : Number(billable),
    notes,
  }
}

/** Monday to Friday between two local days, both included. */
function workdaysBetween(from: string, to: string): number {
  let count = 0
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
    if (weekday !== 0 && weekday !== 6) count += 1
  }
  return count
}

/** The middle of a sorted list, or null where there is none. */
function middleOf(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
}

/** "Deep focus": an energy's own words, said at the head of a row. */
function sentence(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1)
}
