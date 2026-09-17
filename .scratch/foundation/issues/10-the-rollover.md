# 10 — The Rollover at local midnight

**What to build:** At Ryan's local midnight, each Todo still in `today` is either carried over (touched that day: stays, carry count up by one) or sent back (untouched for his chosen period: to `backlog`, carry count reset). Backlog Todos untouched for his archive period become `archived`. The next morning the stack footer counts what happened. His time zone was detected in the browser the first time he signed in. A Todo whose Source is reported complete becomes `done`; nothing else about a Source moves it.

**Blocked by:** 05 — Complete a Todo: the first command, end to end and optimistic

**Status:** ready-for-agent

- [ ] The Rollover is a command at the command seam, given the time and the user's settings
- [ ] Tests cover: touched is carried over; untouched is sent back and its count resets; created at 23:50 counts as Touched; a longer sent-back period; appearing in the stack and Swap are not touches; archive ageing
- [ ] A source-completed command sets the Todo to `done`, and no other Source change affects state (tests)
- [ ] Time zone is stored at first sign-in and can be changed
- [ ] The Coordinator schedules the Rollover for the user's next local midnight and reschedules after it runs and when the time zone changes (Coordinator test with an injected clock)
- [ ] The Rollover's patch reaches open tabs
- [ ] The stack footer's carried-over and sent-back counts come from the last Rollover
