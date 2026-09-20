# 28 — Today is a rundown: catch up, prepare, then work

**What to build:** Ryan, 2026-09-19: *the Today page needs to be more of a rundown or a catch-up, a
prep for the day, very pretty, with sections to dive into such as prep for meetings, things
remaining, etc.* Today stops being a two-column work surface you have to decode and becomes the
thing you read first: what happened while you were away, what each meeting needs from you, whether
what is left fits in the day — and every line of that read opens into the place where you do it.

**Blocked by:** 19 — Timers from Todos (its Today), 27 — The time header

**Status:** built

## The one idea

**Collapsed, the page is the rundown. Expanded, each line is where you work.** Today is a short
column of chapters. Every chapter head is a kicker, a count and *one sentence written from the day's
real rows*. Closed, six sentences tell you your day. Open, a chapter holds the working part that
already exists (the stack you tick, the hours you slot onto, the Mentions you add) or a new one
(meeting prep). Nothing on the screen is decoration and no sentence is canned: each is derived in
`packages/shared` from rows, with the moment as a parameter, and tested.

## The page, top to bottom

```
WEDNESDAY · 17 SEP · 08:41
Good morning, Ryan.
<the Brief, as now>

08 ──▓▓▓▓▓▓▓▓──░░░──████──▒▒▒▒──▓▓▓▓──████──▓▓▓▓──████──▒▒── 18      ← the day ribbon
      spike        standup   PR    design  Q4     1:1
                   ▲ now

CATCH UP · 4        Four people are waiting on you, three Todos carried over from Tuesday and one was sent back.   ⌄
MEETINGS · 3        Three today, the first at 11:00 — in 2h 19m. Devon's 1:1 has prep on your list.               ⌄
WHAT'S LEFT · 7     About 4h 55m of work and 5h 30m free between meetings: it fits.                                ⌄
YOUR DAY            Deep work until 11, then three meetings; 17:00 is free.                                        ⌄
THIS WEEK BY CLIENT (Billing on)   14h 12m so far; Bramble's retainer has 2h 10m left.                             ⌄
LATER THIS WEEK · 2 Auth migration's milestone is Friday; Q4 planning is due Thursday.                             ⌄
```

- **The day ribbon** — the whole working day on one 28px rule, 08 to 18 (the timeline's hours): a
  meeting is an accent-tint block, a slotted Todo a hairline block, a free hour a dashed one, and —
  Billing on — logged time is solid under them. One tick marks now (from the loader's moment, moved
  by `useTicking`, never the clock). Labels sit under the blocks that have room. It is the timeline
  said in one line, in the blueprint's own vernacular (a rule with measurements), and it is the
  pretty thing on the page; the rest stays typographic and still. Pressing a block opens **Your day**
  at that hour. It has a text alternative (the **Your day** sentence) and is `aria-hidden` itself.
- **Chapters** — a disclosure each: a `<button aria-expanded>` head (kicker, count, sentence,
  chevron) and a region. Defaults: a chapter with something in it opens; an empty one stays closed
  and its sentence says so plainly ("Nobody is waiting on you."). What she closes stays closed on
  that device (`localStorage`, UI state only — never D1). `#meetings` etc. in the URL opens and
  scrolls to a chapter, so the ribbon, the index and a link from another screen can all dive in.
- **Desktop (≥900px)** — the chapters are the reading column (about 640px). Beside it a sticky aside
  holds what you *do* wherever you are in the read: **Take on now** (Billing off; with Billing on the
  timer bar already leads the screen and the stack's first row is the recommendation, as ticket 19
  settled), **Add a Todo**, and the **chapter index** — each chapter's name and count, the one in
  view marked (an `IntersectionObserver`, no scroll listener), each a link. **Phone** — one column;
  the index is a row of chips under the ribbon; Take on now sits above the chapters.

### The chapters

1. **Catch up** — what arrived and what the Rollover did, so nothing surprises her later.
   Mentions not yet added as a Todo (with **Add**, the existing `signal.add`), Promises she made and
   Waiting-on that came in since yesterday's local midnight, the Todos the last Rollover **carried
   over** and the ones it **sent back** by name (not just a count), and Sources completed elsewhere.
   "Since yesterday" is derived from `now` and the zone; nothing records when she last looked.
2. **Meetings — prep** — one card per meeting left today, the next one first and blueprint-cornered:
   the time in the heading face, title, who, how long, and *in how long* it starts. Under it, only
   what rows can honestly say:
   - **On your list for this** — Todos whose Source is this event, with their tick boxes.
   - **From the people in it** — Signals whose `person` is named in the event's title or `who`.
   - **Billing on, and the title names a Client** — "1h 45m logged for Quill & Co this week · $4,275
     unbilled", and **Start the timer on Quill & Co** (the existing `timer.start`/`timer.switch`).
   - **Crazy's prep note** — generated text, the Brief's standing: a new `meeting_prep` row per
     event (body, bodyShort), seeded for both personas and left for the Brief Workflow (ticket 25's
     shell) to write. No row, no note — never a placeholder.
   A meeting that is over drops out; when none are left the sentence says "No more meetings today."
3. **What's left** — the Priority stack as it is (tick, snooze, start, drag), Take on now's Todo
   first, then **Done today** folded at its foot. Its sentence does the arithmetic she does in her
   head: the stack's estimates summed against the free time left between `now` and the end of the
   day's hours, meetings taken out — "it fits", "about 1h 30m more than fits", or, with nothing
   estimated, just the count. Snoozed Todos are named with when they return.
4. **Your day** — the hour timeline as it is (slots, drag, logged time with Billing on). Its sentence
   is the shape of the day: where the long free stretch is, how many meetings, what is slotted next.
5. **This week by Client** (Billing on) — ticket 19's card, plus the line from Time: entries that
   need a Client, linking to the Time screen.
6. **Later this week** — the week's tie-ins and milestones (the Week read model's rows) and
   tomorrow's first meeting, so prep for the day includes what the day is leading to.

## Rules

- Frames 1a and 2a drew Today as two columns and are at 0.00%; this ticket supersedes their *layout*
  at the owner's direction and keeps their *parts* (the stack's rows, the timeline's rows, the
  Mentions rows, Take on now, the bar) pixel-faithful. Write **ADR 0003** saying so in a paragraph,
  list the rundown as derived in `docs/BRIEF.md`, and re-scope the `1a`/`2a` visual targets to the
  parts that can still be compared (crop to the part, as `3a`'s targets crop to the bar); say in
  `targets.ts` what stopped being comparable and why. Every other target stays where it is.
- Every sentence is a pure function in `packages/shared/src/rundown.ts` over the day's rows and
  `now`; pluralisation and the empty case are part of it. No sentence is stored except Crazy's
  generated prep note and the Brief.
- No new write path. New commands only if something truly new is written (nothing here should be;
  starting a timer from a meeting is `timer.start`/`timer.switch`, adding a Mention is `signal.add`).
- One solid accent fill on the screen (Take on now, or the timer's square with Billing on). Plain
  CSS on Industry tokens in `apps/web/src/styles/`; collision-proof class names (the CSS is global);
  Lucide at stroke 1.5; one DOM, one breakpoint at 900px, mobile first; accent focus ring; reduced
  motion respected (a chapter opens without animation under it; otherwise one quick height ease —
  the only motion on the page besides the ribbon's now-tick).
- Live: a patch that changes the stack, a Signal or the timer changes the sentences at once — they
  are derived from the cache, so they must not be able to disagree with the rows under them.

## Done when

- [x] Closed, Today reads as six (Billing off: five) true sentences at 1180px and 390px, for both personas
- [x] Every sentence is a tested pure function, including the empty day and "it fits / more than fits"
- [x] Each chapter opens into its working part; ticking, slotting, snoozing, adding and starting still work as before
- [x] Meetings show only what rows support; the prep note is a seeded generated row, absent when there is none
- [x] The ribbon agrees with the timeline and with the header's running timer
- [x] `#chapter` links open and scroll; the index marks the chapter in view; closed chapters stay closed on the device
- [ ] ADR 0003 and `docs/BRIEF.md` record the change; `1a`/`2a` targets are re-scoped to their parts and noise-only; all other targets unchanged
- [x] Keyboard: every chapter head, index link and working control reachable in reading order

## Comments

### 2026-09-19 — built

**Built.** Today is a rundown. The day line, the heading and the Brief lead as they did; under them
the **day ribbon** — the working day on one 28px rule, a meeting an accent tint, a focus block
framed, a Slot a plain hairline box, a free hour dashed, and with the Billing module on what was
tracked drawn solid along the foot of the block it happened in, with one tick for now that
`useTicking` moves from the loader's moment. Under that a reading column of chapters (Catch up,
Meetings, What's left, Your day, This week by Client with the module on, Later this week), each a
`<button aria-expanded>` head of kicker, count and one sentence, and a sticky aside 340px wide
holding Take on now (module off), the place to add a Todo and the index of the chapters, marked by
an `IntersectionObserver`. On a phone one column, the index as a row of chips under the ribbon,
Take on now above the chapters, Add a Todo at the foot, ordered with `order` on the one grid.

**Shared first.** `packages/shared/src/rundown.ts` is the whole of what the screen says:
`viewRundown(today, view, extras, now, timeZone)` returns each chapter's count, sentence and
`filled`, the Catch up model, a `MeetingPrep` per meeting left today and the ribbon's blocks. Pure
and clock-free; 30 tests pin every sentence — the empty day, singular and plural, it fits / more
than fits / two with no estimate / nothing estimated, a meeting over and one under way, Billing on
and off, and the ribbon's runs, its now and its logged shares. Nothing is stored except the Brief
and a meeting's prep note.

**Rows.** `readToday` gained: the Todos the last Rollover sent back **by name** (`sentBack` is a
list now, not a count), the Promises and Waiting-on since yesterday's local midnight beside every
Mention, a `links` row per calendar event (the Todos whose Source is that very Provider item, the
Signals whose person the event names on a whole-word match of their full or first name, the Client
its title names, and the prep note), and `later` — this week's tie-ins, the milestones still ahead
and tomorrow's first meeting. `links` carries ids, not rows, so a Todo ticked in What's left
changes what the meeting says about it in the same render. Migration `0016_meeting_prep.sql` (hand
written from `migration:diff` less its `DROP INDEX`, as 0012–0015 were); `meeting_prep` is in
`USER_TABLES` before `calendar_event`. Both personas are seeded with a first-person prep note per
meeting on the seed day, in the Brief's voice and true of the rows around them.

**Checked.** `check` (no warnings), `typecheck`, `test` (425 in 38 files), `build`. `pnpm visual`:
every other target unchanged — 1c/1d/1e/2b/2c/3a-running/3b/4a 0.00%, 3a 0.01%, 3a-open 0.03%, and
the two known ones 1f 0.13%, 1g 2.45%. The re-scoped parts: `2a-stack` 0.00%, `2a-timeline` 0.33%,
`1a-take-on-now` 0.34%, `2a-week` 1.08%, `1a-stack` 1.38%, `1a-mentions` 2.17%, `1a-timeline`
3.21%. The last two are not noise and the box stays unticked: `1a-mentions` is the card's head
(kicker, edges and the first row) because a Mention's words wrap at 588px where the frame wraps
them at 340px; `1a-timeline` differs on the two focus rows' box borders, where the app's timeline
starts at a different absolute y than the frame's and a fractional row height snaps the other way —
Cori's identical timeline, three rows lower, is at 0.33%.

By hand, against the screenshots in
`/tmp/claude-1000/-home-ryan-code-crazy/2b7de30a-4494-455f-b726-ce3dc6a9a0a2/scratchpad/t28/`:

- **Ryan, Billing off** — `ryan-desktop-closed` and `ryan-phone-closed` (the rundown: five true
  sentences, all two lines or fewer), `ryan-desktop` and `ryan-desktop-all` / `ryan-phone-all` (every
  chapter open), `ryan-desktop-only-catch-up`, `-meetings`, `-whats-left`, `-your-day`, `-later`
  (each chapter open alone), `ryan-desktop-focus-chapter` (the accent focus ring on a chapter head),
  `ryan-desktop-empty` (a day with every row deleted: "Nobody is waiting on you and nothing carried
  over.", "Nothing in the calendar today.", "Nothing left for today.").
- **Cori, Billing on** — `cori-desktop-all` / `cori-phone-running` (the timer bar leading, the
  ribbon's logged bars under 08–10 agreeing with the timeline's 0:20, 1:00 and 0:42, the next-meeting
  card with Quill & Co's week and Start the timer on Quill & Co), `cori-desktop-scrolled` and
  `cori-phone-scrolled` (the bar condensed into the sticky strip with the sticky aside clear
  underneath it), `cori-desktop-idle` / `cori-phone-idle`.
- **Keyboard**, one walk at 1180px: rail, then each chapter head in reading order with its own
  controls inside it (Mentions' rows, the meeting's tick, every stack row's tick and title, the
  timeline), then Take on now's Start and Swap, the place to add a Todo, and the index.
- **Two tabs**: ticking the session spike in one changed the other's What's left sentence from
  "About 4h 30m of work…" to "About 2h 30m…" without a reload.
- **`#your-day`** on a closed chapter opened it and brought it to the top (3px); a chapter closed by
  hand was still closed after a reload.

**Decisions taken.**
- The reading column is 588px, not the ticket's ~640px, and the aside is 340px: 340 is the width
  frames 1a and 2a draw the cards in it at, so Take on now is still frame 1a's card to the pixel,
  and 588 is exactly the width those frames give the timeline. Both parts keep their frame.
- The chapter head is a 120px kicker gutter and the sentence beside it, so six sentences begin at
  one x; the body takes the whole column rather than the gutter's indent, because a card wants the
  pixels more than the rhythm does.
- A meeting's Client line says the week's hours and that Client's terms (`clientTerms`, the line
  "This week by Client" already draws), not the ticket's "$4,275 unbilled". Money is counted in one
  place — `draftInvoice` and `monthEndHold`, per period — and quoting a dollar figure here would be
  a second arithmetic for it. The hours are `readWeekByClient`'s own.
- The Rollover's carried-over and sent-back Todos are named in Catch up and frame 1a's foot of
  counts under the Priority stack is gone: saying it twice on one screen is saying it twice.
- The ribbon's blocks are `<button tabIndex={-1}>` inside the `aria-hidden` rule: pressing one is a
  pointer's shortcut into Your day, and everything it reaches is reachable by keyboard through the
  index and the chapter heads. The Your day sentence is its text alternative.
- A chapter opens with one quick 130ms fade-and-rise rather than a height ease, and stays `hidden`
  when closed: `hidden` keeps a closed chapter out of the tab order and out of layout, which a
  height transition cannot do without `inert`.
- Catch up's sentence carries at most three clauses; what merely arrived since yesterday goes in a
  short second sentence, and only while the first is short enough to carry one. Two lines is what a
  chapter head has, and the chapter lists every Promise and Waiting-on underneath either way.
- Which chapters are open is `useSyncExternalStore` over `localStorage`, not an effect: the server
  snapshot is "nothing decided", so hydration draws the defaults and never flashes, and a `storage`
  listener makes two tabs of the screen agree.
- `Part.crop` is new in the harness: a frame that draws a whole screen can now be cut to one part
  and the app cut to the same size where that part sits. `app.ts` screenshots `fullPage` for a part,
  so a card further down than the viewport is still cropped from where it is.
- Today is in `UNDRAWN` now, so `pnpm visual` still leaves a phone screenshot of the rundown behind;
  the wider shots are `tools/visual/src/shoot.ts`'s.

**Open.**
- `1a-timeline` at 3.21% and `1a-mentions` at 2.17% are not noise (above). Neither is a drawing
  debt — the rows and the card are the frames' — but neither is a clean figure either.
- Ryan's seed has no Promise inside yesterday's local midnight (his newest is two days old), so the
  Catch up chapter shows one Waiting-on and no "You said you'd" section for him, and the design
  review is tied to no Signal although Design is in it. It is the ticket's window, honestly applied;
  a seed with a fresher promise would show more of the chapter.
- The meetings' prep notes are seeded rows waiting for the Brief Workflow (ticket 25's shell) to
  write them, exactly as the Brief is.
