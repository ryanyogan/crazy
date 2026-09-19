import { type TodayTodo, dayLine, firstName, greeting, viewToday, wallClock } from '@crazy/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { TimerBar } from '#/features/timer/TimerBar'
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
  // Which Todo the pointer has picked up: the stack says, the timeline asks.
  const [dragging, setDragging] = useState<TodayTodo | null>(null)

  return (
    <>
      {/* The bar sits across the top of the screen, where frame 2a draws it, and
          only for a user who bills for their time. */}
      {today.timer && (
        <TimerBar
          timer={today.timer}
          picker={today.picker}
          readAt={today.now}
          timeZone={today.timeZone}
        />
      )}
      <div className={shell.billing ? 'screen today today--billing' : 'screen today'}>
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
          {view.takeOnNow && <TakeOnNowCard takeOnNow={view.takeOnNow} timeZone={today.timeZone} />}
        </header>

        <div className="today__body">
          <DayTimeline
            timeline={view.timeline}
            todos={view.stack.length}
            meetings={view.meetings}
            events={today.events}
            dragging={dragging}
            now={now}
          />
          <aside className="today__side">
            <PriorityStack
              stack={view.stack}
              done={view.done}
              carriedOver={view.carriedOver}
              sentBack={today.sentBack}
              snoozed={view.snoozed}
              timeZone={today.timeZone}
              hours={view.timeline.map((hour) => hour.hour)}
              events={today.events}
              now={now}
              onDrag={setDragging}
            />
            <Mentions
              mentions={today.signals.filter((signal) => signal.kind === 'mention')}
              now={now}
            />
            <AddTodo />
          </aside>
        </div>
      </div>
    </>
  )
}
