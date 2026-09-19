# 20 — Time screen: the editable timesheet

**What to build:** Cori opens Time and reviews her timesheet by Day, Week or Month with daily totals. She edits an entry's times, Client, Project, note and billable flag, and adds an entry by hand. Entries with no Client are flagged with a suggested Client she confirms in one tap. The sync indicators are drawn and not wired.

**Blocked by:** 16 — Turn on the Billing module; the Cori persona

**Status:** done — with one command beyond the checklist (`timeEntry.remove`) and two things left Open

- [x] Edit, add and confirm-suggestion commands exist at the command seam with tests, including the Client and Project invariant and rejecting overlaps with the running entry
- [x] The billable flag overrides the default that follows from having a Client
- [x] Suggested Clients are seeded on the entries; confirming one applies it
- [x] Totals are computed by query
- [x] View switching is reflected in the URL
- [x] Sync status and accounting targets are rendered as not wired
- [x] Visual diff against the Time half of frame 2b is noise-only at 1180px; the 390px layout is listed as derived
      — **0.00% in every region** (whole frame, rail, head, day cards, entries, flag, add an entry)

## Comments

### 2026-09-19 — built

**Built.** Four new commands, all at the one seam and all through the one write path:
`timeEntry.edit`, `timeEntry.add`, `timeEntry.confirmSuggestion` and `timeEntry.remove`. They are
Time entry commands rather than timer ones, because the timer is the control and these are about
the record it left behind (CONTEXT.md). Two operations are new beside them: `timeEntry.set` grew
from an end and a note to the start, the work and the billable flag, and `timeEntry.delete` takes a
row out. `decide` holds every rule: an entry is the user's or it is nobody's business; a span has to
end after it began and may not reach into the future; **no two spells of hers may overlap** — the
running entry included, its span reaching to the moment handed in — and a refusal says which hours
it clashed with, in her own zone ("That overlaps 09:00–10:42 Meridian Health."); the Client and the
Project settle each other through `workFor`, exactly as a start does; and billable follows from
having a Client unless the command names it, in which case it sticks through later edits that do
not. The running entry may have its start, its work, its note and its billable flag put right, but
it is not given an end here: ending it is `timer.stop`, which decides the end at its own moment.

**Reading the hours the overlap rule needs** is a second query and never a scan: the span an edit
would occupy is known only once the named entry is in hand, so `loadCommandState` reads the running
entry and the named one, works the span out with `spanNamed` (shared, so the browser and the
Coordinator agree), and then reads by that window — `userId`, `startedAt < to`, `endedAt > from`.

**The read model** is `readTime(db, userId, now, timeZone, view, anchorDay)`: one period's rows,
newest first, filtered by `userId` and by the window the period covers, with the Clients and
Projects those rows can name. What the screen makes of them — the day groups and their totals, the
period total, billable against not, how many entries still name no Client, and the sentence under
the table — is `viewTime` in `packages/shared/src/time.ts`, from those rows and a moment. One
function, used by the loader and by the browser's own cache, so an optimistic edit and a read one
can never come to different totals; no component counts anything. An entry that crosses local
midnight is counted into each day for the part that fell in it, and the running one counts to the
moment handed over and no further.

**The screen** is `apps/web/src/features/time/`, styled in `apps/web/src/styles/time.css`. The
period is the URL's — `?view=week&on=2025-09-15`, validated with zod in `validateSearch` the way
the Metrics screen already does it, `on` left off for the period the moment falls in — so last week
can be linked to, gone back from and reloaded into. Frame 2b's strip of day cards sits over frame
2b's table; pressing a row opens it under itself for editing, with the day, the two times, frame
3a's work picker as a field, the note and a billable box. Escape puts the row back, enter saves
from any field, and a change the rules will not allow is said inside the editor rather than in a
notice, because `useDecide` runs the same `decide` the Coordinator will. An entry that names no
Client wears the Client Crazy suggested as its flag, and that flag is the one-tap Confirm the
frame's own sentence promises. On a phone the same editor rises from the bottom edge in the `Sheet`
primitive, and each entry is a compact two-line row.

**Live.** The Time screen has a query per period (`['time', view, on]`), and `applyToCache` lays a
patch over every period a tab has read; a period that does not hold the row is left exactly as it
was. `decide` in the browser sees the timesheet's own rows as well as the bar's, so an entry from
last week can be edited from the Time screen without the guess refusing it.

**Migration 0012** (`0012_time_entry_suggestions.sql`) adds `suggestedClientId` and
`suggestedProjectId` to `time_entry` — plain columns and no relation, because a suggestion is a
guess about a row rather than a link between two. Written by hand from `migration:diff` less its
`DROP INDEX`: the diff does not know the partial unique index on the entries with no end, which is
the backstop under "at most one running timer". Cori's two spells tracked to Internal are seeded
with Quill suggested, which is what frame 2b's sentence says.

**Checked.** `check` (no warnings), `typecheck`, `test` (308), `build`. Thirteen new command-seam
tests pin the rules (an edit moves the hours; an overlap with another entry and with the running one
are refused by name; touching ends are not an overlap; ends before the start and in the future are
refused; the Project's Client wins and a contradiction is refused; billable overrides and then
sticks; add, with its own overlap; confirm applies the entry's own suggestion and is refused where
there is none; remove, refused while the timer runs and for an entry that is not hers; and the
running entry's end is the timer's). Seven shared tests pin `viewTime` (the week grouped by day
with the running entry counted to now; a spell across midnight counted into both days; the flag and
its sentence; the totals moving the moment an edit is laid over the rows; the periods and the steps
between them; how "when" reads in each view). Four read-model tests in workerd pin `readTime`
against a seeded D1: frame 2b's seven rows and their daily totals, the flag and the billable split,
a spell across midnight read from two different weeks, and the Day and Month bounds with the
month's cards.

`pnpm visual`: **2b 0.00% in every region**, and everything before it unchanged — 1a 0.00% at both
widths, 1c/1d/1e 0.00%, 2a 0.00% in every region, 3a idle 0.01%, 3a running 0.00%, 3a-open 0.03%
(picker 0.00%), 3b 0.00%, and the two known ones (1f 0.13%, 1g 3.15%).

By hand, against the screenshots in
`/tmp/claude-1000/-home-ryan-code-crazy/2b7de30a-4494-455f-b726-ce3dc6a9a0a2/scratchpad/t20/`:

- Desktop 1180px — `d-week`, `d-day`, `d-month`, `d-lastweek` (week 37, reached by the nav),
  `d-editing` and `d-editing-picker` (the work picker open from inside a row), `d-refusal`
  ("That overlaps 14:00–14:40."), `d-confirmed` (after one tap: the row reads Quill & Co, the flag
  falls to one entry and the billable figure moves), `d-add` (the new entry under the Add row),
  `d-running` and `d-running-editing` (the Shell's compact header over the screen, the entry
  counting, its To field reading "still running").
- Phone 390px — `p-week`, `p-day`, `p-month`, `p-editing` and `p-add` (the editor as a sheet),
  `p-running`.
- Keyboard: tab reaches a row's Edit, enter opens it, tab walks the fields (each labelled Day,
  From, To, Client · project, What, Billable), escape closes it and enter in a field saves; the
  saved note survived a reload, so it reached D1.
- Two tabs: one on the week and one on the day. Confirm in the first showed in the second within a
  moment — the row's Client, the flag's count and the billable figure all — and an edit to an
  entry's hours moved the day card, the period total and the row's decimal hours at once. No
  console errors in either.

**Decisions taken.**
- **`timeEntry.remove` is beyond the checklist**, and was added on purpose: a contractor must be
  able to take out an entry that was never worked, and hours nobody worked are worse than no record
  at all. Only an ended entry can go — the running one is stopped first — so removing hours is
  never also stopping a timer. It asks once in the button's own words ("Really remove?") rather
  than in a modal; `Notices` has no undo behind it, and inventing one would have meant a fifth
  command.
- An edit names the Client and the Project **as a pair** or names neither. The picker hands back
  both, and naming a Client alone could otherwise set it onto a Project that contradicts it.
- **The table's columns are given their widths** rather than taken from their content, so they do
  not move while she edits. The widths are frame 2b's own; a month at a time When takes more room
  and What gives it up.
- **The strip of cards is the period's parts one level down**: a day, a week's days, a month's
  weeks. A week's strip is Monday to Friday, and a weekend day joins it only when it was worked —
  which is what frame 2b draws. Each bar is drawn against the fullest card in the strip, as "This
  week by Client" draws a Client's week, and the caption keeps two lines' room so the table under
  it does not move when a caption grows.
- **Frame 2b draws no timer bar on this screen, so the screen draws none.** Ticket 27 left the
  question open ("frame 3a's full bar belongs there too"); the frame answers it. `DRAWS_ITS_OWN`
  stays `['/']` and the compact header is over Time like every other screen.
- **The screen's one solid accent fill is the chosen view** in the segmented control, which is
  where frame 2b puts it. Save in the editor is an outlined accent button rather than a filled one.
- **The shot is taken with the timer stopped** (`timer: 'idle'`), as the note in `targets.ts` says
  to for Cori's other frames: a running entry puts the compact header over the screen and frame 2b
  draws none. Frame 2b's timesheet does draw the first entry as running, so the three places that
  say so — the dash after 09:00, the word under the note, and Wednesday's caption — are masked with
  that reason. The hours the entry came to are the same either way and are compared.
- **Three wordings go through `COPY`** rather than through masks, so that the frame is drawn saying
  what the app says and the table's columns fall where the frame's own layout puts them: "2 entries
  need a **Client**", "**Client?** likely Quill **& Co**", and "I think both were Quill **& Co**".
  Frame 2b calls them entries that need a *project*; in the glossary they need a Client — Internal
  is the absence of a Client, and a Client with no Project is a perfectly good One-off.
- **The right-hand column is masked whole**, with its reason: frame 2b is one page for Time and
  Invoices (its rail marks both destinations, which is masked too) and the Shell has a screen for
  each. Until ticket 21 the column holds what the Time screen itself can say — the period's figures
  and the accounting targets, drawn and plainly not wired, because Crazy has sent nothing anywhere.
  Frame 2b's own "Synced to" sits in the foot of the rail, where the Shell follows frame 1a on
  every screen; that band is masked with the same reason.
- **The field to add an entry takes the note, not a sentence.** Frame 2b's placeholder promises to
  read "2h Meridian synthesis yesterday afternoon" into hours; Crazy parses nothing of the kind and
  a field that looked as if it did would be faked. Add opens the editor under it with the day being
  looked at, a start right after the last entry of that day ended, and the work she was last on —
  and leaves the end empty and asks for it, because inventing an end invents hours.
- **An end earlier than the start is the next morning.** A spell worked across midnight reads
  exactly like that on a wall clock, and refusing it would have meant a second date field.
- **The day cards' figures are masked**, with the reason: frame 2b's daily totals do not add up to
  the entries the frame itself lists (Monday's two rows come to 6:00 against a card that says
  7:45, Wednesday's to 2:02 against 3:10), its bars are hand-drawn percentages, and Thursday and
  Friday are captioned from a calendar and an invoice cycle that are not this screen's. The cards,
  their boxes and their day names are compared. A debt for the designer.
- **The period nav is derived** and its band is masked: frame 2b shows week 38 and no way to reach
  week 37, and a timesheet that cannot go back to last week is no use at month-end.
- An entry edited out of the period on the screen **stays on the screen** until it is read again,
  rather than vanishing under the hand that moved it.
- The harness gained `tools/visual/src/shoot.ts`: a plain screenshot of a route, for looking at by
  hand. `pnpm visual` is the comparison; this is the pair of eyes beside it. Drop it if it is not
  wanted — nothing in the app depends on it.

**Open.**
- The editor's two time fields are `<input type="time">`. Their **value** is always 24-hour and is
  read in her zone, but Chrome draws them in the reader's own locale, so on an en-US machine they
  say "03:00 PM" while every other time on the screen says 15:00. The alternative is a plain text
  field, which loses the arrows, the picker and the phone keyboard. Worth a look when there is a
  frame for the editor.
- Opening a row leaves the focus on its Edit button rather than moving it into the editor. The next
  tab lands in the first field, so it is operable; moving it would have fought the add field, which
  opens the same editor on focus.
- Frame 2b's Hours column is decimal ("1.70"), which is how an invoice counts, while every other
  figure on the screen and in the app is `h m`. The two are side by side on the Today screen. The
  frame is followed here; the designer should say which an editable timesheet wants.
- Nothing writes a suggested Client yet — the column is seeded, as the Brief's text and the stack's
  reasons are. What would write one is the same work as the rest of Crazy's guessing.
- Dev only, and unchanged from tickets 17, 18 and 27: the Coordinator decides at the real clock,
  not the pinned one. The overlap rule gives the running entry a span that reaches to that moment,
  so at a pinned moment a running timer's span is months long and an edit to hours *after* it began
  would be refused. Cori's running entry is the latest thing she has, so nothing in the seeded world
  hits it — an edit of the hours and of the note were both tried with the timer running and both
  landed — but it is there. It goes when ticket 26's clock does.
