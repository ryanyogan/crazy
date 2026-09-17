import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'ssr' },
      // The core Worker hosts the Coordinator. In dev it runs beside this one,
      // so the cross-Worker Durable Object binding resolves from one command
      // and both Workers share one local D1.
      auxiliaryWorkers: [{ configPath: '../core/wrangler.jsonc' }],
    }),
    tanstackStart(),
    viteReact(),
  ],
})
