# 05 — Complete a Todo: the first command, end to end and optimistic

**What to build:** Ryan ticks a Todo and it completes instantly; if the server refuses, it visibly un-ticks. This is the tracer bullet for every later write. It establishes the command seam in the shared package (a pure decide function from state, command and time to patch operations, and a pure apply function), the optimistic mutation hook that runs those functions against the query cache, the server function, and the Coordinator's single write path: load, decide, persist to D1, stamp a sequence number, return the patch. Completing the Take on now promotes the next fitting Todo.

**Blocked by:** 03 — Today screen shows the Brief, Take on now and the Priority stack

**Status:** done — awaiting review

- [x] Decide and apply are pure, take the current time as a parameter, and import nothing from Workers or React
- [x] Command-seam tests cover completing a Todo from each state and the resulting Take on now
- [x] The browser and the Coordinator call the same decide and apply functions
- [x] The tick shows before the server responds, and rolls back with a visible error when the Coordinator rejects it
- [x] The Coordinator is the only writer to D1 and returns the patch with the next sequence number (tested in the Workers test pool against local D1)
- [x] Two commands for one user sent at once are applied one after the other
- [x] After a reload the completed Todo is still done

## Comments

**2026-09-17 — agent.** Built. `pnpm check`, `typecheck`, `test` (78 tests) and `build` pass; `pnpm visual 1a` still reads 0.00% at both widths. Exercised in headless Chromium against `pnpm dev`: with the server's answer held back, the ticked Todo had already left the stack, the header read "6 todos" and the Take on now had become "Reply to Priya on edge rate limits"; after a reload it was still done; with the write made to fail, the Todo went back into the stack and a notice said so.

The seam, for every later write to follow:

- **`packages/shared/src/command.ts`.** `command` (a zod union, one member so far: `todo.complete`), `decide(state, command, now)` returning `{ ok, ops }` or `{ ok: false, reason }`, and `apply(state, ops)`. Operations are row-level (`todo.set` with the columns to set, moments as ISO strings) so they persist to D1, apply to a cache and travel as JSON unchanged. `apply` works on any state that holds `todos`, and ignores rows the state does not hold, so one patch can be laid over every cached read model. `todosNamed(command)` tells a loader which rows a command needs.
- **Rules for completing:** `today` and `backlog` become `done` as of now; already `done` is accepted and changes nothing (two devices ticking at once); `archived` and unknown are refused with a sentence written for the user. Completing is not a touch: the glossary's list of touches does not include it and a done Todo never meets a Rollover.
- **The Take on now needs no rule.** It is derived (`viewToday`), so completing it promotes the next Todo in the browser and on reload alike; the tests assert that through the view.
- **The Coordinator's write path** is `command(input)`: parse, then in the user's turn: `loadCommandState` → `decide` → `persistOps` → stamp → answer. A refusal is an answer (`{ ok: false, reason }`), spends no sequence number and writes nothing; only a failed write throws. `loadCommandState` and `persistOps` live in `@crazy/db/write`, filter by `userId`, and hold no rules.
- **Sequence numbers** come from `PatchLog` (`apps/core/src/coordinator/patches.ts`), a table in the Coordinator's own SQLite that also keeps the last 200 patches for ticket 06. It is bookkeeping about what was committed, which ADR 0002 allows; D1 holds everything a patch says.
- **The browser** sends through one server function, `sendCommand`, and one hook, `useCommand` (`apps/web/src/lib/useCommand.ts`): cancel in-flight reads, `decide` + `apply` on the cache, send, lay the Coordinator's patch over the guess on success, and on failure restore the snapshot, tell the user (`Notices` in the Shell, `role="alert"`) and refetch.
- **The read model** now includes Todos completed on the user's day, so a tick is still visible after a reload. They sit under the stack, ticked and struck through ("Done today"). The frame draws no done Todo, so this is a derived treatment, listed in `docs/BRIEF.md`.

Decisions worth a look:

- **Un-ticking is not a command.** A done Todo's tick is checked and announced as unavailable. If un-completing is wanted it is one more member of `command`.
- **The browser reads its clock in one place** (`apps/web/src/lib/clock.ts`), only to stamp the optimistic guess; the Coordinator's patch replaces it. Screens still format the loader's moment.
- **A pinned development clock and the Coordinator disagree.** The Coordinator stamps `doneAt` from the real clock, so under a `crazy-now` pin in 2025 a Todo ticked "today" is done in 2026 and drops off the pinned day on reload (it stays done and out of the stack). Unpinned, it behaves. If that matters for a frame, the pin would have to travel with the command.
- **The timeline keeps its seeded wording** for an hour whose Todo was completed (noted in ticket 04).
- `lucide-react` is now a dependency of the web app (the dismiss icon), at the version the workspace had already allowed.
