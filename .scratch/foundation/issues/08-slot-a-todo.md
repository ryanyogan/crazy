# 08 — Give a Todo a Slot on the timeline

**What to build:** Ryan drags a Todo from the Priority stack onto a free hour and it sits in that Slot; he can move it to another hour or take it off. On a phone, where dragging is not drawn, he uses a non-drag control to pick the hour. Meetings cannot be displaced. Slotting counts as Touched.

**Blocked by:** 04 — Today screen shows the hour timeline and Mentions, 05 — Complete a Todo: the first command, end to end and optimistic

**Status:** ready-for-agent

- [ ] Commands for slotting, moving and clearing a Slot exist at the command seam with tests
- [ ] A Todo cannot be slotted onto an hour a meeting fully occupies
- [ ] Slotting marks the Todo as Touched
- [ ] Desktop drag works with a pointer and has a keyboard equivalent
- [ ] The phone control is listed as derived in the project brief
- [ ] Optimistic, rolls back on failure, and appears in a second tab
