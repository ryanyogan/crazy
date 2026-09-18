import {
  SOURCE_KINDS,
  type DayEvent,
  type TimelineHour,
  type TodayTodo,
  slotRefusal,
} from '@crazy/shared'
import { SourceChip, Timeline, TimelineRow } from '@crazy/ui'
import { useState } from 'react'
import { notify } from '#/lib/notices'
import { useCommand } from '#/lib/useCommand'

const count = (many: number, one: string) => `${many} ${one}${many === 1 ? '' : 's'}`

interface DayTimelineProps {
  timeline: TimelineHour[]
  todos: number
  meetings: number
  events: DayEvent[]
  /** The Todo being dragged over the day, if one is; null the rest of the time. */
  dragging: TodayTodo | null
  now: Date
}

/**
 * The day, hour by hour. Meetings and focus blocks come from the calendar and
 * carry no way to edit them: Crazy never changes a Provider's item. A Todo
 * dragged from the Priority stack drops onto an hour and takes a Slot on it.
 * An hour that cannot hold it — one meetings leave no room in — does not light
 * up under the drag and says why if the Todo is dropped on it anyway, so a
 * meeting is never displaced and never silently refuses. Without a pointer, the
 * hour is picked in the Todo's own row in the stack.
 */
export function DayTimeline({
  timeline,
  todos,
  meetings,
  events,
  dragging,
  now,
}: DayTimelineProps) {
  const [over, setOver] = useState<number | null>(null)
  // How deep in the timeline the drag is: moving between an hour's own parts
  // leaves one of them, which is not leaving the timeline, so the hours are
  // only dark again once this is back to nothing.
  const [depth, setDepth] = useState(0)
  const command = useCommand()
  // Lit only while a drag is over an hour that can take it. A drag that has
  // ended — dropped, cancelled, or let go somewhere else entirely — leaves no
  // hour looking as though something is still over it.
  const lit = dragging !== null && depth > 0 ? over : null
  const forget = () => {
    setDepth(0)
    setOver(null)
  }

  return (
    <section className="today__day" aria-labelledby="day-title">
      <div className="day__head">
        <h2 id="day-title" className="day__title">
          Your day · {count(todos, 'todo')} · {count(meetings, 'meeting')}
        </h2>
        <span className="day__hint">
          Drag a todo onto an hour to slot it
          <span className="sr-only">, or open it in the Priority stack and pick its hour</span>
        </span>
      </div>
      <Timeline
        aria-label="Hours of the day"
        tabIndex={0}
        onDragEnter={() => setDepth((each) => each + 1)}
        // Carried off the timeline, the hour it was last over goes dark again.
        onDragLeave={() => setDepth((each) => Math.max(0, each - 1))}
      >
        {timeline.map((hour) => {
          const refusal = dragging && slotRefusal(dragging, hour.hour, events, now)
          return (
            <TimelineRow
              key={hour.hour}
              label={String(hour.hour).padStart(2, '0')}
              kind={hour.kind}
              title={hour.title}
              note={hour.note}
              className={lit === hour.hour ? 'tl-row--over' : undefined}
              // Every hour takes the drop — a browser told the drop is not
              // allowed never fires one, and a Todo that lands nowhere and says
              // nothing is worse than one that is told why. Only the hours that
              // can hold it light up.
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setOver(refusal ? null : hour.hour)
              }}
              onDrop={(event) => {
                event.preventDefault()
                forget()
                if (!dragging) return
                if (refusal) return notify(refusal)
                command.mutate({ type: 'todo.slot', todoId: dragging.id, hour: hour.hour })
              }}
            >
              <SourceChip source={hour.source && SOURCE_KINDS[hour.source]} />
            </TimelineRow>
          )
        })}
      </Timeline>
    </section>
  )
}
