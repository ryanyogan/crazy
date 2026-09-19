import { clientTerms, localTimeToInstant, viewTimer } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, seedPersona } from '../write'
import { readTimer, readTimerAndPicker, readTimerPicker, readWeekByClient } from './timer'

// Frame 3a's moment: Wednesday 17 Sep 2025, 10:42 on Cori's wall clock, 1h 42m
// into Meridian's synthesis.
const timeZone = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, timeZone)!
const now = at('2025-09-17T10:42')
const userId = 'user_cori_timer'

const timer = () => readTimer(createReadDb(env.DB), userId, now, timeZone)

beforeAll(async () => {
  await seedPersona(createDb(env.DB), { persona: 'cori', userId, now, timeZone })
})

it("counts today's hours and the running Client's share of them, as of the moment asked", async () => {
  const bar = await timer()

  expect(bar.running).toMatchObject({
    clientName: 'Meridian Health',
    projectName: 'Discovery research',
    billable: true,
    endedAt: null,
  })
  expect(bar.running?.startedAt).toBe(at('2025-09-17T09:00').toISOString())

  // Twenty minutes of her own at 08:10, and 1h 42m of Meridian's since 09:00.
  const view = viewTimer(bar, now, timeZone)
  expect(view.elapsed).toBe(102 * 60)
  expect(view.todaySeconds).toBe((20 + 102) * 60)
  expect(view.clientSeconds).toBe(102 * 60)
})

it('preselects the last entry once the timer has stopped, and guesses nothing', async () => {
  await seedPersona(createDb(env.DB), { persona: 'cori', userId, now, timeZone, timer: 'idle' })
  const bar = await timer()

  expect(bar.running).toBe(null)
  expect(viewTimer(bar, now, timeZone).preselected).toEqual({
    clientId: bar.last?.clientId,
    clientName: 'Meridian Health',
    projectId: bar.last?.projectId,
    projectName: 'Discovery research',
  })
})

it("groups the picker's Projects under their Clients, with this week's hours", async () => {
  await seedPersona(createDb(env.DB), { persona: 'cori', userId, now, timeZone })
  const picker = await readTimerPicker(createReadDb(env.DB), userId, now, timeZone)

  // The order they were added, which is the order frame 3a draws them, and
  // Internal last: it is the absence of a Client, not a Client of its own.
  expect(picker.clients.map((client) => client.name)).toEqual([
    'Meridian Health',
    'Quill & Co',
    'Bramble',
    'Internal',
  ])
  expect(picker.clients.at(-1)?.id).toBe(null)
  expect(picker.clients.at(-1)?.projects.map((project) => project.name)).toEqual(['Admin'])

  // Since Monday, counted no further than the moment asked: Meridian's 4h 15m
  // on Monday, 3h on Tuesday and the 1h 42m still running.
  const hours = (name: string) => picker.clients.find((client) => client.name === name)?.weekSeconds
  expect(hours('Meridian Health')).toBe((4 * 60 + 15 + 3 * 60 + 102) * 60)
  expect(hours('Quill & Co')).toBe(105 * 60)
  expect(hours('Bramble')).toBe(150 * 60)
  // Her own: forty minutes on a call on Tuesday, twenty on the inbox today.
  expect(hours('Internal')).toBe(60 * 60)

  const discovery = picker.clients[0]?.projects.find((each) => each.name === 'Discovery research')
  expect(discovery?.running).toBe(true)
  // The work already running is what the bar says; the recents are where else she has been.
  expect(picker.recent.map((work) => work.projectName)).toEqual([
    null,
    'Onboarding v3',
    'Checkout redesign',
  ])
})

it('reads the bar and the picker together for the Shell, and nothing at all with Billing off', async () => {
  const db = createReadDb(env.DB)
  // One query for both, because the header follows a running entry onto every
  // screen and must not disagree with the bar it stands in for (ticket 27).
  const on = await readTimerAndPicker(db, userId, now, timeZone, true)
  expect(on.timer?.running).toMatchObject({ clientName: 'Meridian Health' })
  expect(on.picker?.clients.map((client) => client.name)).toContain('Quill & Co')

  // With the Billing module off there is no timer and nothing to choose work
  // for, so nothing is read.
  expect(await readTimerAndPicker(db, userId, now, timeZone, false)).toEqual({
    timer: null,
    picker: null,
    week: [],
  })
})

it("counts the week by Client, most hours first, with Internal last and the month's terms", async () => {
  await seedPersona(createDb(env.DB), { persona: 'cori', userId, now, timeZone })
  const week = await readWeekByClient(createReadDb(env.DB), userId, now, timeZone)

  // Monday to now: Meridian 4h 15m + 3h + the running 1h 42m; Bramble 2h 30m;
  // Quill 1h 45m; and an hour of her own between a call and the inbox.
  expect(week.map((client) => [client.name, client.weekSeconds / 60])).toEqual([
    ['Meridian Health', 4 * 60 + 15 + 180 + 102],
    ['Bramble', 150],
    ['Quill & Co', 105],
    ['Internal', 60],
  ])
  // Internal is the absence of a Client: it has no terms and no colour of its own.
  expect(week.at(-1)).toMatchObject({ clientId: null, arrangement: null, order: null })
  // The running entry is counted up to the moment asked and no further.
  expect(clientTerms(week[0]!)).toBe('Project fee · 27h 57m of 40h budget')
  expect(clientTerms(week[1]!)).toBe('Retainer · 20h/mo, 2h 10m left')
  expect(clientTerms(week[2]!)).toBe('Hourly · $190/h')
  expect(clientTerms(week[3]!)).toBe('Not billed')
})
