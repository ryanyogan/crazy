import { createFileRoute } from '@tanstack/react-router'
import { TodayScreen } from '#/features/today/TodayScreen'
import { todayQuery } from '#/lib/queries'

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(todayQuery),
  component: TodayScreen,
})
