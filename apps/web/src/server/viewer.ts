import { auth, clerkClient } from '@clerk/tanstack-react-start/server'
import { DEMO_USER } from '@crazy/shared'
import { clerkEnabled } from '#/lib/auth'

// Server only. Who is asking: the Clerk user, or the demo user when no Clerk
// keys are configured.

export async function viewerId(): Promise<string | null> {
  if (!clerkEnabled) return DEMO_USER.id
  return (await auth()).userId
}

/** The name shown in the Shell, taken from the user's account. */
export async function viewerName(userId: string): Promise<string> {
  if (!clerkEnabled) return DEMO_USER.name
  const user = await clerkClient().users.getUser(userId)
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return name || user.primaryEmailAddress?.emailAddress.split('@')[0] || 'You'
}
