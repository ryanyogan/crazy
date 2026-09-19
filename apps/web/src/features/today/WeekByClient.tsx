import { type ClientWeek, clientTerms, formatTracked, weekShare } from '@crazy/shared'
import { Blueprint } from '@crazy/ui'
import { clientShade } from '#/lib/shades'

/**
 * Where the week has gone, Client by Client (frame 2a). For a contractor whose
 * work is mostly one Client's, this is the at-a-glance answer to "how is my
 * month going": the hours since Monday, most first, and under each the terms
 * it is charged on and how far through the budget or the retainer it is.
 *
 * Internal sits last however many hours went into it: it is the absence of a
 * Client, not one of them. A Client with nothing this week is still listed —
 * a quiet week for a Client is exactly the thing worth noticing.
 */
export function WeekByClient({ week }: { week: ClientWeek[] }) {
  return (
    <Blueprint as="section" className="card weeks" aria-labelledby="weeks-title">
      <h2 id="weeks-title" className="card-kicker weeks__title">
        This week by Client
      </h2>
      {week.length === 0 ? (
        <p className="weeks__empty">No Clients yet.</p>
      ) : (
        <ul className="weeks__list">
          {week.map((client) => (
            <li key={client.clientId ?? 'internal'} className="weeks__client">
              <span className="weeks__name">{client.name}</span>
              <span className="weeks__hours">{formatTracked(client.weekSeconds)}</span>
              <span className="weeks__bar">
                <span
                  className="weeks__fill"
                  style={{
                    width: `${Math.round(weekShare(client, week) * 100)}%`,
                    background: clientShade(client.clientId, week),
                  }}
                />
              </span>
              <span className="weeks__terms">{clientTerms(client)}</span>
            </li>
          ))}
        </ul>
      )}
    </Blueprint>
  )
}
