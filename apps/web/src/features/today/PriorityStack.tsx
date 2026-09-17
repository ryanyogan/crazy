import { SOURCE_KINDS, type TodayTodo, carriedLabel, formatEstimate } from '@crazy/shared'
import { Blueprint, NotWired, SourceChip, Tag } from '@crazy/ui'
import { useId, useState } from 'react'
import { useCommand } from '#/lib/useCommand'

const join = (parts: (string | null)[]) => parts.filter(Boolean).join(' · ')

/**
 * One Todo in the stack. The frame draws the Todo, its Project and estimate
 * and its chip; how long it has been carried and why it sits where it does
 * open underneath when the Todo is pressed.
 */
function StackRow({ todo }: { todo: TodayTodo }) {
  const [open, setOpen] = useState(false)
  const command = useCommand()
  const whyId = useId()
  const why = join([carriedLabel(todo.carryCount), todo.reason])

  const what = (
    <>
      {todo.title}
      <span className="stack__meta">
        {join([todo.project ?? 'One-off', formatEstimate(todo.estimateMinutes)])}
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
        {why ? (
          <button
            type="button"
            className="stack__what"
            aria-expanded={open}
            aria-controls={whyId}
            onClick={() => setOpen(!open)}
          >
            {what}
          </button>
        ) : (
          <span className="stack__what">{what}</span>
        )}
        <SourceChip source={todo.source && SOURCE_KINDS[todo.source.kind]} />
      </div>
      {why && (
        <p id={whyId} className="stack__why" hidden={!open}>
          {why}
        </p>
      )}
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
  done: TodayTodo[]
  carriedOver: number
  sentBack: number
}

/** The `today` Todos in the order Crazy recommends, and what the last Rollover did. */
export function PriorityStack({ stack, done, carriedOver, sentBack }: PriorityStackProps) {
  return (
    <Blueprint as="section" className="card stack" aria-labelledby="stack-title">
      <h2 id="stack-title" className="card-kicker stack__title">
        Priority stack
      </h2>
      {stack.length === 0 ? (
        <p className="stack__empty">Nothing left for today.</p>
      ) : (
        <ol className="stack__todos">
          {stack.map((todo) => (
            <StackRow key={todo.id} todo={todo} />
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
      {(carriedOver > 0 || sentBack > 0) && (
        <div className="stack__foot">
          {carriedOver > 0 && <Tag tone="accent">{carriedOver} carried over</Tag>}
          {sentBack > 0 && <span>{sentBack} sent back</span>}
        </div>
      )}
    </Blueprint>
  )
}
