# 13 — Circles screen

**What to build:** Ryan opens Circles and sees the groups he moves in, each with its Side, and this week's Overlaps with their Circles, people and timing, plus the note that Circles are inferred and his to correct. Circles and Overlaps are seeded.

**Blocked by:** 03 — Today screen shows the Brief, Take on now and the Priority stack

**Status:** done — awaiting review

- [x] Seed reproduces the mockup's Circles and Overlaps
- [x] An Overlap is stored as a Todo matched to more than one Circle
- [x] Visual diff against frame 1e is noise-only at 1180px; the 390px layout is listed as derived
- [x] No rename or merge control is invented

## Comments

**2026-09-18 — agent.** `pnpm check` (no warnings), `typecheck`, `test` (153 tests, green again
under `TZ=Pacific/Kiritimati`) and `build` pass. `pnpm visual 1e` reads 0.00% in every region at
1180px — whole frame, `rail`, `heading`, `figure`, `overlaps` — with no mask but the rail-foot one
1c–1g already carry. `pnpm visual 1a` is still 0.00% in every region at both widths, so the seed's
new rows leave the Today screen exactly where it was.

Built:

- **An Overlap is a Todo matched to more than one Circle, and nothing else.** Migration 0005 adds
  `circle_match` (one Todo, one Circle, carrying `userId`) and gives `circle` the two things Crazy
  infers with it: `people` and `providers`. `readCircles` (`packages/db/src/read/circles.ts`) reads
  the matches and keeps the Todos with more than one; a Todo with one match is simply not an
  Overlap, which `circles.test.ts` states against "Send movers deposit".
- **This week** is computed from the `now` the loader was handed, in the user's zone: `startOfWeek`
  takes the Monday, and an Overlap is this week's when **Crazy noticed it this week** — the last of
  its matches falls inside the Monday–Sunday week — and its Todo is not archived. Tests read at
  literal moments: the Sunday that ends the week (listed), the Monday that starts the next (gone),
  and a persona laid over a Monday morning (listed). Nothing in shared or the read model reads a
  clock.
- **The wording is stored where generated text lives.** `overlap_note` holds why the Todo serves
  both Circles, who is in it, when it lands, and the two short lines the mockup writes inside the
  figure — the same standing as the Brief and `timeline_hour`. The note is not the Overlap: a note
  on a Todo with one match shows nothing, and a match with no note is still an Overlap, listed by
  its Todo's own words (`text`, `people` and `timing` are nullable; the card leaves out what is not
  there).
- **The rules are derived in `packages/shared/src/circles.ts`, with tests:** which Circle takes
  which seat (the work Circles take the three seats that cross, the one with most people first; a
  personal Circle takes the seat that stands apart), how a Circle is drawn (**a personal Circle is
  a dashed outline wherever the figure seats it; a work Circle is washed in wherever it sits** —
  both stated as tests for four work Circles and for two work plus two personal), which seat pairs
  can hold a lens, which Overlap is written in one, the order the Overlaps read, "Four Circles this
  week" and "12 people", "Gmail · Cal". `SOURCE_KINDS` gained a `short` name so the figure can say
  "Cal" where the chip says "CAL".
- **Where the figure puts things** is `apps/web/src/features/circles/figure.ts`: a table of marks,
  one per seat and one per lens, checked by the compiler against the shapes in shared. `packages/
  shared` keeps the rules and holds no pixels.
- **The screen** (`apps/web/src/features/circles/`, `apps/web/src/styles/circles.css`) is one DOM
  for both widths on Industry tokens. The drawing is hidden from assistive technology and its
  `<figcaption>` reads out the same Circles and the same Overlaps. No control is drawn, because the
  screen changes nothing — the note about renaming and merging is text, as the spec's out-of-scope
  list says it should be. Zero focusable elements on the screen.
- **Two words the glossary keeps off a Circle and a Provider.** The screen says "Four Circles this
  week" where the frame says "Four groups", and "which Providers the work lives in" where it says
  "which tools"; `COPY` in `tools/visual/src/targets.ts` draws the frame saying the same, as Today
  does for "1 sent back", and `docs/BRIEF.md` lists all five deliberate differences.
- `docs/BRIEF.md` records the schema (seeded — nothing writes a match or a note yet), the screen,
  the phone layout and the "Not in the picture" line.

Checked in a browser (Playwright against the dev server on :3113, **with the clock pinned to the
frame's moment and again unpinned**): at 1180px the rail's Circles link opens the screen and marks
itself active, four Overlap cards draw, four rings of which exactly one is dashed and three washed,
the lede and the note read as above, the figcaption reads out every Circle and every lens, there
are no focusable elements, and the page scrolls neither way; at 390px Circles is reached through
More, the figure scales to 352px keeping its proportions, and nothing scrolls sideways. No console
errors, warnings or hydration warnings in any of the four runs. Screenshots in `.visual/`.

Not checked: a signed-in Clerk user (as in 01, 06 and 07); the screen under a live patch, because
no command touches a Circle yet.

For review:

- **"This week" means the week Crazy noticed the Overlap in** — the last of its matches — and the
  Todo is not archived. A decision taken here, not one the ticket made. It is not the Todo's own
  dates: the frame lists "Move day is a Wednesday" (1 Oct) under "Overlaps this week", so the week
  is about when Crazy looked. The seed stamps every match at 08:05 this morning, so the demo user
  never opens an empty screen whatever weekday the persona is laid over. Nothing finished stays on
  the screen past the week it was matched in, and a Todo completed today still shows: say if a done
  Overlap should drop out at once instead.
- **The Overlaps are ordered** by how many Circles they serve, then oldest Todo first.
- **The four Overlaps are seeded as `backlog` Todos**, because a `today` Todo would have walked into
  frame 1a's Priority stack.
- **The figure's arrangement is frame 1e's, drawn by hand.** What is derived is who sits where: the
  three seats that cross take the work Circles by how many people they hold, the seat standing apart
  takes a personal Circle. It is **not** "biggest Circle, biggest seat" — a personal Circle of fifty
  people still stands apart, which is the point of the Side. A fifth Circle is named under the
  figure instead of being drawn. Say if the figure should be laid out rather than seated.
- **`overlap_note.timing` is written, not read off the Todo's Slots.** Once a Todo can be slotted
  (ticket 08), slotting "Onboarding v2 design review" at 16:00 leaves this card still saying "Today
  13:00 → 14:00". Which wins is undecided and nothing reconciles them; the schema's doc comment says
  so.
- **`overlap_note` is five columns of prose.** `people` and `timing` are not derivable from anything
  stored — "Thu → Mon", "Ask by Thu" — and the mockup's wording inside the figure is its own: the
  Leadership∩Design lens says "Design review · 14:00 today" while that Overlap's card says
  "Onboarding metrics for Q4 · Lena · Devon · Ask by Thu". Both are kept as drawn. If two Overlaps
  ever share a pair of Circles, the first one wins the lens.
- **The order of an Overlap's Circle tags** is the order Crazy matched them: the read model sorts by
  the match's `createdAt` then its id, and the seed's ids carry an index so the tags read as the
  frame draws them. No rule derives the frame's order (it is not seat order — see "Leadership,
  Design" and "Personal, Platform team").
- **`.circles__kicker` is `.day__title` again**, exactly. A third screen wanting it makes it a
  primitive in `packages/ui`; the Week screen (ticket 11) is being built beside this one and will
  likely want it too, so the move is left for whoever merges them.
- **`getCircles` returns no `seq`**, unlike `getToday`, because nothing patches Circles over the
  socket. The day a command touches a match or a note, it needs one — and `applyToCache` needs to
  know about the circles query. Until then, completing an Overlap's Todo on Today leaves this screen
  showing it for at most the 30s `staleTime` in `apps/web/src/router.tsx`.
