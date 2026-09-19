import { z } from 'zod'
import { addDays, clockTime, isoWeek, startOfDay, startOfWeek, wallClock } from './clock'
import { INTERNAL, formatLogged } from './timer'

// The Time screen (frame 2b, the left half): a contractor's timesheet, read a
// Day, a Week or a Month at a time. The rows come from D1 through `readTime`;
// every figure on the screen is derived here, from those rows and a moment
// handed in, so the optimistic screen and the read one count the same way and
// nothing reads a clock.

/** How much of the timesheet is shown at once. */
export const TIME_VIEWS = ['day', 'week', 'month'] as const
export type TimeView = (typeof TIME_VIEWS)[number]
export const timeView = z.enum(TIME_VIEWS)

/** The word each view is offered under, in the segmented control frame 2b draws. */
export const TIME_VIEW_LABELS: Record<TimeView, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
}

/** One Time entry as the timesheet lists it, with the names it says out loud. */
export interface TimeRow {
  id: string
  /** Null is Internal: the absence of a Client, not a Client of its own. */
  clientId: string | null
  clientName: string | null
  projectId: string | null
  projectName: string | null
  note: string
  billable: boolean
  startedAt: string
  /** Null while it runs: the running timer is the Time entry with no end. */
  endedAt: string | null
  /** Who Crazy thinks the hours were for, where the entry names no Client. */
  suggestedClientId: string | null
  suggestedClientName: string | null
  suggestedProjectId: string | null
  suggestedProjectName: string | null
}

/** A Client as the timesheet names and colours one; the order is the order taken on. */
export interface TimeClient {
  id: string
  name: string
  /** Three letters, as the timeline's chip says it: "MER". */
  code: string
}

/** A Project as the timesheet names one. */
export interface TimeProject {
  id: string
  name: string
  clientId: string | null
}

/**
 * What the Time screen reads: one period's Time entries, and the Clients and
 * Projects they can name. The period's own arithmetic — the day groups, the
 * daily totals, what is billable and what still needs a Client — is `viewTime`.
 */
export interface TimeRead {
  view: TimeView
  /** The local day the period is anchored on: the day itself, a day in the week, or in the month. */
  on: string
  /** The first local day of the period and the last, both inclusive. */
  from: string
  to: string
  /** Every entry with time inside the period, newest first. */
  rows: TimeRow[]
  clients: TimeClient[]
  projects: TimeProject[]
}

/** How long a Time entry ran, in seconds, counted no further than `now`. */
export function rowSeconds(row: Pick<TimeRow, 'startedAt' | 'endedAt'>, now: Date): number {
  const from = new Date(row.startedAt).getTime()
  const until = Math.min(
    row.endedAt ? new Date(row.endedAt).getTime() : now.getTime(),
    now.getTime(),
  )
  return Math.max(0, Math.floor((until - from) / 1000))
}

/** The seconds of a Time entry that fall between two moments. */
function secondsBetween(
  row: Pick<TimeRow, 'startedAt' | 'endedAt'>,
  from: Date,
  to: Date,
  now: Date,
): number {
  const start = Math.max(new Date(row.startedAt).getTime(), from.getTime())
  const until = Math.min(
    row.endedAt ? new Date(row.endedAt).getTime() : now.getTime(),
    now.getTime(),
    to.getTime(),
  )
  return Math.max(0, Math.floor((until - start) / 1000))
}

/**
 * The hours a Time entry comes to, as an invoice counts them: decimal, two
 * places, which is how frame 2b's Hours column reads. 1h 42m is 1.70.
 */
export function decimalHours(seconds: number): string {
  return (Math.max(0, seconds) / 3600).toFixed(2)
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' })
const MONTH = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' })
const DAY_AND_MONTH = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
/** "Wed 17": a weekday and the day of its month, where a weekday alone repeats. */
const weekdayAndDay = (date: Date) => `${WEEKDAY.format(date)} ${date.getUTCDate()}`
const SAID = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const asDate = (day: string) => new Date(`${day}T00:00:00Z`)

/** The first and last local day of the period a view shows, anchored on a day. */
export function periodOf(view: TimeView, on: string): { from: string; to: string } {
  switch (view) {
    case 'day':
      return { from: on, to: on }
    case 'week': {
      const from = startOfWeek(on)
      return { from, to: addDays(from, 6) }
    }
    case 'month': {
      const from = `${on.slice(0, 7)}-01`
      const next = asDate(from)
      next.setUTCMonth(next.getUTCMonth() + 1)
      return { from, to: addDays(next.toISOString().slice(0, 10), -1) }
    }
  }
}

/** The day the period before this one is anchored on, and the one after it. */
export function periodStep(view: TimeView, on: string, by: -1 | 1): string {
  switch (view) {
    case 'day':
      return addDays(on, by)
    case 'week':
      return addDays(startOfWeek(on), by * 7)
    case 'month': {
      const date = asDate(`${on.slice(0, 7)}-01`)
      date.setUTCMonth(date.getUTCMonth() + by)
      return date.toISOString().slice(0, 10)
    }
  }
}

/** "week 38", "Wed 17 Sep", "September": what the screen's heading names after "Time · ". */
export function periodName(view: TimeView, on: string): string {
  switch (view) {
    case 'day':
      return DAY_AND_MONTH.format(asDate(on))
    case 'week':
      return `week ${isoWeek(on)}`
    case 'month':
      return MONTH.format(asDate(on))
  }
}

/** "This week", "Today", "This month": the way back to the period the user is in. */
export function thisPeriod(view: TimeView): string {
  return view === 'day' ? 'Today' : view === 'week' ? 'This week' : 'This month'
}

/** Whether the period the screen is on is the one the moment falls in. */
export function isThisPeriod(view: TimeView, on: string, now: Date, timeZone: string): boolean {
  const { day } = wallClock(now, timeZone)
  const here = periodOf(view, on)
  const there = periodOf(view, day)
  return here.from === there.from
}

/** What one Client put into a day or a week, which is one band of its bar. */
export interface TimeShare {
  clientId: string | null
  clientName: string | null
  seconds: number
}

/**
 * One card of the strip over the timesheet (frame 2b): a part of the period
 * with what went into it. A week is drawn day by day and a month week by week,
 * so the strip is never more than a handful of cards however long the period.
 */
export interface TimeCard {
  /** The local day the card stands for, or the Monday of the week it stands for. */
  key: string
  /** "Mon", or "W38" in a month. */
  name: string
  /** The same, said in full to assistive technology. */
  said: string
  seconds: number
  /** Whose the hours were, most first: the bands of the card's bar. */
  shares: TimeShare[]
  /** How far along the bar is drawn: this card's hours against the fullest card's. */
  fill: number
  /** The line under the bar: "today · running", "1 needs a Client", "3 Clients". */
  note: string
  /** Whether the card holds the day the moment falls on. */
  today: boolean
}

/** What a period came to, and what is still not settled in it. */
export interface TimeTotals {
  seconds: number
  billableSeconds: number
  notBillableSeconds: number
  /** How many entries in the period name no Client, which is what month-end trips over. */
  noClient: number
}

/** The whole Time screen at a moment: the cards, the rows, the totals and the flag. */
export interface TimeScreenView {
  cards: TimeCard[]
  /** The period's entries, newest first, as the table lists them. */
  rows: TimeRow[]
  totals: TimeTotals
  /** The entries with no Client, oldest first: what the flag under the table is about. */
  needClient: TimeRow[]
  /** "2 entries need a Client", or null when none do. */
  flag: string | null
  /** The sentence beside it, which names them and what Crazy thinks they were. */
  suggestion: string | null
  title: string
}

/** The seconds each Client put into a span, most first; Internal is one of them. */
function sharesIn(rows: readonly TimeRow[], from: Date, to: Date, now: Date): TimeShare[] {
  const by = new Map<string, TimeShare>()
  for (const row of rows) {
    const seconds = secondsBetween(row, from, to, now)
    if (seconds <= 0) continue
    const key = row.clientId ?? ''
    const held = by.get(key) ?? {
      clientId: row.clientId,
      clientName: row.clientName,
      seconds: 0,
    }
    by.set(key, { ...held, seconds: held.seconds + seconds })
  }
  return [...by.values()].sort((a, b) => b.seconds - a.seconds)
}

/** What the card says under its bar. */
function cardNote(
  rows: readonly TimeRow[],
  shares: readonly TimeShare[],
  today: boolean,
  running: boolean,
): string {
  if (today) return running ? 'today · running' : 'today'
  const untagged = rows.filter((row) => row.clientId === null).length
  if (untagged > 0) return `${untagged} ${untagged === 1 ? 'needs' : 'need'} a Client`
  if (shares.length > 1) return `${shares.length} Clients`
  return shares[0]?.clientName ?? ''
}

/** The days a week's strip draws: the working week, and a weekend day that was worked. */
function weekCardDays(from: string, rows: readonly TimeRow[], timeZone: string): string[] {
  const worked = new Set(rows.map((row) => wallClock(new Date(row.startedAt), timeZone).day))
  return Array.from({ length: 7 }, (_, index) => addDays(from, index)).filter(
    (day, index) => index < 5 || worked.has(day),
  )
}

/** The parts a period is drawn in: a day, the days of a week, the weeks of a month. */
function cardSpans(read: TimeRead, timeZone: string): { key: string; from: string; to: string }[] {
  if (read.view === 'day') return [{ key: read.from, from: read.from, to: read.from }]
  if (read.view === 'week') {
    return weekCardDays(read.from, read.rows, timeZone).map((day) => ({
      key: day,
      from: day,
      to: day,
    }))
  }
  const spans: { key: string; from: string; to: string }[] = []
  for (let day = startOfWeek(read.from); day <= read.to; day = addDays(day, 7)) {
    const from = day < read.from ? read.from : day
    const last = addDays(day, 6)
    spans.push({ key: day, from, to: last > read.to ? read.to : last })
  }
  return spans
}

/**
 * Everything the Time screen shows, at one moment: the strip of cards over the
 * table with what each part of the period came to, the entries themselves, the
 * period's totals, and the entries that still name no Client. The running entry
 * counts up to `now` and no further, and an entry that crosses local midnight
 * is counted into each day for the part that fell in it — so the cards always
 * add up to the period and the period always adds up to what was worked.
 */
export function viewTime(read: TimeRead, now: Date, timeZone: string): TimeScreenView {
  const periodStart = startOfDay(read.from, timeZone)
  const periodEnd = startOfDay(addDays(read.to, 1), timeZone)
  const today = wallClock(now, timeZone).day

  const cards: TimeCard[] = cardSpans(read, timeZone).map((span) => {
    const from = startOfDay(span.from, timeZone)
    const to = startOfDay(addDays(span.to, 1), timeZone)
    const inside = read.rows.filter((row) => secondsBetween(row, from, to, now) > 0)
    const shares = sharesIn(read.rows, from, to, now)
    const seconds = shares.reduce((total, share) => total + share.seconds, 0)
    const holdsToday = today >= span.from && today <= span.to
    return {
      key: span.key,
      name:
        read.view === 'month'
          ? `W${isoWeek(span.key)}`
          : read.view === 'day'
            ? DAY_AND_MONTH.format(asDate(span.key))
            : WEEKDAY.format(asDate(span.key)),
      said: SAID.format(asDate(span.key)),
      seconds,
      shares,
      fill: 0,
      note: cardNote(
        inside,
        shares,
        holdsToday,
        inside.some((row) => row.endedAt === null),
      ),
      today: holdsToday,
    }
  })
  // The fullest card is drawn full and the rest are read against it, which is
  // how a Client's week is drawn on the Today screen too.
  const most = Math.max(...cards.map((card) => card.seconds), 0)
  for (const card of cards) card.fill = most === 0 ? 0 : card.seconds / most

  let seconds = 0
  let billableSeconds = 0
  for (const row of read.rows) {
    const held = secondsBetween(row, periodStart, periodEnd, now)
    seconds += held
    if (row.billable) billableSeconds += held
  }
  const needClient = read.rows
    .filter((row) => row.clientId === null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  return {
    cards,
    rows: read.rows,
    totals: {
      seconds,
      billableSeconds,
      notBillableSeconds: seconds - billableSeconds,
      noClient: needClient.length,
    },
    needClient,
    flag:
      needClient.length === 0
        ? null
        : `${needClient.length} ${needClient.length === 1 ? 'entry needs' : 'entries need'} a Client`,
    suggestion: suggestionLine(needClient, timeZone),
    title: `Time · ${periodName(read.view, read.on)}`,
  }
}

/** "Tue 14:00–14:40": one entry named by when it was, as the flag's sentence names it. */
export function spanLabel(row: TimeRow, timeZone: string): string {
  const day = WEEKDAY.format(asDate(wallClock(new Date(row.startedAt), timeZone).day))
  const from = clockTime(new Date(row.startedAt), timeZone)
  return row.endedAt === null
    ? `${day} ${from}–`
    : `${day} ${from}–${clockTime(new Date(row.endedAt), timeZone)}`
}

/**
 * What Crazy says about the entries that name no Client, in the sentence frame
 * 2b writes under the table: which they are, and who it thinks they were for.
 * Where it does not think anything it says what to do instead of guessing.
 */
export function suggestionLine(needClient: readonly TimeRow[], timeZone: string): string | null {
  if (needClient.length === 0) return null
  const named = needClient.map((row) => spanLabel(row, timeZone))
  const list =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
  const was = named.length === 1 ? 'was' : 'were'
  const said = `${list} ${was} tracked to ${INTERNAL}.`

  const suggested = [...new Set(needClient.map((row) => row.suggestedClientName))]
  const only = suggested.length === 1 ? suggested[0] : null
  if (!only) {
    return needClient.some((row) => row.suggestedClientName !== null)
      ? `${said} Tap one to give it a Client.`
      : `${said} Give each a Client so the hours can be billed.`
  }
  const think = named.length === 1 ? 'it was' : named.length === 2 ? 'both were' : 'they were'
  return `${said} I think ${think} ${only}; tap to confirm.`
}

/**
 * When an entry was, as the table's first column says it: the weekday and the
 * time it began, with a trailing dash while it is still running — which is what
 * frame 2b draws. A day at a time there is no weekday to give; a month at a
 * time the date comes with it, because a weekday alone repeats.
 */
export function whenLabel(row: TimeRow, view: TimeView, timeZone: string): string {
  const day = wallClock(new Date(row.startedAt), timeZone).day
  const at = clockTime(new Date(row.startedAt), timeZone)
  const running = row.endedAt === null ? '–' : ''
  switch (view) {
    case 'day':
      return `${at}${running}`
    case 'week':
      return `${WEEKDAY.format(asDate(day))} ${at}${running}`
    case 'month':
      return `${weekdayAndDay(asDate(day))} ${at}${running}`
  }
}

/** The small word beside a note: what is running, and what still needs a Client. */
export function rowFlag(row: TimeRow): string {
  if (row.endedAt === null) return 'running'
  if (row.clientId !== null) return ''
  return row.suggestedClientName === null
    ? 'no Client'
    : `Client? likely ${row.suggestedClientName}`
}

/** "7:45": what a day or a week came to, as a card's figure reads it. */
export function cardTotal(seconds: number): string {
  return seconds === 0 ? '—' : formatLogged(seconds)
}

// ── Laying a change over the rows a browser is showing ───────────────────────

/** What a patch may change about a row the Time screen is showing. */
export interface TimeRowChange {
  startedAt?: string
  endedAt?: string | null
  note?: string
  billable?: boolean
  clientId?: string | null
  projectId?: string | null
}

/** The names a cached Time screen can put to a Client and a Project. */
function namesFor(
  read: TimeRead,
  clientId: string | null | undefined,
  projectId: string | null | undefined,
): { clientName: string | null; projectName: string | null } {
  return {
    clientName: clientId ? (read.clients.find((each) => each.id === clientId)?.name ?? null) : null,
    projectName: projectId
      ? (read.projects.find((each) => each.id === projectId)?.name ?? null)
      : null,
  }
}

/**
 * The period's rows with one entry changed. A change to an entry the period
 * does not hold leaves it as it was, so a patch may be laid over any period
 * without asking which it is of. The Client's and Project's names come from the
 * lists this read already holds: a patch carries ids and never names.
 */
export function changeTimeRow(read: TimeRead, id: string, set: TimeRowChange): TimeRead {
  const was = read.rows.find((row) => row.id === id)
  if (!was) return read
  const clientId = 'clientId' in set ? (set.clientId ?? null) : was.clientId
  const projectId = 'projectId' in set ? (set.projectId ?? null) : was.projectId
  const named =
    clientId === was.clientId && projectId === was.projectId
      ? { clientName: was.clientName, projectName: was.projectName }
      : namesFor(read, clientId, projectId)
  const now: TimeRow = { ...was, ...set, clientId, projectId, ...named }
  return { ...read, rows: sorted(read.rows.map((row) => (row.id === id ? now : row))) }
}

/** The period's rows with an entry taken out of them. */
export function removeTimeRow(read: TimeRead, id: string): TimeRead {
  if (!read.rows.some((row) => row.id === id)) return read
  return { ...read, rows: read.rows.filter((row) => row.id !== id) }
}

/** What a new Time entry brings with it, before the screen puts names to it. */
export interface NewTimeRow {
  id: string
  clientId: string | null
  projectId: string | null
  note: string
  billable: boolean
  startedAt: string
  endedAt: string | null
}

/**
 * The period's rows with one more entry in them, if it belongs to the period.
 * Laid twice — once as the answer to the command, once over the socket — it
 * says the same thing: an entry already in the list is replaced, not repeated.
 */
export function insertTimeRow(read: TimeRead, entry: NewTimeRow, timeZone: string): TimeRead {
  // An entry outside the period is not this period's: a patch may be laid over
  // every period a tab has read without asking which it is of.
  const from = startOfDay(read.from, timeZone)
  const to = startOfDay(addDays(read.to, 1), timeZone)
  if (new Date(entry.startedAt) >= to) return read
  if (entry.endedAt !== null && new Date(entry.endedAt) <= from) return read

  const row: TimeRow = {
    ...entry,
    ...namesFor(read, entry.clientId, entry.projectId),
    suggestedClientId: null,
    suggestedClientName: null,
    suggestedProjectId: null,
    suggestedProjectName: null,
  }
  const held = read.rows.some((each) => each.id === row.id)
  return {
    ...read,
    rows: sorted(
      held ? read.rows.map((each) => (each.id === row.id ? row : each)) : [...read.rows, row],
    ),
  }
}

/** Newest first, which is how the table lists a period. */
function sorted(rows: readonly TimeRow[]): TimeRow[] {
  return [...rows].sort(
    (a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id),
  )
}
