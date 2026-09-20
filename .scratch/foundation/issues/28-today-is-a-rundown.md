# 28 — Today is a rundown: catch up, prepare, then work

**What to build:** Ryan, 2026-09-19: *the Today page needs to be more of a rundown or a catch-up, a
prep for the day, very pretty, with sections to dive into such as prep for meetings, things
remaining, etc.* Today stops being a two-column work surface you have to decode and becomes the
thing you read first: what happened while you were away, what each meeting needs from you, whether
what is left fits in the day — and every line of that read opens into the place where you do it.

**Blocked by:** 19 — Timers from Todos (its Today), 27 — The time header

**Status:** ready-for-agent

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

- [ ] Closed, Today reads as six (Billing off: five) true sentences at 1180px and 390px, for both personas
- [ ] Every sentence is a tested pure function, including the empty day and "it fits / more than fits"
- [ ] Each chapter opens into its working part; ticking, slotting, snoozing, adding and starting still work as before
- [ ] Meetings show only what rows support; the prep note is a seeded generated row, absent when there is none
- [ ] The ribbon agrees with the timeline and with the header's running timer
- [ ] `#chapter` links open and scroll; the index marks the chapter in view; closed chapters stay closed on the device
- [ ] ADR 0003 and `docs/BRIEF.md` record the change; `1a`/`2a` targets are re-scoped to their parts and noise-only; all other targets unchanged
- [ ] Keyboard: every chapter head, index link and working control reachable in reading order
