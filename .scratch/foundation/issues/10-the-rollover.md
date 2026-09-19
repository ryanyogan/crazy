# 10 — The Rollover at local midnight

**What to build:** At Ryan's local midnight, each Todo still in `today` is either carried over (touched that day: stays, carry count up by one) or sent back (untouched for his chosen period: to `backlog`, carry count reset). Backlog Todos untouched for his archive period become `archived`. The next morning the stack footer counts what happened. His time zone was detected in the browser the first time he signed in. A Todo whose Source is reported complete becomes `done`; nothing else about a Source moves it.

**Blocked by:** 05 — Complete a Todo: the first command, end to end and optimistic

**Status:** done — awaiting review

- [x] The Rollover is a command at the command seam, given the time and the user's settings
- [x] Tests cover: touched is carried over; untouched is sent back and its count resets; created at 23:50 counts as Touched; a longer sent-back period; appearing in the stack and Swap are not touches; archive ageing
- [x] A source-completed command sets the Todo to `done`, and no other Source change affects state (tests)
- [x] Time zone is stored at first sign-in and can be changed
- [x] The Coordinator schedules the Rollover for the user's next local midnight and reschedules after it runs and when the time zone changes (Coordinator test with an injected clock)
- [x] The Rollover's patch reaches open tabs
- [x] The stack footer's carried-over and sent-back counts come from the last Rollover

## Comments

### 2026-09-19 — built

**What was built.** `rollover` and `source.completed` join the command seam, both server-only.
The Rollover is decided against every open Todo and the user's settings (`RolloverFacts`): touched
during the day that just ended → carry count up by one; untouched for the sent-back period →
`backlog`, count reset, `sentBackAt` stamped; a `backlog` Todo untouched for the archive period →
`archived`. It also clears `startedAt`, so a carried-over Todo is offered afresh (ticket 09's open
end). `user_settings.lastRolloverDay` (migration 0009) makes one midnight roll over once. The
Coordinator schedules `rollover` through the Agents SDK for the user's next local midnight — on
provisioning, after each run, when `settings.set` moves the time zone, and once per instance life
for a user who has none waiting. `settings.set` now takes a time zone, and the Integrations screen
offers this device's zone when it differs. The stack footer needed no change: it already counts
`carryCount > 0` and `sentBackAt` since the day began, which are what the Rollover writes.

**Checked.** `check`, `typecheck`, `test`, `build`. Seven tests at the command seam
(`rollover.test.ts`) covering the ticket's list, and one Coordinator test with an injected clock:
due at Chicago's midnight, rolls the seeded day over, due at the next, and moves to London's
midnight when the zone changes. A screenshot of the settings card from a browser in another zone.

**Not checked.** A real alarm firing at a real midnight in `pnpm dev`; the patch arriving in an
open tab (the path is the one every command uses, and `namesAnotherDay` now treats `rollover.ran`
for another day as the day turning over, so the tab reads again).

**Decisions taken.**
- Untouched for less than the sent-back period: the Todo stays in `today` and its carry count is
  left as it is — neither carried over (that means touched) nor sent back.
- "No other Source change affects state": `source.completed` is the only command a Source has, so
  there is nothing else that could; the test pins that it finishes its own Todo and no other.
- A Rollover that runs late (the Coordinator was unreachable at midnight) rolls over once for the
  day it wakes in; missed days are not replayed one by one.
- The time zone is detected from the request (Cloudflare's `cf.timezone`) at first sign-in, as
  ticket 01 built it, not in the browser; the browser's zone is what the new control offers.
- The Brief time is stored but nothing is scheduled for it yet: there is no Brief writer to wake.

