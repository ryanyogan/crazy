import {
  type MetricRange,
  type Patch,
  type TimeView,
  apply,
  bornElsewhere,
  namesUnknownWork,
} from '@crazy/shared'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import {
  getCircles,
  getIntegrations,
  getInvoices,
  getMetrics,
  getMetricsTime,
  getProjects,
  getShell,
  getTime,
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

/**
 * One period of the timesheet. The period is part of the key, so moving from
 * this week to last and back is a cache hit the second time, and a patch is
 * laid over every period a tab has read (`applyToCache`).
 */
export const TIME_KEY = ['time'] as const

export const timeQuery = (view: TimeView, on?: string) =>
  queryOptions({
    queryKey: [...TIME_KEY, view, on ?? 'now'] as const,
    queryFn: () => getTime({ data: { view, on } }),
  })

/** What one of those periods holds, as `apply` takes it (`Applicable`). */
type TimeCache = Awaited<ReturnType<typeof getTime>>

/**
 * One period of the invoices, with the invoice that is open. The Time screen
 * draws the same column beside its timesheet (frame 2b is one page for the
 * two), so both read this one query and cannot come to different figures.
 */
export const invoicesQuery = (on?: string, open?: string) =>
  queryOptions({
    queryKey: ['invoices', on ?? 'now', open ?? 'first'] as const,
    queryFn: () => getInvoices({ data: { on, open } }),
  })

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

/**
 * The Metrics screen's Time tab, one query per range. It is its own read model
 * rather than part of the Todos tab's: a user with the Billing module off never
 * asks for it, and moving between the two tabs is a cache hit the second time.
 */
export const metricsTimeQuery = (range: MetricRange) =>
  queryOptions({
    queryKey: ['metrics-time', range],
    queryFn: () => getMetricsTime({ data: { range } }),
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
  // Every period of the timesheet this tab has read: an entry edited while the
  // Time screen is on last week belongs to last week, and a period that does
  // not hold the row is left exactly as it was.
  queryClient.setQueriesData<TimeCache>({ queryKey: TIME_KEY }, (held) =>
    held ? apply(held, ops) : held,
  )
  // The Shell lists Time and Invoices only while the Billing module is on.
  queryClient.setQueryData(shellQuery.queryKey, (shell) => shell && apply(shell, ops))
  // A Connection made on another device comes with Clerk's word, which no patch carries.
  if (bornElsewhere(ops)) void queryClient.invalidateQueries(integrationsQuery)
  // A timer started on another device names its Client and Project by id, and
  // the names live in rows the patch does not carry: the timer is read again.
  if (timer && namesUnknownWork(timer, ops)) void queryClient.invalidateQueries(timerQuery)
}
