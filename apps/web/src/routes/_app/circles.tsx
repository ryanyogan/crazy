import { createFileRoute } from '@tanstack/react-router'
import { EmptyScreen } from '#/features/screens/EmptyScreen'

export const Route = createFileRoute('/_app/circles')({
  component: () => <EmptyScreen title="Circles" />,
})
