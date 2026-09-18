import { clockTime, wallClock } from './clock'
import {
  type DayEvent,
  type HourWording,
  type TimelineHour,
  meetingCount,
  timeline,
} from './timeline'
import type { Source, TodayTodo } from './todo'

// The rules of the Today screen that need no database: what the Priority
// stack is, which Todo is the Take on now, and how the moment is worded.

/**
 * The Priority stack: the `today` Todos in the order Crazy recommends. It is
 * an ordering of Todos, not a list of its own. A Todo with no position yet
 * (one just added) follows the placed ones, oldest first.
 */
export function priorityStack<T extends Pick<TodayTodo, 'state' | 'stackPosition' | 'createdAt'>>(
  todos: readonly T[],
): T[] {
  return todos
    .filter((todo) => todo.state === 'today')
    .sort(
      (a, b) =>
        (a.stackPosition ?? Infinity) - (b.stackPosition ?? Infinity) ||
        a.createdAt.localeCompare(b.createdAt),
    )
}

/** Whole hours of the day, the second exclusive: 9 and 11 for "09:00–11:00". */
export interface Hours {
  from: number
  until: number
}

export interface TakeOnNow<T> {
  todo: T
  /** The hours the Todo fits; null when it holds no Slot still to come. */
  hours: Hours | null
}

/** The first unbroken run of Slots that has not already ended. */
function fittingHours(slotHours: readonly number[], hourNow: number): Hours | null {
  const ahead = slotHours.filter((hour) => hour >= hourNow)
  const from = ahead[0]
  if (from === undefined) return null
  let until = from + 1
  while (ahead.includes(until)) until += 1
  return { from, until }
}

/**
 * The one Todo to do at this moment, or none when the stack is empty. Until
 * the calendar is read it is the top of the stack, and the hours it fits are
 * the Slots it holds.
 */
export function takeOnNow<T extends Pick<TodayTodo, 'slotHours'>>(
  stack: readonly T[],
  hourNow: number,
): TakeOnNow<T> | null {
  const todo = stack[0]
  if (!todo) return null
  return { todo, hours: fittingHours(todo.slotHours, hourNow) }
}

/** A Signal where someone addressed the user at a Provider. */
export interface Mention {
  id: string
  who: string
  text: string
  /** When it was said. */
  at: string
  /** The Provider item it is; a Todo made from it takes this as its Source. */
  source: Source
  /** The Todo the user added it as, if they have. */
  todoId: string | null
}

/**
 * What the Today screen holds of a user's day: the rows as D1 has them. It is
 * what loaders cache and what commands are applied to, so everything the
 * screen shows beyond it is derived, by `viewToday`.
 */
export interface Today {
  /** The user's local date. */
  day: string
  /** The Brief written for this day, if one has been. */
  brief: { body: string; bodyShort: string } | null
  /** The day's Todos, in no order: every `today` Todo, and those completed this day. */
  todos: TodayTodo[]
  events: DayEvent[]
  hours: HourWording[]
  /** Newest first. */
  mentions: Mention[]
  /** How many Todos the last Rollover sent back. */
  sentBack: number
}

export interface TodayView {
  stack: TodayTodo[]
  /** Completed this day, most recently first. */
  done: TodayTodo[]
  takeOnNow: TakeOnNow<TodayTodo> | null
  timeline: TimelineHour[]
  meetings: number
  /** How many Todos in the stack the last Rollover carried over. */
  carriedOver: number
}

/** Everything the Today screen derives from the day, at an hour of it. */
export function viewToday(today: Today, hourNow: number): TodayView {
  const stack = priorityStack(today.todos)
  return {
    stack,
    done: today.todos
      .filter((todo) => todo.state === 'done')
      .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
    takeOnNow: takeOnNow(stack, hourNow),
    timeline: timeline(stack, today.events, today.hours),
    meetings: meetingCount(today.events),
    carriedOver: stack.filter((todo) => todo.carryCount > 0).length,
  }
}

const two = (value: number) => String(value).padStart(2, '0')

/** "09:00–11:00", or "09–11" where there is a phone's width. */
export function formatHours({ from, until }: Hours, length: 'long' | 'short'): string {
  return length === 'long' ? `${two(from)}:00–${two(until)}:00` : `${two(from)}–${two(until)}`
}

/** "Good morning, Ryan." */
export function greeting(hour: number, firstName: string): string {
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return firstName ? `Good ${part}, ${firstName}.` : `Good ${part}.`
}

/** "Wednesday · 17 Sep · 08:41", as the user's wall clock reads. */
export function dayLine(now: Date, timeZone: string): string {
  const { day } = wallClock(now, timeZone)
  const date = new Date(`${day}T00:00:00Z`)
  const name = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(date)
  return [
    name({ weekday: 'long' }),
    `${date.getUTCDate()} ${name({ month: 'short' })}`,
    clockTime(now, timeZone),
  ].join(' · ')
}
