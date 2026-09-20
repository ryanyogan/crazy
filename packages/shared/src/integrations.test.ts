import { describe, expect, test } from 'vite-plus/test'
import { type CommandState, apply, command, decide } from './command'
import { shellDestinations } from './destinations'
import {
  type ClientInvoicing,
  invoiceSyncTargets,
  invoicingTerms,
  overlayClerk,
  providerFromClerk,
  scopesLabel,
} from './integrations'

const NOW = new Date('2025-09-17T14:00:00Z')
const state = (connections: CommandState['connections'] = []): CommandState => ({
  day: '2025-09-17',
  todos: [],
  signals: [],
  events: [],
  connections,
})
const WORK_GOOGLE = { id: 'c1', externalAccountId: 'eac_1', defaultSide: 'work' } as const

describe('connecting a Provider', () => {
  test('an external account Clerk vouches for becomes a Connection holding nothing secret', () => {
    const decision = decide(
      state(),
      { type: 'connection.add', id: 'c1', provider: 'google', externalAccountId: 'eac_1' },
      NOW,
    )
    expect(decision).toEqual({
      ok: true,
      ops: [
        {
          type: 'connection.insert',
          connection: {
            id: 'c1',
            provider: 'google',
            externalAccountId: 'eac_1',
            defaultSide: 'work',
            status: 'connected',
            createdAt: NOW.toISOString(),
          },
        },
      ],
    })
  })

  test('a second account at the same Provider is a second Connection; the same account twice is not', () => {
    const second = decide(
      state([WORK_GOOGLE]),
      { type: 'connection.add', id: 'c2', provider: 'google', externalAccountId: 'eac_2' },
      NOW,
    )
    expect(second.ok && second.ops).toHaveLength(1)

    const again = decide(
      state([WORK_GOOGLE]),
      { type: 'connection.add', id: 'c9', provider: 'google', externalAccountId: 'eac_1' },
      NOW,
    )
    expect(again).toEqual({ ok: true, ops: [] })
  })

  test('its default Side can be set to personal, and the screen shows it at once', () => {
    const decision = decide(
      state([WORK_GOOGLE]),
      { type: 'connection.setSide', connectionId: 'c1', side: 'personal' },
      NOW,
    )
    if (!decision.ok) throw new Error(decision.reason)
    const after = apply({ connections: [{ id: 'c1', defaultSide: 'work' as const }] }, decision.ops)
    expect(after.connections).toEqual([{ id: 'c1', defaultSide: 'personal' }])
  })
})

describe('the lifecycle settings', () => {
  test('changing one leaves the others as they were', () => {
    const decision = decide(state(), { type: 'settings.set', set: { sentBackDays: 3 } }, NOW)
    if (!decision.ok) throw new Error(decision.reason)
    const held = { briefTime: '06:00', sentBackDays: 1, archiveDays: 90 }
    expect(apply({ settings: held }, decision.ops).settings).toEqual({ ...held, sentBackDays: 3 })
  })

  test('a period of no days, a Brief at no time, or nothing at all is not a change', () => {
    for (const set of [{ sentBackDays: 0 }, { briefTime: '25:00' }, {}]) {
      expect(command.safeParse({ type: 'settings.set', set }).success).toBe(false)
    }
  })
})

describe('what Clerk reports', () => {
  test("status and scopes are Clerk's; an account Clerk no longer has needs authorising again", () => {
    const row = {
      provider: 'google',
      defaultSide: 'work',
      status: 'connected',
      lastSyncAt: null,
    } as const
    const [kept, gone] = overlayClerk(
      [
        { ...row, id: 'c1', externalAccountId: 'eac_1' },
        { ...row, id: 'c2', externalAccountId: 'eac_gone' },
      ],
      [
        {
          externalAccountId: 'eac_1',
          label: 'ryan@example.com',
          status: 'connected',
          approvedScopes: 'email https://www.googleapis.com/auth/calendar.readonly',
        },
      ],
    )
    expect(kept).toMatchObject({ status: 'connected', scopes: 'email · calendar.readonly' })
    expect(gone).toMatchObject({ status: 'reauth', scopes: null })
  })

  test('only a Provider Crazy reads is a Connection', () => {
    expect(providerFromClerk('oauth_google')).toBe('google')
    expect(providerFromClerk('facebook')).toBeNull()
    expect(scopesLabel('')).toBeNull()
  })
})

describe('how a Client is billed', () => {
  const MERIDIAN: ClientInvoicing = {
    id: 'client_meridian',
    name: 'Meridian Health',
    arrangement: 'project_fee',
    rateCents: 210_00,
    roundingMinutes: 15,
    budgetHours: 40,
    overageRateCents: null,
    currency: 'USD',
    cadence: 'monthly',
    paymentTermsDays: 30,
    autoDraft: true,
    sendWithoutReview: false,
  }
  /** Her September invoice, still hers: the one the terms follow. */
  const DRAFT = {
    id: 'invoice_meridian_sep',
    clientId: MERIDIAN.id,
    status: 'review',
    issuedDay: '2025-09-19',
    paymentTermsDays: 30,
  } as const
  const hers = (over: Partial<CommandState> = {}): CommandState => ({
    ...state(),
    billing: true,
    clients: [{ id: MERIDIAN.id, paymentTermsDays: MERIDIAN.paymentTermsDays }],
    ...over,
  })

  const setting = (set: Record<string, unknown>, over?: Partial<CommandState>) =>
    decide(hers(over), { type: 'client.setInvoicing', clientId: MERIDIAN.id, set } as never, NOW)

  test('each setting lands on the Client, and the screen shows it at once', () => {
    for (const set of [
      { cadence: 'biweekly' },
      { paymentTermsDays: 15 },
      { autoDraft: false },
      { sendWithoutReview: true },
    ] as const) {
      const decision = setting(set)
      if (!decision.ok) throw new Error(decision.reason)
      const after = apply({ clients: [MERIDIAN] }, decision.ops)
      expect(after.clients?.[0]).toMatchObject(set)
    }
  })

  test('a new Client sends nothing unread: it is off until she turns it on', () => {
    // The column defaults to false (migration 0014) and the command is the only
    // way past it, which is why turning it on is a change a user has to make.
    expect(MERIDIAN.sendWithoutReview).toBe(false)
    const decision = setting({ sendWithoutReview: true })
    expect(decision.ok && decision.ops[0]).toMatchObject({
      type: 'client.set',
      set: { sendWithoutReview: true },
    })
  })

  test("somebody else's Client is not hers to bill", () => {
    const decision = decide(
      hers({ clients: [] }),
      { type: 'client.setInvoicing', clientId: MERIDIAN.id, set: { autoDraft: true } },
      NOW,
    )
    expect(decision).toEqual({ ok: false, reason: 'That Client is not one of yours.' })
  })

  test('with the Billing module off there are no Clients to bill', () => {
    const decision = decide(
      { ...hers(), billing: false },
      { type: 'client.setInvoicing', clientId: MERIDIAN.id, set: { cadence: 'monthly' } },
      NOW,
    )
    expect(decision).toEqual({
      ok: false,
      reason: 'Clients belong to the Billing module, which is off.',
    })
  })

  test('an unknown cadence, impossible terms, or nothing at all is not a change', () => {
    for (const set of [
      { cadence: 'fortnightly' },
      { paymentTermsDays: -1 },
      { paymentTermsDays: 400 },
      { paymentTermsDays: 30.5 },
      {},
    ]) {
      const parsed = command.safeParse({
        type: 'client.setInvoicing',
        clientId: MERIDIAN.id,
        set,
      })
      expect(parsed.success).toBe(false)
    }
  })

  test('terms she has not sent yet follow the Client; a sent invoice keeps its own', () => {
    const sent = { ...DRAFT, id: 'invoice_meridian_aug', status: 'sent' as const }
    const decision = setting({ paymentTermsDays: 45 }, { invoices: [DRAFT, sent] })
    if (!decision.ok) throw new Error(decision.reason)
    expect(decision.ops).toEqual([
      { type: 'client.set', id: MERIDIAN.id, set: { paymentTermsDays: 45 } },
      // Issued 19 Sep, net 45: 3 Nov, counted in days and never off a clock.
      {
        type: 'invoice.set',
        id: DRAFT.id,
        set: { paymentTermsDays: 45, dueDay: '2025-11-03' },
      },
    ])
  })

  test('a change that is not the terms leaves every invoice alone', () => {
    const decision = setting({ autoDraft: false }, { invoices: [DRAFT] })
    expect(decision.ok && decision.ops).toHaveLength(1)
  })

  test("a Client's terms read as frame 2c writes them", () => {
    expect(invoicingTerms(MERIDIAN)).toBe('Project fee · $210/h · 15-min rounding · net 30')
    expect(
      invoicingTerms({
        ...MERIDIAN,
        arrangement: 'retainer',
        rateCents: 180_00,
        budgetHours: 20,
        overageRateCents: 200_00,
      }),
    ).toBe('20h/mo · $3,600 · overage $200/h · net 30')
  })

  test('both screens say the same of a billing Provider', () => {
    const [xero, quickbooks] = invoiceSyncTargets([])
    expect(xero).toMatchObject({ name: 'Xero', status: 'not connected' })
    expect(quickbooks).toMatchObject({ name: 'QuickBooks', status: 'not available yet' })
    expect(invoiceSyncTargets(['xero'])[0]).toMatchObject({ status: 'connected', why: null })
  })
})

describe('the Billing module', () => {
  test('turning it on gives the Shell Time and Invoices at once, and turning it off takes them away', () => {
    const on = decide(state(), { type: 'billing.set', on: true }, NOW)
    if (!on.ok) throw new Error(on.reason)
    const shell = apply({ billing: false }, on.ops)
    expect(shellDestinations(shell.billing).map((each) => each.id)).toContain('time')

    const off = decide(state(), { type: 'billing.set', on: false }, NOW)
    if (!off.ok) throw new Error(off.reason)
    const without = shellDestinations(apply(shell, off.ops).billing).map((each) => each.id)
    expect(without).not.toContain('time')
    expect(without).not.toContain('invoices')
  })
})
