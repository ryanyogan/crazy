import type { MetricsView } from '@crazy/shared'
import { Blueprint, Tag } from '@crazy/ui'
import type { ReactNode } from 'react'

/**
 * The three cards of frame 1f's middle row. Every chart is plain DOM on the
 * Industry tokens — a bar's length is a percentage of the largest bar beside
 * it, rounded the way the frame rounds it — and nothing is drawn that is not
 * also said: the drawing is hidden from assistive technology and answered by a
 * sentence that reads out every figure in it.
 */
function Chart({
  title,
  plot,
  described,
  note,
  children,
}: {
  title: ReactNode
  /** Which plot the card holds: a column chart, or a stack of bars. */
  plot: 'hours' | 'rows' | 'rows rows--sources'
  described: string
  note?: string
  children: ReactNode
}) {
  return (
    <Blueprint as="section" className="card metrics__chart">
      <h2 className="card-kicker metrics__chart-title">{title}</h2>
      <div className={`metrics__plot ${plot}`} aria-hidden="true">
        {children}
      </div>
      <p className="sr-only">{described}</p>
      {note === undefined ? null : <p className="card-meta metrics__note">{note}</p>}
    </Blueprint>
  )
}

/** Hours of finished work, by the hour of day they were finished in. */
export function FocusByHour({ view, note }: { view: MetricsView; note?: string }) {
  return (
    <Chart
      plot="hours"
      title="Focus hours by hour of day · when you actually finish things"
      described={view.described.focus}
      note={note}
    >
      {view.focusBars.map((bar) => (
        <div key={bar.label} className="hours__column">
          <span
            className={bar.peak ? 'hours__bar hours__bar--peak' : 'hours__bar'}
            style={{ height: bar.length }}
          />
          <span className="hours__label">{bar.label}</span>
        </div>
      ))}
    </Chart>
  )
}

/** How long the Todos still in the backlog have sat there untouched. */
export function BacklogAgeing({ view, note }: { view: MetricsView; note?: string }) {
  return (
    <Chart plot="rows" title={view.backlogTitle} described={view.described.ageing} note={note}>
      {view.ageingBars.map((bar) => (
        <div key={bar.id} className="rows__row">
          <span className="rows__label">{bar.label}</span>
          <span className="rows__track">
            <span className={`rows__fill rows__fill--${bar.tone}`} style={{ width: bar.length }} />
          </span>
          <span className="rows__count">{bar.value}</span>
        </div>
      ))}
    </Chart>
  )
}

/** Which Provider the range's Todos arrived through, and what was typed in. */
export function TodoSources({ view, note }: { view: MetricsView; note?: string }) {
  return (
    <Chart
      plot="rows rows--sources"
      title="Where your todos come from"
      described={view.described.sources}
      note={note}
    >
      {view.sourceBars.map((bar) => (
        <div key={bar.chip} className="rows__row">
          <Tag className="source-chip rows__chip" title={bar.name}>
            {bar.chip}
          </Tag>
          <span className="rows__track">
            <span className="rows__fill rows__fill--source" style={{ width: bar.length }} />
          </span>
          <span className="rows__count">{bar.value}</span>
        </div>
      ))}
    </Chart>
  )
}

/** The thirty days behind today: how much of each day's plan was completed. */
export function CompletionDays({ view, note }: { view: MetricsView; note?: string }) {
  if (view.heat.length === 0) {
    return <p className="metrics__unmodelled">Crazy has not modelled the last thirty days today.</p>
  }
  return (
    <section className="metrics__days" aria-label="The last thirty days">
      <div className="heat" aria-hidden="true">
        {view.heat.map((day) => (
          <span key={day.day} className={`heat__day heat__day--${day.level}`} />
        ))}
      </div>
      <p className="sr-only">{view.described.heat}</p>
      {note === undefined ? null : <p className="metrics__caption">{note}</p>}
    </section>
  )
}
