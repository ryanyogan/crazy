import type { MetricsTime, MetricsTimeView } from '@crazy/shared'
import { Blueprint } from '@crazy/ui'
import { Fragment, type ReactNode } from 'react'
import { timeShade } from '#/lib/shades'

// The five cards of frame 4a. Every chart is plain DOM on the Industry tokens
// — a bar's length is a percentage of the largest beside it, rounded the way
// the frame rounds it — and nothing is drawn that is not also said: the drawing
// is hidden from assistive technology and answered by a sentence that reads out
// every figure in it. A Client's colour comes from the order she took them on
// (`shades.ts`), so a Client is the same colour on every screen and never
// carries a meaning of its own: its name is beside it in the legend and in the
// sentence under it.

interface Props {
  metrics: MetricsTime
  view: MetricsTimeView
}

function Card({
  className,
  title,
  legend,
  described,
  note,
  foot,
  children,
}: {
  className?: string
  title: ReactNode
  legend?: ReactNode
  described: string
  note?: ReactNode
  /** What the frame draws under the card's own line, where it draws anything. */
  foot?: ReactNode
  children: ReactNode
}) {
  return (
    <Blueprint as="section" className={`card metrics__chart${className ? ` ${className}` : ''}`}>
      <div className="metrics__chart-head">
        <h2 className="card-kicker metrics__chart-title">{title}</h2>
        {legend}
      </div>
      {children}
      <p className="sr-only">{described}</p>
      {note === undefined || note === '' ? null : <p className="card-meta metrics__note">{note}</p>}
      {foot}
    </Blueprint>
  )
}

/** Where every week went, Client by Client, over the span the kicker names. */
export function HoursByClient({ metrics, view }: Props) {
  const shadeOf = (clientId: string | null) =>
    clientId === null ? undefined : timeShade(clientId, metrics.clients)

  return (
    <Card
      title={`Hours per week by Client · last ${metrics.weeks.length} weeks`}
      legend={
        <ul className="legend">
          {view.legend.map((each) => (
            <li key={each.key} className="legend__item">
              <span
                className={
                  each.clientId === null ? 'legend__swatch legend__swatch--none' : 'legend__swatch'
                }
                style={{ background: shadeOf(each.clientId) }}
              />
              {each.label}
            </li>
          ))}
        </ul>
      }
      described={view.described.hours}
      note={view.hoursNote}
    >
      <div className="byweek" aria-hidden="true">
        {view.weeks.map((week) => (
          <div key={week.label} className="byweek__column">
            {/* Drawn bottom first, which is the order she took the Clients on. */}
            {[...week.bands].reverse().map((band) => (
              <span
                key={band.key}
                className={
                  band.clientId === null ? 'byweek__band byweek__band--none' : 'byweek__band'
                }
                style={{ height: band.length, background: shadeOf(band.clientId) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="byweek__labels" aria-hidden="true">
        {view.weeks.map((week) => (
          <div key={week.label} className="byweek__label">
            {week.label}
            <span className="byweek__total">{week.total}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Which hours of which weekday she actually works, from the entries themselves. */
export function WhenYouWork({ metrics, view }: Props) {
  return (
    <Card
      className="metrics__chart--heat"
      title="When you work · weekday × hour · 30 days"
      described={view.described.heat}
      note={metrics.modelled?.notes.when_you_work}
      foot={
        <ul className="rhythm">
          {view.rhythm.map((figure) => (
            <li key={figure.key}>
              <span className="rhythm__value">{figure.value}</span>
              <span className="rhythm__label">{figure.label}</span>
            </li>
          ))}
        </ul>
      }
    >
      <div className="heatgrid" aria-hidden="true">
        <span />
        {view.heatHours.map((hour) => (
          <span key={hour} className="heatgrid__hour">
            {hour}
          </span>
        ))}
        {view.heat.map((row) => (
          <Fragment key={row.day}>
            <span className="heatgrid__day">{row.day}</span>
            {row.cells.map((cell) => (
              <span key={cell.hour} className={`heatgrid__cell heatgrid__cell--${cell.level}`} />
            ))}
          </Fragment>
        ))}
      </div>
    </Card>
  )
}

/** What each Client owes her that nobody has been asked for yet. */
export function UnbilledByClient({ metrics, view }: Props) {
  return (
    <Card title="Unbilled · by Client" described={view.described.unbilled} note={view.unbilledNote}>
      {view.unbilled.length === 0 ? (
        <p className="metrics__unmodelled">
          Every billable hour this month is on an invoice. Nothing to send.
        </p>
      ) : (
        <ul className="moneybars" aria-hidden="true">
          {view.unbilled.map((row) => (
            <li key={row.key} className="moneybars__row">
              <span className="moneybars__name">{row.name}</span>
              <span className="moneybars__figure">{row.figure}</span>
              <span className="moneybars__track">
                <span
                  className="moneybars__fill"
                  style={{
                    width: row.length,
                    background: timeShade(row.clientId, metrics.clients),
                  }}
                />
              </span>
              <span className="moneybars__note">{row.note}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Where each Client's month stands against what they bought, and the calendar. */
export function BudgetBurn({ metrics, view }: Props) {
  return (
    <Card
      className="metrics__chart--burn"
      title="Budget & retainer burn"
      described={view.described.burn}
      note="The black tick is where you should be at this point in the month."
    >
      {view.burn.length === 0 ? (
        <p className="metrics__unmodelled">No Client has a budget or a retainer yet.</p>
      ) : (
        <ul className="moneybars" aria-hidden="true">
          {view.burn.map((row) => (
            <li key={row.key} className="moneybars__row">
              <span className="moneybars__name">{row.name}</span>
              <span className="moneybars__figure moneybars__figure--plain">{row.figure}</span>
              <span className="moneybars__track">
                <span
                  className="moneybars__fill"
                  style={{
                    width: row.length,
                    background: timeShade(row.clientId, metrics.clients),
                  }}
                />
                {row.pace === null ? null : (
                  <span className="moneybars__pace" style={{ left: row.pace }} />
                )}
              </span>
              <span className="moneybars__note">{row.note}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** What she thought a kind of work would take, against what it took. */
export function EstimateVsActual({ view }: { view: MetricsTimeView }) {
  return (
    <Card
      title="Estimate vs actual · Todos with timers"
      described={view.described.estimates}
      note={view.estimatesNote}
    >
      {view.estimates.length === 0 ? (
        <p className="metrics__unmodelled">
          No Todo with an estimate has had a timer on it yet. Start one from a Todo and this fills
          in.
        </p>
      ) : (
        <ul className="estimates" aria-hidden="true">
          {view.estimates.map((row) => (
            <li key={row.key} className="estimates__row">
              <span className="estimates__label">{row.label}</span>
              <span className="estimates__track">
                <span className="estimates__estimate" style={{ width: row.estimate }} />
                <span className="estimates__actual" style={{ width: row.actual }} />
              </span>
              <span className="estimates__ratio">{row.ratio}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
