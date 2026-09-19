import { addDays } from './clock'
import { formatAge } from './timeline'
import type { Signal } from './today'
import type { ProjectStatus, Side, TodayTodo } from './todo'

// The Projects screen, frame 1d: the long work with its Circle, its open count,
// its status and the progress derived from its Todos; the Promises the user
// made and the Waiting on they are owed; and what the lifecycle will archive.
//
// Nothing here reads a clock: the moment arrives as a parameter, as it does
// everywhere in this package.

/** The label a status wears, and the tag it wears it in. */
export const PROJECT_STATUS_LABELS = {
  on_track: 'On track',
  at_risk: 'At risk',
  behind: 'Behind',
} as const satisfies Record<ProjectStatus, string>

export const PROJECT_STATUS_TONES = {
  on_track: 'accent',
  at_risk: 'outline',
  behind: 'neutral',
} as const satisfies Record<ProjectStatus, 'accent' | 'neutral' | 'outline'>

/** Which Side of a life the screen is showing. */
export const PROJECT_FILTERS = ['all', 'work', 'personal'] as const
export type ProjectFilter = (typeof PROJECT_FILTERS)[number]

export const PROJECT_FILTER_LABELS = {
  all: 'All',
  work: 'Work',
  personal: 'Personal',
} as const satisfies Record<ProjectFilter, string>

/**
 * Where a Side can be taken from, in the order the glossary gives: a Circle
 * holds it, and a Todo that has no Circle falls back to the default Side of the
 * Connection it arrived through. A Project has only the first of those.
 */
export interface SideSources {
  /** The Side of the Circle the thing belongs to, if it belongs to one. */
  circle?: Side | null
  /** The default Side of the Connection it arrived through, if it arrived through one. */
  connection?: Side | null
}

/**
 * The Side of something that does not hold one itself. Side is stored only on a
 * Circle (CONTEXT.md, "Side"): the Circle's wins, the arriving Connection's
 * default stands in for a Todo that has no Circle, and something with neither
 * has no Side at all rather than a guessed one.
 */
export function sideOf({ circle, connection }: SideSources): Side | null {
  return circle ?? connection ?? null
}

/** How many Todos a Project holds, counted by state. Nothing here is stored. */
export interface ProjectCounts {
  /** In `backlog` or `today`: the work still to do. */
  open: number
  /** Of those, the ones in `today`. */
  today: number
  done: number
  /** Every Todo the Project has ever held, `archived` included. */
  total: number
}

/** A Project as D1 holds it, with its Todos counted. */
export interface ProjectRow {
  id: string
  name: string
  /** The Circle it belongs to; many Projects belong to none. */
  circle: { id: string; name: string; side: Side } | null
  status: ProjectStatus
  /** Shown in place of the status's own label: "Week 9 of 12". */
  statusNote: string | null
  milestone: string | null
  /** The user's local date the milestone falls on. */
  milestoneDay: string | null
  counts: ProjectCounts
}

/** A Todo of a Project, as the expanded card lists it. Its `projectId` is what groups it. */
export type ProjectTodo = TodayTodo

/** When the next backlog Todos cross the archive period, and how many do. */
export interface ArchiveSoon {
  count: number
  /** The user's local date they archive on. */
  day: string
  /** How many days from today that is. */
  inDays: number
}

/** How long the user lets a Todo go untouched, in Rollovers. */
export interface Lifecycle {
  sentBackDays: number
  archiveDays: number
}

/** What the Projects screen holds, as D1 has it at one moment. */
export interface Projects {
  /** The user's local date. */
  day: string
  projects: ProjectRow[]
  /**
   * The Todos the expanded Projects list: every `today` Todo of a Project, and
   * the head of each Project's backlog. A Todo a command makes here is a
   * One-off with no Project, so it joins this list and belongs to no card.
   */
  todos: ProjectTodo[]
  /** The Promises and the Waiting on, in the order Crazy noticed them. */
  signals: Signal[]
  /** Null when nothing is in the backlog at all. */
  archiveSoon: ArchiveSoon | null
  lifecycle: Lifecycle
}

/**
 * How far along a Project is: the Todos it has finished over every Todo it has
 * ever held. Counted by query and never stored, so it cannot go stale, and an
 * abandoned Todo counts against the Project rather than vanishing from it.
 * A Project with no Todos yet is at nothing, not at everything.
 */
export function projectProgress(counts: ProjectCounts): number {
  if (counts.total <= 0) return 0
  return Math.round((counts.done / counts.total) * 100)
}

/** "17 Sep", and "Fri 19 Sep" for a day near enough to name by its weekday. */
function formatDay(day: string, withWeekday: boolean): string {
  const date = new Date(`${day}T00:00:00Z`)
  const name = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(date)
  const dated = `${date.getUTCDate()} ${name({ month: 'short' })}`
  return withWeekday ? `${name({ weekday: 'short' })} ${dated}` : dated
}

/** A milestone far enough ahead that its weekday no longer places it. */
const WEEKDAY_HORIZON = 7

/**
 * "Edge sessions live · Fri 19 Sep": the next milestone and when it falls. A
 * milestone inside the coming week is named by its weekday, because that is how
 * a person places a day they can still reach; one further out is dated alone.
 */
export function milestoneLabel(
  milestone: string | null,
  milestoneDay: string | null,
  today: string,
): string | null {
  if (milestone === null) return null
  if (milestoneDay === null) return milestone
  const horizon = addDays(today, WEEKDAY_HORIZON)
  return `${milestone} · ${formatDay(milestoneDay, milestoneDay >= today && milestoneDay <= horizon)}`
}

/** "2 Todos", "1 Todo", and an em dash where a Project has nothing on today. */
export function todayLabel(count: number): string {
  if (count <= 0) return '—'
  return `${count} ${count === 1 ? 'Todo' : 'Todos'}`
}

/** "12 open": what a Project still has to do. */
export function openLabel(count: number): string {
  return `${count} open`
}

/**
 * The day a `backlog` Todo archives on: the archive period after the day it was
 * last touched. Counted in the user's own days, so it never drifts by an hour.
 */
export function archiveDayOf(touchedDay: string, archiveDays: number): string {
  return addDays(touchedDay, archiveDays)
}

/** How many days apart two of the user's days are; negative when `day` has passed. */
export function daysUntil(today: string, day: string): number {
  const DAY = 24 * 60 * 60 * 1000
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)
}

/**
 * The lifecycle in a sentence, in the user's own periods, with what it is about
 * to do. Archiving never surprises anyone who has read this line.
 */
export function lifecycleNote(lifecycle: Lifecycle, archiveSoon: ArchiveSoon | null): string {
  const days = (count: number) => (count === 1 ? 'a day' : `${count} days`)
  const rule = `Lifecycle: today → untouched ${days(lifecycle.sentBackDays)} → backlog → untouched ${days(
    lifecycle.archiveDays,
  )} → archive.`
  if (!archiveSoon) return rule
  const { count, inDays } = archiveSoon
  const what = `${count} backlog ${count === 1 ? 'Todo' : 'Todos'}`
  // Today's own archiving has not run yet; tomorrow is "tomorrow" and no further.
  const when = inDays <= 0 ? 'today' : inDays === 1 ? 'tomorrow' : `in ${inDays} days`
  return `${rule} ${what} ${inDays === 1 ? 'archive tomorrow' : `archive ${when}`}.`
}

/** A Project with everything the table draws about it derived. */
export interface ViewProject {
  row: ProjectRow
  /** Taken from its Circle; null for a Project that belongs to none. */
  side: Side | null
  /** The Circle's name, or "No Circle" where there is none. */
  circle: string
  open: string
  status: { label: string; tone: 'accent' | 'neutral' | 'outline' }
  /** Done over every Todo the Project has held, as a whole percent. */
  progress: number
  milestone: string | null
  today: string
  /** Its `today` Todos, in the order the Priority stack would take them. */
  todayTodos: ProjectTodo[]
  /** How many Todos wait in its backlog, and the head of that queue. */
  backlog: { count: number; head: BacklogEntry[] }
}

/** One Todo waiting in a Project's backlog, and how long it has waited. */
export interface BacklogEntry {
  todo: ProjectTodo
  /** "4d": how long since the user last touched it. */
  age: string
}

export interface ProjectsView {
  projects: ViewProject[]
  /** The Promises, newest noticed first. */
  promises: Signal[]
  /** The Waiting on, newest noticed first. Not one of them can become a Todo. */
  waitingOn: Signal[]
  /** The Promises that are not Todos yet: what "Turn all into todos" would make. */
  unaddedPromises: Signal[]
  lifecycle: string
}

/** How much of a Project's backlog the expanded card has room for. */
export const BACKLOG_HEAD = 3

/** Everything the Projects screen derives from what D1 holds, at a moment of it. */
export function viewProjects(
  projects: Projects,
  now: Date,
  filter: ProjectFilter = 'all',
): ProjectsView {
  const today = projects.day

  const shown = projects.projects.filter((row) => {
    if (filter === 'all') return true
    return sideOf({ circle: row.circle?.side }) === filter
  })

  const view = shown.map((row): ViewProject => {
    const mine = projects.todos.filter((todo) => todo.projectId === row.id)
    const backlog = mine
      .filter((todo) => todo.state === 'backlog')
      // The backlog reads as a queue, the longest-held first, and each entry
      // says how long since anybody touched it — which is what decides when it
      // archives. Only the head of the queue has room on the card.
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    return {
      row,
      side: sideOf({ circle: row.circle?.side }),
      circle: row.circle?.name ?? 'No Circle',
      open: openLabel(row.counts.open),
      status: {
        label: row.statusNote ?? PROJECT_STATUS_LABELS[row.status],
        tone: PROJECT_STATUS_TONES[row.status],
      },
      progress: projectProgress(row.counts),
      milestone: milestoneLabel(row.milestone, row.milestoneDay, today),
      today: todayLabel(row.counts.today),
      todayTodos: mine
        .filter((todo) => todo.state === 'today' || todo.state === 'done')
        .sort(
          (a, b) =>
            (a.stackPosition ?? Infinity) - (b.stackPosition ?? Infinity) ||
            a.createdAt.localeCompare(b.createdAt),
        ),
      backlog: {
        count: row.counts.open - row.counts.today,
        head: backlog.slice(0, BACKLOG_HEAD).map((todo) => ({
          todo,
          age: formatAge(new Date(todo.touchedAt), now),
        })),
      },
    }
  })

  const ofKind = (kind: Signal['kind']) => projects.signals.filter((signal) => signal.kind === kind)
  const promises = ofKind('promise')

  return {
    projects: view,
    promises,
    waitingOn: ofKind('waiting_on'),
    unaddedPromises: promises.filter((signal) => signal.todoId === null),
    lifecycle: lifecycleNote(projects.lifecycle, projects.archiveSoon),
  }
}
