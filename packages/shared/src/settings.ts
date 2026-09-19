import { z } from 'zod'
import { PERSONAS } from './demo'

/** An IANA time zone name the runtime recognises, e.g. "America/Chicago". */
export const timeZone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}, 'Unknown time zone')

/** A user's settings row. The lifecycle periods are counted in Rollovers (days). */
export const userSettings = z.object({
  userId: z.string().min(1),
  timeZone,
  /** Local HH:MM the Brief is written at. */
  briefTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /** Days a `today` Todo may go untouched before it is sent back. */
  sentBackDays: z.number().int().min(1),
  /** Days a `backlog` Todo may go untouched before it is archived. */
  archiveDays: z.number().int().min(1),
  billing: z.boolean(),
})
export type UserSettings = z.infer<typeof userSettings>

export const SETTINGS_DEFAULTS = {
  timeZone: 'UTC',
  briefTime: '06:00',
  sentBackDays: 1,
  archiveDays: 90,
  billing: false,
} as const satisfies Omit<UserSettings, 'userId'>

/** What the web app hands the Coordinator on a user's first authenticated request. */
export const provisionInput = z.object({
  /** Detected in the browser or from the request; falls back to the default when absent or unknown. */
  timeZone: timeZone.optional().catch(undefined),
})
export type ProvisionInput = z.infer<typeof provisionInput>

/**
 * Development only: the persona to lay over a user, and the moment to lay it
 * over. A persona whose world has a timer running in it can be seeded with that
 * Time entry already ended, which is the only way to see the idle bar at a
 * pinned moment (`pnpm visual`, frame 3a).
 */
export const reseedInput = z.object({
  persona: z.enum(PERSONAS),
  now: z.iso.datetime(),
  timer: z.enum(['running', 'idle']).optional(),
})
export type ReseedInput = z.infer<typeof reseedInput>
