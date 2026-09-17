import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vite-plus'

// Tests at the Coordinator seam run inside workerd, against a local D1 with
// the real migrations applied (test/apply-migrations.ts).
export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.resolve(import.meta.dirname, '../../packages/db/migrations'),
  )
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          // The pool ships an older workerd than wrangler does; it cannot run
          // the date in wrangler.jsonc. Raise this when the pool is upgraded.
          compatibilityDate: '2026-08-22',
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      name: 'core',
      include: ['src/**/*.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
  }
})
