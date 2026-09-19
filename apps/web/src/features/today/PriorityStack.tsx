import {
  INTERNAL,
  SNOOZE_CHOICES,
  SOURCE_KINDS,
  type DayEvent,
  type SnoozedTodo,
  type TodayTodo,
  carriedLabel,
  dayAndTime,
  formatEstimate,
  hourChoice,
  slotRefusal,
} from '@crazy/shared'
import { Blueprint, Button, NotWired, SourceChip, Tag } from '@crazy/ui'
import { useId, useState } from 'react'
import { StartOnTodo } from '#/features/timer/StartOnTodo'
import { useCommand } from '#/lib/useCommand'

const join = (parts: (string | null)[]) => parts.filter(Boolean).join(' · ')

interface StackRowProps {
  todo: TodayTodo
  /**
   * With the Billing module on the row ends in the control that starts a timer
   * on the Todo rather than the chip that says where it came from, and the line
   * under its title names the Client it is billed to: with a timer in reach,
   * who is paying for an hour is what a contractor needs to see (frame 2a).
   */
  billing: boolean
  /** Whether the timer is running on this Todo, which is what the row says in place of its estimate. */
  timed: boolean
  /** The hours the timeline draws, which are the hours a Slot can be picked from. */
  hours: number[]
  events: DayEvent[]
  now: Date
  /** Says which Todo the pointer has picked up, so the timeline knows what is coming. */
  onDrag: (todo: TodayTodo | null) => void
}

/**
 * One Todo in the stack. The frame draws the Todo, its Project and estimate
 * and its chip; how long it has been carried, why it sits where it does, the
 * snoozes and its Slot open underneath when the Todo is pressed.
 *
 * The row is what a pointer drags onto an hour of the timeline. Everything the
 * drag can do the hour picker does too, so a thumb and a keyboard plan the day
 * as well as a mouse.
 */
function StackRow({ todo, billing, timed, hours, events, now, onDrag }: StackRowProps) {
  const [open, setOpen] = useState(false)
  const command = useCommand()
  const whyId = useId()
  const dragId = useId()
  const why = join([carriedLabel(todo.carryCount), todo.reason])

  const what = (
    <>
      {todo.title}
      <span className="stack__meta">
        {join([
          billing ? (todo.clientName ?? INTERNAL) : (todo.project ?? 'One-off'),
          // What it is costing now says more than what it was thought to cost.
          timed ? 'running' : formatEstimate(todo.estimateMinutes),
        ])}
      </span>
    </>
  )

  return (
    <li className="stack__todo">
      <div className="stack__row">
        <input
          type="checkbox"
          className="tick"
          aria-label={`Done: ${todo.title}`}
          checked={false}
          onChange={() => command.mutate({ type: 'todo.complete', todoId: todo.id })}
        />
        {/* The Todo's own words are what a pointer picks up and drops on an hour.
            Dragging says nothing to assistive technology, so the row says it. */}
        <button
          type="button"
          className="stack__what"
          aria-expanded={open}
          aria-controls={whyId}
          aria-describedby={dragId}
          onClick={() => setOpen(!open)}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', todo.title)
            onDrag(todo)
          }}
          onDragEnd={() => onDrag(null)}
        >
          {what}
        </button>
        <span id={dragId} hidden>
          Open this Todo to give it an hour of the day, or drag it onto one.
        </span>
        {billing ? (
          <StartOnTodo todo={todo} timed={timed} />
        ) : (
          <SourceChip source={todo.source && SOURCE_KINDS[todo.source.kind]} />
        )}
      </div>
      <div id={whyId} className="stack__why" hidden={!open}>
        {why && <p>{why}</p>}
        <label className="stack__slot">
          Slot
          {/* Never disabled while the command is in flight: it is the control a
              keyboard is on, and disabling it would throw the focus away. */}
          <select
            className="input stack__hour"
            value={todo.slotHours[0] ?? ''}
            onChange={(event) =>
              command.mutate(
                event.target.value === ''
                  ? { type: 'todo.clearSlot', todoId: todo.id }
                  : { type: 'todo.slot', todoId: todo.id, hour: Number(event.target.value) },
              )
            }
          >
            <option value="">No Slot</option>
            {hours.map((hour) => (
              // An hour the day cannot take is offered and refused, and says in
              // a word or two why, so the picker reads as the timeline behaves.
              <option
                key={hour}
                value={hour}
                disabled={slotRefusal(todo, hour, events, now) !== null}
              >
                {hourChoice(todo, hour, events, now)}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="stack__snooze">
          <legend className="sr-only">Snooze: {todo.title}</legend>
          {SNOOZE_CHOICES.map(({ minutes, label }) => (
            <Button
              key={minutes}
              disabled={command.isPending}
              onClick={() => command.mutate({ type: 'todo.snooze', todoId: todo.id, minutes })}
            >
              Snooze {label}
            </Button>
          ))}
        </fieldset>
      </div>
    </li>
  )
}

/** A Todo completed today. It has left the stack; un-ticking it is not a command yet. */
function DoneRow({ todo }: { todo: TodayTodo }) {
  return (
    <li className="stack__todo stack__todo--done">
      <div className="stack__row">
        <NotWired why="Done. Un-ticking is not available yet">
          <input
            type="checkbox"
            className="tick"
            aria-label={`Done: ${todo.title}`}
            checked
            readOnly
          />
        </NotWired>
        <span className="stack__what">
          {todo.title}
          <span className="stack__meta">
            {join([todo.project ?? 'One-off', formatEstimate(todo.estimateMinutes)])}
          </span>
        </span>
        <SourceChip source={todo.source && SOURCE_KINDS[todo.source.kind]} />
      </div>
    </li>
  )
}

interface PriorityStackProps {
  stack: TodayTodo[]
  billing: boolean
  /** The Todo the timer is running on, if it was started from one. */
  timedTodoId: string | null
  done: TodayTodo[]
  snoozed: SnoozedTodo[]
  timeZone: string
  carriedOver: number
  sentBack: number
  hours: number[]
  events: DayEvent[]
  now: Date
  onDrag: (todo: TodayTodo | null) => void
}

/** The `today` Todos in the order Crazy recommends, and what the last Rollover did. */
export function PriorityStack({
  stack,
  billing,
  timedTodoId,
  done,
  snoozed,
  timeZone,
  carriedOver,
  sentBack,
  hours,
  events,
  now,
  onDrag,
}: PriorityStackProps) {
  return (
    <Blueprint as="section" className="card stack" aria-labelledby="stack-title">
      <h2 id="stack-title" className="card-kicker stack__title">
        {/* Frame 2a says what the control on each row is for, where a first-time
            user will look for it: in the card's own heading. */}
        Priority stack{billing && ' · press ▸ to start a timer on one'}
      </h2>
      {stack.length === 0 ? (
        <p className="stack__empty">Nothing left for today.</p>
      ) : (
        <ol className="stack__todos">
          {stack.map((todo) => (
            <StackRow
              key={todo.id}
              todo={todo}
              billing={billing}
              timed={todo.id === timedTodoId}
              hours={hours}
              events={events}
              now={now}
              onDrag={onDrag}
            />
          ))}
        </ol>
      )}
      {done.length > 0 && (
        <ul className="stack__todos" aria-label="Done today">
          {done.map((todo) => (
            <DoneRow key={todo.id} todo={todo} />
          ))}
        </ul>
      )}
      {snoozed.length > 0 && (
        <details className="stack__snoozed">
          <summary>{snoozed.length} snoozed</summary>
          <ul>
            {snoozed.map((todo) => (
              <li key={todo.id}>
                {todo.title}
                <span className="stack__meta">
                  Snoozed until {dayAndTime(new Date(todo.snoozedUntil), timeZone)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {(carriedOver > 0 || sentBack > 0) && (
        <div className="stack__foot">
          {carriedOver > 0 && <Tag tone="accent">{carriedOver} carried over</Tag>}
          {sentBack > 0 && <span>{sentBack} sent back</span>}
        </div>
      )}
    </Blueprint>
  )
}
