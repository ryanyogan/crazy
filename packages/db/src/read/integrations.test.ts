import { SETTINGS_DEFAULTS, decide, localTimeToInstant } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, loadCommandState, persistOps, seedPersona } from '../write'
import { readIntegrations } from './integrations'
import { readInvoices } from './invoices'

// The Integrations screen against a seeded D1: the billing section is Cori's
// alone, and how a Client is billed survives the round trip through a command.

const timeZone = 'America/Chicago'
const now = localTimeToInstant('2025-09-17T10:42', timeZone)!
const cori = 'user_cori_integrations'
const ryan = 'user_ryan_integrations'

const db = () => createReadDb(env.DB)

beforeAll(async () => {
  const write = createDb(env.DB)
  // A persona's world includes whether the Billing module is on in it, which
  // is the settings row rather than the seed's own rows (`reseedUser`).
  for (const [userId, persona, billing] of [
    [cori, 'cori', true],
    [ryan, 'ryan', false],
  ] as const) {
    await seedPersona(write, { persona, userId, now, timeZone })
    await write.userSettings.create({
      data: { ...SETTINGS_DEFAULTS, userId, timeZone, billing, createdAt: now },
    })
  }
})

it('reads the billing section only with the Billing module on', async () => {
  const hers = await readIntegrations(db(), cori)
  expect(hers.billing).toBe(true)
  expect(hers.clients.map((client) => client.name)).toEqual([
    'Meridian Health',
    'Quill & Co',
    'Bramble',
  ])

  // Ryan bills nobody and has the module off: there is no billing section for
  // the screen to draw, and no Client of his to draw in it.
  const his = await readIntegrations(db(), ryan)
  expect(his.billing).toBe(false)
  expect(his.clients).toEqual([])
})

it('sends nothing unread: every seeded Client waits to be looked at', async () => {
  const { clients } = await readIntegrations(db(), cori)
  expect(clients.map((client) => client.sendWithoutReview)).toEqual([false, false, false])
  // Frame 2c draws auto-draft on, which is the half of the pair that only
  // prepares something; the seed follows the frame.
  expect(clients.map((client) => client.autoDraft)).toEqual([true, true, true])
})

it("frame 2c's terms are the Client's own columns", async () => {
  const { clients } = await readIntegrations(db(), cori)
  expect(clients.map((client) => [client.cadence, client.paymentTermsDays])).toEqual([
    ['monthly', 30],
    ['biweekly', 15],
    ['first_of_month', 30],
  ])
  expect(clients[0]?.currency).toBe('USD')
})

it('a change of settings is written to the Client and read back', async () => {
  const write = createDb(env.DB)
  const [meridian] = (await readIntegrations(db(), cori)).clients
  if (!meridian) throw new Error('Cori has no Clients')

  const command = {
    type: 'client.setInvoicing',
    clientId: meridian.id,
    set: { cadence: 'biweekly', autoDraft: false, sendWithoutReview: true },
  } as const
  const decision = decide(await loadCommandState(write, cori, command, now), command, now)
  if (!decision.ok) throw new Error(decision.reason)
  await persistOps(write, cori, decision.ops)

  const after = (await readIntegrations(db(), cori)).clients[0]
  expect(after).toMatchObject({ cadence: 'biweekly', autoDraft: false, sendWithoutReview: true })
})

it('her draft falls due under the terms she has just set; a sent invoice would keep its own', async () => {
  const write = createDb(env.DB)
  const [meridian] = (await readIntegrations(db(), cori)).clients
  if (!meridian) throw new Error('Cori has no Clients')
  // Issued on the Friday of frame 2b's week, net 30: 19 Oct, as the frame prints it.
  expect((await readInvoices(db(), cori, now, timeZone)).invoices[0]?.dueDay).toBe('2025-10-19')

  const command = {
    type: 'client.setInvoicing',
    clientId: meridian.id,
    set: { paymentTermsDays: 45 },
  } as const
  const decision = decide(await loadCommandState(write, cori, command, now), command, now)
  if (!decision.ok) throw new Error(decision.reason)
  await persistOps(write, cori, decision.ops)

  const period = await readInvoices(db(), cori, now, timeZone)
  expect(period.invoices[0]).toMatchObject({ paymentTermsDays: 45, dueDay: '2025-11-03' })
  // Nothing has been connected, so both screens say so of the same Providers.
  expect(period.billingConnections).toEqual([])
})
