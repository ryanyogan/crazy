import type { UserSettings } from './settings'
import { type ConnectionStatus, PROVIDERS, type Provider, type Side } from './todo'

// The Integrations screen: every Provider Crazy knows of, the Connections a
// user has made to them, and how each reads on its card. Words are the
// glossary's (CONTEXT.md): Provider and Connection, never "integration".

/** What a Provider's card says of it, whether or not the user has connected it. */
export interface ProviderCard {
  chip: string
  name: string
  /** What Crazy reads there, all of it read-only. */
  reads: string
  /** Why it cannot be connected, for a Provider Clerk cannot broker (ADR 0001). */
  unavailable?: string
}

export const PROVIDER_CARDS = {
  google: { chip: 'GM', name: 'Google', reads: 'Calendar · Gmail · Drive' },
  slack: { chip: 'SL', name: 'Slack', reads: 'Mentions, saved, DMs' },
  linear: { chip: 'LN', name: 'Linear', reads: 'Assigned issues, reviews, cycles' },
  notion: { chip: 'NO', name: 'Notion', reads: '@mentions, comments, pages you own' },
  github: { chip: 'GH', name: 'GitHub', reads: 'Review requests, failing checks' },
} as const satisfies Record<Provider, ProviderCard>

/**
 * What Connect asks each Provider for beyond sign-in, all of it read-only:
 * Crazy never changes a Source. Where a Provider's scopes are fixed when its
 * OAuth app is made (Slack, Notion), there is nothing more to ask for here.
 */
export const READ_SCOPES = {
  google: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ],
  slack: [],
  linear: ['read'],
  notion: [],
  github: ['read:user', 'notifications'],
} as const satisfies Record<Provider, readonly string[]>

/** Providers the mockups draw and Clerk cannot broker: shown, never pressable. */
export const UNAVAILABLE_PROVIDERS = [
  {
    key: 'todoist',
    chip: 'TD',
    name: 'Todoist',
    reads: 'Import personal lists',
    unavailable: 'Not available yet',
  },
  {
    key: 'apple_health',
    chip: 'HK',
    name: 'Apple Health',
    reads: 'Sleep and workouts for energy profile',
    unavailable: 'Not available yet · iOS only',
  },
] as const satisfies readonly (ProviderCard & { key: string })[]

/** Clerk names an external account's provider "google" or "oauth_google", by API. */
export function providerFromClerk(name: string): Provider | null {
  const bare = name.replace(/^oauth_/, '')
  return (PROVIDERS as readonly string[]).includes(bare) ? (bare as Provider) : null
}

/** The strategy Clerk's add-external-account flow is asked for. */
export const clerkStrategy = (provider: Provider) => `oauth_${provider}` as const

/**
 * A scope as Clerk reports it, in the room a card has: the last word of a
 * scope URL ("calendar.readonly"), or the scope itself ("channels:read").
 */
export function scopesLabel(approvedScopes: string): string | null {
  const scopes = approvedScopes
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((scope) => scope.replace(/^https?:\/\/.*\//, ''))
  return scopes.length === 0 ? null : [...new Set(scopes)].join(' · ')
}

/** What Clerk says of one external account, and nothing secret. */
export interface ClerkAccountFacts {
  externalAccountId: string
  /** The account's address at the Provider, which tells two Connections apart. */
  label: string | null
  status: ConnectionStatus
  approvedScopes: string
}

/** A Connection as the screen reads it: the bookkeeping row, overlaid with Clerk's word. */
export interface ConnectionView {
  id: string
  provider: Provider
  externalAccountId: string
  defaultSide: Side
  status: ConnectionStatus
  /** Which account it is, when Clerk says. */
  label: string | null
  /** The scopes Clerk reports, or null when nobody has asked Clerk (the demo user). */
  scopes: string | null
  lastSyncAt: string | null
}

/**
 * Status and scopes are Clerk's to say. A Connection whose external account
 * Clerk no longer has needs authorising again; with no Clerk at all (`accounts`
 * null) the row's own word stands, which is how the demo user is drawn.
 */
export function overlayClerk(
  rows: readonly Omit<ConnectionView, 'label' | 'scopes'>[],
  accounts: readonly ClerkAccountFacts[] | null,
): ConnectionView[] {
  return rows.map((row) => {
    if (accounts === null) return { ...row, label: null, scopes: null }
    const account = accounts.find((each) => each.externalAccountId === row.externalAccountId)
    if (!account) return { ...row, status: 'reauth', label: null, scopes: null }
    return {
      ...row,
      status: account.status,
      label: account.label,
      scopes: scopesLabel(account.approvedScopes),
    }
  })
}

/** "2m ago", "3h ago", "4d ago": how long since a moment, in the room a card has. */
export function ago(then: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - then.getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)}h ago`
  return `${Math.round(minutes / (24 * 60))}d ago`
}

/** What brought a sleeping Coordinator back: the first thing asked of it after it was constructed. */
export type WakeCause = 'request' | 'command' | 'socket' | 'message' | 'close' | 'schedule'

/** What the Realtime panel reads off the Coordinator: its own counters, never domain data. */
export interface Realtime {
  sockets: number
  seq: number
  lastWake: { at: string; cause: WakeCause } | null
  /** How many times it has woken since the start of the user's day. */
  wakesSince: number
}

/** What woke the Coordinator, in the user's words. */
export const WAKE_WORDS: Record<WakeCause, string> = {
  request: 'a screen was opened',
  command: 'you changed something',
  socket: 'a device connected',
  message: 'a device spoke',
  close: 'a device left',
  schedule: 'a schedule came due',
}

/** The lifecycle settings a user may change, and the most each may be. */
export const LIFECYCLE_LIMITS = { sentBackDays: 30, archiveDays: 365 } as const

export type LifecycleSettings = Pick<UserSettings, 'briefTime' | 'sentBackDays' | 'archiveDays'>

export const daysLabel = (days: number) => (days === 1 ? '1 day' : `${days} days`)
