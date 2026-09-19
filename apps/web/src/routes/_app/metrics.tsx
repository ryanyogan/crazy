import { DEFAULT_METRIC_RANGE, metricRange } from '@crazy/shared'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { MetricsScreen } from '#/features/metrics/MetricsScreen'
import { metricsQuery } from '#/lib/queries'

/**
 * The range lives in the URL, so a range can be linked to, gone back from, and
 * reloaded into. A range the URL does not know falls back to the one frame 1f
 * draws rather than failing the route.
 */
const search = z.object({
  range: metricRange.default(DEFAULT_METRIC_RANGE).catch(DEFAULT_METRIC_RANGE),
})

export const Route = createFileRoute('/_app/metrics')({
  validateSearch: search,
  loaderDeps: ({ search: { range } }) => ({ range }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(metricsQuery(deps.range)),
  component: MetricsScreen,
})
