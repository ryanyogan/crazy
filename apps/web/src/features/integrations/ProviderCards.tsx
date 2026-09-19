import {
  type ConnectionView,
  PROVIDERS,
  PROVIDER_CARDS,
  type Provider,
  SIDES,
  type Side,
  UNAVAILABLE_PROVIDERS,
  ago,
  clockTime,
} from '@crazy/shared'
import { Blueprint, NotWired, Tag } from '@crazy/ui'
import { useCommand } from '#/lib/useCommand'
import { ConnectButton, ReauthoriseButton } from './ClerkActions'

const SIDE_WORDS: Record<Side, string> = { work: 'Work', personal: 'Personal' }

interface CardsProps {
  connections: readonly ConnectionView[]
  canConnect: boolean
  now: Date
  timeZone: string
}

/** Every Provider Crazy knows of: connected first as D1 orders them, then the rest. */
export function ProviderCards({ connections, canConnect, now, timeZone }: CardsProps) {
  return (
    <ul className="providers">
      {PROVIDERS.map((provider) => (
        <ProviderCard
          key={provider}
          provider={provider}
          connections={connections.filter((each) => each.provider === provider)}
          canConnect={canConnect}
          now={now}
          timeZone={timeZone}
        />
      ))}
      {UNAVAILABLE_PROVIDERS.map((card) => (
        <Blueprint as="li" key={card.key} className="card provider provider--open">
          <div className="provider__head">
            <Tag className="provider__chip" aria-hidden="true">
              {card.chip}
            </Tag>
            <Tag className="provider__status">Planned</Tag>
          </div>
          <h2 className="card-title">{card.name}</h2>
          <p className="card-body">{card.reads}</p>
          {/* Clerk cannot broker it (ADR 0001): said, and nothing to press. */}
          <p className="card-meta">{card.unavailable}</p>
        </Blueprint>
      ))}
    </ul>
  )
}

function ProviderCard({
  provider,
  connections,
  canConnect,
  now,
  timeZone,
}: CardsProps & { provider: Provider }) {
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
      <h2 className="card-title">{card.name}</h2>
      {/* The scopes are Clerk's word once Clerk is asked; until then, what Crazy reads there. */}
      <p className="card-body">{first?.scopes ?? card.reads}</p>

      {connections.map((connection) => (
        <ConnectionRow
          key={connection.id}
          connection={connection}
          name={card.name}
          canConnect={canConnect}
          now={now}
          timeZone={timeZone}
        />
      ))}

      {canConnect ? (
        <ConnectButton provider={provider} name={card.name} another={connected} />
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

function ConnectionRow({
  connection,
  name,
  canConnect,
  now,
  timeZone,
}: {
  connection: ConnectionView
  name: string
  canConnect: boolean
  now: Date
  timeZone: string
}) {
  const command = useCommand()
  const synced = connection.lastSyncAt ? new Date(connection.lastSyncAt) : null
  const meta =
    connection.status === 'reauth'
      ? synced
        ? `authorisation lapsed · last synced ${clockTime(synced, timeZone)}`
        : 'authorisation lapsed'
      : synced
        ? `synced ${ago(synced, now)}`
        : 'connected · nothing pulled yet'

  return (
    <div className="connection">
      <p className="card-meta connection__meta">
        {connection.label && <span className="connection__label">{connection.label} · </span>}
        {meta}
      </p>
      <label className="connection__side">
        <span className="sr-only">Default Side for {connection.label ?? name}</span>
        <select
          value={connection.defaultSide}
          onChange={(event) =>
            command.mutate({
              type: 'connection.setSide',
              connectionId: connection.id,
              side: event.target.value as Side,
            })
          }
        >
          {SIDES.map((side) => (
            <option key={side} value={side}>
              {SIDE_WORDS[side]}
            </option>
          ))}
        </select>
      </label>
      {connection.status === 'reauth' && canConnect && (
        <ReauthoriseButton
          externalAccountId={connection.externalAccountId}
          provider={connection.provider}
          name={name}
        />
      )}
    </div>
  )
}
