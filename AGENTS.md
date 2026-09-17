# Crazy — brief for agents

Crazy is one place that reads a person's work and personal tools and tells them what to do with
today. Work and personal life sit in the same day on purpose. People who bill for their time turn
on the optional **Billing module** (timer, Time entries, Clients, invoices) inside the same Shell.

**Read `CONTEXT.md` before naming anything.** It is the glossary: Todo (not task), Provider and
Connection (not integration), Shell, Today screen, Rollover, Carried over, Sent back, Side, and so
on. Each entry lists the words to avoid.

Then read the two ADRs in `docs/adr/`; they overrule `docs/design/CLAUDE-CODE-NOTES.md` wherever
the two disagree. The longer picture — what is real, seeded and scaffolded, and what comes next —
is `docs/BRIEF.md`.

## Where things live

```
apps/web         TanStack Start (SSR) on a Worker. Routes, loaders, server functions, Clerk.
apps/core        Worker with no UI. Hosts the Coordinator (one Durable Object per user).
packages/shared  Pure TypeScript: zod schemas and domain rules. No Workers or React imports.
packages/db      Prisma schema, generated client, SQL migrations, read-model queries.
packages/ui      The Industry stylesheet, self-hosted fonts, React primitives.
tools/visual     The visual comparison harness: a route against its frozen frame (`pnpm visual`).
docs/design      The frozen design source. Never edit; compare against it.
.scratch/        Specs and tickets (see docs/agents/issue-tracker.md).
```

In `apps/web`, screen-specific code is grouped by feature under `src/features/`. A primitive used
by more than one screen belongs in `packages/ui`.

## Rules that hold

- **D1 is the only source of truth, and only the Coordinator writes to it** (ADR 0002). The web app
  reads D1 through `@crazy/db` and hands every change to `coordinatorFor(userId)`
  (`apps/web/src/server/coordinator.ts`). `@crazy/db/write` may not be imported in `apps/web`; lint
  enforces it and `ReadDb` has no writing methods.
- **Every change is a command** (`packages/shared/src/command.ts`). `decide` holds the rule and
  returns operations or a refusal; `apply` lays operations over state. The browser runs both on
  its cache through `useCommand`, the Coordinator runs the same two in `command()`. A new write is
  a new member of `command`, a case in `decide`, and tests at that seam — never a second path.
- **The Coordinator holds no domain data** and never awaits a Provider or an LLM. The Agents SDK is
  pinned and imported only by `apps/core/src/coordinator/sdk.ts`; `setState` is banned. Every public
  Coordinator method starts with `await this.ready()`.
- **Clerk is the only credential store** (ADR 0001). Never persist a third-party token. Providers
  are read-only; Crazy never changes a Source.
- **The current time is always a parameter.** Nothing in `packages/shared`, the read models or the
  Coordinator reads the clock. It enters in two places: `apps/core/src/clock.ts` for the
  Coordinator, and `requestNow(timeZone)` in `apps/web/src/server/clock.ts` for loaders and server
  functions, which the dev server lets a request pin. Components never call `new Date()` for the
  present; they format the moment their loader handed them. No column defaults to now.
- **Every row carries `userId`** and every query filters by it.
- **Styles are plain CSS on the Industry tokens.** `packages/ui/src/styles/industry.css` is the
  design system as shipped: do not edit it, and take every colour, font, space and shadow from its
  variables. App styles live in `apps/web/src/styles/`. Lucide icons at stroke 1.5. Fonts are
  self-hosted; no request may go to Google Fonts.
- **One DOM serves phone and desktop**, mobile first, one breakpoint at 900px, desktop capped at
  1180px. The solid accent fill appears once per screen.
- **Nothing is faked.** A control that is not wired renders disabled and says so to assistive
  technology. Every interactive element keeps the accent focus ring.
- **Tests state behaviour a user would recognise** and assert at a seam: the shared package (most
  tests), the Coordinator (`apps/core`, inside workerd), the read models (`packages/db`, inside
  workerd against a seeded D1). No component unit tests.
- TanStack Start, the Clerk TanStack SDK, the Prisma D1 adapter, the Agents SDK and Vite+ all move
  quickly. Fetch their current docs before writing against them.

## Commands

```sh
pnpm install
pnpm dev          # http://localhost:3000 — migrates local D1, runs both Workers
pnpm check        # format (Oxfmt) + lint (Oxlint), via Vite+
pnpm typecheck
pnpm test         # Vitest via Vite+: shared unit tests; the Coordinator and read-model seams in workerd
pnpm build
pnpm visual 1a    # diff a route against its frame; no argument runs them all (docs/BRIEF.md)
```

With no keys configured the app runs as the demo user, the Ryan persona. `curl -X POST
localhost:3000/dev/seed` puts the seeded content back as of now (docs/BRIEF.md, "Seeded data"). For Clerk, copy
`apps/web/.env.example` to `apps/web/.env.local` and fill it in.

After editing `schema.prisma`: `pnpm db:generate`, then write the next migration with
`pnpm --filter @crazy/db -s migration:diff > packages/db/migrations/000N_name.sql` (`LOCAL_D1_URL`
must point at the SQLite file under `apps/web/.wrangler/state/v3/d1`). `pnpm dev` applies it.
