import { addDays, clockTime, startOfDay, wallClock } from './clock'
import type { ClientArrangement } from './todo'

// The timer, as the Today screen holds it and shows it. A Time entry is the
// record and the timer is only the control (CONTEXT.md); the running timer is
// the one Time entry with no end. Nothing here reads the clock: the moment
// comes in as a parameter, from the loader or from the browser's ticker.

/** A Time entry as the bar shows it: the row, with the names it says out loud. */
export interface TimerEntry {
  id: string
  /** Null is Internal: the absence of a Client, not a Client of its own. */
  clientId: string | null
  /** The Client's name; null exactly when there is no Client. */
  clientName: string | null
  projectId: string | null
  projectName: string | null
  /** The Todo the timer was started from, if it was started from one (ticket 19). */
  todoId: string | null
  /** That Todo's title, as the header says it; null when the entry names no Todo. */
  todoTitle: string | null
  note: string
  billable: boolean
  startedAt: string
  /** Null while it runs: the running timer is the Time entry with no end. */
  endedAt: string | null
}

/**
 * What the Today screen holds of the timer, with the Billing module on. The
 * figures the bar shows are derived from these rows at a moment, by `viewTimer`.
 */
export interface TodayTimer {
  /** The Time entry with no end, if one is running. */
  running: TimerEntry | null
  /**
   * The last Time entry that has ended, whatever day it was on. It is what the
   * idle bar reports and what it preselects from; no calendar is guessed at.
   */
  last: TimerEntry | null
  /** Every Time entry that touches today, newest first: what today's totals count. */
  today: TimerEntry[]
}

/** A Project as the picker offers it. */
export interface PickerProject {
  id: string
  name: string
  /** When it was last timed, if ever; the picker says how long ago in a word. */
  lastStartedAt: string | null
  /** Whether the running Time entry is on this Project. */
  running: boolean
}

/**
 * A Client the picker groups its Projects under, and an option in its own
 * right: choosing the Client alone is work for them that is part of nothing
 * larger (CONTEXT.md, "One-off").
 */
export interface PickerClient {
  /** Null is Internal: the absence of a Client, not a Client of its own. */
  id: string | null
  /** The Client's name, or "Internal" where there is none. */
  name: string
  /** Seconds tracked for this Client since Monday, counted no further than now. */
  weekSeconds: number
  projects: PickerProject[]
}

/** Work timed lately, as the phone's sheet leads with it: one row per piece of work. */
export interface RecentWork extends TimerWork {
  /** When that spell of it began. */
  startedAt: string
  /** How long that spell ran, in seconds. */
  seconds: number
}

/**
 * Everything the picker offers: every Client of the user's with its Projects
 * and the hours put in this week, the Projects that belong to no Client under
 * Internal, and the work they timed most recently. Read only with the Billing
 * module on, beside the timer's own rows.
 */
export interface TimerPicker {
  clients: PickerClient[]
  recent: RecentWork[]
}

/** What `decide` needs to know of a Time entry. */
export interface TimeEntryFacts {
  id: string
  clientId: string | null
  projectId: string | null
  /** The Todo it was started from; what makes a second spell on the same work a real change. */
  todoId: string | null
  startedAt: string
  endedAt: string | null
  /** Who Crazy thinks the hours were for, where the entry names no Client. */
  suggestedClientId?: string | null
  suggestedProjectId?: string | null
  /** The Client's name, where the loader could say it: a refusal names whose hours it clashed with. */
  clientName?: string | null
}

/** What `decide` needs to know of a Project a timer names: whose work it is. */
export interface ProjectFacts {
  id: string
  clientId: string | null
}

/** The Client and Project a Time entry is for, as the bar and the picker name them. */
export interface TimerWork {
  clientId: string | null
  clientName: string | null
  projectId: string | null
  projectName: string | null
}

/** The label a Client wears where it has none: the absence of a Client, not one of its own. */
export const INTERNAL = 'Internal'

/** The three letters that stand for no Client at all, as the timeline's chip says it. */
export const INTERNAL_CODE = 'INT'

/** Seconds of a Time entry that fall within the day, counted no further than `now`. */
function secondsWithin(entry: TimerEntry, dayStart: Date, now: Date): number {
  const from = Math.max(new Date(entry.startedAt).getTime(), dayStart.getTime())
  const until = Math.min(
    entry.endedAt ? new Date(entry.endedAt).getTime() : now.getTime(),
    now.getTime(),
  )
  return Math.max(0, Math.floor((until - from) / 1000))
}

/** How long something started at `startedAt` has been going, in whole seconds. */
export function elapsedSince(startedAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000))
}

export interface TimerView {
  running: TimerEntry | null
  /** Seconds the running entry has been going, or 0 when none is. */
  elapsed: number
  /** Seconds tracked today, every entry counted no further than `now`. */
  todaySeconds: number
  /** Seconds tracked today for the running entry's Client; null when none is running. */
  clientSeconds: number | null
  /** What the idle bar preselects: the last entry's Client and Project, and nothing guessed. */
  preselected: TimerWork
}

/** Everything the timer bar shows, at a moment of the day. */
export function viewTimer(timer: TodayTimer, now: Date, timeZone: string): TimerView {
  const { day } = wallClock(now, timeZone)
  const dayStart = startOfDay(day, timeZone)
  const { running } = timer
  const seconds = (entries: readonly TimerEntry[]) =>
    entries.reduce((total, entry) => total + secondsWithin(entry, dayStart, now), 0)
  const preselect = timer.last ?? running

  return {
    running,
    elapsed: running ? elapsedSince(running.startedAt, now) : 0,
    todaySeconds: seconds(timer.today),
    clientSeconds: running
      ? seconds(timer.today.filter((entry) => entry.clientId === running.clientId))
      : null,
    preselected: {
      clientId: preselect?.clientId ?? null,
      clientName: preselect?.clientName ?? null,
      projectId: preselect?.projectId ?? null,
      projectName: preselect?.projectName ?? null,
    },
  }
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' })
const DATE = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

/**
 * Which day a moment fell on, as a person says it looking back from `now`:
 * "today", "yesterday", the weekday within the week behind, and the date
 * beyond that. The present is a parameter here as everywhere.
 */
export function dayWorked(moment: string, now: Date, timeZone: string): string {
  const { day } = wallClock(new Date(moment), timeZone)
  const today = wallClock(now, timeZone).day
  if (day === today) return 'today'
  if (day === addDays(today, -1)) return 'yesterday'
  const date = new Date(`${day}T00:00:00Z`)
  return day > addDays(today, -7) && day < today ? WEEKDAY.format(date) : DATE.format(date)
}

/** "yesterday 15:00": when a spell of work began, as the phone's recents say it. */
export function whenWorked(moment: string, now: Date, timeZone: string): string {
  return `${dayWorked(moment, now, timeZone)} ${clockTime(new Date(moment), timeZone)}`
}

/**
 * When the running entry began, as the header says it after "since": the time
 * alone on the day it started, and the day with it otherwise — a timer left on
 * overnight reads "Tue 17:20" and should look like one.
 */
export function sinceWhen(startedAt: string, now: Date, timeZone: string): string {
  const day = dayWorked(startedAt, now, timeZone)
  const time = clockTime(new Date(startedAt), timeZone)
  return day === 'today' ? time : `${day} ${time}`
}

/** "Meridian Health · Discovery research", or "Internal" where there is no Client. */
export function workLine(work: TimerWork): { client: string; project: string | null } {
  return { client: work.clientName ?? INTERNAL, project: work.projectName }
}

const two = (value: number) => String(value).padStart(2, '0')

/** "01:42" and "17": the minutes the frame sets large, and the seconds it sets small. */
export function formatElapsed(seconds: number): { clock: string; seconds: string } {
  const whole = Math.max(0, Math.floor(seconds))
  return {
    clock: `${two(Math.floor(whole / 3600))}:${two(Math.floor(whole / 60) % 60)}`,
    seconds: two(whole % 60),
  }
}

/** "1h 28m": a span of tracked time, as the bar's totals read. */
export function formatTracked(seconds: number): string {
  const minutes = Math.max(0, Math.floor(seconds / 60))
  return `${Math.floor(minutes / 60)}h ${two(minutes % 60)}m`
}

/**
 * What one Client's week has come to, as "This week by Client" draws it
 * (frame 2a). Internal is one of these lines — work for nobody is still work —
 * and it is the absence of a Client, never a stored row.
 */
export interface ClientWeek {
  /** Null is Internal. */
  clientId: string | null
  name: string
  /** The three letters the timeline's chip says: "MER", or "INT" for Internal. */
  code: string
  /**
   * Where the Client sits in the order they were taken on, which is what its
   * colour follows: a Client's shade must not move when a week's hours do.
   * Internal, which is no Client, has none.
   */
  order: number | null
  /** Seconds tracked since Monday, counted no further than the moment asked. */
  weekSeconds: number
  /** Seconds tracked since the first of the month, which is what a budget is spent against. */
  monthSeconds: number
  arrangement: ClientArrangement | null
  /** Per hour, in cents; null for Internal, which is billed to nobody. */
  rateCents: number | null
  /** The budget or retainer in hours, where the arrangement has one. */
  budgetHours: number | null
}

/**
 * How a Client's work is charged and where the month stands against it, in the
 * line frame 2a draws under the bar. Internal has no terms: it is billed to
 * nobody, which is the whole of what there is to say about it.
 */
export function clientTerms(client: ClientWeek): string {
  const { arrangement, budgetHours, monthSeconds } = client
  if (arrangement === null) return 'Not billed'
  const hours = monthSeconds / 3600
  switch (arrangement) {
    case 'project_fee':
      return budgetHours === null
        ? 'Project fee'
        : `Project fee · ${formatTracked(monthSeconds)} of ${budgetHours}h budget`
    case 'hourly':
      return client.rateCents === null
        ? 'Hourly'
        : `Hourly · $${Math.round(client.rateCents / 100)}/h`
    case 'retainer': {
      if (budgetHours === null) return 'Retainer'
      const left = (budgetHours - hours) * 3600
      return left >= 0
        ? `Retainer · ${budgetHours}h/mo, ${formatTracked(left)} left`
        : `Retainer · ${budgetHours}h/mo, ${formatTracked(-left)} over`
    }
  }
}

/**
 * How far along a Client's bar is drawn: its hours against the busiest Client's
 * this week, so the longest line is full and the rest are read against it. A
 * week with nothing in it draws nothing.
 */
export function weekShare(client: ClientWeek, clients: readonly ClientWeek[]): number {
  const most = Math.max(...clients.map((each) => each.weekSeconds), 0)
  return most === 0 ? 0 : client.weekSeconds / most
}

/** The hours of a day a Time entry ran in, and how many seconds it spent in each. */
export interface LoggedHour {
  hour: number
  seconds: number
  /** Whose hour it was, by the entry that spent most of it here; null is Internal. */
  clientId: string | null
  clientName: string | null
}

/**
 * What was actually tracked, hour by hour of the user's day, from the Time
 * entries themselves — so the timeline shows what happened beside what was
 * planned (spec, story 96). A running entry counts up to `now` and no further;
 * the browser may hand in a later moment as it ticks, and reads no clock to do
 * it. An entry that spans midnight is counted only for the part inside the day.
 */
export function loggedByHour(
  entries: readonly TimerEntry[],
  now: Date,
  timeZone: string,
): LoggedHour[] {
  const { day } = wallClock(now, timeZone)
  const dayStart = startOfDay(day, timeZone).getTime()
  /** Seconds spent in each hour, and by whom. */
  const hours = new Map<number, Map<string, { seconds: number; name: string | null }>>()

  for (const entry of entries) {
    const from = Math.max(new Date(entry.startedAt).getTime(), dayStart)
    const until = Math.min(
      entry.endedAt ? new Date(entry.endedAt).getTime() : now.getTime(),
      now.getTime(),
    )
    if (until <= from) continue
    const firstHour = Math.floor((from - dayStart) / 3_600_000)
    const lastHour = Math.floor((until - dayStart - 1) / 3_600_000)
    for (let hour = firstHour; hour <= lastHour; hour += 1) {
      const start = dayStart + hour * 3_600_000
      const seconds = Math.floor(
        (Math.min(until, start + 3_600_000) - Math.max(from, start)) / 1000,
      )
      if (seconds <= 0) continue
      const by = hours.get(hour) ?? new Map()
      const key = entry.clientId ?? ''
      const held = by.get(key) ?? { seconds: 0, name: entry.clientName }
      by.set(key, { seconds: held.seconds + seconds, name: entry.clientName })
      hours.set(hour, by)
    }
  }

  return [...hours.entries()]
    .map(([hour, by]) => {
      const spells = [...by.entries()]
      const most = spells.reduce((best, each) => (each[1].seconds > best[1].seconds ? each : best))
      return {
        hour,
        seconds: spells.reduce((total, each) => total + each[1].seconds, 0),
        clientId: most[0] === '' ? null : most[0],
        clientName: most[1].name,
      }
    })
    .sort((a, b) => a.hour - b.hour)
}

/** "1:42", "0:20": tracked time as the timeline's right-hand figure reads it. */
export function formatLogged(seconds: number): string {
  const minutes = Math.max(0, Math.floor(seconds / 60))
  return `${Math.floor(minutes / 60)}:${two(minutes % 60)}`
}

/** How long a Time entry ran, in whole seconds; 0 while it is still running. */
export function entrySeconds(entry: TimerEntry): number {
  if (!entry.endedAt) return 0
  return elapsedSince(entry.startedAt, new Date(entry.endedAt))
}

/**
 * The receipt the header holds for a moment after Stop: billing software owes
 * one. It names the hours and who they went to, because that is what was just
 * decided about her money.
 */
export function stopReceipt(entry: TimerEntry): string {
  return `Stopped · ${formatTracked(entrySeconds(entry))} logged to ${entry.clientName ?? INTERNAL}`
}

/**
 * The browser tab while a Time entry runs: "1:42 · Meridian Health — Crazy".
 * The hours are not padded — a tab is read at a glance, not lined up — and the
 * minute is what changes, so the title is rewritten only when it does.
 */
export function timerTitle(seconds: number, clientName: string | null, base: string): string {
  const minutes = Math.max(0, Math.floor(seconds / 60))
  return `${Math.floor(minutes / 60)}:${two(minutes % 60)} · ${clientName ?? INTERNAL} — ${base}`
}

/** "Timer started, Meridian Health, Discovery research": the one line a screen reader hears. */
export function saidAloud(kind: 'started' | 'stopped', entry: TimerEntry): string {
  if (kind === 'stopped') {
    const minutes = Math.floor(entrySeconds(entry) / 60)
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    const said = [
      hours === 0 ? null : `${hours} hour${hours === 1 ? '' : 's'}`,
      rest === 0 && hours !== 0 ? null : `${rest} minute${rest === 1 ? '' : 's'}`,
    ].filter((each) => each !== null)
    return `Timer stopped, ${said.join(' ')}`
  }
  const work = [entry.clientName ?? INTERNAL, entry.projectName].filter((each) => each !== null)
  return `Timer started, ${work.join(', ')}`
}

/** Every Time entry a cached timer holds, wherever it holds it. */
function held(timer: TodayTimer): TimerEntry[] {
  return [timer.running, timer.last, ...timer.today].filter((entry) => entry !== null)
}

/**
 * The Time entry an operation brings, worded with the Client and Project names
 * this cache already holds — the picker's lists where it has them, and the
 * entries it is showing otherwise. A patch carries ids and not names, so a
 * cache that cannot name the work gets null and reads the day again
 * (`namesUnknownWork`) rather than showing an entry it can only half say. With
 * the picker loaded that is rare: it names every Client and Project the user
 * has, so any work the picker can start can also be worded.
 */
export function nameEntry(
  timer: TodayTimer,
  entry: Omit<TimerEntry, 'clientName' | 'projectName' | 'todoTitle'>,
  picker?: TimerPicker | null,
  /** The Todo's title, where the caller holds the day and can say it. */
  todoTitle?: string | null,
): TimerEntry | null {
  const known = held(timer)
  const nameOf = (id: string, of: 'clientId' | 'projectId', say: 'clientName' | 'projectName') =>
    known.find((each) => each[of] === id)?.[say] ?? null

  const clientName =
    entry.clientId === null
      ? null
      : (picker?.clients.find((each) => each.id === entry.clientId)?.name ??
        nameOf(entry.clientId, 'clientId', 'clientName'))
  if (entry.clientId !== null && clientName === null) return null
  const projectName =
    entry.projectId === null
      ? null
      : (picker?.clients
          .flatMap((client) => client.projects)
          .find((each) => each.id === entry.projectId)?.name ??
        nameOf(entry.projectId, 'projectId', 'projectName'))
  if (entry.projectId !== null && projectName === null) return null

  return {
    id: entry.id,
    clientId: entry.clientId,
    clientName,
    projectId: entry.projectId,
    projectName,
    todoId: entry.todoId,
    // A Todo this cache cannot name leaves the entry showing without its title
    // rather than not showing at all: the hours are what matter, and the title
    // arrives with the read `namesUnknownWork` asks for.
    todoTitle:
      entry.todoId === null
        ? null
        : (todoTitle ?? known.find((each) => each.todoId === entry.todoId)?.todoTitle ?? null),
    note: entry.note,
    billable: entry.billable,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
  }
}

/**
 * The picker with one more Project in it, under the Client it is for — or
 * under Internal, which is the absence of a Client and so is made as it is
 * needed rather than stored. A Project for a Client the picker does not hold
 * leaves it as it was; nothing invents a group.
 */
export function addProject(
  picker: TimerPicker,
  project: { id: string; name: string; clientId: string | null },
): TimerPicker {
  const born: PickerProject = {
    id: project.id,
    name: project.name,
    lastStartedAt: null,
    running: false,
  }
  const held = picker.clients.some((client) => client.id === project.clientId)
  if (!held && project.clientId !== null) return picker
  // Laid twice — once as the answer to the command, once over the socket — it
  // says the same thing: a Project already in the list is replaced, not repeated.
  const joined = (projects: readonly PickerProject[]) =>
    projects.some((each) => each.id === born.id)
      ? projects.map((each) => (each.id === born.id ? born : each))
      : [...projects, born]
  const clients = held
    ? picker.clients.map((client) =>
        client.id === project.clientId ? { ...client, projects: joined(client.projects) } : client,
      )
    : [...picker.clients, { id: null, name: INTERNAL, weekSeconds: 0, projects: [born] }]
  return { ...picker, clients }
}

/** What a patch may change about a Time entry the bar is holding. */
export interface EntryChange {
  startedAt?: string
  endedAt?: string | null
  note?: string
  billable?: boolean
  clientId?: string | null
  projectId?: string | null
}

/**
 * The timer's rows with one Time entry changed, wherever it is held. Given an
 * end it stops being the running one and becomes what the idle bar reports; a
 * change to an entry the cache does not hold leaves the cache as it was.
 * Moving an entry's work renames it from the lists this cache already holds —
 * the picker's, where it has them — because a patch carries ids and not names.
 */
export function changeEntry(
  timer: TodayTimer,
  id: string,
  change: EntryChange,
  picker?: TimerPicker | null,
): TodayTimer {
  const was = held(timer).find((entry) => entry.id === id)
  if (!was) return timer
  const clientId = 'clientId' in change ? (change.clientId ?? null) : was.clientId
  const projectId = 'projectId' in change ? (change.projectId ?? null) : was.projectId
  const moved = clientId !== was.clientId || projectId !== was.projectId
  const named = moved
    ? {
        clientName:
          clientId === null
            ? null
            : (picker?.clients.find((each) => each.id === clientId)?.name ?? null),
        projectName:
          projectId === null
            ? null
            : (picker?.clients
                .flatMap((client) => client.projects)
                .find((each) => each.id === projectId)?.name ?? null),
      }
    : { clientName: was.clientName, projectName: was.projectName }
  const now: TimerEntry = { ...was, ...change, clientId, projectId, ...named }
  const stopped = was.endedAt === null && now.endedAt !== null

  return {
    running: stopped ? null : timer.running?.id === id ? now : timer.running,
    last: stopped ? now : timer.last?.id === id ? now : timer.last,
    today: timer.today.map((entry) => (entry.id === id ? now : entry)),
  }
}

/** The timer's rows with a Time entry taken out of them, wherever it was held. */
export function removeEntry(timer: TodayTimer, id: string): TodayTimer {
  if (!held(timer).some((entry) => entry.id === id)) return timer
  return {
    running: timer.running?.id === id ? null : timer.running,
    last: timer.last?.id === id ? null : timer.last,
    today: timer.today.filter((entry) => entry.id !== id),
  }
}

/**
 * Whether a Time entry's hours are stray: for no Client and part of no Project.
 * Work on one of the user's own Projects (their admin, their bookkeeping) was
 * put there on purpose and is nobody's to bill; it is never asked about. Every
 * screen that counts what "needs a Client" asks this, so they cannot disagree.
 */
export function needsClient(entry: { clientId: string | null; projectId: string | null }): boolean {
  return entry.clientId === null && entry.projectId === null
}
