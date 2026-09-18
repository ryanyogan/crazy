import { type WeekView, formatHourCount } from '@crazy/shared'
import { Blueprint } from '@crazy/ui'

/**
 * The week in numbers, all three computed from Todos at the moment the loader
 * read them: how many of the week's Todos are done, the hours of work it has
 * absorbed so far, and how many Todos a Rollover has carried over in it.
 */
export function WeekInNumbers({ view }: { view: WeekView }) {
  return (
    <Blueprint as="section" className="card numbers" aria-labelledby="numbers-title">
      <h2 id="numbers-title" className="card-kicker numbers__title">
        Week in numbers
      </h2>
      <div className="numbers__grid">
        <div>
          <div className="numbers__value">
            {view.done}
            <span className="numbers__unit">/{view.planned}</span>
          </div>
          <div className="numbers__label">todos done</div>
        </div>
        <div>
          <div className="numbers__value">
            {formatHourCount(view.focusHours)}
            <span className="numbers__unit">h</span>
          </div>
          <div className="numbers__label">focus so far</div>
        </div>
        <div>
          <div className="numbers__value">{view.carriedOver}</div>
          <div className="numbers__label">
            carried over<span className="sr-only"> this week</span>
          </div>
        </div>
      </div>
    </Blueprint>
  )
}
