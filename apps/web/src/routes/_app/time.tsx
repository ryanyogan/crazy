import { timeView } from '@crazy/shared'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { TimeScreen } from '#/features/time/TimeScreen'
import { shellQuery, timeQuery } from '#/lib/queries'

/**
 * Which period the timesheet is on lives in the URL, so last week can be
 * linked to, gone back from and reloaded into. `on` is a local day the period
 * is anchored on — the day itself, a day in the week, a day in the month — and
 * is left off for the period the moment falls in, so that "this week" is a
 * plain link rather than a date that goes stale overnight. A URL the app does
 * not understand falls back to this week rather than failing the route.
 */
const search = z.object({
  view: timeView.default('week').catch('week'),
  on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/_app/time')({
  validateSearch: search,
  loaderDeps: ({ search: { view, on } }) => ({ view, on }),
  // Part of the Billing module: with it off there is no such screen, rather
  // than a hidden one.
  loader: async ({ context, deps }) => {
    const shell = await context.queryClient.ensureQueryData(shellQuery)
    if (!shell.billing) throw notFound()
    await context.queryClient.ensureQueryData(timeQuery(deps.view, deps.on))
  },
  component: TimeScreen,
})
