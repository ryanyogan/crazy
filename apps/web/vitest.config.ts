import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vite-plus'

// Test only, and separate from vite.config.ts, which builds the app. The web
// app's one server seam that moves bytes — the Attachment routes' handlers —
// is exercised inside workerd against a local D1 with the real migrations
// applied, a local R2 bound as `ATTACHMENTS`, and the real Coordinator
// (test/wrangler.jsonc). Screens are not tested here: no component unit tests.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.resolve(import.meta.dirname, '../../packages/db/migrations'),
  )
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './test/wrangler.jsonc' },
        miniflare: {
          // Kept in step with apps/core/vite.config.ts: the pool ships an older
          // workerd than wrangler does.
          compatibilityDate: '2026-08-22',
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      name: 'web',
      include: ['src/server/*.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
  }
})
