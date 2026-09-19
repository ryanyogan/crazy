# 18 — Switch the timer: the picker, the split and the bottom sheet

**What to build:** While the timer runs, Cori opens the picker, searches, and chooses another Project; the running entry ends at now and a new one begins. The picker groups Projects under their Clients with hours, offers Internal and a Client with no Project, works with arrows, enter and escape, and has "+ New project". On her phone the same control is a bottom sheet with recent choices first.

**Blocked by:** 17 — The timer bar: start, stop and note

**Status:** done

- [x] The switch command ends the running entry and starts the next at the same instant (command-seam test)
- [x] Choosing a Project that has a Client sets that Client; a contradicting Client is rejected (tests for all four Client and Project combinations)
- [x] Internal is the absence of a Client, not a stored record
- [x] Creating a Project from the picker selects it
- [x] The dropdown is fully keyboard-operable and closes on escape
- [x] Adds the bottom sheet primitive
- [x] Visual diff against frame 3a's open state and frame 3b is noise-only

## Comments

### 2026-09-19 — built

**Built.** `timer.switch` and `project.add` at the command seam. A switch is one command and two
operations: `timeEntry.set` gives the running entry its end and `timeEntry.insert` begins the next
at the same instant, so the day has no gap in it and no second is counted twice. `workFor` decides
the work for both starting and switching, so the Client and Project rule is in one place. A third
operation, `project.insert`, is `project.add`'s; `apply` lays it over the picker's own lists.

The picker's read model is `readTimerPicker` (`packages/db/src/read/timer.ts`), read beside `timer`
with the Billing module on and handed to the Today loader as `Today.picker`: every Client with its
Projects and the hours it has had this week, the Projects with no Client gathered under Internal,
and the work timed most recently. With those lists in the browser's cache, `timerFacts`
(`apps/web/src/lib/useCommand.ts`) decides a switch against the user's real Clients and Projects
rather than the guess ticket 17 left, and `nameEntry` can word any entry the picker can start;
`namesUnknownWork` stays as the fallback.

The control is `apps/web/src/features/timer/WorkPicker.tsx`, styled in
`apps/web/src/styles/timer.css`. One list of choices, rendered once: from 900px it is frame 3a's
dropdown, a `<dialog open>` hanging under the trigger; below it, the same list inside the new
`Sheet` primitive (`packages/ui/src/Sheet.tsx`, styled in `packages/ui/src/styles/primitives.css`),
a modal `<dialog>` with the browser's own scrim and focus trap. `tools/visual` learnt to press a
control open before a shot, and to compare a frame with the foot of an element rather than its head,
which is what a sheet that rises from the bottom edge needs.

**Checked.** `check` (no warnings), `typecheck`, `test` (273), `build`. Seven command-seam tests
pin the new rules, including one table for all four Client and Project combinations, and one
read-model test in workerd pins the picker's grouping, this week's hours and the recents. `pnpm
visual`: 3a-open 0.03% (picker 0.00%), 3b 0.00% (clients 0.00%), 3a idle 0.01%, 3a running 0.00%,
and every frame before them unchanged (1f 0.13%, 1g 3.22%, both as they were on master). By hand at
1180px: the list opens on the work the timer is on, arrows move, enter switches, escape closes and
gives focus back to the trigger, a press elsewhere closes it, and searching narrows Clients and
Projects together. At 390px: the sheet is modal, escape and a tap on the scrim close it and focus
goes back to the trigger. Screenshots of the dropdown, the sheet and a bar after a switch were
looked at against the frames.

**Decisions taken.**
- Switching to the work already running is refused ("The timer is already on that work"), because
  a no-op split would leave two rows in the timesheet where the day means one.
- Switching with nothing running is refused rather than treated as a start: beginning from idle is
  `timer.start`, and inventing the first half of a switch would invent hours.
- Idle, the choice is the bar's own state and no command: nothing has happened until Start does.
  It falls back to the last entry's work, which is ticket 17's preselection.
- A Project named in the picker says whose it is (changed in review, 2026-09-19). With a name typed,
  the list offers one "+ New project “name” · for <Client>" row per Client, and one for Internal; a
  Project made for nobody is never billed, which is too quiet a mistake for a contractor to make by
  default. With nothing typed it is the single row frame 3a draws, and asks for a name.
- A new Project is `on_track` with no Circle, no milestone and no rate of its own. Crazy infers
  Circles, so one named by hand has none — and so no Side — until Crazy has looked.
- The picker's hours are this week's, Monday to the moment asked. Frame 3a quotes figures that are
  in no timesheet in the mockups; a week is the span a person steers by while choosing what to do
  next, and it is what the frame's totals are nearest to.
- A Client's own row is a choice, not just a heading: choosing it is work for them that is part of
  no Project (a One-off), which is what "a Client with no Project" means. Internal's row is the
  same choice with no Client at all, and Internal is still nothing stored.
- The accent tint marks the row the arrows are on, and the list opens on the work the timer is
  already on — which is where frame 3a draws the tint. The screen's one solid accent fill stays the
  timer's square.
- Clients and Projects are offered in the order they were taken on, which is the order frame 3a
  draws them; the cori seed now stamps each a minute apart so that order is real. Internal is last,
  because it is not a Client.
- On a phone the sheet leads with the work timed lately and offers "+ New project" above the
  Clients, so that the Clients and their Projects keep the foot of the sheet, where frame 3b draws
  them and where a thumb reaches them.
- The harness presses the picker open rather than the app holding a state for it: nothing in the
  app exists for the harness's sake.

**Open.**
- Frame 3b's first card — the phone bar with a list of recent work under it on the Today screen —
  is still not compared. The recents it draws are in the sheet here, where this ticket asked for
  them; whether the screen wants them too is ticket 19's question, beside where the Take on now
  card sits.
- The picker's right-hand column is masked in both frames: 3a gives each Project a line of a
  different kind (a meeting from the calendar, an hour left on a retainer) and quotes Client hours
  from no timesheet. The app says when the Project was last timed. The column needs one meaning.
- Frame 3a's open card lays the bar's row out from the top while its idle and running cards centre
  it, so the trigger and the keyboard hint sit two or three pixels apart from the frame and are
  masked. The app follows the two cards that agree.
- Switching at a pinned moment in dev leaves a Time entry stamped by the real clock, as ticket 17
  noted for stopping: the new entry is not on the pinned day, so the bar reads 00:00. Only `pnpm
  dev` is affected.
