import { type MetricRange, viewMetrics } from '@crazy/shared'
import { StatTile } from '@crazy/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { metricsQuery } from '#/lib/queries'
import { BacklogAgeing, CompletionDays, FocusByHour, TodoSources } from './Charts'
import { RangePicker } from './RangePicker'

const route = getRouteApi('/_app/metrics')

/**
 * The Metrics screen, frame 1f: how the user actually works, over a week,
 * thirty days or a quarter. One DOM serves both widths; on a phone the six
 * figures fall into two columns and the three charts into one (derived,
 * docs/BRIEF.md).
 *
 * The range is the URL's. Picking one navigates, the route's loader reads that
 * range and the screen reads it back — so the screen never holds a range of its
 * own that the address bar could disagree with, and the browser's back button
 * works on it like any other link.
 */
export function MetricsScreen() {
  const { range } = route.useSearch()
  const navigate = route.useNavigate()
  const { data: metrics } = useSuspenseQuery(metricsQuery(range))
  const view = viewMetrics(metrics)
  const notes = metrics.modelled?.notes ?? {}

  const pick = (range: MetricRange) => {
    void navigate({ search: { range } })
  }

  return (
    <div className="screen metrics">
      <header className="metrics__head">
        <h1 className="screen__title">Metrics</h1>
        <RangePicker ranges={view.ranges} onPick={pick} />
      </header>

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
    </div>
  )
}
