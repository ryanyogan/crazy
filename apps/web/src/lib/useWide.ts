import { useSyncExternalStore } from 'react'

/** The one breakpoint (AGENTS.md): a phone below it, a desktop from it. */
const WIDE = '(min-width: 900px)'

const NONE = () => () => {}

/**
 * Whether the screen is at or past the one breakpoint. Almost everything that
 * differs between a phone and a desktop is CSS on one DOM; this is for the
 * handful of things CSS cannot say — whether the work picker takes the screen
 * as a modal sheet or hangs under its trigger as a dropdown (frames 3a and 3b).
 *
 * A server render knows no width, so it answers as a phone: mobile first. Only
 * a control the user has already opened reads this, which is after hydration.
 */
export function useWide(): boolean {
  return useSyncExternalStore(
    typeof window === 'undefined'
      ? NONE
      : (listener) => {
          const query = window.matchMedia(WIDE)
          query.addEventListener('change', listener)
          return () => query.removeEventListener('change', listener)
        },
    () => window.matchMedia(WIDE).matches,
    () => false,
  )
}
