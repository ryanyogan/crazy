import { useClerk } from '@clerk/tanstack-react-start'
import { clerkEnabled } from '#/lib/auth'

interface Who {
  name: string
  initials: string
}

function Badge({ name, initials }: Who) {
  return (
    <>
      <span className="badge__initials">{initials}</span>
      <span className="badge__name">{name}</span>
    </>
  )
}

function ClerkUserBadge(who: Who) {
  const { openUserProfile } = useClerk()
  return (
    <button
      type="button"
      className="badge"
      aria-label={`${who.name}: manage account`}
      onClick={() => openUserProfile()}
    >
      <Badge {...who} />
    </button>
  )
}

/** Who is signed in. With Clerk it opens the account; the demo user has none to open. */
export function UserBadge(who: Who) {
  if (clerkEnabled) return <ClerkUserBadge {...who} />
  return (
    <div className="badge">
      <Badge {...who} />
    </div>
  )
}
