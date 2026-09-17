# 03 — Today screen shows the Brief, Take on now and the Priority stack

**What to build:** Ryan opens the Today screen and sees, exactly as drawn on desktop and phone: the greeting, date and refresh time; the Brief; the one solid Take on now card with its Todo, Project, estimate, fitting hours and reason; and the Priority stack with each Todo's Project, estimate, Source chip, carry count and reason, plus the footer counting what was carried over and what was sent back. All of it is read from D1 by a server-side loader. This ticket introduces the Todo, Project, Circle, Brief and Connection parts of the schema, the Ryan persona seed for them, the Today read model, and the UI primitives the screen needs (blueprint frame, button, tag, source chip). Start and Swap are drawn and not yet wired.

**Blocked by:** 01 — Walking skeleton: sign in and see the Shell, served from D1 through both Workers, 02 — Visual comparison harness: diff a route against its frozen frame

**Status:** done — awaiting review

- [x] Seeding the Ryan persona for a user id reproduces the mockup's Todos, Projects, Circles and Brief
- [x] The Today read model, at the pinned time, returns the mockup's Take on now and stack order (tested against a seeded local D1)
- [x] Take on now is derived from the Priority stack, and is absent when no `today` Todo remains
- [x] A Todo with a Source shows its Provider chip; a typed-in Todo shows none
- [x] A carried-over Todo shows "carried N days"
- [x] The solid accent fill appears exactly once on the screen
- [x] Controls not wired yet are disabled and announced as unavailable
- [x] Visual diff against frame 1a is noise-only for these regions at 1180px and 390px

## Comments

**2026-09-17 — agent.** Built. `pnpm check`, `typecheck`, `test` (47 tests) and `build` pass. `pnpm visual 1a`: `brief`, `take on now` and `priority stack` read 0.00% at 1180px and at 390px, beside `rail`, `top bar` and `tab bar`; the only red left in either diff is ticket 04's (timeline, Mentions, add a Todo). Checked in headless Chromium at both widths: no console errors or hydration warnings, one solid accent fill on the screen (the Take on now card), nine controls announced as unavailable, a tick does nothing when pressed.

How each box was met, where it is not obvious:

- **Schema.** Migration `0002` adds Connection, Circle, Project, Todo, Slot and Brief. "One Source, one open Todo" is a partial unique index, through Prisma's `partialIndexes` preview feature, so `migration:diff` knows about it. Days are local dates ("2025-09-17"); ids are handed in by the writer.
- **The seed** is `seedPersona(db, { persona, userId, now, timeZone })`, exported from `@crazy/db/write` so only the Coordinator can run it. It replaces everything the user has and lays the mockup's Wednesday over `now`. The Coordinator runs it when it provisions a new user (seed first, settings row last, so a half-finished seed is redone on the next request). `POST /dev/seed` on the dev server resets the signed-in user and honours the `crazy-now` pin; `pnpm visual` calls it before each frame, which is the reset-and-seed step ticket 02 left for this one.
- **The read model** is `readToday(db, userId, now, timeZone)`. Its seam tests run inside workerd against a migrated, seeded D1, as a third Vitest project (`packages/db/vite.config.ts`; it needs a test-only wrangler config so the Prisma client's WebAssembly import resolves).
- **Take on now** is `takeOnNow(priorityStack(todos), hourNow)` in the shared package: the top of the stack, absent when the stack is empty. Its hours are the Slots the Todo holds that have not yet passed.
- **Not wired.** `NotWired` in `@crazy/ui` sets `aria-disabled`, describes the control as "Not available yet" and swallows the press. It does not use `disabled`, because Industry fades a disabled button to 45% and the frame draws Start and Swap at full strength.

Decisions worth a look:

- **Carry count and reason are behind a press.** The ticket asks the stack to show both; frame 1a's rows draw neither, and the ticket also asks for a noise-only diff. So a row is the frame's until pressed, then "carried 1 day · the reason" opens under it (a button with `aria-expanded`). If carried-over Todos should be noticeable at a glance, the frame needs a treatment for it.
- **A typed-in Todo keeps the frame's "—" chip**, hidden from assistive technology, rather than no chip at all.
- **"1 sent back", not "1 moved to backlog".** The glossary lists the frame's wording as one to avoid, so the app uses the glossary's and the harness draws the frame the same way (`COPY` in `targets.ts`), as it already does for the wordmark. The Brief's own sentence is sample prose and is kept as drawn.
- **Slots came early.** "The hours it fits" is the Todo's Slots, so the Slot table and the stack Todos' Slots are in this ticket; ticket 04 has calendar events, Signals and the timeline left.
- **Energy** ("deep focus", "quick wins", "people & admin") is a Todo column, because the Take on now card words it. Grouping by it (frame 1b) stays out of scope.
- **Every new user is seeded as Ryan**, Clerk users included, until Providers are pulled. The spec's seed also takes a display name; nothing stores one (the greeting reads the account's), so it takes none.
- **On a phone** the frame draws no Start, Swap, date line or stack footer, and a shorter Brief and Take on now line; all follow the frame (`bodyShort` is a Brief column). Start and Swap will need a phone treatment in ticket 09. Listed under derived layouts in `docs/BRIEF.md`.
- **Which three Todos were carried over** is a guess beyond the two the timeline names: Sam's PR (1 day), the Q4 draft (2) and the movers deposit (1). The sent-back one is the Brief's August expense report. The reasons other than the Take on now's are written in the mockup's voice.
- **The Coordinator now queues its writes** (`inTurn`), because `_app` and the Today route load in parallel and both can find a new user unprovisioned; two provisions at once are tested.
- A day after seeding, the Brief and Slots are yesterday's and the screen shows less. Reseed.
