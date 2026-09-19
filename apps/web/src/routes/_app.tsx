import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { Shell } from '#/features/shell/Shell'
import { shellQuery, timerQuery } from '#/lib/queries'
import { getViewer } from '#/server/functions'

// Everything behind sign-in: guards the session, loads what the Shell shows.
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const viewer = await getViewer()
    if (!viewer.userId) throw redirect({ to: '/sign-in' })
  },
  // The timer is the Shell's, not one screen's: while a Time entry runs the
  // header shows it wherever the user is, so it is loaded here and not by the
  // Today screen. With the Billing module off there is no timer to load.
  loader: async ({ context }) => {
    const shell = await context.queryClient.ensureQueryData(shellQuery)
    if (shell.billing) await context.queryClient.ensureQueryData(timerQuery)
  },
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
})
