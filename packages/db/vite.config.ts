import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vite-plus'

// Tests at the read-model seam run inside workerd, against a local D1 with the
// real migrations applied and a persona seeded (test/apply-migrations.ts).
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.resolve(import.meta.dirname, 'migrations'))
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './test/wrangler.jsonc' },
        miniflare: {
          // Kept in step with apps/core/vite.config.ts.
          compatibilityDate: '2026-08-22',
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      name: 'db',
      include: ['src/**/*.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
  }
})
