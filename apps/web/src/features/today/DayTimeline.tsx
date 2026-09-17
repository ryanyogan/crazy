import { SOURCE_KINDS, type TimelineHour } from '@crazy/shared'
import { SourceChip, Timeline, TimelineRow } from '@crazy/ui'

const count = (many: number, one: string) => `${many} ${one}${many === 1 ? '' : 's'}`

interface DayTimelineProps {
  timeline: TimelineHour[]
  todos: number
  meetings: number
}

/**
 * The day, hour by hour. Meetings and focus blocks come from the calendar and
 * carry no way to edit them: Crazy never changes a Provider's item.
 */
export function DayTimeline({ timeline, todos, meetings }: DayTimelineProps) {
  return (
    <section className="today__day" aria-labelledby="day-title">
      <div className="day__head">
        <h2 id="day-title" className="day__title">
          Your day · {count(todos, 'todo')} · {count(meetings, 'meeting')}
        </h2>
        {/* Slotting arrives with ticket 08; until then the hint says so to those who cannot see it is inert. */}
        <span className="day__hint">
          Drag a todo onto an hour to slot it<span className="sr-only"> (not available yet)</span>
        </span>
      </div>
      <Timeline aria-label="Hours of the day" tabIndex={0}>
        {timeline.map((hour) => (
          <TimelineRow
            key={hour.hour}
            label={String(hour.hour).padStart(2, '0')}
            kind={hour.kind}
            title={hour.title}
            note={hour.note}
          >
            <SourceChip source={hour.source && SOURCE_KINDS[hour.source]} />
          </TimelineRow>
        ))}
      </Timeline>
    </section>
  )
}
