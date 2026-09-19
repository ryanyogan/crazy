# 17 — The timer bar: start, stop and note

**What to build:** Cori sees the timer bar on the Today screen. Idle, it preselects the most likely Client and Project and shows today's total and the last entry. She presses the square and it runs, showing elapsed time, Client and Project, since when, billable, and today's total for that Client. She types a note. She presses again and it stops. Her phone shows the same running timer as her desktop.

**Blocked by:** 06 — Live across devices: patches over a hibernating socket, 16 — Turn on the Billing module; the Cori persona

**Status:** done

- [x] Start, stop and set-note commands exist at the command seam with tests, including starting while one is running
- [x] The running timer is the Time entry with no end; nothing about it is held in the Coordinator
- [x] Elapsed time ticks in the browser from the entry's start and the injected clock, with no per-second server traffic
- [x] Idle preselection uses the last entry (calendar-based guessing is out of scope)
- [x] Start and stop appear on a second device within a moment
- [x] The bar renders only with the Billing module on
- [x] Visual diff against the idle and running states of frame 3a is noise-only

## Comments

### 2026-09-19 — built

**Built.** `timer.start`, `timer.stop` and `timer.setNote` at the command seam, run by the
Coordinator through the one write path. Two new operations, `timeEntry.insert` and `timeEntry.set`,
laid over the cache by `apply` like any other. The Today read model gains `timer`
(`packages/db/src/read/timer.ts`), read only with the Billing module on: the entry with no end, every
entry that touches today, and the last one that ended. Everything the bar shows beyond those rows —
elapsed, today's total, the running Client's share, the idle preselection — is derived by `viewTimer`
in `packages/shared/src/timer.ts`, from a moment handed in. The bar is
`apps/web/src/features/timer/`, styled in `apps/web/src/styles/timer.css`: frame 3a's strip across
the top of the screen on desktop, frame 3b's card on a phone, one DOM. The picker trigger is drawn
and disabled, and says why to assistive technology; choosing is ticket 18's. `tools/visual` learnt
to compare one part of a screen against a frame that draws only that part, and gained the `cori`
persona and the `3a` and `3a-running` targets.

**Checked.** `check`, `typecheck`, `test` (267), `build`. Nine command-seam tests pin the rules, and
two read-model tests in workerd pin today's totals and the preselection. `pnpm visual`: 3a idle
0.01%, 3a running 0.00%, and every frame before them unchanged. In two tabs of a browser: stop,
start and a note each appeared in the other tab within a moment, with no notices and no console
errors. Screenshots at 1180px and 390px of both states were looked at against the frame.

**Decisions taken.**
- Starting while a timer runs is refused with a reason, not quietly stopped and started; switching is
  ticket 18's `timer.switch`. Stopping with nothing running is refused rather than shrugged off,
  because inventing an end would invent hours.
- `timer.setNote` takes the entry's id, so the Time screen can word a stopped entry with the same
  command (ticket 20). An entry that is not the user's is refused; only their own are ever loaded.
- A Project's Client wins, and a Client that contradicts it is refused rather than overruled.
  Billable is `clientId !== null`, which is how the seed reads it. The four-combination matrix is 18's.
- The bar is the whole width of the screen beside the rail (1012px), with frame 3a's padding rather
  than frame 2a's, because 3a is the frame this ticket is measured against.
- With the Billing module on the timer's square is the screen's one solid accent fill, so the Take on
  now card gives its up and takes the tint (`.today--billing`). Frame 2a drops the card altogether;
  where it finally sits is ticket 19's.
- The browser never reads the clock for the present: `useTicking` adds `performance.now()` deltas to
  the moment the loader handed, and re-bases on every read. Nothing polls.
- A patch carries the Client's id, not its name. `apply` words a started entry from the names the
  cache already holds — which covers every start the bar can make, since it starts on the
  preselection — and `namesUnknownWork` makes a cache that cannot word it read the day again.
- The idle bar cannot be seen at a pinned moment by stopping the timer, because the Coordinator
  stamps the real clock. `POST /dev/seed?persona=cori&timer=idle` seeds the running entry already
  ended, at the moment everything is laid over; the harness passes it for the idle target.
- Frame 3a's last line in each state is a note about the mockup ("idle · dropdown preselects…",
  "Changing the dropdown while running splits the entry at now."), and its figures are quoted from no
  timesheet in the mockups. Both are masked with their reasons; the rest is compared whole.
