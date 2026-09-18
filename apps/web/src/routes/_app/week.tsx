import { createFileRoute } from '@tanstack/react-router'
import { WeekScreen } from '#/features/week/WeekScreen'
import { weekQuery } from '#/lib/queries'

export const Route = createFileRoute('/_app/week')({
  loader: ({ context }) => context.queryClient.ensureQueryData(weekQuery),
  component: WeekScreen,
})
