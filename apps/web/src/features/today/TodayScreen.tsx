import {
  type DayEvent,
  type TodayTodo,
  type TodayView,
  dayLine,
  firstName,
  greeting,
  loggedByHour,
  viewToday,
  wallClock,
} from '@crazy/shared'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { TimerBar } from '#/features/timer/TimerBar'
import { shellQuery, timerQuery, todayQuery } from '#/lib/queries'
import { AddTodo } from './AddTodo'
import { DayTimeline } from './DayTimeline'
import { Mentions } from './Mentions'
import { PriorityStack } from './PriorityStack'
import { TakeOnNowCard } from './TakeOnNowCard'
import { WeekByClient } from './WeekByClient'
import { useSnoozeExpiry } from './useSnoozeExpiry'

/**
 * The Today screen. With the Billing module off it is frame 1a: the Brief and
 * the Take on now card side by side, the day under them, the Priority stack
 * beside it. With the module on it is frame 2a, which is a different screen for
 * a different day: the timer bar across the top, the Brief leading the day
 * itself, the stack where the Take on now card was — every Todo in it one press
 * from a running timer, so the recommendation at the top of the stack is taken
 * on the same way as anything else — and this week's hours by Client under it.
 *
 * One DOM serves both widths: on a phone the header and body dissolve into a
 * single column in the phone frame's order — Brief, Take on now, timeline,
 * Priority stack. The phone frame stops there; Mentions and the place to add a
 * Todo follow.
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
  const timedTodoId = useTimedTodo(shell.billing)

  const intro = (
    <div className="today__intro">
      <div className="today__dayline">
        {dayLine(now, today.timeZone)}
        {/* With the Billing module on the day line is frame 2a's, which says
            the date and the time and nothing else: the bar under it is what
            says how current the screen is. */}
        {!shell.billing && ' · status refreshed on the hour'}
      </div>
      <h1 className="screen__title">{greeting(hour, firstName(shell.name))}</h1>
      {today.brief && (
        <>
          <p className="today__brief today__brief--long">{today.brief.body}</p>
          <p className="today__brief today__brief--short">{today.brief.bodyShort}</p>
        </>
      )}
    </div>
  )

  return (
    <>
      {/* The bar sits across the top of the screen, where frame 2a draws it, and
          only for a user who bills for their time. It reads the Shell's timer,
          so that it and the header that follows her about cannot disagree. */}
      {shell.billing && <TimerBar place="screen" />}
      <div className={shell.billing ? 'screen today today--billing' : 'screen today'}>
        {/* Frame 2a draws no Take on now card: with a timer in reach the stack
            is the screen's recommendation, and its first row is the Take on now.
            So the header goes with it and the Brief leads the day instead. */}
        {!shell.billing && (
          <header className="today__head">
            {intro}
            {view.takeOnNow && (
              <TakeOnNowCard takeOnNow={view.takeOnNow} timeZone={today.timeZone} />
            )}
          </header>
        )}

        <div className="today__body">
          {shell.billing ? (
            <BillingDay
              view={view}
              events={today.events}
              dragging={dragging}
              now={now}
              timeZone={today.timeZone}
              lead={intro}
            />
          ) : (
            <DayTimeline
              timeline={view.timeline}
              todos={view.stack.length}
              meetings={view.meetings}
              events={today.events}
              dragging={dragging}
              now={now}
            />
          )}
          <aside className="today__side">
            <PriorityStack
              stack={view.stack}
              billing={shell.billing}
              timedTodoId={timedTodoId}
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
            {shell.billing && <WeekOfClients />}
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

/**
 * The day with the Billing module on: the same timeline, with what was actually
 * tracked drawn beside what was planned (frame 2a). The hours come from the
 * Time entries themselves, counted no further than the moment the loader handed
 * over — the browser reads no clock for the present, here as everywhere — and
 * the Brief leads them, where frame 2a puts it.
 */
function BillingDay({
  view,
  events,
  dragging,
  now,
  timeZone,
  lead,
}: {
  view: TodayView
  events: DayEvent[]
  dragging: TodayTodo | null
  now: Date
  timeZone: string
  lead: ReactNode
}) {
  const { data } = useSuspenseQuery(timerQuery)
  const timer = data.timer
  const logged = loggedByHour(timer?.today ?? [], now, timeZone)
  // Every hour the running entry has time in wears the accent frame, not only
  // the one it began in: at 10:42 an entry begun at 09:00 is in two of them.
  const running = timer?.running
  const runningHours = running
    ? loggedByHour([running], now, timeZone).map((each) => each.hour)
    : []
  return (
    <DayTimeline
      timeline={view.timeline}
      todos={view.stack.length}
      meetings={view.meetings}
      events={events}
      dragging={dragging}
      now={now}
      lead={lead}
      logged={logged}
      clients={data.week}
      runningHours={runningHours}
      stack={view.stack}
    />
  )
}

/**
 * The Todo the timer is running on, if it was started from one. It is the
 * Shell's timer that says so and not the Todo itself: the running timer is the
 * Time entry with no end, and nothing about it lives in the browser.
 */
function useTimedTodo(billing: boolean): string | null {
  // Read rather than awaited: with the Billing module off there is no timer
  // query to wait for, and with it on the Shell has already loaded this one.
  const { data } = useQuery({ ...timerQuery, enabled: billing })
  return data?.timer?.running?.todoId ?? null
}

/** This week's hours by Client, from the Shell's timer query (frame 2a). */
function WeekOfClients() {
  const { data } = useSuspenseQuery(timerQuery)
  return <WeekByClient week={data.week} />
}
