import { localTimeToInstant, viewTime } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, seedPersona } from '../write'
import { readTime } from './time'

// Frame 2b's moment: Wednesday 17 Sep 2025, 10:42 on Cori's wall clock, with
// frame 2b's timesheet behind it.
const timeZone = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, timeZone)!
const now = at('2025-09-17T10:42')
const userId = 'user_cori_time'

const read = (view: 'day' | 'week' | 'month', on?: string) =>
  readTime(createReadDb(env.DB), userId, now, timeZone, view, on)

beforeAll(async () => {
  await seedPersona(createDb(env.DB), { persona: 'cori', userId, now, timeZone })
})

it('reads the week Monday to Sunday and groups it by the user local day', async () => {
  const period = await read('week')
  expect({ from: period.from, to: period.to }).toEqual({ from: '2025-09-15', to: '2025-09-21' })

  const screen = viewTime(period, now, timeZone)
  // Frame 2b's seven rows, newest first.
  expect(screen.rows.map((row) => row.note)).toEqual([
    'Research synthesis · interviews 4–7',
    'Inbox, proposal tweak',
    'Wireframes, states 1–6',
    'Call · no notes',
    'Interviews 2–3, notes',
    'Stakeholder review + follow-ups',
    'Interview 1, synthesis setup',
  ])

  // Monday 4.25 + 1.75, Tuesday 3 + 0.67 + 2.5, Wednesday 0.33 + the running
  // 1.70, counted to the moment asked and no further.
  expect(screen.cards.map((card) => [card.name, card.seconds])).toEqual([
    ['Mon', 6 * 3600],
    ['Tue', (3 * 60 + 40 + 2.5 * 60) * 60],
    ['Wed', (20 + 102) * 60],
    ['Thu', 0],
    ['Fri', 0],
  ])
  expect(screen.totals.seconds).toBe(screen.cards.reduce((total, card) => total + card.seconds, 0))
})

it('flags the entries that name no Client, with the Client Crazy suggested', async () => {
  const screen = viewTime(await read('week'), now, timeZone)

  expect(screen.totals.noClient).toBe(2)
  expect(screen.flag).toBe('2 entries need a Client')
  expect(screen.suggestion).toBe(
    'Tue 14:00–14:40 and Wed 08:10–08:30 were tracked to Internal. I think both were Quill & Co; tap to confirm.',
  )
  // Billable follows from having a Client, until she says otherwise.
  expect(screen.totals.billableSeconds + screen.totals.notBillableSeconds).toBe(
    screen.totals.seconds,
  )
  expect(screen.totals.notBillableSeconds).toBe((20 + 40) * 60)
})

it('counts a spell that crossed the local midnight into each day it fell in', async () => {
  const db = createDb(env.DB)
  await db.timeEntry.create({
    data: {
      id: `${userId}/entry/late`,
      userId,
      clientId: null,
      projectId: null,
      todoId: null,
      note: 'Late edit',
      billable: false,
      // 22:00 Sunday to 01:30 Monday, on her wall clock: two hours of one day
      // and an hour and a half of the next.
      startedAt: at('2025-09-14T22:00'),
      endedAt: at('2025-09-15T01:30'),
      createdAt: at('2025-09-14T22:00'),
    },
  })

  const week = viewTime(await read('week'), now, timeZone)
  // The week begins on Monday, so only the part inside it is counted.
  expect(week.cards[0]?.seconds).toBe(6 * 3600 + 1.5 * 3600)

  // The week before it ends on Sunday, which is where the other two hours fell.
  const period = await read('week', '2025-09-08')
  expect({ from: period.from, to: period.to }).toEqual({ from: '2025-09-08', to: '2025-09-14' })
  const before = viewTime(period, now, timeZone)
  expect(before.cards.at(-1)?.seconds).toBe(2 * 3600)

  await db.timeEntry.deleteMany({ where: { id: `${userId}/entry/late` } })
})

it('reads a day and a month by their own bounds', async () => {
  const day = await read('day')
  expect({ from: day.from, to: day.to }).toEqual({ from: '2025-09-17', to: '2025-09-17' })
  expect(day.rows).toHaveLength(2)

  const month = await read('month')
  expect({ from: month.from, to: month.to }).toEqual({ from: '2025-09-01', to: '2025-09-30' })
  // The month is drawn week by week, however long it is.
  const screen = viewTime(month, now, timeZone)
  expect(screen.cards.map((card) => card.name)).toEqual(['W36', 'W37', 'W38', 'W39', 'W40'])
  expect(screen.totals.seconds).toBe(screen.cards.reduce((total, card) => total + card.seconds, 0))
})
