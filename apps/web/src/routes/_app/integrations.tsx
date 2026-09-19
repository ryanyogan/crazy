import { createFileRoute } from '@tanstack/react-router'
import { IntegrationsScreen } from '#/features/integrations/IntegrationsScreen'
import { integrationsQuery } from '#/lib/queries'

export const Route = createFileRoute('/_app/integrations')({
  loader: ({ context }) => context.queryClient.ensureQueryData(integrationsQuery),
  component: IntegrationsScreen,
})
