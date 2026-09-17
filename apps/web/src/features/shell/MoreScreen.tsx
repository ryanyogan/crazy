import { moreDestinations } from '@crazy/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { shellQuery } from '#/lib/queries'
import { UserBadge } from './UserBadge'

/** Everything the phone tab bar leaves out, so no screen is unreachable on a phone. */
export function MoreScreen() {
  const { data: shell } = useSuspenseQuery(shellQuery)

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">More</h1>
      </header>
      <nav className="more" aria-label="More destinations">
        {moreDestinations(shell.billing).map(({ id, to, label }) => (
          <Link key={id} to={to} className="more__dest">
            {label}
          </Link>
        ))}
      </nav>
      <div className="more__who">
        <UserBadge name={shell.name} initials={shell.initials} />
      </div>
    </div>
  )
}
