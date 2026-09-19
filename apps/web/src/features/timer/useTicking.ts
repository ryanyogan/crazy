import { useEffect, useState } from 'react'

/**
 * The present, as a browser is allowed to know it: the moment the loader handed
 * this screen, plus how long ago that was by `performance.now()` — a count that
 * no clock change and no zone change can move. The clock itself is never read
 * here (AGENTS.md, "The current time is always a parameter"), and nothing is
 * asked of the server per second.
 *
 * It ticks only while something is running, so a screen with nothing to count
 * does not re-render every second, and it starts again from whatever moment the
 * next read hands it, so it can never drift far.
 *
 * A background tab may have its interval throttled to once a minute, which
 * costs nothing — the count is a subtraction, not a tally — but the second it
 * shows would be stale for as long as it took to come back. So it is read
 * again the moment the tab is looked at.
 */
export function useTicking(readAt: string, ticking: boolean): Date {
  // The count is kept beside the moment it was measured from, so a new read
  // starts from nothing without the render that resetting it would cost.
  const [ticked, setTicked] = useState({ readAt, seconds: 0 })

  useEffect(() => {
    if (!ticking) return
    const from = performance.now()
    const read = () => setTicked({ readAt, seconds: Math.floor((performance.now() - from) / 1000) })
    const id = setInterval(read, 1000)
    const looked = () => {
      if (document.visibilityState === 'visible') read()
    }
    document.addEventListener('visibilitychange', looked)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', looked)
    }
  }, [readAt, ticking])

  const seconds = ticked.readAt === readAt ? ticked.seconds : 0
  return new Date(new Date(readAt).getTime() + seconds * 1000)
}
