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
}

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

const two = (value: number) => String(value).padStart(2, '0')
const join = (parts: (string | null)[], by: string) => parts.filter(Boolean).join(by) || null

/** Whether the event takes up any part of the hour. */
const during = (event: DayEvent, hour: number) =>
  event.from < (hour + 1) * 60 && event.until > hour * 60

type SlottedTodo = Pick<
  TodayTodo,
  'title' | 'slotHours' | 'estimateMinutes' | 'energy' | 'carryCount' | 'source'
>

function wordHour(hour: number, todos: SlottedTodo[], meetings: DayEvent[]): HourWording {
  const title = join(
    [
      ...todos.map((todo) => (todo.slotHours.includes(hour - 1) ? `↳ ${todo.title}` : todo.title)),
      ...meetings.map(({ title, from }) =>
        from % 60 === 0 ? title : `${title} ${two(Math.floor(from / 60))}:${two(from % 60)}`,
      ),
    ],
    ' · ',
  )

  const [todo] = todos
  const [meeting] = meetings
  const lengths = [
    ...todos.map((each) => formatEstimate(each.estimateMinutes)),
    ...meetings.map((each) => formatEstimate(each.until - each.from)),
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
    source: todo?.source?.kind ?? (meeting ? 'calendar_event' : null),
  }
}

/**
 * The day, hour by hour. How an hour is drawn always follows from what it
 * holds: a meeting wins over a focus block, which wins over Slots alone. How it
 * is worded is Crazy's wording when there is one, and otherwise derived.
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
    const todos = stack.filter((todo) => todo.slotHours.includes(hour))
    const kind: HourKind =
      meetings.length > 0
        ? 'meeting'
        : here.length > 0
          ? 'focus'
          : todos.length > 0
            ? 'slotted'
            : 'free'
    const words = wording.find((each) => each.hour === hour) ?? wordHour(hour, todos, meetings)
    hours.push({ ...words, kind })
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
