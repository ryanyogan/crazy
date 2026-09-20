# 29 — The sweep: what tickets 17–25 left open

**What to build:** Every builder since ticket 17 ended its report with "not happy with". This ticket
closes the ones that are small, real and would be felt by someone billing for their time, and says
no to the rest in writing. Ryan, 2026-09-19: *carry on, fix what you can.*

**Blocked by:** 28 — Today is a rundown (it moves Today's parts; sweep after it, not under it)

**Status:** ready-for-agent

## Fix

- [ ] **See the Billing side on the live site.** With no Clerk keys everyone is the one public demo
  user, the Ryan persona, Billing off — so none of tickets 16–23 can be seen in production, and
  `/dev/seed` is rightly 404 there. Two demo users, `user_demo_ryan` and `user_demo_cori`, chosen by
  a cookie and each provisioned lazily with their persona on first visit, exactly as the one demo
  user is today. A quiet "Viewing the demo as Ryan · switch to Cori" line in the Shell's foot, demo
  mode only (never with Clerk keys). Nobody can reset anybody: no reseed in production.
- [ ] **Metrics opens where the figures are.** A Billing user with no Todos-tab snapshot rows lands
  on "Crazy has not modelled this range today". Seed Cori's Todos-tab rows as Ryan's are seeded, so
  the tab is never thin for a persona; leave the default tab alone.
- [ ] **A Client's cadence sets their invoice period** (ticket 21 and 23's open note): monthly is the
  calendar month, bi-weekly the two-week span the day falls in (anchored on the Client's first
  invoice or, with none, the Monday of their first Time entry), "on the 1st" the previous calendar
  month when drafted. In shared, tested, with the period named on the invoice and in "how this was
  built". Cori's September figures must not move: 2b, 4a and the $13,755 stay as they are — if
  bi-weekly would move Quill's $4,275, keep the seed's invoices as stored drafts and apply the rule
  to what is drafted next; say which.
- [ ] **Times read one way.** The Time screen's editor shows "03:00 PM" beside a table that says
  15:00. Replace `<input type="time">` with a text field that takes and shows `HH:MM` (24-hour),
  forgiving about what she types ("9", "9:5", "0930", "3pm" → 09:00, 09:05, 09:30, 15:00), parsed in
  shared with tests.
- [ ] **The timeline's Client chip says the Client** to a screen reader ("Meridian Health", not
  "MER"), as the Source chip says "From Linear".
- [ ] **This week by Client counts the running entry as it runs** — the running Client's line ticks
  from `useTicking` like the header, so Today never shows a stale total under a live one.
- [ ] **The compact header's note looks like a field** at rest: a hairline under it, not nothing.
- [ ] **A stop on a scrolled Today does not move the page**: the receipt ends without the 20px
  settle (hold the compact height until the bar is back at the top, or until the next scroll).
- [ ] **An unavailable billing Provider is one line**, "Not available yet", not a dead Connect over it.
- [ ] **An upload's failure does not quote the error** to the caller; it goes to the log.
- [ ] **A Todo that goes takes its files with it**: when a Todo is deleted or archived out of D1, its
  Attachments' rows go by the existing cascade — and the web Worker removes the objects under
  `users/<userId>/todos/<todoId>/` when it is the one asking. If nothing deletes a Todo yet, record
  that and leave the hook where the command will be.

## Not doing, and why

- Frame 2b's decimal Hours column ("1.70") stays: the frame draws it, and the day cards beside it
  already say `h m`. One for the designer.
- 1g's remaining 2.5% and 1f's 0.13%: the owner's call on 2026-09-19 was not to chase them.
- A rate limit on uploads: there is no interface and no second user yet; with Clerk keys it becomes
  the Rate Limiting binding on the route (one line in ticket 26's API work).
- Billable reading 96% for Cori: true to her rows.
- Opening a Time row moves no focus: moving it fights the Add field, which opens the same editor.

## Done when

Each box above is ticked or moved to "not doing" with its reason; `check`, `typecheck`, `test`,
`build` green; `pnpm visual` unchanged everywhere except where a fix is the change.
