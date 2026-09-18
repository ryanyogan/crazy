import { isoWeek, weekDays } from './clock'
import type { Side, TodoState } from './todo'

// The rules of the Week screen that need no database: what a week's figures
// mean, how its days are shaped and how each one is captioned. Nothing here
// reads the clock; the week is the one the read model was asked for.
//
// Every figure is computed from Todos, Slots and the calendar, and none of them
// is ever stored:
//
//  - A Todo is **done** on the day it was completed.
//  - A Todo is **planned** on today while it is in `today` — snoozed or not, a
//    snooze takes it out of today's stack, not out of the week — and on a later
//    day when it holds a Slot there. Every Todo is counted on one day only.
//  - A past day also shows what it **carried**: the Todos still open that hold
//    a Slot on it, which is the work that day did not finish.
//  - The three bars **count Todos**, all seven days to one scale.
//  - **Hours** are the estimates of those Todos: what a week has absorbed so
//    far, and what a day's bars say to someone who cannot see them. With the
//    Billing module off there is no timer, so an estimate is all there is.
//  - A **meeting** counts on the day it starts. A focus block is not a meeting.

/** A Todo the week holds, as D1 has it. */
export interface WeekTodo {
  id: string
  state: TodoState
  estimateMinutes: number | null
  carryCount: number
  /** The Side its Circle gives it, through its Project; null for a One-off. */
  side: Side | null
  projectId: string | null
  /** The day it was completed on, or null while it is open. */
  doneDay: string | null
  /** The days of this week it holds a Slot on, earliest first. */
  slotDays: string[]
}

/** A meeting the week holds, on the day it starts. */
export interface WeekMeeting {
  id: string
  day: string
  minutes: number
}

/** A few words Crazy wrote for one thing on one day: a Todo, or a meeting. */
export interface WeekLine {
  id: string
  day: string
  text: string
  todoId: string | null
  calendarEventId: string | null
}

/** The words Crazy adds beside a day's figures. */
export interface WeekNote {
  day: string
  text: string
}

/** A Project's next milestone, when it falls inside the week. */
export interface WeekMilestone {
  day: string
  projectId: string
}

/** Where a user ties into one Project this week, and when that falls. */
export interface TieIn {
  project: string
  text: string
  when: string | null
}

/**
 * What the Week screen holds of a user's week: the rows as D1 has them. What
 * the screen makes of them — the figures, each day's shape and caption — is
 * `viewWeek`'s.
 */
export interface Week {
  /** The Monday the week starts on, as the user's local date. */
  monday: string
  /** The user's local date, inside that week. */
  day: string
  /** The Week brief written for this week, if one has been. */
  brief: { body: string; bodyShort: string } | null
  /** Every Todo the week holds: completed in it, or open and on one of its days. */
  todos: WeekTodo[]
  meetings: WeekMeeting[]
  lines: WeekLine[]
  notes: WeekNote[]
  milestones: WeekMilestone[]
  tieIns: TieIn[]
}

/** What a day holds, of each of the three kinds its bars draw. */
export interface DayCounts {
  done: number
  planned: number
  meetings: number
}

export interface WeekDayView {
  /** The user's local date. */
  day: string
  /** "Mon" and "15", as the day card heads it. */
  name: string
  date: string
  isToday: boolean
  /** Todos done, Todos planned, and meetings. */
  counts: DayCounts
  /** The hours behind those counts, for the words the bars are given. */
  hours: DayCounts
  /** Each count as a share (0 to 1) of the week's largest, for its bar. */
  share: DayCounts
  /** The line under the bars: the figures, and anything Crazy added to them. */
  caption: string | null
  /** The things the day holds, top first, as Crazy words them. */
  lines: { id: string; text: string }[]
}

export interface WeekView {
  /** "Week 38 · 15–21 Sep · day 3 of 5". */
  line: string
  /** Todos completed this week. */
  done: number
  /** Todos the week holds in all, the done ones included: the "of 27". */
  planned: number
  /** Hours of work the week has absorbed so far: the estimates of what is done. */
  focusHours: number
  /** Todos in the week a Rollover has carried over at least once. */
  carriedOver: number
  days: WeekDayView[]
}

const MINUTES_PER_HOUR = 60

function hours(minutes: number): number {
  // Whole minutes go in, so a hundredth of an hour is exact enough to come out.
  return Math.round((minutes / MINUTES_PER_HOUR) * 100) / 100
}

/** "6.5" for six and a half hours, "6" for six, to the nearest tenth. */
export function formatHourCount(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

function monthName(day: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(
    new Date(`${day}T00:00:00Z`),
  )
}

const dayOfMonth = (day: string) => String(new Date(`${day}T00:00:00Z`).getUTCDate())

/** "15–21 Sep", or "29 Sep – 5 Oct" for a week that changes month. */
function weekSpan(monday: string, sunday: string): string {
  const from = dayOfMonth(monday)
  const until = `${dayOfMonth(sunday)} ${monthName(sunday)}`
  return monthName(monday) === monthName(sunday)
    ? `${from}–${until}`
    : `${from} ${monthName(monday)} – ${until}`
}

/**
 * Where the day sits in the working week: "day 3 of 5" on Wednesday. The
 * weekend is not one of the five, so it says so. (The frame draws a Wednesday;
 * what a weekend reads was decided here.)
 */
function weekPlace(days: readonly string[], day: string): string {
  const index = days.indexOf(day)
  return index < 0 || index > 4 ? 'the weekend' : `day ${index + 1} of 5`
}

const estimate = (todo: WeekTodo) => todo.estimateMinutes ?? 0
const sum = (todos: readonly WeekTodo[]) => todos.reduce((total, todo) => total + estimate(todo), 0)

/** Everything the Week screen derives from the week. */
export function viewWeek(week: Week): WeekView {
  const days = weekDays(week.monday)
  const sunday = days[6] ?? week.monday
  const today = week.day

  /**
   * The one day a Todo is planned on, or null when it is done or nowhere: the
   * current day while it is in `today`, else the first day ahead it is slotted
   * on. Counting it on one day only keeps the week's total honest.
   */
  const plannedDay = (todo: WeekTodo): string | null => {
    if (todo.state === 'done') return null
    if (todo.state === 'today') return today
    return todo.slotDays.find((day) => day > today) ?? null
  }

  const held = days.map((day) => {
    const done = week.todos.filter((todo) => todo.doneDay === day)
    const planned = week.todos.filter((todo) => plannedDay(todo) === day)
    // What a day that has passed did not finish: still open, and placed on it.
    const carried =
      day < today
        ? week.todos.filter((todo) => todo.state !== 'done' && todo.slotDays.includes(day))
        : []
    const meetings = week.meetings.filter((meeting) => meeting.day === day)
    return { day, done, planned, carried, meetings }
  })

  // One scale for every bar on the screen: the week's largest count is a full bar.
  const largest = Math.max(
    ...held.map((day) => Math.max(day.done.length, day.planned.length, day.meetings.length)),
    0,
  )
  const share = (count: number) => (largest === 0 ? 0 : count / largest)

  const noteFor = (day: string) => week.notes.find((note) => note.day === day)?.text ?? null

  const milestoneFalls = (day: string, planned: readonly WeekTodo[]) =>
    week.milestones.some(
      (milestone) =>
        milestone.day === day && planned.some((todo) => todo.projectId === milestone.projectId),
    )

  return {
    line: [
      `Week ${isoWeek(week.monday)}`,
      weekSpan(week.monday, sunday),
      weekPlace(days, today),
    ].join(' · '),
    done: week.todos.filter((todo) => todo.doneDay !== null).length,
    planned: week.todos.length,
    focusHours: hours(sum(week.todos.filter((todo) => todo.doneDay !== null))),
    // Until the Rollover keeps a record of itself (ticket 10) this is as close
    // as Crazy can get: a Todo of this week that has been carried at least once.
    carriedOver: week.todos.filter((todo) => todo.carryCount > 0).length,
    days: held.map(({ day, done, planned, carried, meetings }): WeekDayView => {
      const counts = { done: done.length, planned: planned.length, meetings: meetings.length }
      const figures = dayFigures({
        day,
        today,
        counts,
        carried: carried.length,
        focusHours: hours(sum(done)),
        allPersonal: planned.length > 0 && planned.every((todo) => todo.side === 'personal'),
        milestone: milestoneFalls(day, planned),
      })
      const carriedIds = new Set(carried.map((todo) => todo.id))
      const onTheDay = new Set([...done, ...planned, ...carried].map((todo) => todo.id))
      const meetingIds = new Set(meetings.map((meeting) => meeting.id))

      return {
        day,
        name: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(
          new Date(`${day}T00:00:00Z`),
        ),
        date: dayOfMonth(day),
        isToday: day === today,
        counts,
        hours: {
          done: hours(sum(done)),
          planned: hours(sum(planned)),
          meetings: hours(meetings.reduce((total, meeting) => total + meeting.minutes, 0)),
        },
        share: {
          done: share(counts.done),
          planned: share(counts.planned),
          meetings: share(counts.meetings),
        },
        caption: [figures, noteFor(day)].filter(Boolean).join(' · ') || null,
        lines: week.lines
          .filter(
            (line) =>
              line.day === day &&
              (line.todoId === null ? true : onTheDay.has(line.todoId)) &&
              (line.calendarEventId === null ? true : meetingIds.has(line.calendarEventId)) &&
              (line.todoId !== null || line.calendarEventId !== null),
          )
          .map((line) => ({
            id: line.id,
            // How long a Todo has been carried is the Todo's to say, not the words'.
            text:
              line.todoId !== null && carriedIds.has(line.todoId)
                ? `${line.text} (carried)`
                : line.text,
          })),
      }
    }),
  }
}

/**
 * The figures under a day's bars, in the words the day deserves: what a day
 * behind us did, what today holds, and what a day ahead is for. A day ahead
 * that is all personal says so, and one that carries a Project to its milestone
 * names the milestone rather than counting.
 */
function dayFigures(day: {
  day: string
  today: string
  counts: DayCounts
  carried: number
  focusHours: number
  allPersonal: boolean
  milestone: boolean
}): string | null {
  const { counts, carried } = day
  if (counts.done + counts.planned + carried === 0) return null
  if (day.day < day.today) {
    return carried > 0
      ? `${counts.done} of ${counts.done + carried} · ${carried} carried`
      : `${counts.done} done · ${formatHourCount(day.focusHours)}h focus`
  }
  if (day.day === day.today) return `today · ${counts.planned} planned`
  if (day.allPersonal) return 'personal'
  if (day.milestone) return 'milestone'
  return `${counts.planned} planned`
}

/** What a day's bars say to someone who cannot see them. */
export function describeDay({
  counts,
  hours: held,
}: Pick<WeekDayView, 'counts' | 'hours'>): string {
  const todos = (count: number, value: number, label: string) =>
    count === 0 ? `none ${label}` : `${count} ${label}, ${formatHourCount(value)}h`
  const meetings =
    counts.meetings === 0
      ? 'no meetings'
      : `${counts.meetings} ${counts.meetings === 1 ? 'meeting' : 'meetings'}, ${formatHourCount(held.meetings)}h`
  return [
    todos(counts.done, held.done, 'done'),
    todos(counts.planned, held.planned, 'planned'),
    meetings,
  ].join('; ')
}
