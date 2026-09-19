import {
  SOURCE_KINDS,
  type ClientWeek,
  type DayEvent,
  type LoggedHour,
  type TimelineHour,
  type TodayTodo,
  formatLogged,
  slotRefusal,
} from '@crazy/shared'
import { SourceChip, Tag, Timeline, TimelineRow, type TimelineRowKind } from '@crazy/ui'
import { type ReactNode, useState } from 'react'
import { notify } from '#/lib/notices'
import { clientCode, clientShade } from '#/lib/shades'
import { useCommand } from '#/lib/useCommand'

const count = (many: number, one: string) => `${many} ${one}${many === 1 ? '' : 's'}`

/**
 * How an hour is drawn. With the Billing module off it is what the day holds:
 * a meeting, a focus block, a Slot or nothing. With it on, what became of the
 * hour wins over what was planned for it (frame 2a) — the hour the timer is in
 * now is framed in the accent, an hour with tracked time in it is plainly
 * boxed, and everything still only planned is dashed, because a plan is a plan.
 * A meeting is a meeting either way: Crazy never changes a Provider's calendar.
 */
function kindOf(
  hour: TimelineHour,
  spent: LoggedHour | undefined,
  billing: boolean,
  runningHours: readonly number[],
): TimelineRowKind {
  if (!billing || hour.kind === 'meeting') return hour.kind
  if (runningHours.includes(hour.hour)) return 'tracked'
  return spent ? 'logged' : 'free'
}

interface DayTimelineProps {
  timeline: TimelineHour[]
  todos: number
  meetings: number
  events: DayEvent[]
  /** The Todo being dragged over the day, if one is; null the rest of the time. */
  dragging: TodayTodo | null
  now: Date
  /** What is drawn above the hours: the Brief, where frame 2a puts it. */
  lead?: ReactNode
  /**
   * With the Billing module on, what was actually tracked in each hour and
   * every Client the user has, so the day can say whose each hour was. Null
   * with the module off: then the timeline is a plan and nothing else.
   */
  logged?: LoggedHour[] | null
  clients?: ClientWeek[]
  /** The hours the running entry has time in, which frame 2a frames in the accent. */
  runningHours?: readonly number[]
  /** The Todos the day holds, so a planned hour can say whose work it is for. */
  stack?: TodayTodo[]
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
  lead,
  logged = null,
  clients = [],
  runningHours = [],
  stack = [],
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

  /** Whose hour it was: who was tracked in it, or failing that whose work is slotted on it. */
  const clientOf = (hour: number) => {
    const spent = logged?.find((each) => each.hour === hour)
    if (spent) return spent.clientId
    const slotted = stack.find((todo) => todo.slotHours.includes(hour))
    return slotted ? slotted.clientId : null
  }
  /** Whether anything at all belongs to the hour, so an empty hour wears no Client's colour. */
  const owned = (hour: number) =>
    logged?.some((each) => each.hour === hour) ||
    stack.some((todo) => todo.slotHours.includes(hour))

  return (
    <section className="today__day" aria-labelledby="day-title">
      {lead}
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
          const spent = logged?.find((each) => each.hour === hour.hour)
          const client = clientOf(hour.hour)
          return (
            <TimelineRow
              key={hour.hour}
              label={String(hour.hour).padStart(2, '0')}
              kind={kindOf(hour, spent, logged !== null, runningHours)}
              {...(logged === null
                ? {}
                : {
                    rule: owned(hour.hour) ? clientShade(client, clients) : null,
                    figure: spent ? formatLogged(spent.seconds) : null,
                  })}
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
              {logged === null ? (
                <SourceChip source={hour.source && SOURCE_KINDS[hour.source]} />
              ) : (
                <Tag className="source-chip">
                  {owned(hour.hour) ? clientCode(client, clients) : '—'}
                </Tag>
              )}
            </TimelineRow>
          )
        })}
      </Timeline>
    </section>
  )
}
