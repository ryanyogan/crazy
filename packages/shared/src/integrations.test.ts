import { describe, expect, test } from 'vite-plus/test'
import { type CommandState, apply, command, decide } from './command'
import { shellDestinations } from './destinations'
import { overlayClerk, providerFromClerk, scopesLabel } from './integrations'

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
