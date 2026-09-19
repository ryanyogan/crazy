import { type Db, type SeedTimer, seedPersona } from '@crazy/db/write'
import {
  PERSONA_BILLING,
  type Persona,
  type ProvisionInput,
  SETTINGS_DEFAULTS,
  type UserSettings,
  userSettings,
} from '@crazy/shared'

/**
 * Until Crazy pulls from Providers, a new user starts with the mockups' sample
 * content, so that every screen has something true to D1 to show.
 */
const STARTING_PERSONA: Persona = 'ryan'

/**
 * Creates the user's settings row if they have none, and returns the row they
 * have. Safe to repeat: a user who already has settings keeps them untouched,
 * including a time zone they have since changed.
 */
export async function provisionUser(
  db: Db,
  userId: string,
  input: ProvisionInput,
  now: Date,
): Promise<UserSettings> {
  const existing = await db.userSettings.findUnique({ where: { userId } })
  if (existing) return userSettings.parse(existing)

  const timeZone = input.timeZone ?? SETTINGS_DEFAULTS.timeZone
  // The settings row is what marks a user as provisioned, so it goes in last:
  // a seed that stops half way is run again on the next request.
  await seedPersona(db, { persona: STARTING_PERSONA, userId, now, timeZone })
  const created = await db.userSettings.create({
    data: { ...SETTINGS_DEFAULTS, userId, timeZone, createdAt: now },
  })
  return userSettings.parse(created)
}

/** Replaces everything the user has with a persona's content, laid over `now`. */
export async function reseedUser(
  db: Db,
  userId: string,
  persona: Persona,
  now: Date,
  timer?: SeedTimer,
): Promise<void> {
  const settings = await db.userSettings.findUniqueOrThrow({ where: { userId } })
  await seedPersona(db, { persona, userId, now, timeZone: settings.timeZone, timer })
  // A persona's world includes whether the Billing module is on in it.
  await db.userSettings.update({ where: { userId }, data: { billing: PERSONA_BILLING[persona] } })
}
