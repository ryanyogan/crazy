import {
  BILLING_PROVIDERS,
  type ConnectionView,
  PROVIDER_CARDS,
  type Provider,
  unavailableIn,
} from '@crazy/shared'
import { Blueprint, NotWired, Tag } from '@crazy/ui'
import { ConnectButton, ReauthoriseButton } from './ClerkActions'

/**
 * The billing and accounting section of the Integrations screen, frame 2c. It
 * is drawn only with the Billing module on, because a Client is only there
 * then. Xero is connected the way every other Provider is — Clerk's
 * add-external-account flow, and no token anywhere (ADR 0001) — and the rest
 * are drawn as not available yet, because Clerk brokers no connection to them.
 *
 * Every Provider here is read-only, like every Provider: Crazy would read what
 * an accounting Provider says about an invoice and never write one into it.
 * Nothing syncs today; this section connects, and that is all.
 */
export function BillingProviders({
  connections,
  canConnect,
}: {
  connections: readonly ConnectionView[]
  canConnect: boolean
}) {
  return (
    <section className="intg-bill" aria-labelledby="intg-bill-title">
      <h2 id="intg-bill-title" className="intg-bill__title">
        Billing &amp; accounting
      </h2>
      <p className="intg-bill__note">
        Read-only, like every Connection. Crazy has never sent an invoice anywhere, and nothing
        syncs yet.
      </p>
      <ul className="providers intg-bill__cards">
        {BILLING_PROVIDERS.map((provider) => (
          <BillingCard
            key={provider}
            provider={provider}
            connections={connections.filter((each) => each.provider === provider)}
            canConnect={canConnect}
          />
        ))}
        {unavailableIn('billing').map((card) => (
          <Blueprint as="li" key={card.key} className="card provider provider--open">
            <div className="provider__head">
              <Tag className="provider__chip" aria-hidden="true">
                {card.chip}
              </Tag>
              <Tag className="provider__status">Planned</Tag>
            </div>
            <h3 className="card-title">{card.name}</h3>
            <p className="card-body">{card.reads}</p>
            {/* Drawn, plainly unavailable, and why in full for assistive technology. */}
            <NotWired why={card.why}>
              <button type="button" className="btn provider__action">
                Connect<span className="sr-only"> {card.name}</span>
              </button>
            </NotWired>
            <p className="card-meta">{card.unavailable}</p>
          </Blueprint>
        ))}
      </ul>
    </section>
  )
}

/** One billing Provider Clerk can broker, connected or waiting to be. */
function BillingCard({
  provider,
  connections,
  canConnect,
}: {
  provider: Provider
  connections: readonly ConnectionView[]
  canConnect: boolean
}) {
  const card = PROVIDER_CARDS[provider]
  const connected = connections.length > 0
  const lapsed = connections.some((each) => each.status === 'reauth')
  const [first] = connections

  return (
    <Blueprint as="li" className={`card provider${connected ? '' : ' provider--open'}`}>
      <div className="provider__head">
        <Tag className="provider__chip" aria-hidden="true">
          {card.chip}
        </Tag>
        {connected ? (
          <Tag tone={lapsed ? 'outline' : 'accent'} className="provider__status">
            {lapsed ? 'Re-auth' : 'Connected'}
          </Tag>
        ) : (
          <Tag className="provider__status">Available</Tag>
        )}
      </div>
      <h3 className="card-title">{card.name}</h3>
      {/* The scopes are Clerk's word once Clerk is asked; until then, what Crazy reads there. */}
      <p className="card-body">{first?.scopes ?? card.reads}</p>

      {first && (
        <p className="card-meta">
          {first.label ? `${first.label} · ` : ''}
          {first.status === 'reauth' ? 'authorisation lapsed' : 'connected · nothing pulled yet'}
        </p>
      )}

      {canConnect ? (
        first?.status === 'reauth' ? (
          <ReauthoriseButton
            externalAccountId={first.externalAccountId}
            provider={provider}
            name={card.name}
          />
        ) : (
          <ConnectButton provider={provider} name={card.name} another={connected} />
        )
      ) : (
        !connected && (
          <NotWired why="Connecting goes through Clerk, which is not configured here">
            <button type="button" className="btn provider__action">
              Connect<span className="sr-only"> {card.name}</span>
            </button>
          </NotWired>
        )
      )}
    </Blueprint>
  )
}
