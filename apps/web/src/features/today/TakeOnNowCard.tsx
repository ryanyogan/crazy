import {
  ENERGIES,
  type TakeOnNow,
  type TodayTodo,
  formatEstimate,
  formatHours,
} from '@crazy/shared'
import { Blueprint, Button, NotWired } from '@crazy/ui'

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ')

/**
 * The one Todo to do now, and the only solid accent object on the screen. The
 * phone frame words it more tightly and draws no buttons, so each wording is
 * written out and the stylesheet shows the one that fits.
 */
export function TakeOnNowCard({ takeOnNow }: { takeOnNow: TakeOnNow<TodayTodo> }) {
  const { todo, hours } = takeOnNow
  const estimate = formatEstimate(todo.estimateMinutes)
  const energy = todo.energy && ENERGIES[todo.energy]

  return (
    <Blueprint as="section" className="ton" aria-labelledby="ton-title">
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
      <div className="ton__actions">
        <NotWired>
          <Button variant="plain" className="ton__start">
            Start
          </Button>
        </NotWired>
        <NotWired>
          <Button variant="plain" className="ton__swap">
            Swap
          </Button>
        </NotWired>
      </div>
    </Blueprint>
  )
}
