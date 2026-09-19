import { localTimeToInstant, viewTimer } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, seedPersona } from '../write'
import { readTimer } from './timer'

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
