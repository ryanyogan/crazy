# 14 — Metrics screen: how you actually work

**What to build:** Ryan opens Metrics and switches between Week, 30 days and Quarter. He sees headline figures with their change, focus hours by hour of day, backlog ageing, where his Todos come from, and the 30-day completion heatmap. Simple figures are computed from back-dated seeded Todos; modelled figures and the commentary are seeded snapshots.

**Blocked by:** 03 — Today screen shows the Brief, Take on now and the Priority stack

**Status:** done — awaiting review

- [x] Seed includes back-dated Todos sufficient for the computed figures
- [x] Backlog ageing and Todo sources are computed by indexed queries (read-model test)
- [x] Modelled figures come from snapshot rows keyed by range
- [x] Switching range changes the data without a full page load and is reflected in the URL
- [x] Adds the stat tile primitive
- [x] Visual diff against frame 1f is noise-only at 1180px; the 390px layout is listed as derived

## Comments

**2026-09-19 — agent, built and left for review.** `pnpm check` (no warnings), `typecheck`,
`test` (223 tests) and `build` pass. `pnpm visual 1f` reads **0.00% whole frame** and 0.00% in
every region — `rail`, `head`, `headline figures`, `focus by hour`, `backlog ageing`,
`todo sources`, `the last 30 days`. Every other target still reads 0.00% in every region
(1a at both widths, 1c, 1e), so the back-dated seed Todos left Today, Week and Circles alone.

Built:

- **Two kinds of figure, and the line between them is the point.** **Counted:** backlog ageing
  and where the range's Todos came from, by `db.todo.count` over two new indexes
  (`todo(userId, state, touchedAt)` and `todo(userId, createdAt)`), never stored.
  **Modelled:** the six headline figures, the bars by hour of day, the thirty-day strip and the
  four lines of commentary — `metric_snapshot` (migration `0008`), keyed by range and by the day
  it was written for, the same standing as the Brief. A figure the screen can count is never
  stored there, and a day Crazy has not modelled shows none of the modelled ones and says so.
- **`packages/shared/src/metrics.ts`**: the ranges, the ageing bands, what a snapshot row is, and
  `viewMetrics` — bar lengths as a whole percent of the largest bar (the frame rounds the same
  way), the order the sources read, the strip's five darknesses, and a sentence per chart for
  anyone who cannot see it. Nothing there reads a clock.
- **`packages/db/src/read/metrics.ts`** and its workerd test at the pinned Wednesday: the ageing
  bands (14 / 9 / 5 / 6, 34 in all), the sources (LN 41, SL 27, NO 12, GM 9, You 33), a week
  counting fewer than a month and a quarter more, the modelled rows, the unmodelled day, and
  another user's rows staying theirs.
- **The seed**: ~146 back-dated Todos — a month of finished work, sixty days more behind it, and
  twenty still waiting in the three older bands. None is in `today`, holds a Slot, is matched to a
  Circle or was finished inside the week the Week screen shows, which is what keeps the other
  screens where they were.
- **`apps/web/src/features/metrics/`**, `apps/web/src/styles/metrics.css`, and **`StatTile` in
  `packages/ui`** (the six figures; it will be reused). Charts are plain DOM on the tokens, hidden
  from assistive technology and answered by a sentence that reads out every figure in them.

Decisions the ticket did not make:

- **Ranges are trailing windows** ending today — 7, 30 and 90 days — because the frame's deltas
  read "vs last 30d". **Backlog ageing does not move with the range**: it is the backlog as it
  stands, not a span. **The thirty-day strip stays thirty days at every range**, because that is
  what the card says, so it is stored once and read at the 30-day range.
- **Ageing is measured from `touchedAt`**, not `createdAt` — the same clock the archive period
  runs on, which is what "6 items cross 90 days on 29 Sep and archive" is about.
- **"Where your todos come from" counts Providers, not kinds of Source** (`PROVIDER_LABELS`, new
  in shared): Gmail and Calendar are both Google, which is how frame 1g counts too and how user
  story 78 words it. Providers first, largest first; what the user typed himself last.
- **The range is the URL's**, validated on the route with zod and again in the server function.
  `/metrics` normalises to `/metrics?range=30d`. Checked in a browser at :3114: picking a range
  changes the URL with **zero further page loads**, back returns to the previous range, a deep
  link to a range works, and there is no sideways scroll or console noise at 1180px or 390px.
- **The screen has two solid accent fills, not one**, because frame 1f draws two: the chosen
  range, and the peak bar of the hours chart. Followed the frame.
- **"Backlog ageing" where the frame says "Backlog aging"** — a sixth deliberate difference, in
  `COPY`, because the repo (and this ticket) write British English.

For review:

- **One new mask, a debt.** Frame 1f gives each bar of "Focus hours by hour of day" a percentage
  height inside a grid row of automatic height, so it resolves to nothing and **the frame draws no
  bars at all** — ten hour labels over empty space. The app puts the bar in a row of its own and
  draws them; the labels underneath keep the frame's baseline to the pixel and are compared. The
  mask is the bar area only, and goes when the frame draws its own bars.
- **The modelled figures are written for a day.** A day after seeding, the six figures and the
  strip are gone and the screen says so, exactly as the Brief does. Reseed, or say if they should
  instead be read at the newest day Crazy has looked.
- **Metrics is off the socket**, like Week and Circles: no command touches it, so it refetches on
  the 30s `staleTime` rather than taking patches.
- Not checked: a signed-in Clerk user; widths between 900px and 1180px beyond the two the harness
  takes; a user with no history at all beyond the empty-state lines the tests cover.

Screenshots (uncommitted, in the worktree): `.scratch/foundation/shots/14/metrics-{week,30d,quarter}-{1180,390}.png`.
