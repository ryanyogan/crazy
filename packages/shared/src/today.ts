import { clockTime, wallClock } from './clock'
import {
  type DayEvent,
  type HourWording,
  type TimelineHour,
  meetingCount,
  timeline,
} from './timeline'
import { type SignalKind, type Source, type TodayTodo, isSnoozed } from './todo'
import type { TieIn } from './week'

// The rules of the Today screen that need no database: what the Priority
// stack is, which Todo is the Take on now, and how the moment is worded.

/**
 * Whether the user declined this Todo as the Take on now on the day in
 * question. A Swap stores the day it was taken on, so the rest of that local
 * day it sits lower and is not offered again — and not one minute beyond it,
 * because tomorrow's day no longer matches the string.
 */
export function isSwapped(todo: Pick<TodayTodo, 'swappedOnDay'>, day: string): boolean {
  return todo.swappedOnDay === day
}

/**
 * Whether the user has pressed Start on this Todo. It is the moment itself and
 * nothing derived: no rule here decides when a start stops counting, because
 * the day's turning belongs to the Rollover, which clears `startedAt` when it
 * carries a Todo over.
 */
export function isStarted(todo: Pick<TodayTodo, 'startedAt'>): boolean {
  return todo.startedAt !== null
}

/** Where a Todo sits in the stack: its place, and one lower once it has been declined today. */
const place = (todo: StackTodo, day: string) =>
  (todo.stackPosition ?? Infinity) + (isSwapped(todo, day) ? 1 : 0)

type StackTodo = Pick<
  TodayTodo,
  'state' | 'stackPosition' | 'createdAt' | 'snoozedUntil' | 'swappedOnDay'
>

/**
 * The Priority stack: the `today` Todos in the order Crazy recommends. It is
 * an ordering of Todos, not a list of its own. A Todo with no position yet
 * (one just added) follows the placed ones, oldest first. A snoozed Todo is
 * out of it until its snooze ends. A Todo the user swapped today sits one
 * place lower, and behind the Todo it changed places with where the two meet.
 */
export function priorityStack<T extends StackTodo>(
  todos: readonly T[],
  now: Date,
  timeZone: string,
): T[] {
  const { day } = wallClock(now, timeZone)
  return todos
    .filter((todo) => todo.state === 'today' && !isSnoozed(todo, now))
    .sort(
      (a, b) =>
        place(a, day) - place(b, day) ||
        Number(isSwapped(a, day)) - Number(isSwapped(b, day)) ||
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
  /** Whether the user has pressed Start on it today, which is what the card draws. */
  started: boolean
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
 * The one Todo to do at this moment, or none when nothing in the stack is
 * still on offer. Until the calendar is read it is the highest Todo in the
 * stack the user has not declined today, and the hours it fits are the Slots
 * it holds. Swap the last one and there is no Take on now, rather than a card
 * offering something that was just turned down.
 */
export function takeOnNow<T extends Pick<TodayTodo, 'slotHours' | 'swappedOnDay' | 'startedAt'>>(
  stack: readonly T[],
  now: Date,
  timeZone: string,
): TakeOnNow<T> | null {
  const { day, hour } = wallClock(now, timeZone)
  const todo = stack.find((each) => !isSwapped(each, day))
  if (!todo) return null
  return {
    todo,
    hours: fittingHours(todo.slotHours, hour),
    started: isStarted(todo),
  }
}

/** Something Crazy noticed at a Provider that might deserve a Todo. It never becomes one on its own. */
export interface Signal {
  id: string
  kind: SignalKind
  /** Who addressed the user, was promised something, or owes them. */
  who: string
  text: string
  /** When it happened at the Provider. */
  at: string
  /** The Provider item it is; a Todo made from it takes this as its Source. */
  source: Source
  /** The Todo the user added it as, if they have. */
  todoId: string | null
}

/**
 * A Todo the last Rollover sent back. It has left the day, so the rundown
 * needs no more of it than its name (CONTEXT.md, "Sent back").
 */
export interface SentBackTodo {
  id: string
  title: string
}

/**
 * What one of the day's calendar events is tied to. The rows themselves are
 * not repeated here — only which of the day's Todos and Signals belong to the
 * event — so that a Todo ticked in one chapter changes what the meeting says
 * about it in another, from the one copy the cache holds.
 */
export interface EventLinks {
  /** The `DayEvent` these belong to. */
  eventId: string
  /** The Todos whose Source is this event. */
  todoIds: string[]
  /** The Signals whose person the event names. */
  signalIds: string[]
  /** The Client the event's title names, with the Billing module on; null otherwise. */
  clientId: string | null
  /** What Crazy wrote to prepare for it, if it wrote anything. Never a placeholder. */
  prep: { body: string; bodyShort: string } | null
}

/** Where the day is leading: what the rest of the week holds, and what tomorrow opens with. */
export interface Later {
  /** This week's tie-ins, as the Week screen reads them. */
  tieIns: TieIn[]
  /** The Projects whose next milestone falls in the rest of this week. */
  milestones: { project: string; milestone: string; day: string }[]
  /** Tomorrow's first meeting, if the calendar holds one. */
  nextMeeting: { title: string; who: string | null; day: string; at: string } | null
}

/**
 * What the Today screen holds of a user's day: the rows as D1 has them. It is
 * what loaders cache and what commands are applied to, so everything the
 * screen shows beyond it is derived, by `viewToday` and `viewRundown`.
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
  /** The day's Signals, newest first: the Mentions, and what came in since yesterday. */
  signals: Signal[]
  /** The Todos the last Rollover sent back, by name (ticket 28). */
  sentBack: SentBackTodo[]
  /** One per calendar event of the day: the rows tied to it, and Crazy's prep note. */
  links: EventLinks[]
  /** What the rest of the week is leading to, and tomorrow's first meeting. */
  later: Later
}

/** A snoozed Todo, which always knows the moment it returns. */
export type SnoozedTodo = TodayTodo & { snoozedUntil: string }

export interface TodayView {
  stack: TodayTodo[]
  /** Snoozed, and so out of the stack for now; the soonest to return first. */
  snoozed: SnoozedTodo[]
  /** Completed this day, most recently first. */
  done: TodayTodo[]
  takeOnNow: TakeOnNow<TodayTodo> | null
  timeline: TimelineHour[]
  meetings: number
  /** How many Todos in the stack the last Rollover carried over. */
  carriedOver: number
}

/** Everything the Today screen derives from the day, at a moment of it. */
export function viewToday(today: Today, now: Date, timeZone: string): TodayView {
  const stack = priorityStack(today.todos, now, timeZone)
  return {
    stack,
    snoozed: today.todos
      .filter((todo): todo is SnoozedTodo => todo.state === 'today' && isSnoozed(todo, now))
      .sort((a, b) => a.snoozedUntil.localeCompare(b.snoozedUntil)),
    done: today.todos
      .filter((todo) => todo.state === 'done')
      .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
    takeOnNow: takeOnNow(stack, now, timeZone),
    timeline: timeline(stack, today.events, today.hours),
    meetings: meetingCount(today.events),
    carriedOver: stack.filter((todo) => todo.carryCount > 0).length,
  }
}

const two = (value: number) => String(value).padStart(2, '0')

/** "14:00": one hour of the day, as an hour of the timeline is named. */
export function formatHour(hour: number): string {
  return `${two(hour)}:00`
}

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
