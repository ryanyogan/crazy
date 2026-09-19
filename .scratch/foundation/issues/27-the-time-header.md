# 27 — The time header: a running timer is always in sight

**What to build:** Ryan, 2026-09-19: *the UX for time management and the bar should be stunning;
when time is running it should always be visible.* Today the bar lives inside the Today screen and
scrolls away with it; on Week or Projects nothing says that hours are being billed. Make the timer
the Shell's: while a Time entry runs, Cori sees it on every screen, at every scroll position, on
every device, and in the browser tab when she is somewhere else entirely. It stays one quiet line
until she needs it, and it never moves a pixel when a digit changes.

**Blocked by:** 18 — Switch the timer: the picker, the split and the bottom sheet

**Build before:** 19 (which puts Start on every Todo — the header is what answers that press)

**Status:** done

## The design

One component, the Shell's, in two sizes. No frame draws the second size, so it is **derived** and
listed as such in `docs/BRIEF.md`; it is cut from frame 3a's running bar and uses nothing 3a does
not: the accent tint, the accent hairline, the heading face's tabular figures, the Client's rule.

**Full** — frame 3a, unchanged, idle and running. Where it is drawn today: the top of the Today
screen (and the Time screen when ticket 20 asks for it). `pnpm visual 3a` and `3a-running` stay
noise-only.

**Compact, desktop (≥900px)** — a 44px strip, `position: sticky; top: 0` across the top of
`shell__main`, on every screen while an entry runs. On Today the full bar is itself the sticky
element and takes the compact measurements once the page has scrolled (a sentinel and an
`IntersectionObserver`, or a scroll-driven animation where supported — no scroll listener). One row:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [■]  01:42:07   ▍Meridian Health · Discovery research ⌄   Research synthesis…    since 09:00 · billable   Meridian today 3h 47m │
└━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──────────────────────────────────────────────────────────┘
      └ the minute rule: the bottom hairline, drawn left to right once a minute
```

**Compact, phone (<900px)** — docked directly above the tab bar, where a thumb is, the way a music
player keeps what is playing: 48px, `[■] 01:42:07 ▍Meridian Health · Discovery…`. The square stops;
the rest of the strip opens ticket 18's bottom sheet. On Today it appears only once the full card
has scrolled out of view — never both at once. It clears `env(safe-area-inset-bottom)`, and
`shell__main` gains its height in bottom padding while it shows, so it never covers a last row.

**Idle** — the header is not shown outside Today (and Time). Only running time follows her around.

### The figure

- Heading face, `font-variant-numeric: tabular-nums`, in a box sized in `ch` for its longest form, so
  nothing beside it shifts when 09:59:59 becomes 10:00:00 or a 1 becomes an 8. `HH:MM` in text
  colour with `:SS` smaller in `accent-700`, as 3a draws it — in both sizes.
- No blinking colon. Liveness is **the minute rule**: the header's bottom hairline is `accent-300`,
  and over it a 1px `accent-700` line draws from the left edge to the right once a minute, then
  starts again. Pure CSS: one 60s linear keyframe on `transform: scaleX()`, with a negative
  `animation-delay` set from the entry's start second so it agrees with the digits and with every
  other device. It is the one bold thing; everything else in the header keeps still.
  `prefers-reduced-motion`: the rule stands complete and does not move.
- `since 09:00` names the day when the entry did not start today (`since Tue 17:20`): a timer left
  on overnight should look like one. (Doing something about it is ticket 26.)

### The one solid accent fill

On Today the full bar's square keeps the fill (ticket 17). In the compact header the square is
**not** filled: accent hairline box, solid `accent-700` stop glyph, on the tinted strip — so the
screen underneath keeps its own single fill, and the tint band is what says "running".

### Pressing it

- **Start** (from anywhere — the bar now, a Todo in 19): the tint washes across the header from the
  square, ~240ms, once; the figure goes from `neutral-400` to text colour. The same wash plays when
  another device started it. Reduced motion: no wash.
- **Stop**: the header does not vanish under her finger. It holds for about 1.5s, still, reading
  `Stopped · 1h 42m logged to Meridian Health`, then leaves (compact) or settles to idle with today's
  total already counted (full). Billing software owes a receipt. The hold is UI state only; the
  entry ended when the command said so.
- The note is in the desktop compact strip inline (same commit-on-blur field). On the phone the
  note stays on Today's full card; the docked strip is for seeing and stopping.

### Away from the page

- `document.title` while running: `1:42 · Meridian Health — Crazy`, updated when the minute changes,
  restored on stop. It comes from the same derived moment as the bar (`useTicking`), never the clock.
- `useTicking` must stay honest in a throttled background tab: it already derives from
  `performance.now()` deltas and not from counting ticks; add a `visibilitychange` re-read so a tab
  brought back shows the right second at once.

### Said aloud

`role="timer"` on the figure, not live (a screen reader must not be read a clock every second). One
polite live region says "Timer started, Meridian Health, Discovery research" and "Timer stopped,
1 hour 42 minutes" once each. The Stop control's name includes the work. The compact strip is a
`region` labelled "Running timer", reachable in the tab order after the skip link / rail, before the
screen. Accent focus ring throughout.

## Plumbing

- The Shell needs the running entry on every screen. Give the timer (and ticket 18's picker data) its
  own query, loaded by the `_app` route when the Billing module is on, and have Today read that
  rather than embed its own copy; `applyToCache` lays `timeEntry.*` operations over it, and
  `namesUnknownWork` invalidates it. One cache, so the header and the bar cannot disagree.
- No new command, no new write path, nothing in the Coordinator. **Nothing here may make the running
  state depend on the browser** — the header draws the Time entry with no end, as read from D1
  (see ticket 26 and ticket 17's Comments).
- Styles in `apps/web/src/styles/timer.css`, Industry tokens only. One DOM, one breakpoint.
- The visual harness shoots Cori's other frames (2b, 2c, 4a, when their tickets add them) with
  `timer=idle`, because those frames draw no header; say so beside the targets.

## Done when

- [x] With an entry running, the header is visible on every Shell screen at 1180px and 390px, at the top and scrolled to the bottom
- [x] With nothing running, no screen but Today (and Time) shows it; with the Billing module off, nothing anywhere
- [x] No layout shift in or beside the figure across a minute, an hour and a ten-hour boundary
- [x] The minute rule agrees with the seconds digit, and stands still under reduced motion
- [x] Start on one device brings the header up on another within a moment, on whatever screen it is on
- [x] Stop holds the receipt line, then leaves; the tab title follows the timer and is restored
- [x] A screen keeps its single solid accent fill with the compact header over it
- [x] `pnpm visual 3a`, `3a-running`, and ticket 18's targets are still noise-only; screenshots of the compact header on Week and Projects at both widths are in the ticket's Comments
- [x] The derived states are listed in `docs/BRIEF.md`

## Left out, on purpose

A keyboard shortcut to start or stop (a stray key must never start billing), a favicon that changes,
a pause state, and the forgotten-timer prompt (ticket 26).

## Comments

### 2026-09-19 — built

**Built.** The timer is the Shell's now, not the Today screen's. It has a query of its own
(`timerQuery`, `getTimer` → `readTimerAndPicker`), loaded by the `_app` route with the Billing
module on and read by the header, by the bar on Today and by `timerFacts` in `useCommand`; `Today`
no longer carries `timer` or `picker`, so there is one cache and the two cannot disagree.
`applyToCache` lays `timeEntry.*` and `project.insert` over it and `namesUnknownWork` invalidates
it. Nothing about running moved into the browser: the header draws the Time entry with no end as
D1 has it and counts up from its start against the moment the loader handed over.

One component in two sizes. `TimerBar` takes a `place` — `screen` is frame 3a's bar at the top of
Today, `header` is the Shell's, rendered before the screen in `shell__main` and so before it in the
tab order. From 900px the header is a 44px strip stuck to the top; below it a 48px strip docked
above the tab bar, where a thumb is, which `shell__main` clears in bottom padding (`:has`). On
Today the full bar is itself the sticky element and takes the compact measurements once the page
has scrolled past a sentinel below it (`barOnScreen.ts`, an `IntersectionObserver`, no scroll
listener); the same sentinel is what holds the phone's dock back until the card is out of view, so
the timer is never drawn twice at once. Idle, the header is not drawn at all. `WorkPicker` works
from the strip unchanged: frame 3a's dropdown from 900px, frame 3b's sheet below it.

The minute rule is CSS only — `transform: scaleX()` from `transform-origin: left`, 60s linear
infinite, started part-drawn by a negative `animation-delay` taken once from where this entry's
minute already stands and keyed by the entry, so a switch starts a fresh one. `useTimerChange`
reads what has just happened from the rows rather than from the press, so a start made on another
device washes here too; a switch only cross-fades the work line. Stop holds the entry, its final
figure and the receipt for 1.5s, still. `TimerAside` is mounted once by the Shell and owns the two
things that are not the strip: the tab title (`1:42 · Meridian Health — Crazy`, rewritten on the
minute, put back on stop) and one polite live region.

**Checked.** `check` (no warnings), `typecheck`, `test` (278), `build`. `pnpm visual`: 3a idle
0.01%, 3a running 0.00%, 3a-open 0.03% (picker 0.00%), 3b 0.00% (clients 0.00%), 1a/1c/1d/1e all
0.00%, and the two known ones unchanged (1f 0.13%, 1g 3.21%). Five new shared-package tests pin the
wordings (`sinceWhen`, `stopReceipt`, `timerTitle`, `saidAloud`) and one read-model test in workerd
pins the Shell's read and its Billing gate.

By hand, against the screenshots in
`/tmp/claude-1000/-home-ryan-code-crazy/2b7de30a-4494-455f-b726-ce3dc6a9a0a2/scratchpad/t27/`:

- Desktop 1180px — `d-today-running-top`, `d-today-idle`, `d-today-condensed` (the bar pinned and
  condensed, the screen sliding under it), `d-week-top`, `d-week-bottom`, `d-projects-top`,
  `d-projects-bottom`, `d-time`, `d-invoices`, `d-week-picker-open` (the dropdown from the strip),
  `d-week-receipt`, `d-week-minute` and `zoom-minute` (the rule at `:25`, drawn 42% across),
  `d-week-reduced` (reduced motion: the rule complete and still), `d-week-idle` (nothing).
- Phone 390px — `p-today-running-top`, `p-today-dock` (the dock up once the card has gone, the last
  row clearing it), `p-week`, `p-projects-bottom`, `p-more`, `p-week-picker-open` (the sheet from
  the dock), `p-week-receipt` / `zoom-receipt-p`.
- Billing off (Ryan) — `d-ryan-today`, `p-ryan-today`, `d-ryan-week`: no timer anywhere, the Take on
  now card keeps its solid fill, `shell__main` takes no extra padding, the tab title stays "Crazy".
- Two tabs — Start and Stop in one while the other sat on Week and then Projects: the header
  arrived and left within a moment, the wash played on the arriving start, the tab title followed
  and was put back. No console errors.
- Digits — the figure's box measured at elapsed 00:01, 09:59 and 10:00: 64.80px each time, and the
  work picker and the note field begin at the same x to the pixel.
- Tab order at 1180px: rail, then Stop ("Stop the timer on Meridian Health · Discovery research"),
  the picker, the note, then the screen. At 390px: wordmark, Stop, picker, tab bar.

**Decisions taken.**
- The header keeps off a screen that draws its own bar by route (`/`, and `/time` with ticket 20)
  rather than by a runtime registry, so the server render and the first paint already agree and
  nothing flashes. The sentinel only says whether that bar has been scrolled past.
- The condensed bar on Today holds the room the full bar had (`--timer-tall`, 101px, measured).
  A sticky element that shrinks takes the whole screen up with it, and the ticket's one hard rule
  is that nothing moves. The part of that room the 44px strip does not fill passes presses through
  to the screen sliding under it.
- The `ch` box is on the compact figure only. The full bar's figures are already fixed-width —
  tabular and zero-padded, so 09:59:59 and 10:00:00 are the same width — and a box there would have
  moved frame 3a's picker by the slack. Measured rather than assumed (see above).
- The minute rule is the compact header's alone. Frame 3a draws no such line and is frozen at
  0.00%; a line crossing the bar's bottom hairline at an unrepeatable phase would end that.
- Docked on a phone, the rule lies on the strip's **top** edge rather than its bottom: the edge the
  header meets the screen at is the top one there, and the bottom one is the tab bar's hairline.
- The receipt plays on any stop the rows report, including one made on another device — the wash is
  symmetric, and a contractor who stops from her phone should see on her laptop what was logged. On
  the 48px dock it takes the whole strip, because one line is what a phone has room for and this is
  the line worth having; from 900px it sits where the figures were and nothing else moves.
- The start wash is anchored to what was running when the bar was first drawn, so an already-running
  timer never washes on a page load, and a switch — which also changes the entry's id — cross-fades
  the work line instead.
- A change is held for 1.5s whatever its kind, and the wash and cross-fade end themselves inside it
  (`animation-fill-mode: forwards`). One timer, and the polite live region's line has time to be
  heard; deriving it during render keeps `setState` out of an effect.
- `document.title` is set imperatively. TanStack Start builds the head from the routes' `head()`
  and offers no way to word a title from a component; only the root sets one and it never changes,
  so nothing fights over it. It is re-applied after a navigation in case that ever stops being true,
  and the name to give back is read from the document rather than written down twice.
- `saidAloud` says nothing on a switch: the work is on the screen and no hours have changed hands.
- The idle bar's last line now reads "stopped 08:55" through `sinceWhen`, so an entry stopped
  yesterday says so rather than naming a time on the wrong day. For an entry stopped today it is
  word for word what frame 3a draws.
- A **bug ticket 18 left** was fixed on the way: `.picker__sheet` set `display: grid`
  unconditionally, which overrode the `display: none` a browser gives a closed `<dialog>`, so the
  closed sheet was a 31px band across the foot of every phone screen. It only showed once the
  docked header gave it a stacking context above the tab bar, where it ate the tab labels. It is
  now `.picker__sheet[open]`.
- `--tabbar` is the tab bar's real height (46px) rather than the 58px the Shell's padding used, so
  that the dock sits on its hairline; the 12px of air under a screen's last row is now said out
  loud in the padding instead of hidden in the constant.

**Open.**
- On a scrolled Today at desktop, the 1.5s receipt ends with the bar expanding from 44px back to
  the idle bar's 64px, which settles the screen by 20px. Idle time does not follow the user around,
  so the bar has nowhere to stay; the alternative is reserving the full bar's room on an idle Today
  as well, which would leave 37px of nothing under frame 3a's idle bar at all times.
- The Time screen shows the compact header while an entry runs and nothing while it is idle. Frame
  3a's full bar belongs there too; it is ticket 20's.
- The note in the compact strip has no box until it is hovered or focused, so it reads as a line
  rather than a field. It is the quieter of the two, and the strip is meant to be quiet, but a
  first-time user may not know it can be typed in.
- Dev only, and unchanged from tickets 17 and 18: Start and Stop are stamped by the real clock, so
  pressing them at a pinned moment gives the receipt and the strip figures from a real elapsed span
  (the `d-week-receipt` screenshot reads "8815h 27m" for that reason).
