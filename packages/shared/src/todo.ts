import { z } from 'zod'

// The vocabularies D1 holds as strings (SQLite has no enums), and what a Todo
// looks like once it is read. Words are the glossary's (CONTEXT.md).

export const TODO_STATES = ['backlog', 'today', 'done', 'archived'] as const
export const todoState = z.enum(TODO_STATES)
export type TodoState = z.infer<typeof todoState>

/** A Source is unique among Todos in these states. */
export const OPEN_TODO_STATES = ['backlog', 'today'] as const satisfies readonly TodoState[]

export const SIDES = ['work', 'personal'] as const
export const side = z.enum(SIDES)
export type Side = z.infer<typeof side>

/** The Providers Clerk can broker with the Billing module off (ADR 0001). */
export const PROVIDERS = ['google', 'slack', 'linear', 'notion', 'github'] as const
export const provider = z.enum(PROVIDERS)
export type Provider = z.infer<typeof provider>

export const CONNECTION_STATUSES = ['connected', 'reauth'] as const
export const connectionStatus = z.enum(CONNECTION_STATUSES)
export type ConnectionStatus = z.infer<typeof connectionStatus>

export const PROJECT_STATUSES = ['on_track', 'at_risk', 'behind'] as const
export const projectStatus = z.enum(PROJECT_STATUSES)
export type ProjectStatus = z.infer<typeof projectStatus>

/** What a Provider's calendar holds: both are read-only, always. */
export const CALENDAR_EVENT_KINDS = ['meeting', 'focus'] as const
export const calendarEventKind = z.enum(CALENDAR_EVENT_KINDS)
export type CalendarEventKind = z.infer<typeof calendarEventKind>

export const SIGNAL_KINDS = ['mention', 'promise', 'waiting_on'] as const
export const signalKind = z.enum(SIGNAL_KINDS)
export type SignalKind = z.infer<typeof signalKind>

export const BRIEF_KINDS = ['daily', 'weekly'] as const
export const briefKind = z.enum(BRIEF_KINDS)
export type BriefKind = z.infer<typeof briefKind>

/** The kind of attention a Todo takes, as the Take on now card words it. */
export const ENERGIES = {
  deep_focus: 'deep focus',
  quick_win: 'quick wins',
  people_admin: 'people & admin',
} as const
export const energy = z.enum(
  Object.keys(ENERGIES) as [keyof typeof ENERGIES, ...(keyof typeof ENERGIES)[]],
)
export type Energy = z.infer<typeof energy>

/**
 * What a Source is at its Provider, and the chip that stands for it. One
 * Provider can hold several kinds: Gmail and Calendar are both Google.
 */
export const SOURCE_KINDS = {
  linear_issue: { provider: 'linear', chip: 'LN', name: 'Linear' },
  slack_message: { provider: 'slack', chip: 'SL', name: 'Slack' },
  notion_page: { provider: 'notion', chip: 'NO', name: 'Notion' },
  gmail_message: { provider: 'google', chip: 'GM', name: 'Gmail' },
  calendar_event: { provider: 'google', chip: 'CAL', name: 'Google Calendar' },
  github_pull_request: { provider: 'github', chip: 'GH', name: 'GitHub' },
} as const satisfies Record<string, { provider: Provider; chip: string; name: string }>
export const sourceKind = z.enum(
  Object.keys(SOURCE_KINDS) as [keyof typeof SOURCE_KINDS, ...(keyof typeof SOURCE_KINDS)[]],
)
export type SourceKind = z.infer<typeof sourceKind>

/** The Provider item a Todo was made from, or a Signal is. */
export const source = z.object({
  /** The Connection it arrived through, and the item's id at the Provider: together, its identity. */
  connectionId: z.string().min(1),
  itemId: z.string().min(1),
  kind: sourceKind,
  /** What people call the item, when it has a name of its own: "HAL-212". */
  ref: z.string().nullable(),
  url: z.string().nullable(),
})
export type Source = z.infer<typeof source>

/** Whether two Sources are the same Provider item. */
export function sameSource(a: Source, b: Source): boolean {
  return a.connectionId === b.connectionId && a.itemId === b.itemId
}

/** A Todo as the Today screen reads it. */
export interface TodayTodo {
  id: string
  title: string
  state: TodoState
  /** Null is a One-off. */
  project: string | null
  estimateMinutes: number | null
  energy: Energy | null
  carryCount: number
  stackPosition: number | null
  reason: string | null
  /** Null for a Todo the user typed in. */
  source: Source | null
  /** The hours of the day in question this Todo holds a Slot on, ascending. */
  slotHours: number[]
  createdAt: string
  /** The last time the user touched it (CONTEXT.md, "Touched"). */
  touchedAt: string
  /** While this moment is still to come the Todo is out of the Priority stack; null when not snoozed. */
  snoozedUntil: string | null
  /** When it was completed; null until it is. */
  doneAt: string | null
}

/** A snoozed Todo is out of the stack until its snooze ends. */
export function isSnoozed(todo: Pick<TodayTodo, 'snoozedUntil'>, now: Date): boolean {
  return todo.snoozedUntil !== null && new Date(todo.snoozedUntil) > now
}

/** "2h", "45m", "1h 30m"; nothing when there is no estimate. */
export function formatEstimate(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** "carried 2 days" for a Todo that has been carried over; nothing otherwise. */
export function carriedLabel(carryCount: number): string | null {
  if (carryCount <= 0) return null
  return `carried ${carryCount} ${carryCount === 1 ? 'day' : 'days'}`
}
