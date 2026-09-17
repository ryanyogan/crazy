// The current time is always a parameter. These helpers turn a time as a
// person reads it off a wall clock into the moment it names, in their zone.

/** A wall-clock time with no zone: "2025-09-17T08:41", seconds optional. */
const LOCAL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/** How far the zone's wall clock is ahead of UTC at this moment, in milliseconds. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  const wall = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  )
  return wall - Math.floor(instant / 1000) * 1000
}

/**
 * The moment a wall clock in `timeZone` shows `local`, or null if `local` is
 * not a wall-clock time. A time that happens twice when the clocks go back
 * resolves to the first; one the clocks skip resolves to the hour before.
 */
export function localTimeToInstant(local: string, timeZone: string): Date | null {
  const match = LOCAL_TIME.exec(local)
  if (!match) return null
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0))
  const wall = Date.UTC(year!, month! - 1, day, hour, minute, second)
  // A real date survives the round trip; "2025-02-30" does not.
  if (new Date(wall).toISOString().slice(0, 16) !== local.slice(0, 16)) return null

  const guess = wall - zoneOffset(wall, timeZone)
  return new Date(wall - zoneOffset(guess, timeZone))
}

/** What a wall clock in `timeZone` shows at `instant`. */
export interface WallClock {
  /** The local date: "2025-09-17". */
  day: string
  hour: number
  minute: number
}

export function wallClock(instant: Date, timeZone: string): WallClock {
  const wall = new Date(instant.getTime() + zoneOffset(instant.getTime(), timeZone))
  return {
    day: wall.toISOString().slice(0, 10),
    hour: wall.getUTCHours(),
    minute: wall.getUTCMinutes(),
  }
}

/** The moment `day` began in `timeZone`: the last Rollover, seen from inside that day. */
export function startOfDay(day: string, timeZone: string): Date {
  const start = localTimeToInstant(`${day}T00:00`, timeZone)
  if (!start) throw new Error(`Not a day: ${day}`)
  return start
}

/** The day `count` days after `day` (before it, when negative). */
export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}
