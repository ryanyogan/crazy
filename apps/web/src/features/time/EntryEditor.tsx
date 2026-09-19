import { INTERNAL, type TimeRow, type TimerPicker, type TimerWork } from '@crazy/shared'
import { Button } from '@crazy/ui'
import { type KeyboardEvent, useId, useState } from 'react'
import { WorkPicker } from '#/features/timer/WorkPicker'
import { useCommand, useDecide } from '#/lib/useCommand'
import { type Draft, buildCommand } from './draft'

interface EntryEditorProps {
  draft: Draft
  onDraft: (draft: Draft) => void
  /** The entry as it stands, or null while one is being added by hand. */
  was: TimeRow | null
  picker: TimerPicker | null
  now: Date
  timeZone: string
  onClose: () => void
}

/**
 * One Time entry, open for changing (spec, stories 99, 100 and 102). Editing is
 * meant to be forgiving: every field is here at once, escape puts the row back
 * as it was, and a change the rules will not allow is said in plain words
 * beside the field rather than after a round trip — the browser runs the same
 * `decide` the Coordinator will, so the two say the same thing.
 */
export function EntryEditor({
  draft,
  onDraft,
  was,
  picker,
  now,
  timeZone,
  onClose,
}: EntryEditorProps) {
  const command = useCommand()
  const willDecide = useDecide()
  const base = useId()
  const [refusal, setRefusal] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  /** Removing asks once, in the button itself: a modal for one row is too much. */
  const [removing, setRemoving] = useState(false)

  const field = (name: string) => `${base}-${name}`
  const set = (change: Partial<Draft>) => {
    setRefusal(null)
    onDraft({ ...draft, ...change })
  }

  const save = () => {
    const built = buildCommand(draft, was, timeZone)
    if (!built.ok) return setRefusal(built.reason)
    if (built.command === null) return onClose()
    const decision = willDecide(built.command)
    if (!decision.ok) return setRefusal(decision.reason)
    command.mutate(built.command)
    onClose()
  }

  const remove = () => {
    if (!was) return onClose()
    if (!removing) return setRemoving(true)
    command.mutate({ type: 'timeEntry.remove', entryId: was.id })
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !picking) {
      event.preventDefault()
      onClose()
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault()
      save()
    }
  }

  const work: TimerWork = draft.work
  const said = work.projectName
    ? `${work.clientName ?? INTERNAL} · ${work.projectName}`
    : (work.clientName ?? INTERNAL)

  return (
    // A fieldset, not a form: the row it sits in is inside no form, and enter
    // saves from any field here rather than submitting anything. The key
    // handler is on the group because escape and enter mean the same from
    // every field in it, and each of those fields is interactive itself.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <fieldset
      className="time__editor"
      aria-label={was ? `Editing ${said}` : 'A new Time entry'}
      onKeyDown={onKeyDown}
    >
      <div className="time__fields">
        <div className="time__field time__field--day">
          <label htmlFor={field('day')}>Day</label>
          <input
            id={field('day')}
            type="date"
            className="input"
            value={draft.day}
            onChange={(event) => set({ day: event.target.value })}
          />
        </div>
        <div className="time__field">
          <label htmlFor={field('start')}>From</label>
          <input
            id={field('start')}
            type="time"
            className="input"
            value={draft.start}
            onChange={(event) => set({ start: event.target.value })}
          />
        </div>
        <div className="time__field">
          <label htmlFor={field('end')}>To</label>
          {draft.running ? (
            <p className="time__still" id={field('end')}>
              still running
            </p>
          ) : (
            <input
              id={field('end')}
              type="time"
              className="input"
              value={draft.end}
              onChange={(event) => set({ end: event.target.value })}
            />
          )}
        </div>
        <div className="time__field time__field--work">
          <span className="time__label" id={field('work-label')}>
            Client · project
          </span>
          {picker ? (
            <WorkPicker
              picker={picker}
              chosen={work}
              // Choosing here changes the row being edited, never the timer:
              // nothing is split and no hours move until Save says so.
              running={false}
              now={now}
              timeZone={timeZone}
              open={picking}
              onOpen={setPicking}
              onChoose={(chosen) => set({ work: chosen })}
              place="field"
              label="Work this entry is for"
            />
          ) : (
            <p className="time__still">{said}</p>
          )}
        </div>
        <div className="time__field time__field--note">
          <label htmlFor={field('note')}>What</label>
          <input
            id={field('note')}
            type="text"
            className="input"
            value={draft.note}
            maxLength={500}
            placeholder="What were you doing?"
            onChange={(event) => set({ note: event.target.value })}
          />
        </div>
        <label className="time__billable">
          <input
            type="checkbox"
            checked={draft.billable}
            onChange={(event) => set({ billable: event.target.checked })}
          />
          Billable
        </label>
      </div>

      {refusal && (
        <p className="time__refusal" role="alert">
          {refusal}
        </p>
      )}

      <div className="time__actions">
        {/* Not the solid accent fill: the screen's one fill is the view the
            segmented control is on (frame 2b), and an editor is a state of the
            screen rather than a screen of its own. */}
        <Button className="time__save" onClick={save} disabled={command.isPending}>
          Save
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {was && (
          <Button
            variant="ghost"
            className="time__remove"
            onClick={remove}
            onBlur={() => setRemoving(false)}
            aria-label={removing ? `Really remove ${said}?` : `Remove ${said}`}
          >
            {removing ? 'Really remove?' : 'Remove'}
          </Button>
        )}
      </div>
    </fieldset>
  )
}
