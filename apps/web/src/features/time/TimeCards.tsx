import type { TimeCard, TimeClient } from '@crazy/shared'
import { cardTotal } from '@crazy/shared'
import { Blueprint } from '@crazy/ui'
import { timeShade } from '#/lib/shades'

/**
 * The strip over the timesheet (frame 2b): what each part of the period came
 * to, with a band per Client and the rest of the fullest part left dashed — so
 * a light day is read against a full one at a glance. A week is drawn day by
 * day and a month week by week, so the strip is never more than a handful of
 * cards however long the period. Today's card wears the accent tint.
 */
export function TimeCards({ cards, clients }: { cards: TimeCard[]; clients: TimeClient[] }) {
  if (cards.length === 0) return null
  // The fullest card is drawn full and the rest are read against it.
  const most = Math.max(...cards.map((card) => card.seconds), 1)
  return (
    <ul className="time__cards">
      {cards.map((card) => (
        <Blueprint
          as="li"
          key={card.key}
          className={card.today ? 'card time__card is-today' : 'card time__card'}
        >
          <div className="time__card-head">
            <span className="time__card-name" aria-hidden="true">
              {card.name}
            </span>
            <span className="sr-only">{card.said}</span>
            <span className="time__card-total">{cardTotal(card.seconds)}</span>
          </div>
          <div className="time__card-bar" aria-hidden="true">
            {card.shares.map((share) => (
              <span
                key={share.clientId ?? 'internal'}
                className="time__card-share"
                style={{
                  width: `${(share.seconds / most) * 100}%`,
                  background: timeShade(share.clientId, clients),
                }}
              />
            ))}
            <span className="time__card-rest" />
          </div>
          <div className="time__card-note">{card.note}</div>
        </Blueprint>
      ))}
    </ul>
  )
}
