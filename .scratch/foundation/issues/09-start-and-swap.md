# 09 — Start and Swap on Take on now

**What to build:** Ryan presses Start and the Take on now card changes to its started state; the Todo is now Touched. He presses Swap and the next fitting Todo becomes Take on now, while the declined one sits one place lower for the rest of the day and is not Touched. With the Billing module off the started state has no frame: it reuses the running timer bar's treatment without the picker.

**Blocked by:** 05 — Complete a Todo: the first command, end to end and optimistic

**Status:** ready-for-agent

- [ ] Start and Swap commands exist at the command seam with tests
- [ ] Start marks the Todo as started and Touched
- [ ] Swap lowers the Todo one place, changes no state, and does not mark it Touched
- [ ] A swapped Todo stays lowered for the rest of that local day and not beyond it
- [ ] Swapping the last fitting Todo leaves no Take on now card
- [ ] The started state is listed as derived in the project brief
- [ ] Optimistic, rolls back on failure, and appears in a second tab
