import { moneyShort, termsLabel } from './invoice'
import type { UserSettings } from './settings'
import {
  BILLING_PROVIDERS,
  type ClientArrangement,
  type ClientCadence,
  type ConnectionStatus,
  PROVIDERS,
  type Provider,
  type Side,
} from './todo'

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
  // Frame 2c's own words for Xero, which are three things Crazy would read and
  // nothing it would write: a Provider is read-only (ADR 0001).
  xero: { chip: 'XE', name: 'Xero', reads: 'Invoices, contacts, paid status' },
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
  // Xero's own read scopes, beside the offline access its refresh needs. Like
  // the rest of this list they are from memory of the Provider's scope names,
  // not from fetched docs: check them when there are keys to run them with.
  xero: ['accounting.transactions.read', 'accounting.contacts.read'],
} as const satisfies Record<Provider, readonly string[]>

/** A Provider the mockups draw that no Connection can be made to: shown, never pressable. */
export interface UnavailableProvider extends ProviderCard {
  key: string
  /** Which section of the Integrations screen draws it. */
  section: 'work' | 'billing'
  /** What stands in the way, in full, for assistive technology (`NotWired`). */
  why: string
}

const NO_CLERK_CONNECTION =
  'Clerk brokers no Connection to it, and Crazy never holds a credential of its own (ADR 0001). It would have to be configured as a custom OIDC provider in the Clerk Dashboard first.'

/**
 * Providers the mockups draw and Clerk cannot broker: shown, never pressable.
 * The billing ones are frame 2c's six less Xero, which Clerk does broker
 * (`BILLING_PROVIDERS`). Every one of them would be read-only: Crazy would read
 * what an accounting Provider says and never write an invoice into it.
 */
export const UNAVAILABLE_PROVIDERS = [
  {
    key: 'todoist',
    chip: 'TD',
    name: 'Todoist',
    reads: 'Import personal lists',
    section: 'work',
    unavailable: 'Not available yet',
    why: NO_CLERK_CONNECTION,
  },
  {
    key: 'apple_health',
    chip: 'HK',
    name: 'Apple Health',
    reads: 'Sleep and workouts for energy profile',
    section: 'work',
    unavailable: 'Not available yet · iOS only',
    why: 'Apple Health is on the phone itself: there is no OAuth path to it at all, and Crazy has no iOS app.',
  },
  {
    key: 'quickbooks',
    chip: 'QB',
    name: 'QuickBooks Online',
    // Frame 2c asks for "Create invoices, customers, mark paid"; a Provider is
    // read-only, so what a card may promise is what Crazy would read there.
    reads: 'Customers, invoices, paid status',
    section: 'billing',
    unavailable: 'Not available yet',
    why: `QuickBooks Online is not one of the connections Clerk offers. ${NO_CLERK_CONNECTION}`,
  },
  {
    key: 'harvest',
    chip: 'HV',
    name: 'Harvest',
    reads: 'Time entries you tracked there',
    section: 'billing',
    unavailable: 'Not available yet',
    why: `Harvest is not one of the connections Clerk offers. ${NO_CLERK_CONNECTION}`,
  },
  {
    key: 'stripe',
    chip: 'ST',
    name: 'Stripe',
    reads: 'Payments against your invoices',
    section: 'billing',
    unavailable: 'Not available yet',
    why: `Stripe is not one of the connections Clerk offers. ${NO_CLERK_CONNECTION}`,
  },
  {
    key: 'freshbooks',
    chip: 'FB',
    name: 'FreshBooks',
    reads: 'Invoices, time import',
    section: 'billing',
    unavailable: 'Not available yet',
    why: `FreshBooks is not one of the connections Clerk offers. ${NO_CLERK_CONNECTION}`,
  },
  {
    key: 'toggl',
    chip: 'TG',
    name: 'Toggl Track',
    reads: 'Import history',
    section: 'billing',
    unavailable: 'Not available yet',
    why: `Toggl Track is not one of the connections Clerk offers. ${NO_CLERK_CONNECTION}`,
  },
] as const satisfies readonly UnavailableProvider[]

/** Those of them one section of the screen draws. */
export const unavailableIn = (section: 'work' | 'billing'): readonly UnavailableProvider[] =>
  UNAVAILABLE_PROVIDERS.filter((each) => each.section === section)

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

// ── Invoice settings, per Client (frame 2c) ──────────────────────────────────

/**
 * How long a Client may be given to pay. Nought is "due on receipt"; the top is
 * a year, which is past anything anybody nets and short of a typed nonsense.
 */
export const INVOICING_LIMITS = { paymentTermsDays: { min: 0, max: 365 } } as const

/**
 * How often a Client's invoice goes out, in her words. The frame writes
 * Bramble's as "Retainer · 1st", which says the arrangement as well; the terms
 * line beside it already says that, so the cadence here says only when.
 */
export const CADENCE_WORDS: Record<ClientCadence, string> = {
  monthly: 'Monthly',
  biweekly: 'Bi-weekly',
  first_of_month: 'On the 1st',
}

const ARRANGEMENT_WORDS: Record<ClientArrangement, string> = {
  project_fee: 'Project fee',
  hourly: 'Hourly',
  retainer: 'Retainer',
}

/** One Client's invoice settings, as the Integrations screen reads them. */
export interface ClientInvoicing {
  id: string
  name: string
  arrangement: ClientArrangement
  rateCents: number
  roundingMinutes: number
  /** The budget or retainer in hours, where the arrangement has one. */
  budgetHours: number | null
  overageRateCents: number | null
  /** What her invoices are in; one currency until a Client is in another. */
  currency: string
  cadence: ClientCadence
  paymentTermsDays: number
  /** Whether Crazy is to put the next invoice together for her when it comes due. */
  autoDraft: boolean
  /** Whether such an invoice may go out without her reading it first. Off unless she says so. */
  sendWithoutReview: boolean
}

/**
 * A Client's terms in one line, as frame 2c writes them: "Project fee · $210/h
 * · 15-min rounding · net 30", and a retainer as what it buys — "20h/mo ·
 * $3,600 · overage $200/h · net 30". The frame ends each line with the
 * accounting Provider that Client goes out through; none is connected, and a
 * line that named one would be saying something untrue.
 */
export function invoicingTerms(client: ClientInvoicing): string {
  const net = termsLabel(client.paymentTermsDays).toLowerCase()
  const rate = (cents: number) => `${moneyShort(cents, client.currency)}/h`
  if (client.arrangement === 'retainer' && client.budgetHours !== null) {
    return [
      `${client.budgetHours}h/mo`,
      moneyShort(client.budgetHours * client.rateCents, client.currency),
      client.overageRateCents === null ? null : `overage ${rate(client.overageRateCents)}`,
      net,
    ]
      .filter((part) => part !== null)
      .join(' · ')
  }
  return [
    ARRANGEMENT_WORDS[client.arrangement],
    rate(client.rateCents),
    `${client.roundingMinutes}-min rounding`,
    net,
  ].join(' · ')
}

/** What auto-draft does, and what it plainly does not do yet. */
export const AUTO_DRAFT_NOTE =
  'On, Crazy will put the invoice together when the cadence comes due and leave it waiting for you. Nothing is drafted on its own yet: the invoices you have were drafted when they were seeded.'

/** What send without review does, said before she turns it on and after. */
export const SEND_WITHOUT_REVIEW_NOTE =
  'Off, an invoice waits for you to read it before it goes anywhere. On, Crazy would send it the moment it is drafted. Crazy cannot send anything yet — it has no accounting Connection and has never sent an invoice — so this says what will happen, not what does.'

/** The second press: what she is agreeing to, in her own terms. */
export const confirmSendWithoutReview = (name: string) =>
  `Really let ${name}'s invoices go out unread?`

/**
 * Where an invoice is meant to end up once Crazy can send one, and where each
 * of them has got to. The Integrations screen draws the same Providers with the
 * same words (`PROVIDER_CARDS`, `UNAVAILABLE_PROVIDERS`), so the two screens
 * cannot come to disagree about what is connected.
 */
export function invoiceSyncTargets(connected: readonly Provider[]): {
  name: string
  status: string
  why: string | null
}[] {
  const billing = BILLING_PROVIDERS.map((each) => ({
    name: PROVIDER_CARDS[each].name,
    status: connected.includes(each) ? 'connected' : 'not connected',
    why: connected.includes(each)
      ? null
      : `${PROVIDER_CARDS[each].name} is not connected. Connect it on the Integrations screen; Crazy still has nothing that sends an invoice.`,
  }))
  const quickbooks = UNAVAILABLE_PROVIDERS.find((each) => each.key === 'quickbooks')!
  return [...billing, { name: 'QuickBooks', status: 'not available yet', why: quickbooks.why }]
}

export type LifecycleSettings = Pick<
  UserSettings,
  'briefTime' | 'sentBackDays' | 'archiveDays' | 'timeZone'
>

export const daysLabel = (days: number) => (days === 1 ? '1 day' : `${days} days`)
