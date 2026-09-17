import type { UserSettings } from '@crazy/shared'
import type { ReadDb } from '../client'

/** The user's settings, or null if they have not been provisioned yet. */
export async function readUserSettings(db: ReadDb, userId: string): Promise<UserSettings | null> {
  const row = await db.userSettings.findUnique({ where: { userId } })
  if (!row) return null
  const { createdAt: _createdAt, ...settings } = row
  return settings
}
