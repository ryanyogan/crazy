import { saidAloud, timerTitle } from '@crazy/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { timerQuery } from '#/lib/queries'
import { useTicking } from './useTicking'
import { useTimerChange } from './useTimerChange'

// What the timer says beside the screen: the browser tab while it runs, and
// the one line a screen reader hears when it starts and when it stops. Mounted
// once by the Shell, whatever screen is showing and whether or not the header
// is drawn, so that neither is said twice.

/**
 * The tab title while a Time entry runs: "1:42 · Meridian Health — Crazy". It
 * is rewritten only when the minute changes, and put back when the timer stops.
 * The title otherwise belongs to the router's head, which sets it once and
 * never again, so it is re-applied after a navigation in case it ever does.
 */
function useTabTitle(title: string | null): void {
  const here = useRouterState({ select: (state) => state.location.pathname })
  // What the router put there, taken once: it is the name to give back.
  const base = useRef<string | null>(null)

  useEffect(() => {
    base.current ??= document.title
    if (title === null) return
    document.title = title
    return () => {
      if (base.current !== null) document.title = base.current
    }
  }, [title, here])
}

export function TimerAside() {
  const { data } = useSuspenseQuery(timerQuery)
  const running = data.timer?.running ?? null
  const now = useTicking(data.now, running !== null)
  const change = useTimerChange(data.timer)

  // The minute, not the second: a title that changed every second would be a
  // flicker in the tab strip and nothing more.
  const minutes = running ? Math.floor((now.getTime() - Date.parse(running.startedAt)) / 60000) : 0
  useTabTitle(running ? timerTitle(minutes * 60, running.clientName, 'Crazy') : null)

  // Once each, and nothing between: a switch says nothing, because the work is
  // on the screen and the hours have not changed hands.
  const heard =
    change?.kind === 'started' || change?.kind === 'stopped'
      ? saidAloud(change.kind, change.entry)
      : ''

  return (
    <p className="sr-only" aria-live="polite">
      {heard}
    </p>
  )
}
