import { type MetricRange, type Patch, apply, bornElsewhere, namesUnknownWork } from '@crazy/shared'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import {
  getCircles,
  getIntegrations,
  getMetrics,
  getProjects,
  getShell,
  getTimer,
  getToday,
  getWeek,
} from '#/server/functions'

// One query per read model. Loaders `ensureQueryData` these during SSR and
// screens read them with `useSuspenseQuery`, so the cache is the only source.

export const shellQuery = queryOptions({ queryKey: ['shell'], queryFn: () => getShell() })

export const todayQuery = queryOptions({ queryKey: ['today'], queryFn: () => getToday() })

/**
 * The timer is the Shell's, not one screen's: it is loaded by the `_app` route
 * with the Billing module on and read by the header, by the Today bar and by
 * the work picker, so that what follows the user around and what she presses
 * are the same rows (ticket 27).
 */
export const timerQuery = queryOptions({ queryKey: ['timer'], queryFn: () => getTimer() })

export const weekQuery = queryOptions({ queryKey: ['week'], queryFn: () => getWeek() })

export const circlesQuery = queryOptions({ queryKey: ['circles'], queryFn: () => getCircles() })

export const projectsQuery = queryOptions({ queryKey: ['projects'], queryFn: () => getProjects() })

export const integrationsQuery = queryOptions({
  queryKey: ['integrations'],
  queryFn: () => getIntegrations(),
})

/** One query per range, so switching range is a cache hit the second time. */
export const metricsQuery = (range: MetricRange) =>
  queryOptions({
    queryKey: ['metrics', range],
    queryFn: () => getMetrics({ data: { range } }),
  })

/** Lays operations over every cached read model that holds the rows they name. */
export function applyToCache(queryClient: QueryClient, ops: Patch['ops']): void {
  const timer = queryClient.getQueryData(timerQuery.queryKey)
  queryClient.setQueryData(todayQuery.queryKey, (held) => held && apply(held, ops))
  // The timer's own rows and the picker's lists: a Time entry started, ended or
  // worded, and a Project named while choosing work.
  queryClient.setQueryData(timerQuery.queryKey, (held) => held && apply(held, ops))
  // A Todo made here is a One-off with no Project, so it joins the list and
  // belongs to no card; what the Projects screen shows change is the Signal.
  queryClient.setQueryData(projectsQuery.queryKey, (projects) => projects && apply(projects, ops))
  queryClient.setQueryData(integrationsQuery.queryKey, (held) => held && apply(held, ops))
  // The Shell lists Time and Invoices only while the Billing module is on.
  queryClient.setQueryData(shellQuery.queryKey, (shell) => shell && apply(shell, ops))
  // A Connection made on another device comes with Clerk's word, which no patch carries.
  if (bornElsewhere(ops)) void queryClient.invalidateQueries(integrationsQuery)
  // A timer started on another device names its Client and Project by id, and
  // the names live in rows the patch does not carry: the timer is read again.
  if (timer && namesUnknownWork(timer, ops)) void queryClient.invalidateQueries(timerQuery)
}
