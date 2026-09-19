import type { TimerEntry, TodayTimer } from '@crazy/shared'
import { useEffect, useRef, useState } from 'react'

// What has just happened to the running timer, for as long as it is worth
// showing. It is read from the rows themselves, so a start made on another
// device washes across this header too; nothing here is told by the press.

export interface TimerChange {
  kind: 'started' | 'switched' | 'stopped'
  /** The entry it happened to: the one that began, or the one that ended. */
  entry: TimerEntry
}

/**
 * How long a change stands: as long as the header holds the stop receipt, so
 * that what is said aloud has time to be heard. The start's wash and the
 * switch's cross-fade are each one short pass inside it and end themselves.
 */
const HELD_MS = 1500

/**
 * A timer already running when this was first drawn has not just started, so
 * nothing plays on a page load: only a change from what was first seen counts.
 */
export function useTimerChange(timer: TodayTimer | null): TimerChange | null {
  const [change, setChange] = useState<TimerChange | null>(null)
  const running = timer?.running ?? null
  const ended = timer?.last ?? null
  const before = useRef<string | null>(running?.id ?? null)
  const holding = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(holding.current), [])

  useEffect(() => {
    const was = before.current
    const is = running?.id ?? null
    if (was === is) return
    before.current = is

    const hold = (next: TimerChange) => {
      clearTimeout(holding.current)
      setChange(next)
      holding.current = setTimeout(() => setChange(null), HELD_MS)
    }

    // Begun: from nothing it is a start, from other work it is a switch, and a
    // switch changes the work without making anything of it.
    if (running) return hold({ kind: was === null ? 'started' : 'switched', entry: running })
    // Stopped. The entry that ended is the one the rows now report as the last.
    if (ended && ended.id === was && ended.endedAt !== null) {
      hold({ kind: 'stopped', entry: ended })
    }
  }, [running, ended])

  return change
}
