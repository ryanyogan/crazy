import { createFileRoute } from '@tanstack/react-router'
import { EmptyScreen } from '#/features/screens/EmptyScreen'

export const Route = createFileRoute('/_app/metrics')({
  component: () => <EmptyScreen title="Metrics" />,
})
