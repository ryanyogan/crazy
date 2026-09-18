import { type Patch, apply } from '@crazy/shared'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { getShell, getToday } from '#/server/functions'

// One query per read model. Loaders `ensureQueryData` these during SSR and
// screens read them with `useSuspenseQuery`, so the cache is the only source.

export const shellQuery = queryOptions({ queryKey: ['shell'], queryFn: () => getShell() })

export const todayQuery = queryOptions({ queryKey: ['today'], queryFn: () => getToday() })

/** Lays operations over every cached read model that holds the rows they name. */
export function applyToCache(queryClient: QueryClient, ops: Patch['ops']): void {
  queryClient.setQueryData(todayQuery.queryKey, (today) => today && apply(today, ops))
}
