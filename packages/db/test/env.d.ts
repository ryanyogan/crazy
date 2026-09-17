import type { D1Migration } from '@cloudflare/vitest-pool-workers'
import type { D1 } from '../src/client'

// What packages/db/vite.config.ts binds for the read-model tests.
declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1
    TEST_MIGRATIONS: D1Migration[]
  }
}
