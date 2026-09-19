import { expect, it } from 'vite-plus/test'
import { localTimeToInstant } from './clock'
import { apply } from './command'
import {
  type TimeRead,
  type TimeRow,
  decimalHours,
  periodOf,
  periodStep,
  suggestionLine,
  viewTime,
  whenLabel,
} from './time'

// Cori's week, as frame 2b's timesheet has it: Wednesday 17 Sep 2025, 10:42 on
// her wall clock. Nothing here reads a clock; the moment comes in.

const ZONE = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, ZONE)!
const NOW = at('2025-09-17T10:42')

const MERIDIAN = { id: 'client/meridian', name: 'Meridian Health', code: 'MER' }
const QUILL = { id: 'client/quill', name: 'Quill & Co', code: 'QUI' }

function row(
  id: string,
  from: string,
  until: string | null,
  fields: Partial<TimeRow> = {},
): TimeRow {
  return {
    id,
    clientId: MERIDIAN.id,
    clientName: MERIDIAN.name,
    projectId: 'project/discovery',
    projectName: 'Discovery research',
    note: '',
    billable: true,
    startedAt: at(from).toISOString(),
    endedAt: until === null ? null : at(until).toISOString(),
    suggestedClientId: null,
    suggestedClientName: null,
    suggestedProjectId: null,
    suggestedProjectName: null,
    ...fields,
  }
}

const read = (rows: TimeRow[], fields: Partial<TimeRead> = {}): TimeRead => ({
  view: 'week',
  on: '2025-09-17',
  from: '2025-09-15',
  to: '2025-09-21',
  rows,
  clients: [MERIDIAN, QUILL],
  projects: [{ id: 'project/discovery', name: 'Discovery research', clientId: MERIDIAN.id }],
  ...fields,
})

it('groups the week by day and counts the running entry no further than now', () => {
  const screen = viewTime(
    read([
      row('wed-run', '2025-09-17T09:00', null),
      row('tue', '2025-09-16T09:00', '2025-09-16T12:00'),
      row('mon', '2025-09-15T09:00', '2025-09-15T13:15'),
    ]),
    NOW,
    ZONE,
  )

  // Monday to Friday, and the running entry counted to 10:42 and no further.
  expect(screen.cards.map((card) => [card.name, card.seconds])).toEqual([
    ['Mon', 4.25 * 3600],
    ['Tue', 3 * 3600],
    ['Wed', 102 * 60],
    ['Thu', 0],
    ['Fri', 0],
  ])
  expect(screen.totals.seconds).toBe((4.25 + 3) * 3600 + 102 * 60)
  expect(screen.cards[2]?.today).toBe(true)
  expect(screen.cards[2]?.note).toBe('today · running')
})

it('counts a spell worked across midnight into each day it fell in', () => {
  const screen = viewTime(read([row('late', '2025-09-15T22:00', '2025-09-16T01:30')]), NOW, ZONE)

  expect(screen.cards[0]?.seconds).toBe(2 * 3600)
  expect(screen.cards[1]?.seconds).toBe(1.5 * 3600)
  // The day it began is the day it is listed on, and its hours are the whole spell.
  expect(screen.totals.seconds).toBe(3.5 * 3600)
  expect(decimalHours(3.5 * 3600)).toBe('3.50')
})

it('says how many entries still need a Client, and who Crazy thinks they were for', () => {
  const untagged = (id: string, from: string, until: string) =>
    row(id, from, until, {
      clientId: null,
      clientName: null,
      projectId: null,
      projectName: null,
      billable: false,
      suggestedClientId: QUILL.id,
      suggestedClientName: QUILL.name,
    })
  const screen = viewTime(
    read([
      row('wed', '2025-09-17T09:00', '2025-09-17T10:42'),
      untagged('inbox', '2025-09-17T08:10', '2025-09-17T08:30'),
      untagged('call', '2025-09-16T14:00', '2025-09-16T14:40'),
    ]),
    NOW,
    ZONE,
  )

  expect(screen.totals.noClient).toBe(2)
  expect(screen.flag).toBe('2 entries need a Client')
  // Oldest first, as the sentence reads them off the week.
  expect(screen.suggestion).toBe(
    'Tue 14:00–14:40 and Wed 08:10–08:30 were tracked to Internal. I think both were Quill & Co; tap to confirm.',
  )
  expect(screen.totals.billableSeconds).toBe(102 * 60)
  expect(screen.totals.notBillableSeconds).toBe(60 * 60)
})

it('says what to do where it has nothing to suggest', () => {
  const none = row('call', '2025-09-16T14:00', '2025-09-16T14:40', {
    clientId: null,
    clientName: null,
  })
  expect(suggestionLine([none], ZONE)).toBe(
    'Tue 14:00–14:40 was tracked to Internal. Give each a Client so the hours can be billed.',
  )
})

it('moves the totals the moment an edit is laid over the rows', () => {
  const held = { time: read([row('mon', '2025-09-15T09:00', '2025-09-15T13:15')]), timeZone: ZONE }
  const after = apply(held, [
    { type: 'timeEntry.set', id: 'mon', set: { endedAt: at('2025-09-15T12:00').toISOString() } },
  ])

  expect(viewTime(after.time, NOW, ZONE).totals.seconds).toBe(3 * 3600)
  expect(viewTime(after.time, NOW, ZONE).cards[0]?.seconds).toBe(3 * 3600)
})

it('takes a period from the day it is anchored on, and steps through them', () => {
  expect(periodOf('day', '2025-09-17')).toEqual({ from: '2025-09-17', to: '2025-09-17' })
  expect(periodOf('week', '2025-09-17')).toEqual({ from: '2025-09-15', to: '2025-09-21' })
  expect(periodOf('month', '2025-09-17')).toEqual({ from: '2025-09-01', to: '2025-09-30' })

  expect(periodStep('week', '2025-09-17', -1)).toBe('2025-09-08')
  expect(periodStep('month', '2025-01-31', 1)).toBe('2025-02-01')
  expect(periodStep('day', '2025-09-17', 1)).toBe('2025-09-18')
})

it('says when an entry was in the words the period has room for', () => {
  const running = row('wed', '2025-09-17T09:00', null)
  expect(whenLabel(running, 'day', ZONE)).toBe('09:00–')
  expect(whenLabel(running, 'week', ZONE)).toBe('Wed 09:00–')
  expect(whenLabel(running, 'month', ZONE)).toBe('Wed 17 09:00–')
  expect(whenLabel(row('wed', '2025-09-17T08:10', '2025-09-17T08:30'), 'week', ZONE)).toBe(
    'Wed 08:10',
  )
})
