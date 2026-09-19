import { type TodayTodo, viewTimer } from '@crazy/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { timerQuery } from '#/lib/queries'
import { useCommand } from '#/lib/useCommand'

/**
 * The control frame 2a puts on every Todo: press it and the timer runs on that
 * Todo, tied to it and prefilled from its Project. One press and no choosing,
 * which is the whole point — a contractor's timer is her money, and the moment
 * she has to pick a Client before she can start is the moment she stops
 * bothering.
 *
 * While a timer is already running the same press is a switch: the running
 * entry ends and the Todo's begins at the same instant, so the day has no gap
 * in it and no second is counted twice. The Todo the timer is already on has
 * nothing to press — it wears the running mark instead of the control, which is
 * how the row says quietly that it is the one being timed.
 */
export function StartOnTodo({ todo, timed }: { todo: TodayTodo; timed: boolean }) {
  const command = useCommand()
  const { data } = useSuspenseQuery(timerQuery)
  const { timer } = data
  if (!timer) return null

  const running = timer.running
  if (timed) {
    return (
      <span className="todo-start todo-start--running">
        <span className="todo-start__mark" aria-hidden="true" />
        <span className="sr-only">The timer is running on {todo.title}</span>
      </span>
    )
  }

  // A Todo that is part of no Project starts on the work the bar already had —
  // the running entry's, or the one the idle bar preselects — so that starting
  // a One-off still takes one press. A Todo with a Project ignores this: the
  // Project settles the work, and `decide` holds that rule.
  const { preselected } = viewTimer(timer, new Date(data.now), data.timeZone)
  const work = running ?? preselected

  return (
    <button
      type="button"
      className="todo-start"
      aria-label={`Start the timer on ${todo.title}`}
      disabled={command.isPending}
      onClick={() =>
        command.mutate({
          type: running ? 'timer.switch' : 'timer.start',
          id: crypto.randomUUID(),
          clientId: work.clientId,
          projectId: work.projectId,
          todoId: todo.id,
        })
      }
    >
      <Play size={10} strokeWidth={1.5} fill="currentColor" aria-hidden="true" />
    </button>
  )
}
