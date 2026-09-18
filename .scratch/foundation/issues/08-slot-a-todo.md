# 08 — Give a Todo a Slot on the timeline

**What to build:** Ryan drags a Todo from the Priority stack onto a free hour and it sits in that Slot; he can move it to another hour or take it off. On a phone, where dragging is not drawn, he uses a non-drag control to pick the hour. Meetings cannot be displaced. Slotting counts as Touched.

**Blocked by:** 04 — Today screen shows the hour timeline and Mentions, 05 — Complete a Todo: the first command, end to end and optimistic

**Status:** done — awaiting review

- [x] Commands for slotting, moving and clearing a Slot exist at the command seam with tests
- [x] A Todo cannot be slotted onto an hour a meeting fully occupies
- [x] Slotting marks the Todo as Touched
- [x] Desktop drag works with a pointer and has a keyboard equivalent
- [x] The phone control is listed as derived in the project brief
- [x] Optimistic, rolls back on failure, and appears in a second tab

## Comments

**2026-09-18 — agent.** Built, reviewed adversarially, and rebuilt where the review found holes.
On `4e0a708` (after ticket 13): `pnpm check` (no warnings), `typecheck`, `test` (189 tests, 33 of
them this ticket's; the suite is green under the machine's zone, `TZ=UTC` and
`TZ=Pacific/Kiritimati`) and `build` all pass. `pnpm visual 1a --url http://localhost:3108` reads
0.00% in every region at both widths; at `--now 2025-09-17T16:30` the timeline and the Priority
stack read 0.00% (the Brief, Mentions and top bar differ there only because the frame is drawn for
08:41). `pnpm visual 1e` still reads 0.00%.

Built:

- **Two commands at the seam** (`packages/shared/src/command.ts`): `todo.slot` (a Todo and an hour)
  and `todo.clearSlot`. Moving is `todo.slot` onto another hour — giving, moving and taking off are
  one decision, `slotOps`. One new operation, `slot.set`, which states every Slot the Todo holds on
  that day at once, so a patch laid twice ends the same and a patch laid over a Todo already on
  those hours does not even make a new state for the screen to read.
- **A Slot is decided against the day** (`CommandState` gained `day` and `events`): which day it is
  comes from the user's zone and the moment the command was taken, never from the browser.
  `loadCommandState` takes `now`, and loads the calendar and the Slots already held only for a
  command that `needsTheDay`.
- **Meetings cannot be displaced.** `meetingHolds` (`timeline.ts`) walks the meetings that touch an
  hour and answers whether they leave no minute of it free, so two back to back hold it between
  them while a single 30-minute meeting does not — which is what frame 1a draws at 11:00 and 16:00,
  where a Todo shares the hour with a meeting. `slotRefusal` holds every reason once, as a
  sentence, and `hourChoice` says the same in the two words a picker has room for.
- **A Todo keeps its length when it moves** (`hoursIfSlottedAt`): the two-hour spike dragged to
  11:00 holds 11 and 12, and is refused where its second hour would be a meeting.
- **Crazy's wording follows the Slots, and nothing deletes it.** Each `timeline_hour` row records
  the Todos it was written for (`writtenFor`, migration 0006; a sorted JSON array of Todo ids, as
  SQLite has no lists). `timeline()` uses the words while the hour still holds exactly those Todos
  and otherwise words the hour from what it holds now. So one hour freed three ways — the Todo
  completed, snoozed, or taken off it — reads the same way each time, and an hour put back the way
  Crazy planned it reads the way Crazy wrote it. `wordHour` names an empty focus block ("Focus")
  rather than calling it free.
- **The screen**: a stack row's words are what a pointer picks up (HTML drag and drop, no new
  dependency); every hour takes the drop, only the hours that can hold the Todo light up in the
  accent tint, and a drop that cannot land says why in a notice rather than doing nothing. The same
  opened row holds an hour picker labelled "Slot" — every hour of the day, and "No Slot" — which is
  the phone's way and the keyboard's; it is 36px tall below 900px, never disabled while a command
  is in flight (disabling it would throw the focus away), and an hour it cannot offer says why.
  The Todo's button carries an sr-only description of both ways to give it an hour.
- **Slotting is Touched**, and so is taking a Todo off the day. A Todo that has left the day
  (`done`, `backlog`, `archived`) answers a clear with nothing at all, so the asking cannot change
  what the Rollover does with it.
- **`covers`** gained the Slot row, so a Slot another tab had already given — where the Coordinator
  rightly answers with nothing — leaves the browser reading the truth again rather than holding its
  guess. **`namesAnotherDay`** is new: an operation for a day the cached screen is not showing is
  how a tab open across local midnight learns that its day is over, and `live.ts` reads everything
  again.

Checked in a browser (Playwright, Chromium, two contexts, against `vp dev --port 3108`; the script
is `slot-check.mjs` in this session's scratch folder, not in the repo — 30 checks, all passing):
dragging onto a free hour, moving, taking off; the hour under the pointer lights and no other, and
nothing stays lit when the drag leaves the timeline or crosses an hour that refuses; a drop on an
hour a meeting fills says "14:00 is a meeting, and Crazy never moves a meeting." and changes
nothing; the picker lists "14:00 — a meeting", disabled, and every other hour plainly; focus is
still on the picker 1.2s after a change; a Todo moved off its hour and back reads "Free" and then
Crazy's words again; a completed Todo's hour and a snoozed Todo's hour read as the free hour and
the focus block they now are, with no stale chip; a second tab shows the Slot with no server call
of its own; a forced 500 rolls back and says so; at 390px the picker is labelled, 36px tall, and
nothing scrolls sideways. An hour two meetings fill between them was checked by splitting the
seeded design review in two in the local D1 and reloading: refused in the picker, and a drop on it
says why.

Not checked: a real touch device (the picker is what a thumb uses; HTML drag and drop is not a
touch gesture), WebKit (Playwright's WebKit cannot start on this machine — missing system
libraries), and a signed-in Clerk user, as in 01, 06, 07 and 13.

For review:

- **The keyboard equivalent of the drag is the hour picker in the Todo's own row**, not the
  timeline: the timeline is not a keyboard drop target, and Slots cannot be given from it without a
  pointer. Everything the drag can do the picker does, with the same rule and the same words.
- **A Todo's length never grows.** `hoursIfSlottedAt` takes the hours it already holds, so a new
  90-minute Todo takes one hour; the estimate is not read. Whoever wires Crazy's own suggestions
  will want that.
- **A Todo keeps its length when it moves** was a decision this ticket did not make; the
  alternative is that a Slot is always one hour and a two-hour Todo shrinks when dragged.
- **Crazy's wording now steps aside rather than being deleted**, which is the reviewer's design.
  The cost is a column of bookkeeping (`writtenFor`) that the Brief Workflow must write when it
  words a day, and the schema comment says so.
- **A completed Todo keeps its Slots**; its hour reads free because the timeline is drawn from the
  stack. Nothing yet shows what was done in an hour — ticket 09's Start and the timer will want it.
- **A snoozed Todo cannot be given a Slot** (it has left the day) but can be taken off one.
- The picker offers the hours the timeline draws — 08:00 to 17:00 on the seeded day — while a
  command may name any hour of the day.
- Ticket 13's `overlap_note.timing` is seeded text ("Today 13:00 → 14:00") and does not follow a
  Slot, so moving a Todo the Circles screen calls an Overlap makes the two disagree. It is
  generated text with nothing generating it yet, like the Brief; worth one rule when either is
  wired.
