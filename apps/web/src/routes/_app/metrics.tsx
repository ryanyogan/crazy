import {
  DEFAULT_METRIC_RANGE,
  DEFAULT_METRIC_TAB,
  metricRange,
  metricTabInUrl,
} from '@crazy/shared'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { MetricsScreen } from '#/features/metrics/MetricsScreen'
import { metricsQuery, metricsTimeQuery, shellQuery } from '#/lib/queries'

/**
 * Which tab is open and how far back it looks both live in the URL, so either
 * can be linked to, gone back from and reloaded into. A URL the app does not
 * understand falls back to what frame 1f draws rather than failing the route.
 *
 * Only the tabs a user can reach may be named: the Money tab is drawn and not
 * wired, so nothing navigates to it and no link carries it.
 */
const search = z.object({
  tab: metricTabInUrl.default(DEFAULT_METRIC_TAB).catch(DEFAULT_METRIC_TAB),
  range: metricRange.default(DEFAULT_METRIC_RANGE).catch(DEFAULT_METRIC_RANGE),
})

export const Route = createFileRoute('/_app/metrics')({
  validateSearch: search,
  loaderDeps: ({ search: { tab, range } }) => ({ tab, range }),
  // The Time tab belongs to the Billing module. With it off the screen is
  // exactly frame 1f's, and a link to the Time tab simply opens the Todos one
  // — Metrics is every user's screen, and only this half of it is not.
  loader: async ({ context, deps }) => {
    const shell = await context.queryClient.ensureQueryData(shellQuery)
    await (shell.billing && deps.tab === 'time'
      ? context.queryClient.ensureQueryData(metricsTimeQuery(deps.range))
      : context.queryClient.ensureQueryData(metricsQuery(deps.range)))
  },
  component: MetricsScreen,
})
