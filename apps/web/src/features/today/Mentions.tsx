import { type Signal, SOURCE_KINDS, formatAge } from '@crazy/shared'
import { Blueprint, Button, SourceChip, Tag } from '@crazy/ui'
import { useId, useState } from 'react'
import { useCommand } from '#/lib/useCommand'

/**
 * One Mention. The frame draws where it was said, who said what and how long
 * ago; whether it is already a Todo, and the way to make it one, open
 * underneath when it is pressed.
 */
function MentionRow({ mention, now }: { mention: Signal; now: Date }) {
  const [open, setOpen] = useState(false)
  const command = useCommand()
  const moreId = useId()

  return (
    <li className="mentions__mention">
      <div className="mentions__row">
        <SourceChip source={SOURCE_KINDS[mention.source.kind]} />
        <button
          type="button"
          className="mentions__what"
          aria-expanded={open}
          aria-controls={moreId}
          onClick={() => setOpen(!open)}
        >
          <strong>{mention.who}</strong> {mention.text}
        </button>
        <span className="mentions__age">
          {formatAge(new Date(mention.at), now)}
          <span className="sr-only"> ago</span>
        </span>
      </div>
      <div id={moreId} className="mentions__more" hidden={!open}>
        {mention.todoId ? (
          <Tag tone="accent">Added to your Todos</Tag>
        ) : (
          <Button
            className="mentions__add"
            disabled={command.isPending}
            onClick={() =>
              command.mutate({
                type: 'signal.add',
                signalId: mention.id,
                todoId: crypto.randomUUID(),
              })
            }
          >
            Add
          </Button>
        )}
      </div>
    </li>
  )
}

/** Who addressed the user at a Provider. None becomes a Todo unless they add it. */
export function Mentions({ mentions, now }: { mentions: Signal[]; now: Date }) {
  return (
    <Blueprint as="section" className="card mentions" aria-labelledby="mentions-title">
      <h2 id="mentions-title" className="card-kicker mentions__title">
        Mentions
      </h2>
      {mentions.length === 0 ? (
        <p className="mentions__empty">Nobody is waiting on you.</p>
      ) : (
        <ul className="mentions__list">
          {mentions.map((mention) => (
            <MentionRow key={mention.id} mention={mention} now={now} />
          ))}
        </ul>
      )}
    </Blueprint>
  )
}
