import { expect, it } from 'vite-plus/test'
import { clockTime, localTimeToInstant, startOfDay, wallClock } from './clock'

it("reads a wall-clock time in the user's time zone", () => {
  // The mockups' moment: Wednesday 17 Sep 2025, 08:41.
  expect(localTimeToInstant('2025-09-17T08:41', 'America/Chicago')?.toISOString()).toBe(
    '2025-09-17T13:41:00.000Z',
  )
  expect(localTimeToInstant('2025-09-17T08:41', 'Asia/Kolkata')?.toISOString()).toBe(
    '2025-09-17T03:11:00.000Z',
  )
  expect(localTimeToInstant('2025-09-17T08:41:30', 'UTC')?.toISOString()).toBe(
    '2025-09-17T08:41:30.000Z',
  )
})

it('follows the zone across a clock change', () => {
  expect(localTimeToInstant('2025-01-15T00:00', 'America/Chicago')?.toISOString()).toBe(
    '2025-01-15T06:00:00.000Z',
  )
  // Local midnight on the day the clocks go back is still midnight.
  expect(localTimeToInstant('2025-11-02T00:00', 'America/Chicago')?.toISOString()).toBe(
    '2025-11-02T05:00:00.000Z',
  )
  expect(localTimeToInstant('2025-11-03T00:00', 'America/Chicago')?.toISOString()).toBe(
    '2025-11-03T06:00:00.000Z',
  )
  // 01:30 happens twice that night; the first is meant.
  expect(localTimeToInstant('2025-11-02T01:30', 'America/Chicago')?.toISOString()).toBe(
    '2025-11-02T06:30:00.000Z',
  )
  // 02:30 never happens the night the clocks go forward.
  expect(localTimeToInstant('2025-03-09T02:30', 'America/Chicago')?.toISOString()).toBe(
    '2025-03-09T07:30:00.000Z',
  )
})

it('refuses anything that is not a wall-clock time', () => {
  expect(localTimeToInstant('2025-09-17T13:41:00Z', 'UTC')).toBeNull()
  expect(localTimeToInstant('2025-02-30T08:00', 'UTC')).toBeNull()
  expect(localTimeToInstant('tomorrow', 'UTC')).toBeNull()
})

it("reads a moment off the user's wall clock", () => {
  const now = new Date('2025-09-17T03:30:00.000Z')
  expect(wallClock(now, 'America/Chicago')).toEqual({ day: '2025-09-16', hour: 22, minute: 30 })
  expect(wallClock(now, 'Asia/Kolkata')).toEqual({ day: '2025-09-17', hour: 9, minute: 0 })
  expect(clockTime(now, 'Asia/Kolkata')).toBe('09:00')
})

it("finds the user's local midnight", () => {
  expect(startOfDay('2025-09-17', 'America/Chicago').toISOString()).toBe('2025-09-17T05:00:00.000Z')
})
