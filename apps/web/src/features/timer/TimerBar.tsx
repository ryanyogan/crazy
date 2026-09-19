import {
  INTERNAL,
  type TimerEntry,
  type TimerPicker,
  type TimerWork,
  type TodayTimer,
  clockTime,
  formatElapsed,
  formatTracked,
  viewTimer,
  workLine,
} from '@crazy/shared'
import { Blueprint, NotWired, Tag } from '@crazy/ui'
import { Play } from 'lucide-react'
import { useState } from 'react'
import { useCommand } from '#/lib/useCommand'
import { WorkPicker } from './WorkPicker'
import { useTicking } from './useTicking'

/** With the Billing module on there is always a picker; without one there is nothing to choose from. */
const PICKER_UNREAD = 'Choosing the Client and Project needs the day read again.'

interface TimerBarProps {
  timer: TodayTimer
  /** Every Client and Project the picker offers; null only if the day was read without one. */
  picker: TimerPicker | null
  /** The moment the loader handed this screen, which the elapsed count runs from. */
  readAt: string
  timeZone: string
}

/**
 * The timer bar, frame 3a: one square Start/Stop, the work it is for, and what
 * the day has come to. It renders only with the Billing module on, in the place
 * frame 2a draws a segmented picker.
 *
 * Idle it preselects the last entry's Client and Project — nothing is guessed
 * from a calendar — until the user chooses otherwise in the picker, which is
 * this bar's own state and no command: nothing has happened until Start does.
 * Running it counts up in the browser from the entry's start, so no second of
 * it costs a request, and choosing other work splits the entry at now.
 */
export function TimerBar({ timer, picker, readAt, timeZone }: TimerBarProps) {
  const command = useCommand()
  const now = useTicking(readAt, timer.running !== null)
  const view = viewTimer(timer, now, timeZone)
  const { running, preselected } = view
  // What Start would start: the picker's choice if one was made this visit, and
  // the last entry's work otherwise. It is not persisted and is not a command.
  const [chosen, setChosen] = useState<TimerWork | null>(null)
  const [picking, setPicking] = useState(false)
  const on: TimerWork = running ?? chosen ?? preselected
  const work = workLine(on)
  const elapsed = formatElapsed(view.elapsed)

  return (
    <section
      className={`timer${running ? ' timer--running' : ''}${picking ? ' timer--picking' : ''}`}
      aria-label="Timer"
    >
      <Blueprint className="timer__bar">
        <Blueprint
          as="button"
          type="button"
          className="btn btn-primary timer__control"
          aria-label={running ? 'Stop the timer' : 'Start the timer'}
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

        <p className="timer__elapsed">
          {elapsed.clock}
          {running && <span className="timer__seconds">:{elapsed.seconds}</span>}
        </p>

        {picker ? (
          <WorkPicker
            picker={picker}
            chosen={on}
            running={running !== null}
            now={now}
            timeZone={timeZone}
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

        {running ? (
          <p className="timer__meta">
            <span>
              since {clockTime(new Date(running.startedAt), timeZone)} ·{' '}
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
                {clockTime(new Date(timer.last.endedAt), timeZone)}
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
      </Blueprint>
    </section>
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
