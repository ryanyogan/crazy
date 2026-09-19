import {
  INTERNAL,
  type TimerEntry,
  type TimerWork,
  type TodayTimer,
  elapsedSince,
  entrySeconds,
  formatElapsed,
  formatTracked,
  sinceWhen,
  stopReceipt,
  viewTimer,
  workLine,
} from '@crazy/shared'
import { Blueprint, NotWired, Tag } from '@crazy/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { type CSSProperties, useState } from 'react'
import { timerQuery } from '#/lib/queries'
import { useCommand } from '#/lib/useCommand'
import { useWide } from '#/lib/useWide'
import { WorkPicker } from './WorkPicker'
import { useBarOnScreen, useBarSentinel } from './barOnScreen'
import { useTicking } from './useTicking'
import { useTimerChange } from './useTimerChange'

/** With the Billing module on there is always a picker; without one there is nothing to choose from. */
const PICKER_UNREAD = 'Choosing the Client and Project needs the timer read again.'

/**
 * Where a bar is drawn. `screen` is frame 3a's bar at the top of the Today
 * screen; `header` is the Shell's own, which follows a running entry onto
 * every other screen.
 */
export type TimerPlace = 'screen' | 'header'

/**
 * The screens that draw the full bar themselves. The header keeps off them, so
 * that the same timer is never shown twice at once. The Time screen joins them
 * with ticket 20.
 */
const DRAWS_ITS_OWN = ['/']

/** Nothing to show, and nothing read: the hooks below still need rows to look at. */
const NOTHING: TodayTimer = { running: null, last: null, today: [] }

/**
 * The timer, in the two sizes one component has: frame 3a's bar across the top
 * of the Today screen, and the Shell's compact header, which is that bar cut
 * down to a strip and shown wherever the user is while a Time entry runs.
 *
 * Nothing about running lives in the browser: the bar draws the Time entry with
 * no end as D1 has it, and counts up from its start against a moment the loader
 * handed over. A closed tab, a sleeping phone and another device all agree.
 */
export function TimerBar({ place }: { place: TimerPlace }) {
  const command = useCommand()
  const { data } = useSuspenseQuery(timerQuery)
  const { picker } = data
  const timer = data.timer ?? NOTHING
  const wide = useWide()
  const onScreen = useBarOnScreen()
  const sentinel = useBarSentinel()
  const here = useRouterState({ select: (state) => state.location.pathname })
  const change = useTimerChange(data.timer)
  const now = useTicking(data.now, timer.running !== null)
  const view = viewTimer(timer, now, data.timeZone)
  const { running, preselected } = view
  // What Start would start: the picker's choice if one was made this visit, and
  // the last entry's work otherwise. It is not persisted and is not a command.
  const [chosen, setChosen] = useState<TimerWork | null>(null)
  const [picking, setPicking] = useState(false)

  // Stop does not take the header away under her finger: for a moment and quite
  // still, the bar goes on showing the entry that ended and what it came to.
  const receipt = change?.kind === 'stopped' ? change.entry : null
  const shown: TimerEntry | null = running ?? receipt
  const on: TimerWork = shown ?? chosen ?? preselected
  const work = workLine(on)
  const elapsed = formatElapsed(running ? view.elapsed : receipt ? entrySeconds(receipt) : 0)

  // On a screen that draws its own bar the header keeps away: on desktop that
  // bar is itself what condenses, and on a phone the dock waits until the card
  // has scrolled out of view — never both at once.
  const ownBarHere = DRAWS_ITS_OWN.includes(here)
  if (place === 'header' && (data.timer === null || (ownBarHere && (wide || onScreen)))) {
    return null
  }
  if (place === 'header' && shown === null) return null
  if (place === 'screen' && data.timer === null) return null

  const compact = place === 'header' || (wide && !onScreen && shown !== null)
  const classes = [
    'timer',
    `timer--${place}`,
    shown ? 'timer--running' : '',
    compact ? 'timer--compact' : '',
    receipt ? 'timer--stopped' : '',
    picking ? 'timer--picking' : '',
    change?.kind === 'started' ? 'timer--washing' : '',
    change?.kind === 'switched' ? 'timer--switched' : '',
  ]
    .filter((name) => name !== '')
    .join(' ')

  return (
    <>
      {/* A labelled section is a region, and this one is not live: a screen
          reader is not read a clock every second. What is worth saying aloud is
          said once, by `TimerAside`. */}
      <section className={classes} aria-label={place === 'header' ? 'Running timer' : 'Timer'}>
        <Blueprint className="timer__bar">
          <Blueprint
            as="button"
            type="button"
            className={compact ? 'btn timer__control' : 'btn btn-primary timer__control'}
            aria-label={running ? `Stop the timer on ${sayWork(work)}` : 'Start the timer'}
            disabled={command.isPending}
            onClick={() =>
              running
                ? command.mutate({ type: 'timer.stop' })
                : command.mutate({
                    type: 'timer.start',
                    id: crypto.randomUUID(),
                    clientId: on.clientId,
                    projectId: on.projectId,
                  })
            }
          >
            {running ? (
              <span className="timer__stop" aria-hidden="true" />
            ) : (
              <Play size={14} strokeWidth={1.5} fill="currentColor" aria-hidden="true" />
            )}
          </Blueprint>

          {/* Sized in `ch` for its longest reading, so that nothing beside it
              moves when 09:59:59 becomes 10:00:00 or a 1 becomes an 8. */}
          <p className="timer__elapsed" {...(running ? { role: 'timer' } : {})}>
            {elapsed.clock}
            {shown && <span className="timer__seconds">:{elapsed.seconds}</span>}
          </p>

          {picker ? (
            <WorkPicker
              picker={picker}
              chosen={on}
              running={running !== null}
              now={now}
              timeZone={data.timeZone}
              open={picking}
              onOpen={setPicking}
              onChoose={setChosen}
            />
          ) : (
            <div className="timer__picker">
              <NotWired why={PICKER_UNREAD}>
                <button type="button" className="input timer__pick">
                  <span className="timer__rule" aria-hidden="true" />
                  <span className="timer__work">
                    <span className="timer__client">{work.client}</span>
                    {work.project && <span className="timer__project"> · {work.project}</span>}
                  </span>
                </button>
              </NotWired>
            </div>
          )}

          {receipt ? (
            // Billing software owes a receipt: what was just decided about her
            // money, in the place the figures were.
            <p className="timer__meta">
              <span className="timer__receipt">{stopReceipt(receipt)}</span>
            </p>
          ) : running ? (
            <p className="timer__meta">
              <span>
                since {sinceWhen(running.startedAt, now, data.timeZone)} ·{' '}
                {running.billable ? 'billable' : 'not billable'}
              </span>
              <Tag tone="accent" className="timer__total">
                {work.client} today {formatTracked(view.clientSeconds ?? 0)}
              </Tag>
            </p>
          ) : (
            <p className="timer__meta">
              <span>Today {formatTracked(view.todaySeconds)}</span>
              {timer.last?.endedAt && (
                <span>
                  last: {timer.last.clientName ?? INTERNAL}, stopped{' '}
                  {sinceWhen(timer.last.endedAt, now, data.timeZone)}
                </span>
              )}
            </p>
          )}

          {/* While the list is open the bar says how to drive it, where the
              figures were: frame 3a's open state. A phone has the sheet's own
              heading instead, so this shows from the breakpoint up. */}
          <p className="timer__hint">↑↓ to move · ⏎ to switch · esc</p>

          {/* Keyed by the note as it stands: a wording that arrives from another
              device replaces the field's draft, and nothing else does. */}
          {running && <TimerNote key={`${running.id}:${running.note}`} entry={running} />}

          {/* The one bold thing. Only the compact header wears it: the full bar
              is frame 3a's and keeps still. */}
          {compact && running && (
            <MinuteRule key={running.id} startedAt={running.startedAt} now={now} />
          )}
        </Blueprint>
      </section>
      {/* Just below the bar, so that the header knows when it has been passed. */}
      {place === 'screen' && <div ref={sentinel} className="timer__edge" aria-hidden="true" />}
    </>
  )
}

/** "Meridian Health · Discovery research", as a control's name says it. */
function sayWork(work: { client: string; project: string | null }): string {
  return work.project ? `${work.client} · ${work.project}` : work.client
}

/**
 * The header's liveness, in place of a blinking colon: a hairline that draws
 * itself from left to right once a minute. It is one CSS animation and no
 * JavaScript — a negative delay, taken from where this entry's minute already
 * stands, starts it part-drawn so that it agrees with the seconds beside it and
 * with every other device showing the same entry. Keyed by the entry, so a
 * switch starts a fresh one rather than jumping a running one.
 */
function MinuteRule({ startedAt, now }: { startedAt: string; now: Date }) {
  const [into] = useState(() => elapsedSince(startedAt, now) % 60)
  return (
    <span
      className="timer__minute"
      style={{ '--minute-into': `${-into}s` } as CSSProperties}
      aria-hidden="true"
    />
  )
}

/**
 * The note the invoice line is written from. It is committed when the user
 * leaves the field or presses enter, never on a keystroke: a command a second
 * is a command a second, and a half-typed note is not what they meant.
 */
function TimerNote({ entry }: { entry: TimerEntry }) {
  const command = useCommand()
  const [draft, setDraft] = useState(entry.note)

  return (
    <input
      className="input timer__note"
      value={draft}
      maxLength={500}
      placeholder="Add a note for this entry…"
      aria-label="Note for this Time entry"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const note = draft.trim()
        if (note !== entry.note) command.mutate({ type: 'timer.setNote', entryId: entry.id, note })
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
  )
}
