import { shellDestinations, tabBarDestinations } from '@crazy/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useLive } from '#/lib/live'
import { shellQuery } from '#/lib/queries'
import { LiveIndicator } from './LiveIndicator'
import { Notices } from './Notices'
import { UserBadge } from './UserBadge'

/**
 * The single navigation frame around every screen. One DOM serves both widths:
 * below 900px the rail collapses to a top bar and the tab bar appears.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { data: shell } = useSuspenseQuery(shellQuery)
  useLive()

  return (
    <div className="shell">
      <aside className="shell__rail">
        <Link to="/" className="shell__wordmark">
          CRAZY
        </Link>
        <nav className="shell__nav" aria-label="Primary">
          {shellDestinations(shell.billing).map(({ id, to, label }, index) => (
            <Link
              key={id}
              to={to}
              className="shell__dest"
              activeProps={{ className: 'is-active' }}
              activeOptions={{ exact: to === '/' }}
            >
              <span className="shell__num">{String(index + 1).padStart(2, '0')}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="shell__foot">
          <LiveIndicator now={shell.now} timeZone={shell.timeZone} />
          <UserBadge name={shell.name} initials={shell.initials} />
        </div>
      </aside>

      <main className="shell__main">
        <Notices />
        {children}
      </main>

      <nav className="tabbar" aria-label="Primary">
        {tabBarDestinations(shell.billing).map(({ id, to, label }) => (
          <Link
            key={id}
            to={to}
            className="tabbar__tab"
            activeProps={{ className: 'is-active' }}
            activeOptions={{ exact: to === '/' }}
          >
            {label}
          </Link>
        ))}
        <Link to="/more" className="tabbar__tab" activeProps={{ className: 'is-active' }}>
          More
        </Link>
      </nav>
    </div>
  )
}
