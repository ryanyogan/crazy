# 11 — Week screen

**What to build:** Ryan opens Week and sees, as drawn: the week header, the state of the union, the week in numbers, each day with done, planned and meetings, and where he ties in per Project. The Week brief and tie-ins are seeded; the numbers are computed from his Todos.

**Blocked by:** 03 — Today screen shows the Brief, Take on now and the Priority stack

**Status:** done — awaiting review

- [x] Seed includes the Week brief, tie-ins and enough Todos across the week to produce the mockup's numbers
- [x] Done of planned, focus hours and carried over are computed by query, not stored (read-model test at the pinned time)
- [x] Visual diff against frame 1c is noise-only at 1180px
- [x] The 390px layout is single-column, uses the same primitives, and is listed as derived

## Comments

**2026-09-18 — agent, built and left for review.** `pnpm check` (no warnings), `pnpm typecheck`,
`pnpm test` (180 tests, also under `TZ=Pacific/Kiritimati`) and `pnpm build` all pass.
`pnpm visual 1c` reads **0.00% whole frame** and 0.00% in every region; 1a is 0.00% at both widths
and 1e is 0.00%.

Built:

- **`packages/shared/src/week.ts`** (tested): `Week` — the rows the screen holds — and `viewWeek`,
  which derives every figure, every day's caption and the words under it. `clock.ts` gained
  `weekDays` and `isoWeek` beside ticket 13's `startOfWeek`.
- **`packages/db/src/read/week.ts`**: `readWeek(db, userId, now, timeZone)`. Six queries, every one
  filtered by `userId`, nested selects included; none reads the clock.
- **`apps/web/src/features/week/`** and `apps/web/src/styles/week.css`. Nothing on frame 1c is a
  control, so nothing needed `NotWired`.
- **Schema (migration `0007`)**: `week_day_note` holds the words Crazy adds beside a day's figures
  ("Q4 held"); `week_day_line` holds the few words for one Todo or one meeting, keyed to the thing
  it words so it leaves the card when that thing does; `tie_in` holds a tie-in for one Project in
  one week, keyed like the Week brief. `todo` gained `@@index([userId, state, doneAt])`.
- **The seed**: the mockups' week laid on the week's Monday, one day of it per weekday.

**Second pass, after review.** The seven findings and the rulings on them:

1. **The bars count Todos**, not hours, all seven days to one scale (the week's largest count).
   Hours stay in "focus so far" and in the sentence the bars are given for assistive technology,
   which now says both ("6 done, 3.5h; none planned; 2 meetings, 2h"). Meetings count on the same
   scale. Masks: the meetings third of each strip (no scale fits the frame's 40/60/60/30/50), and
   one or two pixels at the top edge of five Todo bars. Measured, in pixels of the 36px strip,
   frame against app: **Mon done 34/32, Tue done 26/27, Wed planned 37/37, Thu planned 23/22,
   Fri planned 17/17, Sat planned 7/6, Sun planned 5/6** — Wednesday and Friday are exact and are
   compared whole. Unmasked, "the week" reads 0.10% and the whole frame 0.02%; with the five
   1–2px masks both are 0.00%. Both masks are debts, recorded as such in `docs/BRIEF.md`.
2. **A Todo in `today` is planned for today**, Slot or no Slot, snoozed or not; a Todo holding a
   Slot on a later day is planned for that day; each Todo counts on one day only. In the browser:
   18/27 → add a Todo → **18/28** and today's caption "today · 8 planned" → tick it → **19/28**
   and "today · 7 planned". Tested at both seams.
3. **The persona's week is laid on `startOfWeek(today)` plus each day's weekday**, not on
   `today ± n`. Today is always the Today persona's day, so its weekday's content stands aside;
   a day behind today is seeded done, a day ahead planned, and every stamp that has already
   happened goes through `past()`. Wednesday gained content of its own for the weeks it is not
   today. Checked in the browser seeded on a Monday, a Friday and a Sunday (screenshots in the
   scratchpad): no blank working day, nothing finished in the future, work-day work on work days,
   the weekend personal. At the pinned Wednesday the screen is frame 1c exactly.
4. **A day's caption is derived** — "6 done · 3.5h focus", "5 of 7 · 2 carried", "today · 7
   planned", "4 planned", "milestone", "personal" — and only the prose Crazy adds is stored, as an
   optional note per day ("Q4 held", "Sam out"). Each line under it words **one thing** and is kept
   with it, so a Todo that leaves a day takes its line with it (tested), and "(carried)" is derived
   from the Todo's carry count. Tuesday's "Sam's PR (carried)" words the Todo Tuesday carried into
   today; Friday's "Movers deposit" words a Friday Todo of its own ("Check the movers deposit
   cleared"), because frame 1a puts "Send movers deposit" on Wednesday.
5. **A tie-in is a row for one Project in one week** (`tie_in`), read for the week being shown; the
   two Project columns are gone. Next week shows no tie-in and no Week brief (tested).
6. **No glossary-banned word is stored or exported**: the `summary`/`item` kinds are gone with the
   old table; what remains is a day's `caption` (derived), its `note` (stored) and its `lines`.
7–12. Nested `slots` select filters by `userId`; `@@index([userId, state, doneAt])` added in the
   same migration; day lines are keyed by row id; `weekSpan` and `weekPlace` are no longer
   exported; the seven day headings sit under an sr-only `<h2>`; and a week with no Week brief says
   "Crazy has not written about this week." under the heading (listed as derived).

What each figure means, in `week.ts` and here:

- A Todo is **done** on the day it was completed, and **planned** on today while it is in `today`
  or on the later day it holds a Slot on. A past day also shows what it **carried**: what is still
  open and was placed on it.
- **Todos done / of** counts Todos, each once. **Focus so far** is the hours those done Todos were
  estimated at — with the Billing module off there is no timer, so the estimate is all there is.
- **Carried over** is the Todos of this week that a Rollover has carried at least once.
- The week runs **Monday to Sunday on the user's wall clock**, numbered as the calendar numbers it;
  "day 3 of 5" counts the working week and a Saturday or Sunday reads "the weekend".

For review:

- **"4 carried over" on Week beside "3 carried over" on Today** is right: Today's footer reports
  what the last Rollover did, Week reports the Todos a Rollover carried at any point this week,
  one of which is finished. Until ticket 10 records each Rollover, `carryCount > 0` among the
  week's Todos is an approximation — a Todo carried only in an earlier week would be counted too.
  Said in the code, and the figure reads "carried over this week" to assistive technology.
- **Today's card is not accented.** Frame 1c's template has a `today` flag no call passes, so the
  frame draws every day alike and so does the app; a sighted user's only cue is "day 3 of 5" and
  `aria-current`. One rule away, and a question for the designer.
- **A snooze that ends next week** still leaves its Todo planned on today: a snooze is a day thing.
- **The Week read model is off the socket.** No command touches it, so `applyToCache` leaves it
  alone and it refetches like any other query — stale for at most the query's 30s staleTime.
- **Completing a Todo under a pinned `crazy-now` drops it out of both screens**, because the
  Coordinator stamps `doneAt` from the real clock. Pre-existing and not this ticket's; it is why
  the add-and-tick check above was run unpinned.
- Not looked at: any width between 900px and 1180px beyond the two the harness takes, and how the
  screen reads for a user with no Projects at all.
