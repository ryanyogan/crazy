import { formatAge, localTimeToInstant, viewToday, wallClock } from '@crazy/shared'
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
  return { ...day, ...viewToday(day, wallClock(moment, timeZone).hour) }
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
    mentions: [],
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
  const { mentions, stack } = await today()

  expect(
    mentions.map((mention) => [
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
  expect(mentions.map((mention) => mention.todoId)).toEqual([reply.id, null, null, null])
})

it("leaves yesterday's meetings and wording off today's timeline", async () => {
  const thursday = await today(at('2025-09-18T08:41'))
  expect(thursday.events).toEqual([])
  expect(thursday.hours).toEqual([])
  expect(thursday.meetings).toBe(0)
})

it('puts the same content back when the persona is seeded again', async () => {
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId, now, timeZone })
  expect((await today()).stack).toHaveLength(7)
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
