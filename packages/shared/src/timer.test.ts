import { expect, it } from 'vite-plus/test'
import { localTimeToInstant } from './clock'
import {
  type TimerEntry,
  formatLogged,
  loggedByHour,
  saidAloud,
  sinceWhen,
  stopReceipt,
  timerTitle,
} from './timer'

// What the time header words for itself. The moment is a parameter here as
// everywhere: nothing below reads a clock.

const timeZone = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, timeZone)!
/** Frame 3a's moment: Wednesday 17 Sep 2025, 10:42, 1h 42m into Meridian's synthesis. */
const now = at('2025-09-17T10:42')

function entry(fields: Partial<TimerEntry> = {}): TimerEntry {
  return {
    id: 'entry/wed',
    clientId: 'client/meridian',
    clientName: 'Meridian Health',
    projectId: 'project/discovery',
    projectName: 'Discovery research',
    todoId: null,
    todoTitle: null,
    note: '',
    billable: true,
    startedAt: at('2025-09-17T09:00').toISOString(),
    endedAt: null,
    ...fields,
  }
}

it('says only the time for an entry begun today, and names the day for one that was not', () => {
  expect(sinceWhen(at('2025-09-17T09:00').toISOString(), now, timeZone)).toBe('09:00')
  // A timer left on overnight should look like one.
  expect(sinceWhen(at('2025-09-16T17:20').toISOString(), now, timeZone)).toBe('yesterday 17:20')
  expect(sinceWhen(at('2025-09-14T17:20').toISOString(), now, timeZone)).toBe('Sun 17:20')
  expect(sinceWhen(at('2025-09-03T17:20').toISOString(), now, timeZone)).toBe('Sep 3 17:20')
})

it('owes a receipt naming the hours and who they went to', () => {
  const ended = entry({ endedAt: at('2025-09-17T10:42').toISOString() })
  expect(stopReceipt(ended)).toBe('Stopped · 1h 42m logged to Meridian Health')
  // Work for nobody is Internal, which is the absence of a Client.
  expect(stopReceipt({ ...ended, clientId: null, clientName: null })).toBe(
    'Stopped · 1h 42m logged to Internal',
  )
})

it('puts the hours and the Client in the tab, unpadded, as a tab is read at a glance', () => {
  expect(timerTitle(102 * 60, 'Meridian Health', 'Crazy')).toBe('1:42 · Meridian Health — Crazy')
  expect(timerTitle(7 * 60, null, 'Crazy')).toBe('0:07 · Internal — Crazy')
  expect(timerTitle(10 * 3600, 'Quill & Co', 'Crazy')).toBe('10:00 · Quill & Co — Crazy')
})

it('says the work once when a timer starts and the span once when it stops', () => {
  expect(saidAloud('started', entry())).toBe('Timer started, Meridian Health, Discovery research')
  expect(saidAloud('started', entry({ projectId: null, projectName: null }))).toBe(
    'Timer started, Meridian Health',
  )
  expect(saidAloud('stopped', entry({ endedAt: at('2025-09-17T10:42').toISOString() }))).toBe(
    'Timer stopped, 1 hour 42 minutes',
  )
  expect(saidAloud('stopped', entry({ endedAt: at('2025-09-17T09:01').toISOString() }))).toBe(
    'Timer stopped, 1 minute',
  )
  expect(saidAloud('stopped', entry({ endedAt: at('2025-09-17T11:00').toISOString() }))).toBe(
    'Timer stopped, 2 hours',
  )
})

// ── Tracked time, hour by hour (ticket 19) ──────────────────────────────────

it('counts tracked time into the hours it fell in, the running one up to now and no further', () => {
  const hours = loggedByHour(
    [
      // Twenty minutes of her own before the day began.
      entry({
        id: 'entry/inbox',
        clientId: null,
        clientName: null,
        projectId: null,
        projectName: null,
        billable: false,
        startedAt: at('2025-09-17T08:10').toISOString(),
        endedAt: at('2025-09-17T08:30').toISOString(),
      }),
      // Running since 09:00: 1h 42m, which is one whole hour and 42 minutes of
      // the next, not 1h 42m on the hour it began.
      entry(),
    ],
    now,
    timeZone,
  )

  expect(hours).toEqual([
    { hour: 8, seconds: 20 * 60, clientId: null, clientName: null },
    { hour: 9, seconds: 60 * 60, clientId: 'client/meridian', clientName: 'Meridian Health' },
    { hour: 10, seconds: 42 * 60, clientId: 'client/meridian', clientName: 'Meridian Health' },
  ])
  expect(hours.map((each) => formatLogged(each.seconds))).toEqual(['0:20', '1:00', '0:42'])
})

it('gives an hour to whoever had most of it, and counts nothing from before the day', () => {
  const hours = loggedByHour(
    [
      // Begun yesterday and stopped at 08:40: only this morning's part counts.
      entry({
        id: 'entry/overnight',
        startedAt: at('2025-09-16T22:00').toISOString(),
        endedAt: at('2025-09-17T08:40').toISOString(),
      }),
      entry({
        id: 'entry/quill',
        clientId: 'client/quill',
        clientName: 'Quill & Co',
        startedAt: at('2025-09-17T08:40').toISOString(),
        endedAt: at('2025-09-17T08:55').toISOString(),
      }),
    ],
    now,
    timeZone,
  )

  // The night before is another day: counting starts at midnight.
  expect(hours[0]).toEqual({
    hour: 0,
    seconds: 60 * 60,
    clientId: 'client/meridian',
    clientName: 'Meridian Health',
  })
  expect(hours.reduce((total, each) => total + each.seconds, 0)).toBe((8 * 60 + 55) * 60)
  // The 08:00 hour held 40 minutes of Meridian's and 15 of Quill's, so it is Meridian's.
  expect(hours.at(-1)).toEqual({
    hour: 8,
    seconds: 55 * 60,
    clientId: 'client/meridian',
    clientName: 'Meridian Health',
  })
})
