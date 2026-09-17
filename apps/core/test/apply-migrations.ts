import type { D1Migration } from '@cloudflare/vitest-pool-workers'
import { applyD1Migrations, env } from 'cloudflare:test'

// TEST_MIGRATIONS is bound by vite.config.ts and exists only under test, so it
// is kept out of the Worker's Env type.
const { TEST_MIGRATIONS } = env as unknown as { TEST_MIGRATIONS: D1Migration[] }

await applyD1Migrations(env.DB, TEST_MIGRATIONS)
