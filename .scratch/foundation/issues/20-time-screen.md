# 20 — Time screen: the editable timesheet

**What to build:** Cori opens Time and reviews her timesheet by Day, Week or Month with daily totals. She edits an entry's times, Client, Project, note and billable flag, and adds an entry by hand. Entries with no Client are flagged with a suggested Client she confirms in one tap. The sync indicators are drawn and not wired.

**Blocked by:** 16 — Turn on the Billing module; the Cori persona

**Status:** ready-for-agent

- [ ] Edit, add and confirm-suggestion commands exist at the command seam with tests, including the Client and Project invariant and rejecting overlaps with the running entry
- [ ] The billable flag overrides the default that follows from having a Client
- [ ] Suggested Clients are seeded on the entries; confirming one applies it
- [ ] Totals are computed by query
- [ ] View switching is reflected in the URL
- [ ] Sync status and accounting targets are rendered as not wired
- [ ] Visual diff against the Time half of frame 2b is noise-only at 1180px; the 390px layout is listed as derived
