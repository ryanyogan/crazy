import { type MetricRange, viewMetricsTime } from '@crazy/shared'
import { StatTile } from '@crazy/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { metricsTimeQuery } from '#/lib/queries'
import {
  BudgetBurn,
  EstimateVsActual,
  HoursByClient,
  UnbilledByClient,
  WhenYouWork,
} from './TimeCharts'

/**
 * Whether her month is healthy, frame 4a: how much of her time is billable,
 * who it goes to, what money is still unbilled, and whether a budget or a
 * retainer is about to run over. Every figure here is counted from her own Time
 * entries and her own invoices, except the two targets and the two lines of
 * commentary, which Crazy modelled.
 *
 * One DOM serves both widths; on a phone the six figures fall into two columns
 * and the five cards into one (derived, docs/BRIEF.md).
 */
export function TimeTab({ range }: { range: MetricRange }) {
  const { data: metrics } = useSuspenseQuery(metricsTimeQuery(range))
  const view = viewMetricsTime(metrics)

  return (
    <>
      <section className="metrics__figures" aria-labelledby="time-figures-title">
        <h2 id="time-figures-title" className="sr-only">
          The headline figures
        </h2>
        <ul className="metrics__tiles">
          {view.tiles.map((tile) => (
            <StatTile
              as="li"
              key={tile.key}
              label={tile.label}
              value={tile.value}
              note={tile.note}
            />
          ))}
        </ul>
      </section>

      <div className="metrics__charts metrics__charts--pair">
        <HoursByClient metrics={metrics} view={view} />
        <WhenYouWork metrics={metrics} view={view} />
      </div>

      <div className="metrics__charts metrics__charts--three">
        <UnbilledByClient metrics={metrics} view={view} />
        <BudgetBurn metrics={metrics} view={view} />
        <EstimateVsActual view={view} />
      </div>
    </>
  )
}
