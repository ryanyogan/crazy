import { SOURCE_KINDS, type Signal, formatAge } from '@crazy/shared'
import { Blueprint, Button, SourceChip, Tag } from '@crazy/ui'
import { useId } from 'react'
import { useCommand } from '#/lib/useCommand'

interface PromisesProps {
  promises: Signal[]
  /** The ones that are not Todos yet: what pressing the button would make. */
  unadded: Signal[]
  now: Date
}

/**
 * "You said you'd…": what Ryan told somebody he would do. None of them is a
 * Todo until he says so, and one press turns every one that is not into one —
 * each taking the Promise's Provider item as its Source.
 */
export function Promises({ promises, unadded, now }: PromisesProps) {
  const command = useCommand()
  const noneLeft = useId()

  return (
    <Blueprint as="section" className="card projects__signals" aria-labelledby="promises-title">
      <h2 id="promises-title" className="card-kicker">
        {"You said you'd…"}
      </h2>
      {promises.length === 0 ? (
        <p className="projects__none">You have not promised anybody anything.</p>
      ) : (
        <ul className="projects__signal-list">
          {promises.map((promise) => (
            <li key={promise.id} className="projects__signal">
              <SourceChip source={SOURCE_KINDS[promise.source.kind]} />
              <span className="projects__signal-what">
                {promise.text}
                <span className="projects__signal-who">to {promise.who}</span>
                {promise.todoId ? (
                  <Tag tone="accent" className="projects__added">
                    Added to your Todos
                  </Tag>
                ) : null}
              </span>
              <span className="projects__signal-age projects__signal-age--promise">
                {formatAge(new Date(promise.at), now)}
                <span className="sr-only"> ago</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="ghost"
        className="projects__turn-all"
        disabled={unadded.length === 0 || command.isPending}
        aria-describedby={unadded.length === 0 ? noneLeft : undefined}
        onClick={() =>
          command.mutate({
            type: 'signal.addAll',
            adds: unadded.map((promise) => ({
              signalId: promise.id,
              todoId: crypto.randomUUID(),
            })),
          })
        }
      >
        Turn all into todos
      </Button>
      <span id={noneLeft} hidden>
        Every Promise is already one of your Todos.
      </span>
    </Blueprint>
  )
}
