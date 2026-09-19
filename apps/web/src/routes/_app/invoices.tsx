import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { InvoicesScreen } from '#/features/invoices/InvoicesScreen'
import { invoicesQuery, shellQuery } from '#/lib/queries'

/**
 * Which month is being invoiced, and which invoice is open, both live in the
 * URL — so a draft can be linked to, gone back from and reloaded into, the way
 * the Time screen holds its period. `on` is a local day in the month, left off
 * for the month the moment falls in, so "this month" is a plain link rather
 * than a date that goes stale. A URL the app does not understand falls back to
 * this month rather than failing the route.
 */
const search = z.object({
  on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  open: z.string().min(1).max(200).optional().catch(undefined),
})

export const Route = createFileRoute('/_app/invoices')({
  validateSearch: search,
  loaderDeps: ({ search: { on, open } }) => ({ on, open }),
  // Part of the Billing module: with it off there is no such screen, rather than a hidden one.
  loader: async ({ context, deps }) => {
    const shell = await context.queryClient.ensureQueryData(shellQuery)
    if (!shell.billing) throw notFound()
    await context.queryClient.ensureQueryData(invoicesQuery(deps.on, deps.open))
  },
  component: InvoicesScreen,
})
