import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { browserNow } from '#/lib/clock'
import { todayQuery } from '#/lib/queries'

/**
 * Read a fresh server moment when the next snooze ends, without polling the
 * Coordinator. The wait is measured from the browser's clock, not from when the
 * read was taken: patches arriving over the socket do not refresh `readAt`, so
 * an old read would set the timer late and leave the Todo hidden past its
 * snooze. Early is harmless — the refetch carries a new server moment and this
 * arms again.
 */
export function useSnoozeExpiry(until: string | null, readAt: string): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!until) return
    const timer = setTimeout(
      () => {
        void queryClient.invalidateQueries({ queryKey: todayQuery.queryKey })
      },
      Math.max(1000, new Date(until).getTime() - browserNow().getTime()),
    )
    return () => clearTimeout(timer)
  }, [until, readAt, queryClient])
}
