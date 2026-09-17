import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ClerkSignIn } from '#/features/auth/ClerkSignIn'
import { SignInScreen } from '#/features/auth/SignInScreen'
import { clerkEnabled } from '#/lib/auth'
import { getViewer } from '#/server/functions'

export const Route = createFileRoute('/sign-in')({
  beforeLoad: async () => {
    if (!clerkEnabled) return
    const viewer = await getViewer()
    if (viewer.userId) throw redirect({ to: '/' })
  },
  component: clerkEnabled ? ClerkSignIn : DemoSignIn,
})

/** Without Clerk keys every door leads straight in, as the demo user Ryan. */
function DemoSignIn() {
  const navigate = useNavigate()
  const enter = () => navigate({ to: '/' })
  return <SignInScreen signInWith={enter} sendCode={enter} />
}
