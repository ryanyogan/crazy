# 21 — Invoices screen: drafts you can read

**What to build:** Cori opens Invoices and sees each Client's invoice for the period with status, detail and amount. She opens a draft and reads its lines, hours, amounts, total, terms, due date and the explanation of how it was built. Send, Preview PDF and accounting sync are drawn and unavailable. Invoices and their lines are seeded.

**Blocked by:** 16 — Turn on the Billing module; the Cori persona

**Status:** ready-for-agent

- [ ] Adds Invoice and invoice line to the schema with statuses draft, review, sent and paid
- [ ] Seed reproduces the mockup's invoices and the Meridian draft
- [ ] Line amounts and the total agree with the seeded Time entries under the Client's rate and rounding
- [ ] Send, Preview PDF and sync are disabled and announced as unavailable
- [ ] Visual diff against the Invoices half of frame 2b is noise-only at 1180px; the 390px layout is listed as derived
