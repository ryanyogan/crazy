# 01 — Walking skeleton: sign in and see the Shell, served from D1 through both Workers

**What to build:** A developer runs one command and gets the whole system standing: the monorepo on Vite+, the server-rendered web app, the core Worker hosting a Coordinator that does nothing yet, a D1 database with user settings, and Clerk sign-in. A user signs in (or, with no Clerk keys, arrives as the demo user Ryan), has their settings row and Coordinator provisioned on that first request, and sees the Shell with the CRAZY wordmark, the six Billing-off destinations, their name and initials, and empty routes behind each destination. On a phone they see the bottom tab bar and a More screen. The Industry stylesheet is included as shipped, Barlow and Barlow Condensed are self-hosted, and the four design files are frozen under the docs folder. The agent-facing brief and the project brief are written. Fetch current docs for TanStack Start, the Clerk TanStack SDK, the Prisma D1 adapter, the Agents SDK and Vite+ before writing against them.

**Blocked by:** None — can start immediately

**Status:** done — awaiting review; the Clerk path is unexercised (no keys on this machine)

- [x] One dev command starts both Workers locally with D1 and the Coordinator bound across Workers
- [x] Format, lint, typecheck, test and build commands all pass from the root
- [x] With Clerk keys a user can sign in; without them the app runs as the demo user Ryan
- [x] First authenticated request creates the user's settings row and Coordinator; repeat requests do not duplicate them
- [x] The web app has no code path that writes to D1
- [x] Shell matches the frames' header and navigation at 1180px and the tab bar at 390px, switching at 900px, from one DOM
- [x] Every nav destination and the More screen resolve to a route
- [x] Fonts are served from the app; no request goes to Google Fonts
- [x] Every interactive element shows the accent focus ring
- [x] The agent-facing brief, the project brief and the frozen design files exist

## Comments

**2026-09-17 — agent.** Built. `pnpm check`, `typecheck`, `test` (13 tests) and `build` pass from the root; `pnpm dev` from a wiped state serves all nine routes, and repeated requests leave one `user_settings` row and one Coordinator. Checked in headless Chromium at 1180px and 390px: fonts load from the app and no request leaves localhost.

How each box was met, where it is not obvious:

- **Coordinator bound across Workers.** `apps/web/wrangler.jsonc` binds `COORDINATOR` with `script_name: "crazy-core"`; the Vite plugin runs core as an auxiliary Worker. Both Workers share one local D1 under `apps/web/.wrangler/state`, so `pnpm dev` applies migrations there first.
- **No write path in the web app.** `@crazy/db` exports only `createReadDb`, whose `ReadDb` type has no writing methods; `@crazy/db/write` is barred from `apps/web` by lint, as are `agents` (everywhere but `coordinator/sdk.ts`) and direct Prisma imports.
- **Provisioning.** `getShell` reads the settings row and calls `Coordinator.provision` only when it is missing, so a repeat request never wakes the Durable Object. The user is the one the Coordinator is named for, never an argument. Time zone comes from `request.cf.timezone`.
- **Industry "as shipped".** The shipped file's second line imports Google Fonts, which the fonts box forbids. The app's copy drops that one line and nothing else; the frozen copy in `docs/design` is untouched.

Not verified: signing in through Clerk. There are no keys here, so that path is typechecked only (it is `runway`'s, minus passkeys).

Decisions worth a look, all listed as derived in `docs/BRIEF.md`:

- The frames' Shell is a left rail, not a header, so that is what was built.
- The Live indicator reads "Not live yet" with a hollow dot until ticket 06, rather than claiming to be live.
- With the Billing module on, frame 2a omits Circles from the rail; the spec keeps all destinations, so Circles sits after Invoices.
- The demo user's display name is "Ryan Yogan" (`packages/shared/src/demo.ts`), a guess from the owner's email.
- The Agents SDK 0.23 has no `hibernate` option (the docs still show one); hibernation is its default.
- The Workers Vitest pool ships an older workerd than wrangler, so `apps/core/vite.config.ts` pins the test compatibility date to 2026-08-22.
- `git init` was run; nothing is committed.
