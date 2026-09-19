import { type D1, type Db, createClient } from './client'

// Writing to D1 from anywhere other than the Coordinator bypasses per-user
// ordering and the broadcast (ADR 0002). Lint forbids this import in apps/web.
//
// D1 has no interactive transactions; the Coordinator serialises each user's
// writes instead. Order multi-statement writes so they are safe to re-run.

export type { Db } from './client'

export function createDb(d1: D1): Db {
  return createClient(d1)
}

export { type SeedInput, type SeedTimer, seedPersona } from './seed'
export { loadCommandState, persistOps } from './commands'
