import {
  type Command,
  type TimeRow,
  type TimeView,
  type TimerWork,
  addDays,
  clockTime,
  localTimeToInstant,
  periodOf,
  wallClock,
} from '@crazy/shared'

// A row open for editing, as the fields hold it: wall-clock times on a day,
// which is how a person reads a timesheet. Turning those into the moments a
// command carries happens here, in the user's own zone; the rules about them
// are `decide`'s, and are never repeated.

export interface Draft {
  /** The entry being edited; null for one being added by hand. */
  id: string | null
  /** The local day the entry is on: "2025-09-17". */
  day: string
  /** "09:00", on her wall clock. */
  start: string
  /** "10:42", or empty while it is still being said. */
  end: string
  work: TimerWork
  note: string
  billable: boolean
  /** Whether this is the running entry, whose end is `timer.stop`'s to give. */
  running: boolean
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/

/** The draft an entry opens as: what it says now, in the words the fields take. */
export function draftOf(row: TimeRow, timeZone: string): Draft {
  return {
    id: row.id,
    day: wallClock(new Date(row.startedAt), timeZone).day,
    start: clockTime(new Date(row.startedAt), timeZone),
    end: row.endedAt === null ? '' : clockTime(new Date(row.endedAt), timeZone),
    work: {
      clientId: row.clientId,
      clientName: row.clientName,
      projectId: row.projectId,
      projectName: row.projectName,
    },
    note: row.note,
    billable: row.billable,
    running: row.endedAt === null,
  }
}

/**
 * The draft a new entry opens as. The defaults are the ones that cost the
 * fewest keystrokes: the day she is looking at (or today, if that is one of
 * them), a start right after the last entry of that day ended, and the work she
 * was last on — so the common case is a note, an end time and Save.
 */
export function newDraft(
  rows: readonly TimeRow[],
  view: TimeView,
  on: string,
  now: Date,
  timeZone: string,
): Draft {
  const today = wallClock(now, timeZone).day
  const { from, to } = periodOf(view, on)
  const day = today >= from && today <= to ? today : to
  const onDay = rows.filter(
    (row) => wallClock(new Date(row.startedAt), timeZone).day === day && row.endedAt !== null,
  )
  const last = onDay
    .map((row) => row.endedAt as string)
    .sort()
    .at(-1)
  const latest = rows[0]

  return {
    id: null,
    day,
    start: last ? clockTime(new Date(last), timeZone) : '09:00',
    end: '',
    work: {
      clientId: latest?.clientId ?? null,
      clientName: latest?.clientName ?? null,
      projectId: latest?.projectId ?? null,
      projectName: latest?.projectName ?? null,
    },
    note: '',
    billable: (latest?.clientId ?? null) !== null,
    running: false,
  }
}

/** The moment a wall-clock time on a day names, or null if it is not one. */
function momentOf(day: string, time: string, timeZone: string): Date | null {
  if (!HH_MM.test(time)) return null
  return localTimeToInstant(`${day}T${time}`, timeZone)
}

export type Built = { ok: true; command: Command | null } | { ok: false; reason: string }

/**
 * The command a saved draft is, or why it is not one yet. An end earlier than
 * the start is the next morning — a spell worked across midnight is a real
 * thing and reads exactly like this on a wall clock — and everything else about
 * the hours is `decide`'s to allow or refuse.
 */
export function buildCommand(draft: Draft, was: TimeRow | null, timeZone: string): Built {
  const started = momentOf(draft.day, draft.start, timeZone)
  if (!started) return { ok: false, reason: 'Say when it began, as 09:00.' }

  let ended: Date | null = null
  if (!draft.running) {
    if (draft.end === '') return { ok: false, reason: 'Say when it ended, as 10:42.' }
    ended = momentOf(draft.day, draft.end, timeZone)
    if (!ended) return { ok: false, reason: 'Say when it ended, as 10:42.' }
    // Worked past midnight: the end is the next morning's.
    if (ended <= started) ended = momentOf(addDays(draft.day, 1), draft.end, timeZone)
    if (!ended) return { ok: false, reason: 'Say when it ended, as 10:42.' }
  }

  const note = draft.note.trim()
  if (was === null) {
    if (!ended) return { ok: false, reason: 'Say when it ended, as 10:42.' }
    return {
      ok: true,
      command: {
        type: 'timeEntry.add',
        id: crypto.randomUUID(),
        startedAt: started.toISOString(),
        endedAt: ended.toISOString(),
        clientId: draft.work.clientId,
        projectId: draft.work.projectId,
        note,
        billable: draft.billable,
      },
    }
  }

  // Only what changed: an edit of the note must not move the hours, and naming
  // the work at all is what makes billable follow a Client again.
  const edit: Extract<Command, { type: 'timeEntry.edit' }> = {
    type: 'timeEntry.edit',
    entryId: was.id,
  }
  if (started.toISOString() !== was.startedAt) edit.startedAt = started.toISOString()
  if (ended && ended.toISOString() !== was.endedAt) edit.endedAt = ended.toISOString()
  if (note !== was.note) edit.note = note
  if (draft.work.clientId !== was.clientId || draft.work.projectId !== was.projectId) {
    edit.clientId = draft.work.clientId
    edit.projectId = draft.work.projectId
  }
  if (draft.billable !== was.billable) edit.billable = draft.billable

  // Nothing said differently: closing the row is the whole of what happened.
  const said = Object.keys(edit).length > 2
  return { ok: true, command: said ? edit : null }
}
