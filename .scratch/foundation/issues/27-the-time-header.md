# 27 — The time header: a running timer is always in sight

**What to build:** Ryan, 2026-09-19: *the UX for time management and the bar should be stunning;
when time is running it should always be visible.* Today the bar lives inside the Today screen and
scrolls away with it; on Week or Projects nothing says that hours are being billed. Make the timer
the Shell's: while a Time entry runs, Cori sees it on every screen, at every scroll position, on
every device, and in the browser tab when she is somewhere else entirely. It stays one quiet line
until she needs it, and it never moves a pixel when a digit changes.

**Blocked by:** 18 — Switch the timer: the picker, the split and the bottom sheet

**Build before:** 19 (which puts Start on every Todo — the header is what answers that press)

**Status:** ready-for-agent

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

- [ ] With an entry running, the header is visible on every Shell screen at 1180px and 390px, at the top and scrolled to the bottom
- [ ] With nothing running, no screen but Today (and Time) shows it; with the Billing module off, nothing anywhere
- [ ] No layout shift in or beside the figure across a minute, an hour and a ten-hour boundary
- [ ] The minute rule agrees with the seconds digit, and stands still under reduced motion
- [ ] Start on one device brings the header up on another within a moment, on whatever screen it is on
- [ ] Stop holds the receipt line, then leaves; the tab title follows the timer and is restored
- [ ] A screen keeps its single solid accent fill with the compact header over it
- [ ] `pnpm visual 3a`, `3a-running`, and ticket 18's targets are still noise-only; screenshots of the compact header on Week and Projects at both widths are in the ticket's Comments
- [ ] The derived states are listed in `docs/BRIEF.md`

## Left out, on purpose

A keyboard shortcut to start or stop (a stray key must never start billing), a favicon that changes,
a pause state, and the forgotten-timer prompt (ticket 26).
