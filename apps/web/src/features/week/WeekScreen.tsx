import { viewWeek } from '@crazy/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { weekQuery } from '#/lib/queries'
import { TieIns } from './TieIns'
import { WeekDays } from './WeekDays'
import { WeekInNumbers } from './WeekInNumbers'

/**
 * The Week screen, frame 1c: the state of the union, the week in numbers, the
 * seven days with what is done, planned and in meetings, and where the user
 * ties in per Project. One DOM serves both widths; on a phone the head, the
 * days and the tie-ins fall into one column (derived, docs/BRIEF.md).
 */
export function WeekScreen() {
  const { data: week } = useSuspenseQuery(weekQuery)
  const view = viewWeek(week)

  return (
    <div className="screen week">
      <header className="week__head">
        <div>
          <div className="week__line">{view.line}</div>
          <h1 className="screen__title">State of the union</h1>
          {week.brief ? (
            <>
              <p className="week__brief week__brief--long">{week.brief.body}</p>
              <p className="week__brief week__brief--short">{week.brief.bodyShort}</p>
            </>
          ) : (
            <p className="week__brief">Crazy has not written about this week.</p>
          )}
        </div>
        <WeekInNumbers view={view} />
      </header>

      <WeekDays days={view.days} />
      <TieIns tieIns={week.tieIns} />
    </div>
  )
}
