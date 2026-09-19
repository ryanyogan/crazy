import { Blueprint, NotWired } from '@crazy/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { integrationsQuery } from '#/lib/queries'
import { ManageAccountButton } from './ClerkActions'
import { ProviderCards } from './ProviderCards'
import { RealtimeCard } from './RealtimeCard'

/**
 * The Integrations screen, frame 1g: each Provider and the Connections made to
 * it, the Account as Clerk has it, the socket and the lifecycle settings. One
 * DOM serves both widths: on a phone the aside falls under the Providers.
 */
export function IntegrationsScreen() {
  const { data } = useSuspenseQuery(integrationsQuery)
  const { account } = data

  return (
    <div className="screen integrations">
      <section className="integrations__providers" aria-labelledby="integrations-title">
        <h1 id="integrations-title" className="screen__title integrations__title">
          Integrations
        </h1>
        <ProviderCards
          connections={data.connections}
          canConnect={data.canConnect}
          now={new Date(data.now)}
          timeZone={data.timeZone}
        />
      </section>

      <aside className="integrations__aside">
        <Blueprint as="section" className="card account" aria-labelledby="account-title">
          <h2 id="account-title" className="card-kicker">
            Account
          </h2>
          <div className="account__who">
            <span className="account__initials" aria-hidden="true">
              {account.initials}
            </span>
            <div className="account__name">
              {account.name}
              <div className="account__how">
                {[account.email, account.signedInWith].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <p className="account__security">{account.security}</p>
          {account.managed ? (
            <ManageAccountButton />
          ) : (
            <NotWired why="The demo user has no account to manage">
              <button type="button" className="btn btn-secondary account__manage">
                Manage account
              </button>
            </NotWired>
          )}
        </Blueprint>

        <RealtimeCard realtime={data.realtime} settings={data.settings} timeZone={data.timeZone} />
      </aside>
    </div>
  )
}
