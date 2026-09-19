# 09 — Start and Swap on Take on now

**What to build:** Ryan presses Start and the Take on now card changes to its started state; the Todo is now Touched. He presses Swap and the next fitting Todo becomes Take on now, while the declined one sits one place lower for the rest of the day and is not Touched. With the Billing module off the started state has no frame: it reuses the running timer bar's treatment without the picker.

**Blocked by:** 05 — Complete a Todo: the first command, end to end and optimistic

**Status:** done — awaiting review

- [x] Start and Swap commands exist at the command seam with tests
- [x] Start marks the Todo as started and Touched
- [x] Swap lowers the Todo one place, changes no state, and does not mark it Touched
- [x] A swapped Todo stays lowered for the rest of that local day and not beyond it
- [x] Swapping the last fitting Todo leaves no Take on now card
- [x] The started state is listed as derived in the project brief
- [x] Optimistic, rolls back on failure, and appears in a second tab

## Comments

**2026-09-19 — agent.** `pnpm check` (no warnings), `typecheck`, `test` (223) and `build` pass;
`pnpm visual 1a --url http://localhost:3109` reads 0.00% in every region at both widths.

Built:

- **Two commands at the seam** (`packages/shared/src/command.ts`): `todo.start` and `todo.swap`.
  Both reuse the existing `todo.set` operation, so `apply`, `covers` and the patch shape are
  unchanged. Start sets `startedAt` and `touchedAt`; Swap sets `swappedOnDay` and nothing else —
  not the state, not `touchedAt`, so a Todo dodged all day is still sent back at the Rollover.
- **Two columns on Todo** (migration `0008_start_and_swap.sql`): `startedAt` (a moment) and
  `swappedOnDay` (a local day, as a Slot's `day` is). A Swap lasts exactly as long as that string
  matches the day derived from `now` and the user's zone — no clock is read to expire it.
- **The stack and the Take on now follow** (`today.ts`): `priorityStack` adds 1 to a swapped Todo's
  place, and `takeOnNow` is the highest Todo the user has not declined today. So swapping promotes
  the next one and drops the declined one a place; swap everything and there is no card at all.
- **The card** (`TakeOnNowCard.tsx`): Start and Swap are wired through `useCommand`, so both are
  optimistic and roll back. Started, the card takes the running timer bar's treatment from frame 3a
  — accent tint, accent hairline — without the picker, and says "Started · since 09:12" where the
  buttons were.

Checked by eye at 1180px and 390px, un-started / started / after a Swap
(`.scratch/foundation/shots/09/`, uncommitted): the started card reads cleanly at both widths, Swap
promotes Priya's reply and leaves the spike one place below it, nothing scrolls sideways at 390px,
no console errors. Not exercised this time: a forced rollback, a second tab, a keyboard walk, and a
signed-in Clerk user.

Decisions taken here that the ticket did not make:

- **Swap lowers by exactly one place, and the Take on now skips what was declined.** Lowering alone
  would offer a declined Todo again after the next Swap; skipping alone would not move it. Both
  together give the ticket's two sentences and checkbox 5. After two Swaps the stack can read A, C,
  B while C is on offer — the top of the stack is not always the Take on now, which the glossary
  already allows ("the highest in the Priority stack that fits").
- **The started state does not expire on its own.** `startedAt` is a moment and nothing derives a
  day from it, so the Rollover (ticket 10) should clear it when it carries a Todo over; until it
  does, a Todo started yesterday and carried over still reads as started. I tried day-scoping it in
  the view and backed it out: the Coordinator stamps its own real clock while a dev request can pin
  the page's, so under `--now` the started state never appeared.
- **Swap is the same dev-clock asymmetry**: `swappedOnDay` is the Coordinator's day and is read back
  against the page's, so under a pinned `--now` a Swap does not survive a reload. Slots already
  behave this way (`slot.set` carries the Coordinator's day); it does not arise outside the harness.
- **Swap goes when the card is started** — a Todo taken on is not one being declined — and there is
  no way to un-start. Nothing is drawn for either, so nothing is faked.
- **The card gives up the solid accent fill while started**, so a started Today screen has no solid
  accent object. The timer bar keeps its accent on the square Stop; with the module off there is no
  Stop to put it on.
- **Start and Swap stay desktop-only.** The phone frame draws no actions inside the Take on now card
  the harness compares, so wiring them below 900px breaks `pnpm visual 1a`. Recorded in
  `docs/BRIEF.md` as needing a frame.
- `decide` does not check that the Todo being swapped is in fact the Take on now — it is decided
  against the rows it names, not the whole stack — so the screen is what keeps Swap on the one card.
