import {
  INTERNAL,
  type TimerPicker,
  type TimerWork,
  clockTime,
  dayWorked,
  formatTracked,
  whenWorked,
} from '@crazy/shared'
import { Sheet } from '@crazy/ui'
import { type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { notify } from '#/lib/notices'
import { useCommand } from '#/lib/useCommand'
import { useWide } from '#/lib/useWide'

// The work picker, frames 3a (open) and 3b. One list of choices, rendered once:
// above the breakpoint it hangs under the trigger as a dropdown, below it the
// same list is a modal sheet from the bottom of the screen. Choosing while the
// timer runs is `timer.switch`, which splits the entry at this moment; choosing
// while it is idle is what Start will start, and is this bar's own state.

/** Frame 3a gives each Client a shade of the accent, in the order they were added. */
const TONES = ['var(--color-accent-700)', 'var(--color-accent-400)', 'var(--color-accent-200)']
/** Internal is not a Client, and wears no Client's colour. */
const INTERNAL_TONE = 'var(--color-neutral-400)'

/** One row of the picker, in the order the list draws them. */
type Option =
  | { kind: 'recent'; work: TimerWork; say: string; meta: string }
  | { kind: 'client'; work: TimerWork; say: string; hours: string; tone: string }
  | { kind: 'project'; work: TimerWork; say: string; meta: string; running: boolean }
  /** Naming a Project: for whom it would be, once there is a name to give it. */
  | { kind: 'new'; work: null; say: string; clientId: string | null; named: boolean }

const matches = (text: string, query: string) => text.toLowerCase().includes(query)

/**
 * Every choice the picker offers, in order: the work timed lately (which the
 * phone's sheet leads with), then each Client with its Projects under it, then
 * the place to name a new Project. A search keeps a Client whose own name
 * matches, with all of its Projects, and otherwise only the Projects that match.
 */
function options(picker: TimerPicker, query: string, now: Date, timeZone: string): Option[] {
  const search = query.trim().toLowerCase()
  const rows: Option[] = []

  for (const work of picker.recent) {
    const say = work.projectName
      ? `${work.clientName ?? INTERNAL} · ${work.projectName}`
      : (work.clientName ?? INTERNAL)
    if (search && !matches(say, search)) continue
    rows.push({
      kind: 'recent',
      work,
      say,
      meta: `${whenWorked(work.startedAt, now, timeZone)} · ${formatTracked(work.seconds)}`,
    })
  }

  picker.clients.forEach((client, index) => {
    const named = search !== '' && matches(client.name, search)
    const projects = client.projects.filter(
      (project) => search === '' || named || matches(project.name, search),
    )
    if (search !== '' && !named && projects.length === 0) return
    rows.push({
      kind: 'client',
      // The Client alone: work for them that is part of no Project (a One-off).
      work: {
        clientId: client.id,
        clientName: client.id === null ? null : client.name,
        projectId: null,
        projectName: null,
      },
      say: client.name,
      hours: formatTracked(client.weekSeconds),
      tone: client.id === null ? INTERNAL_TONE : (TONES[index % TONES.length] as string),
    })
    for (const project of projects) {
      rows.push({
        kind: 'project',
        // A Project's Client wins: choosing it is choosing them too.
        work: {
          clientId: client.id,
          clientName: client.id === null ? null : client.name,
          projectId: project.id,
          projectName: project.name,
        },
        say: project.name,
        meta: project.running
          ? 'running'
          : project.lastStartedAt
            ? dayWorked(project.lastStartedAt, now, timeZone)
            : '',
        running: project.running,
      })
    }
  })

  // Nothing typed, the one row frame 3a draws, which asks for a name. With a
  // name typed, one row for each Client it could be for: a Project made for
  // nobody is never billed, and that is too quiet a mistake to make by default.
  const wording = query.trim()
  if (wording === '') {
    rows.push({ kind: 'new', work: null, say: '+ New project', clientId: null, named: false })
    return rows
  }
  for (const client of picker.clients) {
    rows.push({
      kind: 'new',
      work: null,
      say: `+ New project “${wording}” · ${client.id === null ? INTERNAL : `for ${client.name}`}`,
      clientId: client.id,
      named: true,
    })
  }
  return rows
}

interface WorkPickerProps {
  picker: TimerPicker
  /** The work the bar is on: the running entry's, or what Start would start. */
  chosen: TimerWork
  /** Whether a Time entry is running, which is what makes a choice a switch. */
  running: boolean
  /** The moment the screen is showing, which "yesterday" and "Mon" are read from. */
  now: Date
  timeZone: string
  /** Whether the list is open. The bar holds it, because its own line changes while it is. */
  open: boolean
  onOpen: (open: boolean) => void
  /** Idle, the choice is this bar's own state; running, nothing is handed back. */
  onChoose: (work: TimerWork) => void
  /**
   * Where the control is drawn. The bar is frames 3a and 3b; `field` is the
   * same control inside a form — the Time screen's row editor — where it is a
   * field like the ones beside it and the trigger has no elapsed figure to
   * stand against (ticket 20).
   */
  place?: 'bar' | 'field'
  /** What the trigger is called, where "the work being timed" is not what it is. */
  label?: string
}

/**
 * The trigger the bar draws, and the list it opens. The trigger says what the
 * timer is on; the list says what else it could be on.
 */
export function WorkPicker({
  picker,
  chosen,
  running,
  now,
  timeZone,
  open,
  onOpen,
  onChoose,
  place = 'bar',
  label,
}: WorkPickerProps) {
  const command = useCommand()
  const wide = useWide()
  const base = useId()
  const [query, setQuery] = useState('')
  /** Which row the arrows are on; null until they have moved (`active`). */
  const [moved, setMoved] = useState<number | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => options(picker, query, now, timeZone), [picker, query, now, timeZone])
  const listId = `${base}-list`
  const optionId = (index: number) => `${base}-option-${index}`

  // Until the arrows have moved, the list is on the work the timer is already
  // on, which is where frame 3a draws the tint.
  const on = rows.findIndex(
    (row) =>
      row.work !== null &&
      row.work.clientId === chosen.clientId &&
      row.work.projectId === chosen.projectId,
  )
  const active = moved ?? Math.max(on, 0)
  const setActive = (index: number) => setMoved(Math.min(Math.max(index, 0), rows.length - 1))

  const close = useCallback(
    (toTrigger = true) => {
      onOpen(false)
      setQuery('')
      setMoved(null)
      if (toTrigger) trigger.current?.focus()
    },
    [onOpen],
  )

  /** The search field takes the focus as the list opens, and nothing else does. */
  const takesFocus = useCallback((field: HTMLInputElement | null) => {
    search.current = field
    field?.focus()
  }, [])

  // The dropdown is not modal, so a press anywhere else is a press elsewhere.
  useEffect(() => {
    if (!open || !wide) return
    const elsewhere = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) close(false)
    }
    document.addEventListener('mousedown', elsewhere)
    return () => document.removeEventListener('mousedown', elsewhere)
  }, [open, wide, close])

  /** Take the work chosen: a split while the timer runs, this bar's state while it is idle. */
  const take = (work: TimerWork) => {
    close()
    if (running) {
      command.mutate({
        type: 'timer.switch',
        id: crypto.randomUUID(),
        clientId: work.clientId,
        projectId: work.projectId,
      })
    } else {
      onChoose(work)
    }
  }

  /** Name a Project here and take it: it is why the user opened the picker. */
  const name = (clientId: string | null) => {
    const wording = query.trim()
    if (wording === '') {
      notify('Type a name for the new Project first.')
      search.current?.focus()
      return
    }
    const id = crypto.randomUUID()
    void command
      .mutateAsync({ type: 'project.add', id, name: wording, clientId })
      // The row that was chosen said whose it is, so its hours are billed to
      // them from the first second.
      .then(() =>
        take({
          clientId,
          clientName:
            picker.clients.find((each) => each.id === clientId && each.id !== null)?.name ?? null,
          projectId: id,
          projectName: wording,
        }),
      )
      .catch(() => {})
    close()
  }

  const choose = (row: Option) => (row.kind === 'new' ? name(row.clientId) : take(row.work))

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive(active + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive(active - 1)
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(rows.length - 1)
        break
      case 'Enter': {
        event.preventDefault()
        const row = rows[active]
        if (row) choose(row)
        break
      }
      case 'Escape':
        event.preventDefault()
        close()
        break
    }
  }

  const list = (
    <>
      <input
        ref={takesFocus}
        type="text"
        className="input picker__search"
        placeholder="Search clients and projects…"
        aria-label="Search clients and projects"
        // The combobox is the field, and the list is what it controls.
        role="combobox"
        aria-expanded={true}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={rows[active] ? optionId(active) : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setMoved(0)
        }}
        onKeyDown={onKeyDown}
      />
      {/* No native element groups Projects under their Clients, marks the row
          the arrows are on and lets a Client be a choice in its own right, so
          this is the listbox of the combobox pattern. */}
      {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <div className="picker__list" id={listId} role="listbox" aria-label="Clients and Projects">
        {rows.map((row, index) => (
          <Row
            key={`${row.kind}:${row.work?.clientId ?? ''}:${row.work?.projectId ?? ''}:${index}`}
            row={row}
            id={optionId(index)}
            active={index === active}
            onPick={() => choose(row)}
            onPoint={() => setActive(index)}
          />
        ))}
      </div>
    </>
  )

  const work = chosen.projectName
    ? `${chosen.clientName ?? INTERNAL} · ${chosen.projectName}`
    : (chosen.clientName ?? INTERNAL)

  const heading = running ? 'Switch project' : 'Choose project'

  return (
    // Tabbing out of the dropdown is leaving it; the sheet holds focus itself.
    <div
      className={place === 'bar' ? 'timer__picker' : 'timer__picker picker--field'}
      ref={wrapper}
      onBlur={(event) => {
        if (!open || !wide) return
        if (!wrapper.current?.contains(event.relatedTarget)) close(false)
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="input timer__pick"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          label
            ? `${label}: ${work}. Choose other work`
            : `Work being timed: ${work}. Choose other work`
        }
        onClick={() => onOpen(!open)}
      >
        <span className="timer__rule" aria-hidden="true" />
        <span className="timer__work">
          <span className="timer__client">{chosen.clientName ?? INTERNAL}</span>
          {chosen.projectName && <span className="timer__project"> · {chosen.projectName}</span>}
        </span>
        <Chevron up={open} />
      </button>

      {/* The popup holds a search field and the list it filters, so it is a
          dialog in both places: hanging under the trigger here, and taking the
          screen as a sheet on a phone. Open, not modal: the screen behind the
          dropdown is not dimmed and stays usable. */}
      {open && wide && (
        <dialog open className="blueprint elev-md picker__panel" aria-label={heading}>
          <Corners />
          {list}
        </dialog>
      )}
      {/* The sheet stays in the DOM, closed, so that the browser hands focus
          back to the trigger when it closes. */}
      {!wide && (
        <Sheet open={open} onClose={() => close()} label={heading} className="picker__sheet">
          <span className="sheet__handle" aria-hidden="true" />
          <div className="picker__head">
            <h2 className="picker__title">{heading}</h2>
            {running && (
              <span className="picker__split">splits entry at {clockTime(now, timeZone)}</span>
            )}
          </div>
          {list}
        </Sheet>
      )}
    </div>
  )
}

/** The blueprint's registration marks, which a plain div does not carry. */
function Corners() {
  return (
    <>
      <i className="corner tl" aria-hidden="true" />
      <i className="corner tr" aria-hidden="true" />
      <i className="corner bl" aria-hidden="true" />
      <i className="corner br" aria-hidden="true" />
    </>
  )
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={up ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  )
}

interface RowProps {
  row: Option
  id: string
  active: boolean
  onPick: () => void
  onPoint: () => void
}

/**
 * One choice. Every row is an option of the one listbox, the Client's own row
 * included: choosing a Client and no Project is work for them that is part of
 * nothing larger. The row the arrows are on wears the accent tint, which is
 * where frame 3a draws it — on the work the timer is already on, which is
 * where the list opens.
 */
function Row({ row, id, active, onPick, onPoint }: RowProps) {
  const common = {
    id,
    role: 'option' as const,
    'aria-selected': active,
    tabIndex: -1,
    type: 'button' as const,
    onClick: onPick,
    onMouseMove: onPoint,
  }
  const styled = (name: string) =>
    active ? `picker__row ${name} is-active` : `picker__row ${name}`

  switch (row.kind) {
    case 'recent':
      return (
        <button {...common} className={styled('picker__recent')}>
          <span className="picker__name">
            {row.say}
            <span className="picker__when">{row.meta}</span>
          </span>
        </button>
      )
    case 'client':
      return (
        <button {...common} className={styled('picker__group')}>
          <span className="picker__swatch" style={{ background: row.tone }} aria-hidden="true" />
          {row.say}
          <span className="picker__hours">{row.hours}</span>
        </button>
      )
    case 'project':
      return (
        <button {...common} className={styled('picker__project')}>
          <span className="picker__name">{row.say}</span>
          <span className="picker__meta">{row.meta}</span>
        </button>
      )
    case 'new':
      return (
        <button {...common} className={styled('picker__new')}>
          {row.say}
        </button>
      )
  }
}
