import { localTimeToInstant, viewCircles } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, seedPersona } from '../write'
import { readCircles } from './circles'

// Frame 1e's moment: Wednesday 17 Sep 2025, 08:41 on Ryan's wall clock, which
// falls in the week of Monday 15 September.
const timeZone = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, timeZone)!
const now = at('2025-09-17T08:41')
const userId = 'user_ryan'

/** A user's Circles as D1 holds them, and what the screen derives at that moment. */
async function circles(moment = now, user = userId) {
  const held = await readCircles(createReadDb(env.DB), user, moment, timeZone)
  return { ...held, ...viewCircles(held) }
}

beforeAll(async () => {
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId, now, timeZone })
})

it('shows Ryan the four Circles frame 1e draws, each with its Side', async () => {
  const { seated } = await circles()

  expect(
    seated.map(({ circle, outline }) => [circle.name, circle.side, circle.people, outline]),
  ).toEqual([
    ['Platform team', 'work', 12, false],
    ['Design', 'work', 5, false],
    ['Leadership', 'work', 3, false],
    ['Personal', 'personal', null, true],
  ])
  expect(seated.map(({ circle }) => circle.providers)).toEqual([
    ['slack_message', 'linear_issue'],
    ['notion_page', 'slack_message'],
    ['notion_page', 'gmail_message'],
    ['gmail_message', 'calendar_event'],
  ])
})

it("reads this week's Overlaps with their Circles, people and timing", async () => {
  const { overlaps } = await circles()

  expect(
    overlaps.map((overlap) => [
      overlap.circles.map((circle) => circle.name),
      overlap.title,
      overlap.people,
      overlap.timing,
    ]),
  ).toEqual([
    [
      ['Platform team', 'Design'],
      'Onboarding v2 design review',
      'Sam · Lena · Priya',
      'Today 13:00 → 14:00',
    ],
    [['Platform team', 'Leadership'], 'Auth migration in the Q4 doc', 'Devon', 'Thu → Mon'],
    [['Leadership', 'Design'], 'Onboarding metrics for Q4', 'Lena · Devon', 'Ask by Thu'],
    [['Personal', 'Platform team'], 'Move day is a Wednesday', 'You', '1 Oct'],
  ])
  expect(overlaps.every((overlap) => overlap.text !== null)).toBe(true)
})

it('writes the three Overlaps frame 1e draws where their Circles cross', async () => {
  const { lenses } = await circles()

  expect(lenses.map(({ at, title, note }) => [at, title, note])).toEqual([
    [0, 'Onboarding v2', 'Sam · Priya · Lena'],
    [1, 'Auth migration', 'Q4 doc · Devon'],
    [2, 'Design review', '14:00 today'],
  ])
})

it('is no Overlap when a Todo is matched to one Circle only', async () => {
  const { overlaps } = await circles()
  // "Send movers deposit" is matched to Personal and to nothing else.
  expect(overlaps.map((overlap) => overlap.title)).not.toContain('Send movers deposit')

  const matches = await createReadDb(env.DB).circleMatch.count({ where: { userId } })
  expect(matches).toBe(9)
})

it('lists an Overlap Crazy has not worded yet by its Todo', async () => {
  const user = 'user_unworded'
  const db = createDb(env.DB)
  await seedPersona(db, { persona: 'ryan', userId: user, now, timeZone })
  // A match can be made before anything is written about it.
  await db.overlapNote.deleteMany({ where: { userId: user, todoId: { contains: 'move-day' } } })

  const { overlaps } = await circles(now, user)

  expect(overlaps.at(-1)).toMatchObject({
    title: 'Move day is a Wednesday',
    text: null,
    people: null,
    timing: null,
    figure: null,
  })
  expect(overlaps).toHaveLength(4)
})

it('keeps an Overlap for the week Crazy matched it in, and lets it go after', async () => {
  // Matched on the Wednesday: still this week's on the Sunday that ends it,
  // and gone by the Monday that starts the next.
  expect((await circles(at('2025-09-21T23:30'))).overlaps).toHaveLength(4)
  expect((await circles(at('2025-09-22T00:30'))).overlaps).toEqual([])
})

it('fills the screen for a persona laid over a Monday morning', async () => {
  const user = 'user_monday'
  const monday = at('2025-09-15T08:41')
  await seedPersona(createDb(env.DB), { persona: 'ryan', userId: user, now: monday, timeZone })

  expect((await circles(monday, user)).overlaps).toHaveLength(4)
})

it('reads only the rows of the user asking', async () => {
  expect(await circles(now, 'user_someone_else')).toMatchObject({
    circles: [],
    overlaps: [],
    seated: [],
    unseated: [],
    lenses: [],
  })
})
