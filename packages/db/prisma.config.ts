import { defineConfig } from 'prisma/config'

// D1 is reached through a Worker binding at runtime, so the CLI only needs a
// datasource for `migrate diff`. LOCAL_D1_URL points it at the SQLite file
// wrangler keeps for local development (see the README's migration steps).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.LOCAL_D1_URL ?? 'file:./prisma/dev.sqlite',
  },
})
