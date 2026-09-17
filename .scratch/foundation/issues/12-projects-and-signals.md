# 12 — Projects screen with Promises and Waiting on

**What to build:** Ryan opens Projects and sees each Project with its Circle, open count, status, derived progress, next milestone and what is on today. He filters by All, Work and Personal. He expands a Project to see today's Todos and its backlog with ages. Below are his Promises, which he can turn into Todos all at once, the Waiting on list, which he cannot, and the lifecycle note with how many Todos archive soon.

**Blocked by:** 03 — Today screen shows the Brief, Take on now and the Priority stack, 07 — Add a Todo, snooze a Todo, and add a Mention as a Todo

**Status:** ready-for-agent

- [ ] Progress is done over total of the Project's Todos, computed by query
- [ ] The filter uses the Side derived from each Project's Circle (Side derivation tested at the command seam or read-model seam in each fallback order)
- [ ] Expanding a Project shows its `today` Todos and its backlog with ages
- [ ] "Turn all into todos" adds every Promise not already added, each with its Source, and is optimistic
- [ ] Waiting on entries offer no way to become Todos
- [ ] The archive-soon count comes from real ageing
- [ ] Adds the table and segmented-control primitives
- [ ] Visual diff against frame 1d is noise-only at 1180px; the 390px layout is listed as derived
