# 17 — The timer bar: start, stop and note

**What to build:** Cori sees the timer bar on the Today screen. Idle, it preselects the most likely Client and Project and shows today's total and the last entry. She presses the square and it runs, showing elapsed time, Client and Project, since when, billable, and today's total for that Client. She types a note. She presses again and it stops. Her phone shows the same running timer as her desktop.

**Blocked by:** 06 — Live across devices: patches over a hibernating socket, 16 — Turn on the Billing module; the Cori persona

**Status:** ready-for-agent

- [ ] Start, stop and set-note commands exist at the command seam with tests, including starting while one is running
- [ ] The running timer is the Time entry with no end; nothing about it is held in the Coordinator
- [ ] Elapsed time ticks in the browser from the entry's start and the injected clock, with no per-second server traffic
- [ ] Idle preselection uses the last entry (calendar-based guessing is out of scope)
- [ ] Start and stop appear on a second device within a moment
- [ ] The bar renders only with the Billing module on
- [ ] Visual diff against the idle and running states of frame 3a is noise-only
