import { localTimeToInstant } from '@crazy/shared'
import { getCookie, setResponseHeader } from '@tanstack/react-start/server'

// Server only. The current time is always a parameter, and this is the one
// place the web app reads it. Loaders and server functions take the moment
// from here and hand it on; nothing else looks at the clock.

/** A wall-clock time in the user's zone, e.g. "2025-09-17T08:41". Development only. */
export const PINNED_NOW_COOKIE = 'crazy-now'
/** Echoes the moment a pinned request was served at, so a pin is never silently ignored. */
export const PINNED_NOW_HEADER = 'x-crazy-now'

/**
 * The moment this request is served at. In development a request may pin it,
 * so a screen can be compared with its frame at the time the frame shows; a
 * production build never reads the cookie.
 */
export function requestNow(timeZone: string): Date {
  const pinned = import.meta.env.DEV ? getCookie(PINNED_NOW_COOKIE) : undefined
  if (!pinned) return new Date()

  const now = localTimeToInstant(pinned, timeZone)
  if (!now) {
    throw new Error(`${PINNED_NOW_COOKIE} must be a local time like 2025-09-17T08:41`)
  }
  setResponseHeader(PINNED_NOW_HEADER, now.toISOString())
  return now
}
