import { type MetricRange, viewMetrics } from '@crazy/shared'
import { StatTile } from '@crazy/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { metricsQuery } from '#/lib/queries'
import { BacklogAgeing, CompletionDays, FocusByHour, TodoSources } from './Charts'

/**
 * How the user actually works, frame 1f: the six headline figures, the three
 * charts and the thirty-day strip, over a week, thirty days or a quarter. One
 * DOM serves both widths; on a phone the six figures fall into two columns and
 * the three charts into one (derived, docs/BRIEF.md).
 */
export function TodosTab({ range }: { range: MetricRange }) {
  const { data: metrics } = useSuspenseQuery(metricsQuery(range))
  const view = viewMetrics(metrics)
  const notes = metrics.modelled?.notes ?? {}

  return (
    <>
      <section className="metrics__figures" aria-labelledby="figures-title">
        <h2 id="figures-title" className="sr-only">
          The headline figures
        </h2>
        {metrics.modelled === null ? (
          <p className="metrics__unmodelled">Crazy has not modelled this range today.</p>
        ) : (
          <ul className="metrics__tiles">
            {metrics.modelled.headlines.map((figure) => (
              <StatTile
                as="li"
                key={figure.figure}
                label={figure.label}
                value={figure.value}
                note={figure.note}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="metrics__charts">
        <FocusByHour view={view} note={notes.focus_by_hour} />
        <BacklogAgeing view={view} note={notes.backlog_ageing} />
        <TodoSources view={view} note={notes.todo_sources} />
      </div>

      <CompletionDays view={view} note={notes.completion_days} />
    </>
  )
}
