import {
  type ChapterName,
  type ClientWeek,
  type LoggedHour,
  type Rundown,
  type RundownExtras,
  type Today,
  type TodayTimer,
  type TodayTodo,
  type TodayView,
  dayLine,
  firstName,
  greeting,
  loggedByHour,
  needsClient,
  viewRundown,
  viewToday,
  wallClock,
} from '@crazy/shared'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { TimerBar } from '#/features/timer/TimerBar'
import { shellQuery, timerQuery, todayQuery } from '#/lib/queries'
import { AddTodo } from './AddTodo'
import { CatchUp } from './CatchUp'
import { Chapter } from './Chapter'
import { ChapterIndex } from './ChapterIndex'
import { DayRibbon } from './DayRibbon'
import { DayTimeline } from './DayTimeline'
import { LaterThisWeek } from './LaterThisWeek'
import { MeetingCards } from './MeetingCards'
import { PriorityStack } from './PriorityStack'
import { TakeOnNowCard } from './TakeOnNowCard'
import { WeekByClient } from './WeekByClient'
import { scrollToChapter, useChapters } from './useChapters'
import { useSnoozeExpiry } from './useSnoozeExpiry'

/**
 * The Today screen: a rundown you read, that opens into the places you work.
 *
 * Closed, the page is six sentences (five with the Billing module off) — what
 * arrived while you were away, what each meeting needs from you, whether what
 * is left fits in the day, the shape of the day, where the week has gone, and
 * what the week is leading to. Every one of them is derived in
 * `packages/shared` from the day's own rows at the moment the loader handed
 * over (`viewRundown`), so no sentence can disagree with the rows under it,
 * and a patch that changes a row changes the sentence in the same render.
 *
 * Open, each chapter holds the working part that already existed — the stack
 * you tick and drag, the hours you slot onto, the Mentions you add — drawn
 * exactly as frames 1a and 2a draw them. This ticket supersedes those frames'
 * two-column *layout* at the owner's direction and keeps their parts
 * (ADR 0003).
 */
export function TodayScreen() {
  const { data: shell } = useSuspenseQuery(shellQuery)
  const { data: today } = useSuspenseQuery(todayQuery)
  const now = new Date(today.now)
  const { hour } = wallClock(now, today.timeZone)
  const view = viewToday(today, now, today.timeZone)
  useSnoozeExpiry(view.snoozed[0]?.snoozedUntil ?? null, today.now)

  // Which Todo the pointer has picked up: What's left says, Your day asks.
  const [dragging, setDragging] = useState<TodayTodo | null>(null)
  const chapters = useChapters()
  const billing = useBillingFigures(shell.billing, now, today.timeZone)
  const rundown = viewRundown(today, view, billing.extras, now, today.timeZone)

  const dive = (name: ChapterName) => {
    chapters.open(name)
    // After the chapter has been told to open, so the scroll lands on the head
    // of a chapter that is about to be tall rather than on where it was short.
    requestAnimationFrame(() => scrollToChapter(name))
  }
  useHashChapter(dive)

  const timedTodoId = billing.timer?.running?.todoId ?? null

  return (
    <>
      {/* The bar leads the screen and only for a user who bills for their time,
          where frame 2a draws it. It reads the Shell's timer, so it and the
          header that follows her about cannot disagree, and it is what condenses
          into the sticky strip once the page scrolls past it (ticket 27). */}
      {shell.billing && <TimerBar place="screen" />}
      <div className={shell.billing ? 'screen today today--billing' : 'screen today'}>
        <header className="today__intro">
          <div className="today__dayline">{dayLine(now, today.timeZone)}</div>
          <h1 className="screen__title">{greeting(hour, firstName(shell.name))}</h1>
          {today.brief && (
            <>
              <p className="today__brief today__brief--long">{today.brief.body}</p>
              <p className="today__brief today__brief--short">{today.brief.bodyShort}</p>
            </>
          )}
        </header>

        <DayRibbon ribbon={rundown.ribbon} readAt={today.now} onPick={() => dive('your-day')} />

        <div className="today__body">
          <div className="rundown">
            {rundown.chapters.map((chapter) => (
              <Chapter
                key={chapter.name}
                chapter={chapter}
                open={chapters.isOpen(chapter.name, chapter.filled)}
                onToggle={() => chapters.toggle(chapter.name, chapter.filled)}
              >
                {body(chapter.name, {
                  today,
                  view,
                  rundown,
                  shellBilling: shell.billing,
                  billing,
                  dragging,
                  timedTodoId,
                  now,
                  onDrag: (todo) => {
                    // A Todo picked up in What's left has to have somewhere to
                    // land: Your day opens as the drag begins if it was closed.
                    if (todo) chapters.open('your-day')
                    setDragging(todo)
                  },
                })}
              </Chapter>
            ))}
          </div>

          <aside className="today__aside">
            {/* Frame 2a draws no Take on now card: with a timer in reach the
                stack is the recommendation and its first row is the Take on
                now, as ticket 19 settled. */}
            {!shell.billing && view.takeOnNow && (
              <TakeOnNowCard takeOnNow={view.takeOnNow} timeZone={today.timeZone} />
            )}
            <AddTodo />
            <ChapterIndex chapters={rundown.chapters} onPick={dive} />
          </aside>
        </div>
      </div>
    </>
  )
}

/** The day as the loader handed it over: the rows, and the moment they were read at. */
type TodayRead = Today & { now: string; timeZone: string }

interface BodyProps {
  today: TodayRead
  view: TodayView
  rundown: Rundown
  shellBilling: boolean
  billing: BillingFigures
  dragging: TodayTodo | null
  timedTodoId: string | null
  now: Date
  onDrag: (todo: TodayTodo | null) => void
}

/** What opens under each chapter's head: the working part that already exists. */
function body(name: ChapterName, props: BodyProps) {
  const { today, view, rundown, shellBilling, billing, dragging, timedTodoId, now, onDrag } = props
  switch (name) {
    case 'catch-up':
      return <CatchUp catchUp={rundown.catchUp} now={now} />
    case 'meetings':
      return <MeetingCards meetings={rundown.meetings} billing={shellBilling} />
    case 'whats-left':
      return (
        <PriorityStack
          stack={view.stack}
          billing={shellBilling}
          timedTodoId={timedTodoId}
          done={view.done}
          snoozed={view.snoozed}
          timeZone={today.timeZone}
          hours={view.timeline.map((each) => each.hour)}
          events={today.events}
          now={now}
          onDrag={onDrag}
        />
      )
    case 'your-day':
      return (
        <DayTimeline
          timeline={view.timeline}
          todos={view.stack.length}
          meetings={view.meetings}
          events={today.events}
          dragging={dragging}
          now={now}
          {...(shellBilling
            ? {
                logged: billing.logged,
                clients: billing.week,
                runningHours: billing.runningHours,
                stack: view.stack,
              }
            : {})}
        />
      )
    case 'clients':
      return <WeekByClient week={billing.week} />
    case 'later':
      return <LaterThisWeek later={today.later} />
  }
}

interface BillingFigures {
  timer: TodayTimer | null
  week: ClientWeek[]
  logged: LoggedHour[]
  runningHours: number[]
  extras: RundownExtras
}

/**
 * The Billing module's figures for the day, all from the Shell's one timer
 * query, so the ribbon, the timeline, "This week by Client" and the header's
 * running timer cannot come to different numbers.
 */
function useBillingFigures(on: boolean, now: Date, timeZone: string): BillingFigures {
  const { data } = useQuery({ ...timerQuery, enabled: on })
  const timer = data?.timer ?? null
  const week = data?.week ?? []
  const logged = on ? loggedByHour(timer?.today ?? [], now, timeZone) : []
  // Every hour the running entry has time in wears the accent frame, not only
  // the one it began in: at 10:42 an entry begun at 09:00 is in two of them.
  const running = timer?.running
  const runningHours = running
    ? loggedByHour([running], now, timeZone).map((each) => each.hour)
    : []
  return {
    timer,
    week,
    logged,
    runningHours,
    extras: {
      billing: on
        ? { week, needsClient: (timer?.today ?? []).filter((entry) => needsClient(entry)).length }
        : null,
      logged,
    },
  }
}

/**
 * `#meetings` in the URL opens that chapter and scrolls to it — how the ribbon,
 * the index and a link from another screen all dive in. The hash is read on
 * arrival and whenever it changes; the browser's own jump would land on a
 * chapter that was still closed, so it is done here instead.
 */
function useHashChapter(dive: (name: ChapterName) => void): void {
  useEffect(() => {
    const go = () => {
      const name = window.location.hash.slice(1)
      if (name) dive(name as ChapterName)
    }
    go()
    window.addEventListener('hashchange', go)
    return () => window.removeEventListener('hashchange', go)
    // Once, on arrival: `dive` closes over the chapters' state and changes with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
