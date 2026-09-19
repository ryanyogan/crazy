import {
  ENERGIES,
  type TakeOnNow,
  type TodayTodo,
  clockTime,
  formatEstimate,
  formatHours,
} from '@crazy/shared'
import { Blueprint, Button } from '@crazy/ui'
import { useCommand } from '#/lib/useCommand'

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ')

interface TakeOnNowCardProps {
  takeOnNow: TakeOnNow<TodayTodo>
  timeZone: string
}

/**
 * The one Todo to do now, and the only solid accent object on the screen. The
 * phone frame words it more tightly and draws no buttons, so each wording is
 * written out and the stylesheet shows the one that fits.
 *
 * Started, the card stops recommending and starts reporting: it takes the
 * running timer bar's treatment (frame 3a) without the picker, because with the
 * Billing module off there is no timer to pick a Client for — only the moment
 * the user said they were on it. Swap goes with it: a Todo taken on is not one
 * being declined.
 */
export function TakeOnNowCard({ takeOnNow, timeZone }: TakeOnNowCardProps) {
  const { todo, hours, started } = takeOnNow
  const command = useCommand()
  const estimate = formatEstimate(todo.estimateMinutes)
  const energy = todo.energy && ENERGIES[todo.energy]

  return (
    <Blueprint
      as="section"
      className={started ? 'ton ton--started' : 'ton'}
      aria-labelledby="ton-title"
    >
      <div className="ton__kicker">
        <span className="ton__long">
          {join(['Take on now', hours && formatHours(hours, 'long')])}
        </span>
        <span className="ton__short">
          {join(['Take on now', hours && formatHours(hours, 'short')])}
        </span>
      </div>
      <h2 id="ton-title" className="ton__title">
        {todo.title}
      </h2>
      <div className="ton__meta">
        <span className="ton__long">
          {join([
            todo.project,
            todo.source?.ref,
            estimate && [`~${estimate}`, energy].filter(Boolean).join(' '),
            todo.reason,
          ])}
        </span>
        <span className="ton__short">
          {join([todo.source?.ref, estimate && `~${estimate}`, energy])}
        </span>
      </div>
      {started && todo.startedAt ? (
        <p className="ton__started">
          Started · since {clockTime(new Date(todo.startedAt), timeZone)}
        </p>
      ) : (
        <div className="ton__actions">
          <Button
            variant="plain"
            className="ton__start"
            disabled={command.isPending}
            onClick={() => command.mutate({ type: 'todo.start', todoId: todo.id })}
          >
            Start
          </Button>
          <Button
            variant="plain"
            className="ton__swap"
            disabled={command.isPending}
            onClick={() => command.mutate({ type: 'todo.swap', todoId: todo.id })}
          >
            Swap
          </Button>
        </div>
      )}
    </Blueprint>
  )
}
