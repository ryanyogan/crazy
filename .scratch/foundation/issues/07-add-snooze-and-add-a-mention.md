# 07 — Add a Todo, snooze a Todo, and add a Mention as a Todo

**What to build:** Ryan types a new Todo on the Today screen and it appears as a One-off with no chip. He snoozes a Todo and it leaves the stack until the snooze ends. He presses Add on a Mention and it becomes a Todo whose Source is the Mention's Provider item; the Mention then shows as added. Nothing ever becomes a Todo from a Signal without that press.

**Blocked by:** 04 — Today screen shows the hour timeline and Mentions, 05 — Complete a Todo: the first command, end to end and optimistic

**Status:** ready-for-agent

- [ ] Commands for add, snooze and add-a-Signal exist at the command seam with tests
- [ ] Creating and snoozing each count as Touched
- [ ] A new Todo may have no Project and no Client
- [ ] Adding a Mention creates a Todo with that Source and marks the Signal as added
- [ ] Adding the same Signal twice, or a Signal whose Source already has an open Todo, creates nothing new
- [ ] A Waiting on Signal cannot be added
- [ ] All three are optimistic, roll back on failure, and appear in a second tab
