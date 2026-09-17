import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { Shell } from '#/features/shell/Shell'
import { shellQuery } from '#/lib/queries'
import { getViewer } from '#/server/functions'

// Everything behind sign-in: guards the session, loads what the Shell shows.
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const viewer = await getViewer()
    if (!viewer.userId) throw redirect({ to: '/sign-in' })
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(shellQuery),
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
})
