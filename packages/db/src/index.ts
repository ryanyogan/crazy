import { type D1, type ReadDb, createClient } from './client'

// The reading side of the database: what the web app's loaders may use. The
// writing side is ./write, which only the Coordinator imports (ADR 0002).

export type { D1, ReadDb } from './client'
export type { UserSettings as UserSettingsRow } from './generated/prisma/client'
export * from './read/circles'
export * from './read/shell'
export * from './read/today'
export * from './read/week'

export function createReadDb(d1: D1): ReadDb {
  return createClient(d1)
}
