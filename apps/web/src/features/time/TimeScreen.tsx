import {
  TIME_VIEWS,
  TIME_VIEW_LABELS,
  type TimeRow,
  type TimeView,
  isThisPeriod,
  periodStep,
  thisPeriod,
  viewTime,
} from '@crazy/shared'
import { Button, SegmentedControl, Sheet, Tag } from '@crazy/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { timeQuery, timerQuery } from '#/lib/queries'
import { useTicking } from '#/features/timer/useTicking'
import { useWide } from '#/lib/useWide'
import { InvoicesAside } from '#/features/invoices/InvoicesAside'
import { EntriesTable } from './EntriesTable'
import { EntryEditor } from './EntryEditor'
import { TimeCards } from './TimeCards'
import { type Draft, draftOf, newDraft } from './draft'

const route = getRouteApi('/_app/time')

const VIEW_OPTIONS = TIME_VIEWS.map((value) => ({ value, label: TIME_VIEW_LABELS[value] }))

/**
 * The Time screen, frame 2b's left half: the timesheet Cori puts right before
 * the invoices go out. A Day, a Week or a Month at a time, with what each part
 * of the period came to over the entries themselves; every entry editable in
 * place; the ones that still name no Client flagged with the Client Crazy
 * thinks they were for, one tap from being confirmed.
 *
 * Which period is the URL's. Choosing a view or moving a week navigates, the
 * loader reads that period and the screen reads it back — so the screen holds
 * no period of its own that the address bar could disagree with.
 *
 * Frame 2b draws no timer bar here, so the screen does not draw one: while an
 * entry runs the Shell's compact header is over it like every other screen
 * (ticket 27). The running entry is in the table, counting up from the moment
 * the loader handed over, and is editable like any other but for its end.
 */
export function TimeScreen() {
  const { view, on } = route.useSearch()
  const navigate = route.useNavigate()
  const { data } = useSuspenseQuery(timeQuery(view, on))
  const { data: timer } = useSuspenseQuery(timerQuery)
  const wide = useWide()
  /** The row open for editing, as its fields hold it; null when none is. */
  const [draft, setDraft] = useState<Draft | null>(null)

  const running = data.time.rows.some((row) => row.endedAt === null)
  const now = useTicking(data.now, running)
  const screen = viewTime(data.time, now, data.timeZone)
  const anchor = on ?? data.time.on

  const go = (next: { view?: TimeView; on?: string }) => {
    setDraft(null)
    void navigate({ search: { view: next.view ?? view, on: next.on } })
  }
  const step = (by: -1 | 1) => go({ on: periodStep(view, anchor, by) })
  const open = (row: TimeRow) => setDraft(draft?.id === row.id ? null : draftOf(row, data.timeZone))
  const add = () => setDraft(newDraft(data.time.rows, view, anchor, now, data.timeZone))

  const editing = draft?.id ?? null
  const was = editing === null ? null : (data.time.rows.find((row) => row.id === editing) ?? null)
  const editor = draft && (
    <EntryEditor
      draft={draft}
      onDraft={setDraft}
      was={was}
      picker={timer.picker}
      now={now}
      timeZone={data.timeZone}
      onClose={() => setDraft(null)}
    />
  )
  const here = isThisPeriod(view, anchor, now, data.timeZone)

  return (
    <div className="screen time" data-view={view}>
      <section className="time__main" aria-labelledby="time-title">
        <div className="time__head">
          <h1 id="time-title" className="screen__title">
            {screen.title}
          </h1>
          {/* Frame 2b draws no way to move between periods; a timesheet that
              cannot go back to last week is no use at month-end (derived). */}
          <div className="time__period">
            <button
              type="button"
              className="btn btn-ghost time__step"
              onClick={() => step(-1)}
              aria-label={`The ${view} before this one`}
            >
              <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost time__now"
              onClick={() => go({ on: undefined })}
              disabled={here}
            >
              {thisPeriod(view)}
            </button>
            <button
              type="button"
              className="btn btn-ghost time__step"
              onClick={() => step(1)}
              aria-label={`The ${view} after this one`}
            >
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <SegmentedControl
            label="How much of the timesheet to show"
            value={view}
            options={VIEW_OPTIONS}
            onChange={(next) => go({ view: next, on: anchor })}
            className="time__views"
          />
        </div>

        <TimeCards cards={screen.cards} clients={data.time.clients} />

        {screen.rows.length === 0 ? (
          <p className="time__none">
            Nothing tracked in this {view}. Add an entry below, or start the timer.
          </p>
        ) : (
          <EntriesTable
            rows={screen.rows}
            clients={data.time.clients}
            view={view}
            now={now}
            timeZone={data.timeZone}
            openId={wide ? editing : null}
            editor={wide ? editor : null}
            onOpen={open}
          />
        )}

        {screen.flag !== null && (
          <div className="time__flag">
            <Tag tone="accent">{screen.flag}</Tag>
            <span>{screen.suggestion}</span>
          </div>
        )}

        {/* Frame 2b's place to add an entry by hand. The field is the new
            entry's note; Add opens the row with its times, because Crazy does
            not read a sentence into hours and a field that looked as if it did
            would be faked. */}
        <div className="time__add">
          <input
            type="text"
            className="input time__add-note"
            placeholder="What were you doing?"
            aria-label="What a new Time entry was for"
            value={draft && draft.id === null ? draft.note : ''}
            onFocus={() => {
              if (!draft || draft.id !== null) add()
            }}
            onChange={(event) =>
              setDraft((held) =>
                held && held.id === null ? { ...held, note: event.target.value } : held,
              )
            }
          />
          <Button variant="secondary" onClick={add}>
            Add
          </Button>
        </div>

        {/* The new entry opens under the place it was asked for, with its day,
            a start right after the last entry of that day, and the work she was
            last on — so the common case is a note, an end time and Save. */}
        {wide && draft?.id === null && <div className="time__new">{editor}</div>}
      </section>

      {/* Frame 2b is one page for Time and Invoices: this column is the
          Invoices screen's own two cards, read from the same query (ticket 21). */}
      <InvoicesAside on={on} />

      {/* A phone has no room to edit inside a row, so the same editor rises
          from the bottom edge instead (derived, docs/BRIEF.md). */}
      {!wide && (
        <Sheet
          open={draft !== null}
          onClose={() => setDraft(null)}
          label={was ? 'Edit this Time entry' : 'A new Time entry'}
          className="time__sheet"
        >
          <span className="sheet__handle" aria-hidden="true" />
          {editor}
        </Sheet>
      )}
    </div>
  )
}
