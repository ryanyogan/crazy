# 19 — Timers from Todos, and tracked hours on the timeline

**What to build:** Cori presses the start control on any Todo and a timer starts tied to that Todo, prefilled with its Client and Project. Start on Take on now does the same. Tracked hours land on the day's timeline beside what was planned, and the Today screen shows this week's hours by Client. Her Brief and timeline are the second mockup's.

**Blocked by:** 09 — Start and Swap on Take on now, 17 — The timer bar: start, stop and note

**Status:** ready-for-agent

- [ ] Starting from a Todo records the Todo on the Time entry, marks the Todo Touched, and prefills its Client and Project
- [ ] With the Billing module on, Start on Take on now starts a timer; with it off, behaviour is unchanged
- [ ] The timeline shows logged time per hour from real Time entries
- [ ] This week by Client is computed by query
- [ ] Visual diff against frame 2a, with frame 3a's bar in place of its segmented picker, is noise-only at 1180px and 390px
