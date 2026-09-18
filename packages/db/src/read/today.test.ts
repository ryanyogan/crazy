import { formatAge, localTimeToInstant, viewToday } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, persistOps, seedPersona } from '../write'
import { readToday } from './today'

// Frame 1a's moment: Wednesday 17 Sep 2025, 08:41 on Ryan's wall clock.
const timeZone = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, timeZone)!
const now = at('2025-09-17T08:41')
const userId = 'user_ryan'

/** The day as D1 holds it, and what the Today screen derives from it at that moment. */
async function today(moment = now, user = userId) {
  const day = await readToday(createReadDb(env.DB), user, moment, timeZone)
  return { ...day, ...viewToday(day, moment, timeZone) }
}

beforeAll(async () => {
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId, now, timeZone })
})

it('shows Ryan the Priority stack frame 1a draws, in its order', async () => {
  const { stack } = await today()

  expect(stack.map((todo) => [todo.title, todo.project, todo.estimateMinutes])).toEqual([
    ['Finish Cloudflare session-token spike', 'Auth migration', 120],
    ['Reply to Priya on edge rate limits', 'Auth migration', 15],
    ["Review Sam's onboarding PR", 'Onboarding redesign', 45],
    ['Draft Q4 priorities, section 2', 'Q4 planning', 60],
    ['Prep 1:1 notes for Devon', null, 20],
    ['Send movers deposit', 'Apartment move', 5],
    ['Book dentist', null, 5],
  ])
  expect(stack.every((todo) => todo.reason)).toBe(true)
})

it('takes the session-token spike on now, for 09:00 to 11:00', async () => {
  const { takeOnNow } = await today()

  expect(takeOnNow?.todo).toMatchObject({
    title: 'Finish Cloudflare session-token spike',
    project: 'Auth migration',
    estimateMinutes: 120,
    energy: 'deep_focus',
    reason: "unblocks Priya and Friday's milestone",
    source: { kind: 'linear_issue', ref: 'HAL-212' },
  })
  expect(takeOnNow?.hours).toEqual({ from: 9, until: 11 })
})

it('gives a Todo from a Provider its Source, and a typed-in Todo none', async () => {
  const { stack } = await today()

  expect(stack.map((todo) => todo.source?.kind ?? null)).toEqual([
    'linear_issue',
    'slack_message',
    'linear_issue',
    'notion_page',
    'calendar_event',
    'gmail_message',
    null,
  ])
})

it('counts what the last Rollover carried over and what it sent back', async () => {
  const { stack, carriedOver, sentBack } = await today()

  expect(carriedOver).toBe(3)
  expect(sentBack).toBe(1)
  expect(stack.filter((todo) => todo.carryCount > 0).map((todo) => todo.carryCount)).toEqual([
    1, 2, 1,
  ])
})

it("reads the Brief written for the user's day", async () => {
  expect((await today()).brief?.body).toMatch(/^You've got a lighter morning than usual/)
  // Thursday has no Brief yet, and Wednesday's Rollover is no longer the last one.
  const thursday = await today(at('2025-09-18T08:41'))
  expect(thursday.brief).toBeNull()
  expect(thursday.sentBack).toBe(0)
})

it('reads only the rows of the user asking', async () => {
  expect(await today(now, 'user_someone_else')).toMatchObject({
    brief: null,
    takeOnNow: null,
    stack: [],
    carriedOver: 0,
    sentBack: 0,
    events: [],
    hours: [],
    signals: [],
    snoozed: [],
  })
})

it('draws the day frame 1a draws: three meetings, focus blocks, Slots and a free first hour', async () => {
  const { timeline, meetings } = await today()

  expect(meetings).toBe(3)
  expect(timeline.map(({ hour, kind, title }) => [hour, kind, title])).toEqual([
    [8, 'free', 'Brief · inbox skim'],
    [9, 'focus', 'Finish Cloudflare session-token spike'],
    [10, 'focus', '↳ spike continues'],
    [11, 'meeting', 'Platform standup'],
    [12, 'slotted', 'Reply to Priya · book dentist'],
    [13, 'focus', "Review Sam's onboarding PR"],
    [14, 'meeting', 'Onboarding design review'],
    [15, 'focus', 'Draft Q4 priorities · section 2'],
    [16, 'meeting', 'Prep notes · 1:1 with Devon 16:30'],
    [17, 'slotted', 'Send movers deposit · follow-ups'],
  ])
  expect(timeline[1]).toMatchObject({ note: 'deep focus · HAL-212', source: 'linear_issue' })
})

it("places a meeting on the user's wall clock, whatever zone the server is in", async () => {
  const { events } = await today()
  expect(events.find((event) => event.title === '1:1 with Devon')).toMatchObject({
    kind: 'meeting',
    from: 16 * 60 + 30,
    until: 17 * 60,
  })
})

it('lists who is waiting on Ryan, newest first, and knows which Mention he already added', async () => {
  const { signals, stack } = await today()

  expect(
    signals.map((mention) => [
      mention.who,
      formatAge(new Date(mention.at), now),
      mention.source.kind,
    ]),
  ).toEqual([
    ['Priya', '17h', 'slack_message'],
    ['Devon', '1d', 'notion_page'],
    ['Sam', '1d', 'linear_issue'],
    ['Northside Movers', '2d', 'gmail_message'],
  ])
  const reply = stack.find((todo) => todo.title === 'Reply to Priya on edge rate limits')!
  expect(signals.map((mention) => mention.todoId)).toEqual([reply.id, null, null, null])
})

it("leaves yesterday's meetings and wording off today's timeline", async () => {
  const thursday = await today(at('2025-09-18T08:41'))
  // Thursday holds a meeting of its own (the week the Week screen draws);
  // Wednesday's three and its hour-by-hour wording are not on it.
  expect(thursday.events.map((event) => event.title)).toEqual(['Onboarding v2 ship review'])
  expect(thursday.hours).toEqual([])
  expect(thursday.meetings).toBe(1)
})

it('puts the same content back when the persona is seeded again', async () => {
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId, now, timeZone })
  expect((await today()).stack).toHaveLength(7)
})

it('lays the persona over an early hour with nothing recorded as touched later in the day', async () => {
  const user = 'user_early_riser'
  const early = at('2025-09-17T06:30')
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId: user, now: early, timeZone })

  const { stack, meetings } = await today(early, user)

  expect(stack).toHaveLength(7)
  const ahead = stack
    .flatMap((todo) => [todo.createdAt, todo.touchedAt])
    .filter((stamp) => new Date(stamp) > early)
  expect(ahead).toEqual([])
  // The day itself is still to come, and it is left where the mockups draw it.
  expect(meetings).toBe(3)
})

/** Seeds a user of their own and snoozes one of their stack's Todos until a given moment. */
async function snoozeUntil(user: string, title: string, until: Date) {
  const db = createDb(env.DB)
  await seedPersona(db, { persona: 'ryan', userId: user, now, timeZone })
  const { stack } = await today(now, user)
  const todo = stack.find((each) => each.title === title)!
  await persistOps(db, user, [
    { type: 'todo.set', id: todo.id, set: { snoozedUntil: until.toISOString() } },
  ])
  return todo
}

it('reads a Todo snoozed until later today out of the Priority stack, and lists it as snoozed', async () => {
  const user = 'user_snoozer'
  const until = at('2025-09-17T11:30')
  const spike = await snoozeUntil(user, 'Finish Cloudflare session-token spike', until)

  const { stack, snoozed, takeOnNow } = await today(now, user)

  expect(stack.map((todo) => todo.title)).not.toContain(spike.title)
  expect(stack).toHaveLength(6)
  expect(snoozed.map((todo) => [todo.title, todo.snoozedUntil])).toEqual([
    [spike.title, until.toISOString()],
  ])
  // The Take on now is the top of what is left, never the snoozed Todo.
  expect(takeOnNow?.todo.title).toBe('Reply to Priya on edge rate limits')
})

it('has a Todo whose snooze has ended back in the Priority stack', async () => {
  const user = 'user_waker'
  const spike = await snoozeUntil(
    user,
    'Finish Cloudflare session-token spike',
    at('2025-09-17T09:30'),
  )

  const { stack, snoozed, takeOnNow } = await today(at('2025-09-17T09:31'), user)

  expect(stack[0]?.title).toBe(spike.title)
  expect(stack).toHaveLength(7)
  expect(snoozed).toEqual([])
  expect(takeOnNow?.todo.title).toBe(spike.title)
})

it('reads the hour of a snoozed Todo as free, and gives it back its words when the snooze ends', async () => {
  const user = 'user_slot_snoozer'
  const until = at('2025-09-17T18:00')
  await snoozeUntil(user, 'Send movers deposit', until)

  // The stack the timeline is drawn from leaves out a snoozed Todo, so 17:00
  // holds nothing: it is dashed, and worded as the free hour it now is rather
  // than by the plan Crazy wrote for the Todo that is asleep.
  const asleep = await today(now, user)
  expect(asleep.timeline.find((hour) => hour.hour === 17)).toMatchObject({
    kind: 'free',
    title: 'Free',
    source: null,
  })

  // Nothing was thrown away: the Todo returns to the hour Crazy planned for it.
  const awake = await today(new Date(until.getTime() + 60_000), user)
  expect(awake.timeline.find((hour) => hour.hour === 17)).toMatchObject({
    kind: 'slotted',
    title: 'Send movers deposit · follow-ups',
  })
})

/** The day, as the user's wall clock names it: what a Slot falls on. */
const day = '2025-09-17'

/** Gives a Todo the hours named, as the Coordinator does when a Slot is set. */
async function slotAt(user: string, todoId: string, hours: number[]) {
  await persistOps(createDb(env.DB), user, [
    { type: 'slot.set', todoId, day, hours, at: now.toISOString() },
    { type: 'todo.set', id: todoId, set: { touchedAt: now.toISOString() } },
  ])
}

it('moves a Todo to another hour, and words both hours from what they now hold', async () => {
  const user = 'user_planner'
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId: user, now, timeZone })
  const deposit = (await today(now, user)).stack.find(
    (each) => each.title === 'Send movers deposit',
  )!
  expect(deposit.slotHours).toEqual([17])

  // The deposit dragged from 17:00 to 08:00.
  await slotAt(user, deposit.id, [8])

  const { stack, timeline } = await today(now, user)
  expect(stack.find((each) => each.id === deposit.id)?.slotHours).toEqual([8])
  // Crazy worded 08:00 for an hour with nothing on it and 17:00 for the deposit;
  // neither describes its hour now, so both hours are worded by what they hold.
  expect(timeline.find((hour) => hour.hour === 8)).toMatchObject({
    kind: 'slotted',
    title: 'Send movers deposit',
  })
  expect(timeline.find((hour) => hour.hour === 17)).toMatchObject({ kind: 'free', title: 'Free' })
  // Another user's day is untouched: their 17:00 still says what Crazy wrote.
  expect((await today()).timeline.find((hour) => hour.hour === 17)?.title).toBe(
    'Send movers deposit · follow-ups',
  )
})

it("puts Crazy's words back when a Todo is moved away and then back again", async () => {
  const user = 'user_returner'
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId: user, now, timeZone })
  const deposit = (await today(now, user)).stack.find(
    (each) => each.title === 'Send movers deposit',
  )!

  await slotAt(user, deposit.id, [8])
  await slotAt(user, deposit.id, [17])

  const { timeline } = await today(now, user)
  expect(timeline.find((hour) => hour.hour === 17)).toMatchObject({
    kind: 'slotted',
    title: 'Send movers deposit · follow-ups',
    source: 'gmail_message',
  })
  expect(timeline.find((hour) => hour.hour === 8)?.title).toBe('Brief · inbox skim')
})

it('moves a two-hour Todo with both of its hours', async () => {
  const user = 'user_two_hours'
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId: user, now, timeZone })
  const spike = (await today(now, user)).stack[0]!
  expect(spike.slotHours).toEqual([9, 10])

  await slotAt(user, spike.id, [11, 12])

  const { stack, timeline } = await today(now, user)
  expect(stack[0]?.slotHours).toEqual([11, 12])
  expect(timeline.find((hour) => hour.hour === 11)?.title).toContain(spike.title)
  expect(timeline.find((hour) => hour.hour === 12)?.title).toContain(`↳ ${spike.title}`)
  // The focus block it left is named again, now that nothing is in it.
  expect(timeline.find((hour) => hour.hour === 9)).toMatchObject({ kind: 'focus', title: 'Focus' })
})

it('takes a Todo off the day, leaving it in the stack with no hour of its own', async () => {
  const user = 'user_unplanner'
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId: user, now, timeZone })
  const spike = (await today(now, user)).stack[0]!

  await slotAt(user, spike.id, [])

  const { stack, timeline, takeOnNow } = await today(now, user)
  expect(stack[0]).toMatchObject({ id: spike.id, slotHours: [] })
  // It is still the one to take on now; it just no longer fits any hour.
  expect(takeOnNow).toMatchObject({ todo: { id: spike.id }, hours: null })
  expect(timeline.find((hour) => hour.hour === 9)).toMatchObject({ kind: 'focus', title: 'Focus' })
})

it('leaves the Slots of a Todo completed today where they were, and frees its hour', async () => {
  const user = 'user_slot_finisher'
  const db = createDb(env.DB)
  await seedPersona(db, { persona: 'ryan', userId: user, now, timeZone })
  const deposit = (await today(now, user)).stack.find(
    (each) => each.title === 'Send movers deposit',
  )!

  await persistOps(db, user, [
    { type: 'todo.set', id: deposit.id, set: { state: 'done', doneAt: now.toISOString() } },
  ])

  const { done, timeline } = await today(now, user)
  // The Slot stays: the day still knows where the work was planned. The timeline
  // is drawn from the stack, so 17:00 reads as the free hour it now is — the
  // same as when the Todo is snoozed or taken off it by hand.
  expect(done.map((each) => [each.title, each.slotHours])).toEqual([[deposit.title, [17]]])
  expect(timeline.find((hour) => hour.hour === 17)).toMatchObject({
    kind: 'free',
    title: 'Free',
    source: null,
  })
})

it('keeps a Todo completed today on the day, out of the stack, and drops it the day after', async () => {
  const user = 'user_finisher'
  const db = createDb(env.DB)
  await seedPersona(db, { persona: 'ryan', userId: user, now, timeZone })
  const { stack } = await today(now, user)
  const spike = stack[0]!
  await persistOps(db, user, [
    { type: 'todo.set', id: spike.id, set: { state: 'done', doneAt: now.toISOString() } },
  ])

  const after = await today(at('2025-09-17T09:15'), user)
  expect(after.stack).toHaveLength(6)
  expect(after.done.map((todo) => todo.title)).toEqual([spike.title])
  expect(after.takeOnNow?.todo.title).toBe('Reply to Priya on edge rate limits')

  expect((await today(at('2025-09-18T08:41'), user)).done).toEqual([])
})
