import { addDays, localTimeToInstant, startOfWeek, viewWeek } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, persistOps, seedPersona } from '../write'
import { readWeek } from './week'

// Frame 1c's moment: the same Wednesday 17 Sep 2025, 08:41 the Today screen
// shows, in the middle of week 38.
const timeZone = 'America/Chicago'
const at = (local: string, zone = timeZone) => localTimeToInstant(local, zone)!
const now = at('2025-09-17T08:41')
const userId = 'user_ryan_week'

/** The week as D1 holds it, and what the Week screen derives from it. */
async function week(moment = now, user = userId, zone = timeZone) {
  const held = await readWeek(createReadDb(env.DB), user, moment, zone)
  return { ...held, ...viewWeek(held) }
}

/** A user of their own, seeded at a moment, and the week they then see. */
async function seedAt(user: string, moment: Date, zone = timeZone) {
  await seedPersona(createDb(env.DB), {
    persona: 'ryan',
    userId: user,
    now: moment,
    timeZone: zone,
  })
  return week(moment, user, zone)
}

beforeAll(async () => {
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId, now, timeZone })
})

it('heads the week the way frame 1c heads it', async () => {
  expect((await week()).line).toBe('Week 38 · 15–21 Sep · day 3 of 5')
})

it("reads the Week brief written for the week's Monday", async () => {
  expect((await week()).brief?.body).toMatch(/^You're on track for the auth migration milestone/)
})

it('counts the week in numbers from the Todos, done of planned, focus and carried over', async () => {
  const { done, planned, focusHours, carriedOver } = await week()

  // Six Todos finished on Monday and five on Tuesday, of the 27 the week holds.
  expect([done, planned]).toEqual([11, 27])
  // The hours those eleven were estimated at: three and a half, then three.
  expect(focusHours).toBe(6.5)
  // Three carried into today, and the one Monday carried into Tuesday.
  expect(carriedOver).toBe(4)
})

it('counts each day: what it finished, what it holds, and its meetings', async () => {
  const { days } = await week()

  expect(
    days.map((day) => [day.name, day.counts.done, day.counts.planned, day.counts.meetings]),
  ).toEqual([
    ['Mon', 6, 0, 2],
    ['Tue', 5, 0, 3],
    ['Wed', 0, 7, 3],
    ['Thu', 0, 4, 1],
    ['Fri', 0, 3, 2],
    ['Sat', 0, 1, 0],
    ['Sun', 0, 1, 0],
  ])
  // Every bar is drawn to one scale, so the week's largest count is a full one.
  expect(days[2]?.share.planned).toBe(1)
  expect(days[0]?.share.done).toBe(6 / 7)
  expect(days.filter((day) => day.isToday).map((day) => day.name)).toEqual(['Wed'])
})

it('captions each day as frame 1c captions it, figures first', async () => {
  const { days } = await week()

  expect(days.map((day) => day.caption)).toEqual([
    '6 done · 3.5h focus',
    '5 of 7 · 2 carried',
    'today · 7 planned',
    '4 planned · Q4 held',
    'milestone · Sam out',
    'personal',
    'personal',
  ])
})

it("says each day's things in Crazy's words, and how long one has been carried", async () => {
  const { days } = await week()

  expect(days.map((day) => day.lines.map((line) => line.text))).toEqual([
    ['Kickoff auth milestone', 'Q4 doc outline'],
    ['Rotate KV secret', "Sam's PR (carried)"],
    ['Session spike', 'Design review 14:00', '1:1 Devon'],
    ['Q4 doc: sections 2–3', 'Runbook to Design'],
    ['Auth migration milestone', 'Movers deposit'],
    ['Long run · 16 km'],
    ['Pack kitchen'],
  ])
})

it('lists where Ryan ties in, one card per Project that needs him this week', async () => {
  const { tieIns } = await week()

  expect(tieIns.map((tieIn) => [tieIn.project, tieIn.when])).toEqual([
    ['Auth migration', 'Milestone Fri'],
    ['Onboarding redesign', 'Review today 14:00'],
    ['Q4 planning', 'Thu morning held'],
    ['Apartment move', 'Fri · 1 Oct'],
  ])
  expect(tieIns[0]?.text).toBe('You own the spike and the runbook; Priya is blocked on both.')
})

it('reads only the rows of the user asking', async () => {
  const other = await week(now, 'user_someone_else')

  expect(other).toMatchObject({ brief: null, todos: [], meetings: [], lines: [], tieIns: [] })
  expect([other.done, other.planned, other.focusHours, other.carriedOver]).toEqual([0, 0, 0, 0])
  expect(other.days.every((day) => day.caption === null)).toBe(true)
})

it('plans a Todo typed in today for today, and keeps the total when it is ticked', async () => {
  const user = 'user_week_adder'
  const db = createDb(env.DB)
  const before = await seedAt(user, now)
  // Typed in, the way the command seam adds one: a One-off with no Slot.
  await persistOps(db, user, [
    {
      type: 'todo.insert',
      todo: {
        id: `${user}/todo/typed-in`,
        title: 'Book the meeting room',
        state: 'today',
        source: null,
        createdAt: now.toISOString(),
        touchedAt: now.toISOString(),
      },
    },
  ])

  // It has no Slot and no Project: it is still work this week is holding.
  const added = await week(now, user)
  expect([added.done, added.planned]).toEqual([before.done, before.planned + 1])
  expect(added.days[2]?.counts.planned).toBe((before.days[2]?.counts.planned ?? 0) + 1)

  await persistOps(db, user, [
    {
      type: 'todo.set',
      id: `${user}/todo/typed-in`,
      set: { state: 'done', doneAt: now.toISOString() },
    },
  ])
  const ticked = await week(now, user)
  expect([ticked.done, ticked.planned]).toEqual([before.done + 1, before.planned + 1])
  // Today's caption follows the Todos, so it never says what is no longer true.
  expect(ticked.days[2]?.caption).toBe('today · 7 planned')
})

it('still counts a snoozed Todo as planned: a snooze is a day thing, not a week one', async () => {
  const user = 'user_week_snoozer'
  const db = createDb(env.DB)
  const before = await seedAt(user, now)
  const spike = before.todos.find((todo) => todo.state === 'today')

  await persistOps(db, user, [
    {
      type: 'todo.set',
      id: spike!.id,
      set: { snoozedUntil: at('2025-09-17T15:00').toISOString() },
    },
  ])

  // Snoozing drops a Todo out of today's stack; the week still holds it.
  const after = await week(now, user)
  expect([after.done, after.planned]).toEqual([before.done, before.planned])
  expect(after.days[2]?.counts.planned).toBe(before.days[2]?.counts.planned)
})

it('takes a worded Todo off a day when it leaves it', async () => {
  const user = 'user_week_worder'
  const db = createDb(env.DB)
  const before = await seedAt(user, now)
  const thursday = addDays(startOfWeek('2025-09-17'), 3)
  expect(before.days[3]?.lines.map((line) => line.text)).toContain('Runbook to Design')

  // Finished a day early: it is Wednesday's work now, and Thursday stops saying it.
  await persistOps(db, user, [
    {
      type: 'todo.set',
      id: `${user}/todo/thu-runbook-to-design`,
      set: { state: 'done', doneAt: now.toISOString() },
    },
  ])

  const after = await week(now, user)
  expect(after.days[3]?.day).toBe(thursday)
  expect(after.days[3]?.lines.map((line) => line.text)).toEqual(['Q4 doc: sections 2–3'])
  expect(after.days[3]?.caption).toBe('3 planned · Q4 held')
})

it('shows no tie-in and no Week brief in a week Crazy has not written about', async () => {
  const next = await week(at('2025-09-24T08:41'))

  expect(next.line).toBe('Week 39 · 22–28 Sep · day 3 of 5')
  expect([next.brief, next.tieIns, next.lines, next.notes]).toEqual([null, [], [], []])
  // Only what is genuinely in that week: today's stack, which moves with today.
  expect(next.done).toBe(0)
  expect(next.days.map((day) => day.counts.planned)).toEqual([0, 0, 7, 0, 0, 0, 0])
})

it('lays the persona on the week it is seeded in, whatever weekday that is', async () => {
  for (const [user, moment, line, todayIndex] of [
    ['user_week_monday', at('2025-09-15T08:41'), 'Week 38 · 15–21 Sep · day 1 of 5', 0],
    ['user_week_friday', at('2025-09-19T08:41'), 'Week 38 · 15–21 Sep · day 5 of 5', 4],
    ['user_week_sunday', at('2025-09-21T08:41'), 'Week 38 · 15–21 Sep · the weekend', 6],
  ] as const) {
    const held = await seedAt(user, moment)

    expect(held.line).toBe(line)
    expect(held.days[todayIndex]?.isToday).toBe(true)
    // Today is always the Today screen's own day: its seven Todos, planned.
    expect(held.days[todayIndex]?.counts.planned).toBe(7)
    expect(held.days[todayIndex]?.caption).toBe('today · 7 planned')
    // Nothing is finished in the future, and the week's work is on its work days.
    expect(
      held.days.filter((day) => day.day > held.day).every((day) => day.counts.done === 0),
    ).toBe(true)
    expect(held.done).toBeLessThanOrEqual(held.planned)
    // The week's meetings are on its working days. (Today keeps frame 1a's
    // three wherever today falls, the weekend included.)
    expect(held.days.slice(5).every((day) => day.isToday || day.counts.meetings === 0)).toBe(true)
    // Every working day of the week says something.
    expect(held.days.slice(0, 5).every((day) => day.caption !== null)).toBe(true)
  }
})

it('keeps a week whose clocks change whole, at both ends', async () => {
  // Wednesdays in the weeks the United States and Europe change their clocks:
  // the week of 27 Oct 2025 ends on the Sunday the clocks went back, and the
  // week of 24 Mar 2025 ends on the Sunday they went forward in Europe.
  for (const [user, moment, zone, line] of [
    ['user_ryan_autumn', at('2025-10-29T08:41'), timeZone, 'Week 44 · 27 Oct – 2 Nov · day 3 of 5'],
    [
      'user_ryan_spring',
      at('2025-03-26T08:41', 'Europe/London'),
      'Europe/London',
      'Week 13 · 24–30 Mar · day 3 of 5',
    ],
  ] as const) {
    const held = await seedAt(user, moment, zone)

    expect(held.line).toBe(line)
    expect([held.done, held.planned, held.focusHours, held.carriedOver]).toEqual([11, 27, 6.5, 4])
    // The Sunday the clocks change still holds what was planned on it.
    expect(held.days[6]?.counts.planned).toBe(1)
    expect(held.days.map((day) => day.caption).filter(Boolean)).toHaveLength(7)
  }
})
