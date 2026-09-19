import { clerkClient } from '@clerk/tanstack-react-start/server'
import { type ConnectionRow, createReadDb, readIntegrations } from '@crazy/db'
import {
  type ClerkAccountFacts,
  DEMO_USER,
  type Provider,
  type Realtime,
  initials,
  overlayClerk,
  providerFromClerk,
  startOfDay,
  wallClock,
} from '@crazy/shared'
import { env } from 'cloudflare:workers'
import { clerkEnabled } from '#/lib/auth'
import { coordinatorFor } from './coordinator'

// Server only. What the Integrations screen shows: D1's bookkeeping rows, what
// Clerk says of the external accounts behind them, and the Coordinator's own
// counters. Clerk is the only credential store (ADR 0001): nothing read here is
// a token, and nothing Clerk says is written down but the external account's id.

/** The Account card: who is signed in, as Clerk has it. */
export interface AccountView {
  name: string
  initials: string
  email: string | null
  /** "signed in with Google", or how else. */
  signedInWith: string
  /** "Two-factor on · 2 sessions · managed by Clerk". */
  security: string
  /** False for the demo user, who has no account to manage. */
  managed: boolean
}

const DEMO_ACCOUNT: AccountView = {
  name: DEMO_USER.name,
  initials: initials(DEMO_USER.name),
  email: null,
  signedInWith: 'the demo user · no sign-in configured',
  security: 'No account · add Clerk keys to sign in',
  managed: false,
}

interface ClerkSide {
  account: AccountView
  accounts: (ClerkAccountFacts & { provider: Provider })[]
}

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

async function readClerk(userId: string): Promise<ClerkSide> {
  const clerk = clerkClient()
  const [user, sessions] = await Promise.all([
    clerk.users.getUser(userId),
    clerk.sessions.getSessionList({ userId, status: 'active' }),
  ])
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.primaryEmailAddress?.emailAddress.split('@')[0] ||
    'You'
  const [first] = user.externalAccounts
  const count = sessions.totalCount

  return {
    account: {
      name,
      initials: initials(name),
      email: user.primaryEmailAddress?.emailAddress ?? null,
      signedInWith: first
        ? `signed in with ${capitalised(first.provider.replace(/^oauth_/, ''))}`
        : 'signed in with an email code',
      security: [
        `Two-factor ${user.twoFactorEnabled ? 'on' : 'off'}`,
        `${count} ${count === 1 ? 'session' : 'sessions'}`,
        'managed by Clerk',
      ].join(' · '),
      managed: true,
    },
    // Only the Providers Crazy reads are Connections; another external account is sign-in alone.
    accounts: user.externalAccounts.flatMap((account) => {
      const provider = providerFromClerk(account.provider)
      if (!provider) return []
      return {
        provider,
        externalAccountId: account.id,
        label: account.emailAddress || account.username || null,
        status: account.verification?.status === 'verified' ? 'connected' : 'reauth',
        approvedScopes: account.approvedScopes,
      } as const
    }),
  }
}

/**
 * A verified external account with no bookkeeping row becomes a Connection
 * here: this is where the user lands when Clerk's add-external-account flow
 * sends them back. The write is the Coordinator's, as every write is.
 */
async function reconcile(
  userId: string,
  rows: readonly ConnectionRow[],
  accounts: ClerkSide['accounts'],
): Promise<boolean> {
  const missing = accounts.filter(
    (account) =>
      account.status === 'connected' &&
      !rows.some((row) => row.externalAccountId === account.externalAccountId),
  )
  for (const account of missing) {
    await coordinatorFor(userId).command({
      type: 'connection.add',
      id: `connection_${account.externalAccountId}`,
      provider: account.provider,
      externalAccountId: account.externalAccountId,
    })
  }
  return missing.length > 0
}

export async function integrationsFor(userId: string, now: Date, timeZone: string) {
  const db = createReadDb(env.DB)
  const clerk = clerkEnabled ? await readClerk(userId) : null

  let read = await readIntegrations(db, userId)
  if (clerk && (await reconcile(userId, read.connections, clerk.accounts))) {
    read = await readIntegrations(db, userId)
  }

  // Asked last, so that what it counts includes this request's own wake.
  // An answer over RPC is a stub to be disposed of; what the screen keeps is plain.
  const { sockets, seq, lastWake, wakesSince } = await coordinatorFor(userId).realtime({
    since: startOfDay(wallClock(now, timeZone).day, timeZone).toISOString(),
  })
  const realtime: Realtime = {
    sockets,
    seq,
    lastWake: lastWake && { at: lastWake.at, cause: lastWake.cause },
    wakesSince,
  }

  return {
    account: clerk?.account ?? DEMO_ACCOUNT,
    /** Whether Connect can be pressed: it is Clerk's flow, so not without Clerk. */
    canConnect: clerk !== null,
    connections: overlayClerk(read.connections, clerk?.accounts ?? null),
    settings: read.settings,
    realtime,
    now: now.toISOString(),
    timeZone,
  }
}
