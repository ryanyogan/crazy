import { SOURCE_KINDS, type Signal, formatAge } from '@crazy/shared'
import { Blueprint, SourceChip } from '@crazy/ui'

/**
 * What other people owe Ryan. A Waiting on never becomes a Todo — it closes
 * when they respond (CONTEXT.md) — so this card offers no way to make one, and
 * other people's work stays out of his day.
 */
export function WaitingOn({ waitingOn, now }: { waitingOn: Signal[]; now: Date }) {
  return (
    <Blueprint as="section" className="card projects__signals" aria-labelledby="waiting-title">
      <h2 id="waiting-title" className="card-kicker">
        Waiting on
      </h2>
      {waitingOn.length === 0 ? (
        <p className="projects__none">Nobody owes you anything.</p>
      ) : (
        <ul className="projects__signal-list">
          {waitingOn.map((signal) => (
            <li key={signal.id} className="projects__signal">
              <SourceChip source={SOURCE_KINDS[signal.source.kind]} />
              <span className="projects__signal-what">
                <strong>{signal.who}</strong> · {signal.text}
              </span>
              <span className="projects__signal-age">
                {formatAge(new Date(signal.at), now)}
                <span className="sr-only"> ago</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Blueprint>
  )
}
