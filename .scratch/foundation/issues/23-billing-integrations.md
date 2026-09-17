# 23 — Billing Connections and invoice settings per Client

**What to build:** With the Billing module on, the Integrations screen gains a billing and accounting section — Xero and QuickBooks connectable through Clerk, the rest not available yet — and invoice settings per Client: cadence, terms, auto-draft, and send without review, which is off unless she turns it on.

**Blocked by:** 15 — Integrations screen: Account, Connections, Realtime and lifecycle settings, 16 — Turn on the Billing module; the Cori persona

**Status:** ready-for-agent

- [ ] The section renders only with the Billing module on
- [ ] Per-Client settings are commands, optimistic, and persisted on the Client
- [ ] Send without review defaults to off
- [ ] Visual diff against frame 2c is noise-only at 1180px; the 390px layout is listed as derived
