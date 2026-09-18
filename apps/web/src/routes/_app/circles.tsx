import { createFileRoute } from '@tanstack/react-router'
import { CirclesScreen } from '#/features/circles/CirclesScreen'
import { circlesQuery } from '#/lib/queries'

export const Route = createFileRoute('/_app/circles')({
  loader: ({ context }) => context.queryClient.ensureQueryData(circlesQuery),
  component: CirclesScreen,
})
