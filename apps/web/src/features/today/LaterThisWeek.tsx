import type { Later } from '@crazy/shared'
import { Tag } from '@crazy/ui'
import { Link } from '@tanstack/react-router'

/**
 * What today is leading to: the tie-ins and milestones the Week screen already
 * holds for this week, and the meeting tomorrow opens with. Prep for a day is
 * not only prep for its own hours.
 */
export function LaterThisWeek({ later }: { later: Later }) {
  const { tieIns, milestones, nextMeeting } = later
  return (
    <div className="later">
      {milestones.length > 0 && (
        <ul className="later__list">
          {milestones.map((each) => (
            <li key={each.project}>
              <Tag tone="accent">{weekday(each.day)}</Tag>
              <span className="later__what">
                <strong>{each.project}</strong>
                {each.milestone && ` · ${each.milestone}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {tieIns.length > 0 && (
        <ul className="later__list">
          {tieIns.map((tieIn) => (
            <li key={`${tieIn.project}:${tieIn.text}`}>
              <Tag>{tieIn.when ?? 'This week'}</Tag>
              <span className="later__what">
                <strong>{tieIn.project}</strong> · {tieIn.text}
              </span>
            </li>
          ))}
        </ul>
      )}
      {nextMeeting && (
        <p className="later__tomorrow">
          Tomorrow opens with <strong>{nextMeeting.title}</strong> at {nextMeeting.at}
          {nextMeeting.who && ` · ${nextMeeting.who}`}.
        </p>
      )}
      <Link to="/week" className="later__more">
        The whole week
      </Link>
    </div>
  )
}

/** "Friday": the weekday a local date falls on. */
function weekday(day: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(
    new Date(`${day}T00:00:00Z`),
  )
}
