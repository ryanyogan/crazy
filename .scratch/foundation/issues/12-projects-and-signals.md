# 12 — Projects screen with Promises and Waiting on

**What to build:** Ryan opens Projects and sees each Project with its Circle, open count, status, derived progress, next milestone and what is on today. He filters by All, Work and Personal. He expands a Project to see today's Todos and its backlog with ages. Below are his Promises, which he can turn into Todos all at once, the Waiting on list, which he cannot, and the lifecycle note with how many Todos archive soon.

**Blocked by:** 03 — Today screen shows the Brief, Take on now and the Priority stack, 07 — Add a Todo, snooze a Todo, and add a Mention as a Todo

**Status:** done — awaiting review

- [x] Progress is done over total of the Project's Todos, computed by query
- [x] The filter uses the Side derived from each Project's Circle (Side derivation tested at the command seam or read-model seam in each fallback order)
- [x] Expanding a Project shows its `today` Todos and its backlog with ages
- [x] "Turn all into todos" adds every Promise not already added, each with its Source, and is optimistic
- [x] Waiting on entries offer no way to become Todos
- [x] The archive-soon count comes from real ageing
- [x] Adds the table and segmented-control primitives
- [x] Visual diff against frame 1d is noise-only at 1180px; the 390px layout is listed as derived

## Comments

**2026-09-19 — agent.** `pnpm check` (no warnings), `typecheck`, `test` (224 tests) and `build`
pass. `pnpm visual 1d` reads **0.00% whole frame** and 0.00% in every region — `heading`,
`projects`, `expanded`, `promises`, `waiting on`, `lifecycle`. 1a is 0.00% at both widths, 1c and
1e 0.00%: the seed's new rows leave the built screens where they were.

Built:

- **`packages/shared/src/projects.ts`**: the rows the screen holds and `viewProjects`, which
  derives progress, the milestone wording, the ages and the lifecycle sentence. `sideOf` holds the
  glossary's fallback order — Circle, then the arriving Connection's default, then no Side at all —
  and is what the filter runs on; a Project has only the first of the three.
- **`packages/db/src/read/projects.ts`**: `readProjects(db, userId, now, timeZone)`. Progress and
  the open count are a `groupBy`, never a stored column; the archive-soon count is read off how
  long each backlog Todo has gone untouched. Every query filters by `userId`.
- **`signal.addAll` at the command seam.** `signal.add`'s whole rule moved into `addOneSignal`, and
  both commands run it — one Signal for `add`, a run of them for `addAll`, each decided against
  what the ones before it made, so two Promises at the same Provider item end as one Todo. A
  Promise already added decides nothing.
- **The screen** (`apps/web/src/features/projects/`, `apps/web/src/styles/projects.css`), the
  `Table` and `SegmentedControl` primitives in `packages/ui`, and `readProjects` behind
  `projectsQuery`. The query carries a `seq`, because a patch lands on it.
- **`useCommand` now decides against the cache that holds the Signals a command names.** Today's
  cache holds Mentions and the Projects cache holds Promises, and neither holds the other's; both
  are cancelled, patched and put back.
- **The seed**: the Promises and Waiting on frame 1d draws, and the history behind each Project —
  what it finished and what was archived without being done — filled only as far as the frame's
  totals need, so the figures hold whichever weekday the persona is laid over. Six One-offs
  untouched for 78 days are what the lifecycle note counts.

Checked in a browser at 1180px and 390px, as it opens, with the Personal filter on, with another
Project opened and after "Turn all into todos" (screenshots in `.scratch/foundation/shots/12/`,
uncommitted): the Promises all read "Added to your Todos" and the button disables itself, the
Project counts do not move because the new Todos are One-offs, nothing scrolls sideways at either
width, and the console is clean in both.

Decisions taken here, not ones the ticket made:

- **Progress is done over every Todo the Project has ever held, archived ones included.** Work
  dropped counts against the Project rather than vanishing from it, and it is the only reading of
  the frame's five percentages that is a whole number of Todos.
- **The first Project is open when the screen arrives**, because frame 1d draws one expanded and no
  way to have chosen it. Pressing another opens it; pressing the open one closes it.
- **The backlog reads oldest-added first and each row says how long since it was last touched**,
  which is what decides when it archives. Only the three the card has room for are drawn.
- **The Promises and Waiting on are listed in the order Crazy noticed them, newest first** — not the
  order they happened, which is why the frame's ages do not descend. Mentions on Today still read by
  when they happened; the two lists could be made to agree either way.
- **The squares beside a Project's `today` Todos are marks, not checkboxes.** Nothing on this screen
  changes a Todo's state, so nothing is drawn as though it could.
- Two masks on frame 1d, both debts for the designer and both recorded in `docs/BRIEF.md`: the
  frame's third "Today's children" row is a Todo completed today, and seeding one would add a done
  row under frame 1a's frozen Priority stack; and the frame's "12 open", "Backlog · 9" and "2 on
  today" cannot all be true, so the app honours the open count the table draws and says
  "Backlog · 10". Six wordings are drawn into the frame instead of masked, listed in `docs/BRIEF.md`.

Not checked: a signed-in Clerk user, as in 01, 06 and 07; the screen under a patch from a second
device (the command is on the socket like every other, but only one tab was exercised); and the
rollback path, which is `useCommand`'s and unchanged but for which cache it puts back.
