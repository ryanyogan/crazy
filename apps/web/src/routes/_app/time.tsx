import { createFileRoute, notFound } from '@tanstack/react-router'
import { EmptyScreen } from '#/features/screens/EmptyScreen'
import { shellQuery } from '#/lib/queries'

export const Route = createFileRoute('/_app/time')({
  // Part of the Billing module: with it off there is no such screen, rather than a hidden one.
  loader: async ({ context }) => {
    const shell = await context.queryClient.ensureQueryData(shellQuery)
    if (!shell.billing) throw notFound()
  },
  component: () => <EmptyScreen title="Time" />,
})
