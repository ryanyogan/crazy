import {
  type MeetingPrep,
  SOURCE_KINDS,
  clientTerms,
  formatEstimate,
  formatTracked,
} from '@crazy/shared'
import { Blueprint, Button, SourceChip, Tag } from '@crazy/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Play } from 'lucide-react'
import { timerQuery } from '#/lib/queries'
import { useCommand } from '#/lib/useCommand'

const join = (parts: (string | null)[]) => parts.filter(Boolean).join(' · ')

/**
 * One meeting still to come, and only what the day's rows can honestly say
 * about it: the Todos whose Source is this very calendar item, the Signals
 * from the people it names, where the Client's week stands if its title names
 * one, and the prep note Crazy wrote. Nothing here is invented — a meeting
 * with no rows behind it is a heading and a time, which is the truth.
 */
function MeetingCard({ meeting, billing }: { meeting: MeetingPrep; billing: boolean }) {
  const { event, todos, signals, client, prep } = meeting
  const command = useCommand()

  return (
    <Blueprint as="article" className="meeting" aria-labelledby={`meeting-${event.id}`}>
      <div className="meeting__when">
        <span className="meeting__at">{meeting.at}</span>
        <span className="meeting__starts">{meeting.under ? 'under way' : meeting.starts}</span>
      </div>
      <h3 id={`meeting-${event.id}`} className="meeting__title">
        {event.title}
      </h3>
      <p className="meeting__who">{join([event.who, meeting.length])}</p>

      {prep && (
        <>
          <p className="meeting__prep meeting__prep--long">{prep.body}</p>
          <p className="meeting__prep meeting__prep--short">{prep.bodyShort}</p>
        </>
      )}

      {todos.length > 0 && (
        <section className="meeting__part" aria-labelledby={`meeting-${event.id}-todos`}>
          <h4 id={`meeting-${event.id}-todos`} className="card-kicker meeting__kicker">
            On your list for this
          </h4>
          <ul className="meeting__list">
            {todos.map((todo) => (
              <li key={todo.id} className={todo.state === 'done' ? 'meeting__done' : undefined}>
                <input
                  type="checkbox"
                  className="tick"
                  aria-label={`Done: ${todo.title}`}
                  checked={todo.state === 'done'}
                  disabled={todo.state === 'done' || command.isPending}
                  onChange={() => command.mutate({ type: 'todo.complete', todoId: todo.id })}
                />
                <span className="meeting__what">{todo.title}</span>
                <span className="meeting__meta">{formatEstimate(todo.estimateMinutes)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {signals.length > 0 && (
        <section className="meeting__part" aria-labelledby={`meeting-${event.id}-signals`}>
          <h4 id={`meeting-${event.id}-signals`} className="card-kicker meeting__kicker">
            From the people in it
          </h4>
          <ul className="meeting__list">
            {signals.map((signal) => (
              <li key={signal.id}>
                <SourceChip source={SOURCE_KINDS[signal.source.kind]} />
                <span className="meeting__what">
                  <strong>{signal.who}</strong> {signal.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {billing && client && (
        <section className="meeting__part" aria-labelledby={`meeting-${event.id}-client`}>
          <h4 id={`meeting-${event.id}-client`} className="card-kicker meeting__kicker">
            {client.name}
          </h4>
          <p className="meeting__client">
            {formatTracked(client.weekSeconds)} this week · {clientTerms(client)}
          </p>
          <StartOnClient meeting={meeting} />
        </section>
      )}
    </Blueprint>
  )
}

/**
 * Start the timer on the Client this meeting is for, with one press. It is the
 * command the bar already has — `timer.start`, or `timer.switch` while one runs
 * — because a meeting is not a new way to write down an hour.
 */
function StartOnClient({ meeting }: { meeting: MeetingPrep }) {
  const command = useCommand()
  const { data } = useSuspenseQuery(timerQuery)
  const running = data.timer?.running ?? null
  const client = meeting.client
  if (!data.timer || !client?.clientId) return null

  if (running && running.clientId === client.clientId) {
    return (
      <p className="meeting__running">
        <Tag tone="accent">The timer is on {client.name}</Tag>
      </p>
    )
  }
  return (
    <Button
      className="meeting__start"
      disabled={command.isPending}
      onClick={() =>
        command.mutate({
          type: running ? 'timer.switch' : 'timer.start',
          id: crypto.randomUUID(),
          clientId: client.clientId,
          // The meeting names a Client and nothing finer; the Project stays
          // unsaid rather than guessed, and she can pick one in the bar.
          projectId: null,
          todoId: null,
        })
      }
    >
      <Play size={11} strokeWidth={1.5} fill="currentColor" aria-hidden="true" />
      Start the timer on {client.name}
    </Button>
  )
}

/** The meetings left today, the next one first. A meeting that is over drops out. */
export function MeetingCards({ meetings, billing }: { meetings: MeetingPrep[]; billing: boolean }) {
  return (
    <div className="meetings">
      {meetings.map((meeting) => (
        <MeetingCard key={meeting.event.id} meeting={meeting} billing={billing} />
      ))}
    </div>
  )
}
