import { z } from 'zod'
import type { Hours } from './today'
import {
  type CalendarEventKind,
  ENERGIES,
  type SourceKind,
  type TodayTodo,
  carriedLabel,
  formatEstimate,
} from './todo'

// The day's hour timeline: what occupies each hour, how it is drawn, and how
// it is worded. Meetings are tinted fills, focus blocks are framed, an hour
// that only holds Slots is plainly boxed and a free hour is dashed.

/** A meeting or focus block on the day in question, read from a Provider. Never editable. */
export interface DayEvent {
  id: string
  kind: CalendarEventKind
  title: string
  /** Who it is with, as the Provider puts it: "12 people". */
  who: string | null
  /** Minutes into the day, on the user's wall clock, clipped to the day. */
  from: number
  until: number
}

/**
 * How Crazy worded an hour when it last planned the day. It is generated text,
 * like the Brief; an hour without it is worded from what it holds.
 */
export interface HourWording {
  hour: number
  title: string
  note: string | null
  source: SourceKind | null
  /**
   * The Todos that held a Slot on the hour when the words were written. They
   * describe that hour and no other plan of it, so the moment the user slots
   * something else there the words are set aside — and taken up again if the
   * hour comes back to what it was. Empty for an hour worded with no Todo on it.
   */
  writtenFor: readonly string[]
}

/** The Todo ids a wording was written for, as D1 holds them: SQLite has no lists. */
export const writtenFor = z.array(z.string())

export type HourKind = 'meeting' | 'focus' | 'slotted' | 'free'

export interface TimelineHour {
  hour: number
  kind: HourKind
  title: string
  note: string | null
  source: SourceKind | null
}

/** The hours the timeline always shows; it widens to hold anything outside them. */
export const DAY_HOURS: Hours = { from: 8, until: 18 }

/** The last hour any day has: a Slot cannot run past it. */
export const LAST_HOUR = 23

/** Whether the event takes up any part of the hour. */
const during = (event: DayEvent, hour: number) =>
  event.from < (hour + 1) * 60 && event.until > hour * 60

/**
 * Whether meetings leave no minute of that hour free. Crazy never changes a
 * Provider's calendar, so an hour meetings fill is the one hour of the day a
 * Todo cannot be given a Slot on. One meeting need not do it on its own: two
 * back to back fill the hour between them, while an hour a meeting only half
 * fills can hold a Todo as well, as the 16:00 hour of frame 1a does.
 */
export function meetingHolds(events: readonly DayEvent[], hour: number): boolean {
  const from = hour * 60
  const until = from + 60
  const here = events
    .filter((event) => event.kind === 'meeting' && during(event, hour))
    .sort((a, b) => a.from - b.from)

  // Walk the hour: a meeting that starts after the minute reached leaves a gap,
  // and a gap anywhere is room the user can still plan into.
  let reached = from
  for (const meeting of here) {
    if (meeting.from > reached) return false
    reached = Math.max(reached, meeting.until)
    if (reached >= until) return true
  }
  return false
}

/**
 * The hours a Todo would hold if it were given a Slot at `hour`: as many as it
 * holds now, so moving a two-hour Todo keeps it two hours long, and one that
 * holds no Slot yet takes a single hour.
 */
export function hoursIfSlottedAt(todo: { slotHours: readonly number[] }, hour: number): number[] {
  const span = Math.max(1, todo.slotHours.length)
  return Array.from({ length: span }, (_, index) => hour + index)
}

const two = (value: number) => String(value).padStart(2, '0')
const join = (parts: (string | null)[], by: string) => parts.filter(Boolean).join(by) || null

type SlottedTodo = Pick<
  TodayTodo,
  'id' | 'title' | 'slotHours' | 'estimateMinutes' | 'energy' | 'carryCount' | 'source'
>

function wordHour(
  hour: number,
  todos: SlottedTodo[],
  meetings: DayEvent[],
  focus: DayEvent[],
): HourWording {
  // A focus block is where work goes, so it is named only when nothing is in it.
  const empty = todos.length === 0 && meetings.length === 0
  const title = join(
    [
      ...todos.map((todo) => (todo.slotHours.includes(hour - 1) ? `↳ ${todo.title}` : todo.title)),
      ...meetings.map(({ title, from }) =>
        from % 60 === 0 ? title : `${title} ${two(Math.floor(from / 60))}:${two(from % 60)}`,
      ),
      ...(empty ? focus.map((block) => block.title) : []),
    ],
    ' · ',
  )

  const [todo] = todos
  const [meeting] = meetings
  const lengths = [
    ...todos.map((each) => formatEstimate(each.estimateMinutes)),
    ...meetings.map((each) => formatEstimate(each.until - each.from)),
    ...(empty ? focus.map((each) => formatEstimate(each.until - each.from)) : []),
  ]
  let note: string | null
  if (meeting && !todo) {
    note = join([lengths[0]!, meeting.who], ' · ')
  } else if (meeting || !todo) {
    note = join(lengths, ' + ')
  } else if (todos.length === 1) {
    note = join(
      [
        carriedLabel(todo.carryCount) ?? (todo.energy && ENERGIES[todo.energy]),
        formatEstimate(todo.estimateMinutes),
      ],
      ' · ',
    )
  } else {
    const shared = todos.every((each) => each.energy === todo.energy) ? todo.energy : null
    const minutes = todos.reduce((sum, each) => sum + (each.estimateMinutes ?? 0), 0)
    note = join([shared && ENERGIES[shared], formatEstimate(minutes)], ' · ')
  }

  return {
    hour,
    title: title ?? 'Free',
    note,
    source:
      todo?.source?.kind ?? (meeting || (empty && focus.length > 0) ? 'calendar_event' : null),
    writtenFor: todos.map((each) => each.id),
  }
}

/** Whether an hour still holds exactly the Todos a wording was written for. */
function stillDescribes(wording: HourWording, todos: readonly SlottedTodo[]): boolean {
  return (
    wording.writtenFor.length === todos.length &&
    todos.every((todo) => wording.writtenFor.includes(todo.id))
  )
}

/**
 * The day, hour by hour. How an hour is drawn always follows from what it
 * holds: a meeting wins over a focus block, which wins over Slots alone. How it
 * is worded is Crazy's wording while that still describes the hour — while the
 * hour holds the Todos the words were written for — and otherwise derived from
 * what the hour holds now. Nothing is thrown away: an hour put back the way
 * Crazy planned it reads the way Crazy wrote it.
 */
export function timeline(
  stack: readonly SlottedTodo[],
  events: readonly DayEvent[],
  wording: readonly HourWording[],
): TimelineHour[] {
  const held = [
    ...stack.flatMap((todo) => todo.slotHours),
    ...events.flatMap(({ from, until }) => [Math.floor(from / 60), Math.ceil(until / 60) - 1]),
  ]
  const first = Math.min(DAY_HOURS.from, ...held)
  const last = Math.max(DAY_HOURS.until - 1, ...held)

  const hours: TimelineHour[] = []
  for (let hour = first; hour <= last; hour += 1) {
    const here = events.filter((event) => during(event, hour))
    const meetings = here
      .filter((event) => event.kind === 'meeting')
      .sort((a, b) => a.from - b.from)
    const focus = here.filter((event) => event.kind === 'focus').sort((a, b) => a.from - b.from)
    const todos = stack.filter((todo) => todo.slotHours.includes(hour))
    const kind: HourKind =
      meetings.length > 0
        ? 'meeting'
        : here.length > 0
          ? 'focus'
          : todos.length > 0
            ? 'slotted'
            : 'free'
    const written = wording.find((each) => each.hour === hour)
    const words =
      written && stillDescribes(written, todos) ? written : wordHour(hour, todos, meetings, focus)
    hours.push({ hour, kind, title: words.title, note: words.note, source: words.source })
  }
  return hours
}

/** "3 meetings": the day's meetings, which focus blocks are not. */
export function meetingCount(events: readonly DayEvent[]): number {
  return events.filter((event) => event.kind === 'meeting').length
}

/** How long ago something happened, as the Mentions list words it: "40m", "17h", "2d". */
export function formatAge(at: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`
  return `${Math.floor(minutes / (24 * 60))}d`
}
