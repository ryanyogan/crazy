# 16 — Turn on the Billing module; the Cori persona

**What to build:** A user turns on the Billing module from the Integrations screen and the Shell gains Time and Invoices; on a phone the tab bar becomes Today, Time, Invoices, More, with everything else under More. Turning it off restores the other Shell. Seeding the Cori persona gives a user the second mockup's world: Clients with their billing terms, Projects with and without Clients, back-dated Time entries, and the Billing module on. This adds Client and Time entry to the schema.

**Blocked by:** 15 — Integrations screen: Account, Connections, Realtime and lifecycle settings

**Status:** ready-for-agent

- [ ] The Billing module setting is a command and is optimistic
- [ ] Both Shell variants match their frames at 1180px and 390px
- [ ] Time and Invoices routes are unreachable, not merely hidden, with the module off
- [ ] Client holds rate, rounding, payment terms and cadence; a Project may override the rate
- [ ] At most one Time entry per user has no end, enforced at the command seam
- [ ] Seeding Cori reproduces the second sample user's Clients, Projects and hours
- [ ] The placement of the on/off control is listed as derived
