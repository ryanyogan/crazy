# 19 — Timers from Todos, and tracked hours on the timeline

**What to build:** Cori presses the start control on any Todo and a timer starts tied to that Todo, prefilled with its Client and Project. Start on Take on now does the same. Tracked hours land on the day's timeline beside what was planned, and the Today screen shows this week's hours by Client. Her Brief and timeline are the second mockup's.

**Blocked by:** 09 — Start and Swap on Take on now, 17 — The timer bar: start, stop and note

**Status:** done — two boxes answered differently by the frame (see Comments)

- [x] Starting from a Todo records the Todo on the Time entry, marks the Todo Touched, and prefills its Client and Project
- [ ] With the Billing module on, Start on Take on now starts a timer; with it off, behaviour is unchanged
      — **frame 2a draws no Take on now card.** With the module off the card and its Start are exactly
      ticket 09's, unchanged (`pnpm visual 1a` 0.00%); with it on the card is gone and the stack's
      first row is the recommendation, one press from a running timer. See Decisions taken.
- [x] The timeline shows logged time per hour from real Time entries
- [x] This week by Client is computed by query
- [ ] Visual diff against frame 2a, with frame 3a's bar in place of its segmented picker, is noise-only at 1180px and 390px
      — **0.00% in every region at 1180px**, by composing 3a's bar into 2a's screen. At 390px frame 2a
      and frame 3b draw the phone timer differently and 3b is the one the app follows, so there is
      nothing there that a comparison would not have to mask; screenshotted instead. See Decisions taken.

## Comments

### 2026-09-19 — built

**Built.** One command path and no new command: `timer.start` and `timer.switch` take an optional
`todoId`. Given one, `decide` checks the Todo is the user's and still open, records it on the Time
entry, marks it started and Touched in the same decision (the `todo.set` `todo.start` would have
made), and takes the work from the Todo's Project — whose Client wins, through `workFor`, so an
entry can never contradict the Project the Todo belongs to. A Todo that is part of nothing larger
starts on the work the bar already had, which the browser passes, so a One-off still takes one
press. Pressing start on a Todo while a timer runs is a switch: the running entry ends and the
Todo's begins at the same instant, and here — unlike a plain switch — the same Client and Project
with a different Todo is allowed, because the Todo is what changed. Pressing it on the Todo the
running entry already names is refused in those words.

The control is `apps/web/src/features/timer/StartOnTodo.tsx`, on every row of the Priority stack
with the Billing module on, where frame 2a draws it; the Todo the timer is on wears the accent
hairline, the accent tint and a solid mark in place of it, and its line reads "Bramble · running"
instead of its estimate. The one solid accent fill stays the timer's square.

`TimerEntry` gained `todoId` and `todoTitle`, read beside the entry (a Time entry outlives the Todo
that caused it, so there is no relation on the row). The compact time header now says what is being
timed — `[■] 00:00:03 ▍Bramble · Onboarding v3 ⌄ Onboarding flow v3 wireframes …` — one line, cut
short, and only from 900px, where the strip has the room; ticket 27's wash and its live region fire
on a Todo start like any other, because `useTimerChange` reads what happened from the rows.

**Tracked hours on the timeline.** `loggedByHour` (`packages/shared/src/timer.ts`) splits the day's
Time entries into the hours they fell in, the running one counted up to the moment handed in and no
further; nothing reads a clock. Each hour then draws as frame 2a draws it: the Client's colour down
its left edge, the Client's three letters where frame 1a puts the Source chip, the time tracked in
it on the right, and the box itself saying what became of the hour rather than what is planned for
it — the hours the timer is in now framed in the accent, hours with time in them plainly boxed,
everything still only planned dashed. A meeting is a meeting either way.

**This week by Client** is `readWeekByClient` (`packages/db/src/read/timer.ts`), read with the
timer and the picker in the Shell's one query, filtered by `userId`, counted from Monday to the
moment asked, most hours first with Internal last. Under each Client's bar is where its month
stands: "Project fee · 27h 57m of 40h budget", "Retainer · 20h/mo, 2h 10m left", "Hourly · $190/h",
"Not billed" — the frame's own four wordings, with figures that are Cori's real entries.

**The seed.** Cori had no calendar, no Slots and no hour wordings, so her Today read "0 meetings"
and every hour Free. She now has frame 2a's day: the Quill weekly at 11:30, her five Todos slotted
on the hours the frame slots them on, and Crazy's wording for each of the nine hours the frame
draws, including 08:00 ("Inbox · proposal tweak · tracked to Internal · project?") and 12:00
("Lunch · timer paused"), which hold no Todo and are worded all the same.

**The harness learnt to compose.** Frame 2a draws the timer as a segmented picker the app does not
have, and the bar it does have is frame 3a's, drawn on its own beside it and 38px taller — so
masking the band would still have left every row below it in the wrong place. A target can now name
a band of its card and another frame's card to put in it (`compose`, `tools/visual/src/targets.ts`),
which is what the canvas itself suggests trying next under frame 3a: "put the 3a bar into 2a".

**Checked.** `check` (no warnings), `typecheck`, `test` (287), `build`. Seven new command-seam tests
pin the new rules (the entry names the Todo and the Todo is under way and Touched; a One-off starts
on the bar's work; someone else's and a finished Todo refused; start-while-running splits at the
same instant; the Todo already running is refused; the Billing module off refuses the timer and
leaves `todo.start` as it was), one read-model test in workerd pins the week by Client and its four
term wordings, and two shared tests pin the hours (the running spell counted into each hour it
touches and no further, an entry from before midnight counted only from midnight, an hour given to
whoever had most of it).

`pnpm visual`: **2a 0.00%** whole frame and 0.00% in each of rail, brief, timeline, priority stack
and this week by client. Everything before it unchanged — 1a 0.00% at both widths, 1c/1d/1e 0.00%,
3a idle 0.01%, 3a running 0.00%, 3a-open 0.03%, 3b 0.00% — and the two known ones as they were
(1f 0.13%, 1g 3.22%).

In two tabs of a browser: start pressed on a Todo in one while the other sat on Week — the running
entry split, the header there changed to the new work within a moment and its line named the Todo,
the row in the stack took the running mark and read "running", and the row the timer left went back
to its control. No console errors.

Screenshots in
`/tmp/claude-1000/-home-ryan-code-crazy/2b7de30a-4494-455f-b726-ce3dc6a9a0a2/scratchpad/t19/`:
`d-cori-running`, `d-cori-idle`, `p-cori-running`, `p-cori-idle` (1180px and 390px, running and
idle), `d-cori-after-start` and `p-cori-after-start` (after pressing start on a row),
`d-week-header-after-start` (the compact header on Week naming the Todo), and `d-ryan-today`,
`p-ryan-today` (the Billing module off, unchanged).

**Decisions taken.**
- **With the Billing module on the Today screen has no Take on now card.** Frame 2a drops it, puts
  the Brief at the head of the day's own column and starts the stack at the top of the aside, and
  the ticket said to follow the frame. It is also the better screen: with a start control on every
  row the recommendation is the stack's first row and taking it on is the same one press as taking
  on anything else, rather than a card that says the same thing twice. With the module off nothing
  changed — frame 1a, ticket 09's Start and Swap, `pnpm visual 1a` 0.00%. If the card is wanted back
  beside the timer it needs a frame; `.today--billing .ton` has gone from `today.css` rather than
  sit there unreachable.
- **An optional `todoId` on the two commands rather than a new command**, as the ticket decided. A
  new write would have been a second path to the same two operations, and the rules that differ —
  whose Todo, whether it is open, where the work comes from — are rules about the same start.
- **The Todo's Project wins over what the browser passes, and the pass is the fallback.** The
  browser cannot know a Project's Client, so the rule has to live in `decide`; a Todo with a Project
  ignores the bar's selection, and a Todo with none takes it. `TodoFacts` gained `projectId` and
  `loadCommandState` reads the timed Todo's Project beside the one a command names.
- **A Todo need only be open, not in `today`.** Nothing but the stack draws the control today, but
  the Time screen and search will, and a timer started on a `backlog` Todo is a person working on
  it; it is marked Touched and started, and moving it into the day is not this command's to decide.
- **`TodayTodo` gained `projectId`, `clientId` and `clientName`**, from the Project and its Client
  in one read. The stack's line says the Client with the module on — with a timer in reach, who is
  paying for the hour is what a contractor needs to see — and the timeline says whose a planned hour
  is from the Todo slotted on it.
- **A Client's colour follows the order it was taken on, not its hours** (`order` on `ClientWeek`,
  `apps/web/src/lib/shades.ts`): accent-700, accent-400, accent-200 as frame 2a gives them, and
  neutral for Internal. A colour that moved when a week moved would be no colour at all.
- **Tracked time is counted into each hour it fell in**, so 1h 42m from 09:00 reads 1:00 on the
  09:00 hour and 0:42 on the 10:00 hour. Frame 2a puts the whole spell on the hour it began, which
  does not add up to a day; the column is masked with that reason and the other seven hours are
  compared.
- **Whose an hour is comes from what was tracked in it, and failing that from the Todo slotted on
  it.** Frame 2a marks the 11:00 hour as Quill's because the meeting in the calendar is Quill's;
  Crazy never reads a Client off a Provider's item, so that hour names nobody here. Masked, with
  the reason.
- **"This week by Client" lists Internal**, which frame 2a does not. Work for nobody is still work,
  and a contractor who has quietly spent five hours on her own admin this week should be told. It
  sits last however many hours went into it: it is the absence of a Client, not one of them.
- **The Todo's title is in the compact header only.** The full bar is frame 3a's and frozen at
  0.00%; the strip is where the question "what am I timing?" is asked, because the strip is what
  follows her onto Week. On the 48px phone dock there is no room and it is not drawn.
- **A patch that starts an entry on a Todo the cache cannot name still shows the entry**, without
  its title, and `namesUnknownWork` asks for the read that brings the words. The Client and the
  Project are right from the first frame — an entry that cannot be named at all is still left out
  and read again, as ticket 17 left it.
- **Frame 3b's first card does not belong on the phone Today.** It draws a list of recent work under
  the bar; frame 2a's phone draws the day there, and the recents are already in the bottom sheet
  where ticket 18 put them and where a thumb reaches them. 3b's card is a frame of the control on
  its own, as 3a is on desktop, and 2a is the frame of the screen.
- **Frame 2a's phone is screenshotted, not compared.** Its timer is a solid accent card with Stop
  and Switch project on it where frame 3b — the one ticket 17 built and the one frozen — draws a
  tinted card with the square; everything below it sits at a different height for that reason
  alone, and 2a's phone also leaves the Brief out. A comparison would be masks and nothing else.
  Written beside the target and in `docs/BRIEF.md`.
- **Frame 2a's rail keeps Circles.** The frame lists seven destinations and omits it; ticket 16
  already decided the Shell keeps Circles with the module on, so the five destinations above it are
  compared and the three below are masked with that reason.

**Open.**
- Dev only, and unchanged from tickets 17, 18 and 27: the Coordinator stamps the real clock, so a
  timer started at a pinned moment lands on the real day and the pinned page cannot see it. The
  two-tab check and `d-cori-after-start` were made at the real clock for that reason; everything
  compared by the harness is read, not pressed.
- The timeline's Client chip is a `Tag`, the same primitive as the Source chip it replaces. A
  screen reader hears the three letters and not the Client's name; the Source chip says "From
  Linear" under its own. It wants the same treatment, and a frame that says whether both belong on
  the row at once.
- Nothing on the Today screen yet says an hour was tracked to no Project — frame 2a's 08:00 row
  reads "tracked to Internal · project?", which is Crazy asking a question the app cannot yet be
  answered. It is seeded wording; the asking is a later ticket's.
- "This week by Client" does not tick. Its figures come from the loader's moment, and the running
  entry's seconds stand still until the next read. A card about a week does not need the second,
  but the Client whose timer is running is the one line that is quietly out of date.
