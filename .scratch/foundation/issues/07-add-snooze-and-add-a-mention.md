# 07 — Add a Todo, snooze a Todo, and add a Mention as a Todo

**What to build:** Ryan types a new Todo on the Today screen and it appears as a One-off with no chip. He snoozes a Todo and it leaves the stack until the snooze ends. He presses Add on a Mention and it becomes a Todo whose Source is the Mention's Provider item; the Mention then shows as added. Nothing ever becomes a Todo from a Signal without that press.

**Blocked by:** 04 — Today screen shows the hour timeline and Mentions, 05 — Complete a Todo: the first command, end to end and optimistic

**Status:** done — awaiting review

- [x] Commands for add, snooze and add-a-Signal exist at the command seam with tests
- [x] Creating and snoozing each count as Touched
- [x] A new Todo may have no Project and no Client
- [x] Adding a Mention creates a Todo with that Source and marks the Signal as added
- [x] Adding the same Signal twice, or a Signal whose Source already has an open Todo, creates nothing new
- [x] A Waiting on Signal cannot be added
- [x] All three are optimistic, roll back on failure, and appear in a second tab

## Comments

**2026-09-18 — agent.** `pnpm check` (no warnings), `typecheck`, `test` (134 tests) and `build` pass; `pnpm visual 1a` reads 0.00% in every region at both widths. The work was reviewed twice over (against the ticket, and against AGENTS.md, the glossary and the frames), checked in a browser, and the findings fixed before this was written.

Built:

- **Three commands at the seam** (`packages/shared/src/command.ts`): `todo.add` (the browser names the new Todo, so the optimistic row and the real one are the same row), `todo.snooze` (1 minute to a week; the screen offers `SNOOZE_CHOICES`: 30 min, 1 hour, 24 hours) and `signal.add`. Two new operations, `todo.insert` and `signal.set`; `apply` inserts or replaces, so a patch heard twice ends the same. `persistOps` and `loadCommandState` (`packages/db/src/commands.ts`) follow: the loader finds the open Todo a named Signal's Source already has, for that user only.
- **Snooze is a column, not a state** (`snoozedUntil`, migration 0004). The Todo stays in `today`; `isSnoozed(todo, now)` keeps it out of the Priority stack, Take on now and the timeline until the moment passes, and nothing has to wake it. `viewToday` now takes the moment, not the hour, and returns `snoozed`, soonest first. `useSnoozeExpiry` reads Today again when the first snooze ends. CONTEXT.md has a **Snooze** entry.
- **Adding a Mention**: a new `today` Todo with the Mention's Source, worded by `todoTitleFor` until Crazy writes better. Added twice, it answers with an empty patch. If its Source already has an open Todo the Mention is marked as that one and nothing is made; **if that Todo was in `backlog` it comes into `today` and is Touched**, because pressing Add is the user deciding it enters their day (spec story 43). One already in `today` is not Touched by this: attaching a Mention is not on the glossary's list.
- **The screen**: the place to add a Todo is wired (⌘K focuses it, the draft is kept until it is saved, whitespace is refused with a reason); a pressed stack row holds the three snoozes in a `fieldset`; snoozed Todos sit under the stack behind "N snoozed" with the day and time they return; a Mention's Add is wired. `docs/BRIEF.md` records the snooze controls and the snoozed list as derived layouts: no frame draws them.
- **`covers(guess, ops)`** (`command.ts`, tested). The browser decides against a cache that holds less than D1, so the Coordinator may rightly answer with fewer rows than the guess touched: an empty patch when another tab added the Mention first, or `signal.set` alone when the Source's Todo is in `backlog`, which Today's cache never holds. `useCommand` used to lay that patch over the optimistic cache and leave the guessed Todo behind, twice over once the socket brought the real one. Now, when the patch does not cover the guess, Today is read again. It does not put `before` back, which would throw away a patch that landed over the socket meanwhile.

Also fixed on the way:

- **The seed stamped things in the future.** The persona is laid over the moment of provisioning, and `touchedAt: at(0, '08:05')` is later than that before 08:05. `past()` in `packages/db/src/seed/ryan.ts` clamps everything that has already happened to the moment seeded over; calendar events stay ahead. A Coordinator test that compared against the seeded `touchedAt` passed or failed by time of day; it now says when the Todo was last touched. The three seams were audited for the same fault and run under `TZ=UTC`, UTC+14 and UTC−11: no other case.
- `live.ts`: a message the browser cannot parse now leads to a refetch rather than nothing.
- The Add button was disabled while the input was empty, which drew it at 45% and broke `pnpm visual 1a` (0.01%); `required` does that job now.

Checked in a browser (Playwright, two contexts against `pnpm dev`): each of the three shows within 100ms with the command held back 2.5s; a second tab shows each within 200ms with no server call; a 500, a dropped connection and a real refusal each roll back and say so, and a failed add keeps the draft; with the clock pinned past a snooze the Todo is back at its place; a second tab made deaf to the socket and pressing Add on a Mention the first had already added ends with one Todo, after a refetch; no console errors or hydration warnings; at 390px the snooze buttons are 36px tall and nothing scrolls sideways.

Not checked in a browser: adding a Mention whose Source already has an open Todo. No seeded Mention shares a Source with a Todo, so that rule is proved at the command seam and the Coordinator seam only. And, as in 01 and 06, a signed-in Clerk user.

For review:

- **A snoozed Todo cannot be ticked or woken early**, and nothing clears `snoozedUntil`. A 24-hour snooze is final until it ends. No control is drawn, so nothing is faked, but it is the obvious next ask.
- **A snoozed Todo's Slot.** Its hour on the timeline turns free, but keeps the seeded wording that names the Todo ("Send movers deposit · follow-ups"); `packages/db/src/read/today.test.ts` states this as it is. Either re-word an hour whose only Todo is snoozed, or keep it drawn as slotted.
- **"N carried over" counts the stack**, so snoozing a carried-over Todo lowers it until the snooze ends. The code says so; say if the footer should report the Rollover's morning count instead.
- **The Brief** goes on recommending a Todo after it is snoozed. It is stored text and is not re-derived.
- The `backlog` rule above is a decision taken here, not one the ticket made. A Todo it brings into `today` keeps its old `sentBackAt`; nothing reads that outside `backlog` today.
- A title made from a Mention is not capped at the 500 characters a typed one is.
