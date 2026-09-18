import { dayLine, firstName, greeting, viewToday, wallClock } from '@crazy/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { shellQuery, todayQuery } from '#/lib/queries'
import { AddTodo } from './AddTodo'
import { DayTimeline } from './DayTimeline'
import { Mentions } from './Mentions'
import { PriorityStack } from './PriorityStack'
import { TakeOnNowCard } from './TakeOnNowCard'
import { useSnoozeExpiry } from './useSnoozeExpiry'

/**
 * The Today screen, frame 1a. One DOM serves both widths: on a phone the
 * header and body dissolve into a single column in the phone frame's order —
 * Brief, Take on now, timeline, Priority stack. The phone frame stops there;
 * Mentions and the place to add a Todo follow.
 */
export function TodayScreen() {
  const { data: shell } = useSuspenseQuery(shellQuery)
  const { data: today } = useSuspenseQuery(todayQuery)
  const now = new Date(today.now)
  const { hour } = wallClock(now, today.timeZone)
  const view = viewToday(today, now, today.timeZone)
  useSnoozeExpiry(view.snoozed[0]?.snoozedUntil ?? null, today.now)

  return (
    <div className="screen today">
      <header className="today__head">
        <div>
          <div className="today__dayline">
            {dayLine(now, today.timeZone)} · status refreshed on the hour
          </div>
          <h1 className="screen__title">{greeting(hour, firstName(shell.name))}</h1>
          {today.brief && (
            <>
              <p className="today__brief today__brief--long">{today.brief.body}</p>
              <p className="today__brief today__brief--short">{today.brief.bodyShort}</p>
            </>
          )}
        </div>
        {view.takeOnNow && <TakeOnNowCard takeOnNow={view.takeOnNow} />}
      </header>

      <div className="today__body">
        <DayTimeline timeline={view.timeline} todos={view.stack.length} meetings={view.meetings} />
        <aside className="today__side">
          <PriorityStack
            stack={view.stack}
            done={view.done}
            carriedOver={view.carriedOver}
            sentBack={today.sentBack}
            snoozed={view.snoozed}
            timeZone={today.timeZone}
          />
          <Mentions
            mentions={today.signals.filter((signal) => signal.kind === 'mention')}
            now={now}
          />
          <AddTodo />
        </aside>
      </div>
    </div>
  )
}
