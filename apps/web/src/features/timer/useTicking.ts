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
 */
export function useTicking(readAt: string, ticking: boolean): Date {
  // The count is kept beside the moment it was measured from, so a new read
  // starts from nothing without the render that resetting it would cost.
  const [ticked, setTicked] = useState({ readAt, seconds: 0 })

  useEffect(() => {
    if (!ticking) return
    const from = performance.now()
    const id = setInterval(
      () => setTicked({ readAt, seconds: Math.floor((performance.now() - from) / 1000) }),
      1000,
    )
    return () => clearInterval(id)
  }, [readAt, ticking])

  const seconds = ticked.readAt === readAt ? ticked.seconds : 0
  return new Date(new Date(readAt).getTime() + seconds * 1000)
}
