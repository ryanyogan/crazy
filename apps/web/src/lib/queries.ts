import { type MetricRange, type Patch, apply, bornElsewhere } from '@crazy/shared'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import {
  getCircles,
  getIntegrations,
  getMetrics,
  getProjects,
  getShell,
  getToday,
  getWeek,
} from '#/server/functions'

// One query per read model. Loaders `ensureQueryData` these during SSR and
// screens read them with `useSuspenseQuery`, so the cache is the only source.

export const shellQuery = queryOptions({ queryKey: ['shell'], queryFn: () => getShell() })

export const todayQuery = queryOptions({ queryKey: ['today'], queryFn: () => getToday() })

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
  queryClient.setQueryData(todayQuery.queryKey, (today) => today && apply(today, ops))
  // A Todo made here is a One-off with no Project, so it joins the list and
  // belongs to no card; what the Projects screen shows change is the Signal.
  queryClient.setQueryData(projectsQuery.queryKey, (projects) => projects && apply(projects, ops))
  queryClient.setQueryData(integrationsQuery.queryKey, (held) => held && apply(held, ops))
  // The Shell lists Time and Invoices only while the Billing module is on.
  queryClient.setQueryData(shellQuery.queryKey, (shell) => shell && apply(shell, ops))
  // A Connection made on another device comes with Clerk's word, which no patch carries.
  if (bornElsewhere(ops)) void queryClient.invalidateQueries(integrationsQuery)
}
