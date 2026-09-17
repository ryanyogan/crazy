# 18 — Switch the timer: the picker, the split and the bottom sheet

**What to build:** While the timer runs, Cori opens the picker, searches, and chooses another Project; the running entry ends at now and a new one begins. The picker groups Projects under their Clients with hours, offers Internal and a Client with no Project, works with arrows, enter and escape, and has "+ New project". On her phone the same control is a bottom sheet with recent choices first.

**Blocked by:** 17 — The timer bar: start, stop and note

**Status:** ready-for-agent

- [ ] The switch command ends the running entry and starts the next at the same instant (command-seam test)
- [ ] Choosing a Project that has a Client sets that Client; a contradicting Client is rejected (tests for all four Client and Project combinations)
- [ ] Internal is the absence of a Client, not a stored record
- [ ] Creating a Project from the picker selects it
- [ ] The dropdown is fully keyboard-operable and closes on escape
- [ ] Adds the bottom sheet primitive
- [ ] Visual diff against frame 3a's open state and frame 3b is noise-only
