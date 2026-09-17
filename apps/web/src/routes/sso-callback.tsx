import { AuthenticateWithRedirectCallback } from '@clerk/tanstack-react-start'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { clerkEnabled } from '#/lib/auth'

// Where Google and GitHub send the browser back. Clerk finishes the sign-in
// (or transfers it into a sign-up) and moves on to `/`.
export const Route = createFileRoute('/sso-callback')({
  beforeLoad: () => {
    if (!clerkEnabled) throw redirect({ to: '/' })
  },
  component: () => <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" />,
})
