# 16 — Turn on the Billing module; the Cori persona

**What to build:** A user turns on the Billing module from the Integrations screen and the Shell gains Time and Invoices; on a phone the tab bar becomes Today, Time, Invoices, More, with everything else under More. Turning it off restores the other Shell. Seeding the Cori persona gives a user the second mockup's world: Clients with their billing terms, Projects with and without Clients, back-dated Time entries, and the Billing module on. This adds Client and Time entry to the schema.

**Blocked by:** 15 — Integrations screen: Account, Connections, Realtime and lifecycle settings

**Status:** in progress — one box open

- [x] The Billing module setting is a command and is optimistic
- [ ] Both Shell variants match their frames at 1180px and 390px
- [x] Time and Invoices routes are unreachable, not merely hidden, with the module off
- [x] Client holds rate, rounding, payment terms and cadence; a Project may override the rate
- [x] At most one Time entry per user has no end, enforced at the command seam — `decide` refuses `timer.start` while one runs (ticket 17); the partial unique index stays as the backstop
- [x] Seeding Cori reproduces the second sample user's Clients, Projects and hours
- [x] The placement of the on/off control is listed as derived

## Comments

### 2026-09-19 — most of it built; two boxes left open (one closed by ticket 17)

**Built.** `billing.set` at the seam, optimistic over the Shell's cache and the Integrations
screen's, so the rail changes at once. `/time` and `/invoices` throw `notFound()` from their loaders
with the module off (the old "Billing is off" screen is gone). Migration 0011: `client` (rate,
rounding, payment terms, cadence, arrangement, budget hours), `time_entry`, and a Project's optional
Client and rate override. The Cori persona (`packages/db/src/seed/cori.ts`): three Clients with
frame 2c's terms, five Projects (one with no Client), the five Todos of frame 2a's stack, the Brief,
and 23 Time entries — frame 2b's timesheet plus the rest of the month, so Meridian stands at 28.0h,
Quill at 22.5h and Bramble at 17.8h with one entry running. Reseeding a persona sets the Billing
module to that persona's. The switch is a card under Realtime on the Integrations screen.

**Checked.** `check`, `typecheck`, `test` (247), `build`; a command-seam test for the Shell's
destinations, a Coordinator test that seeds Cori and counts her world; in a browser: `/time` is Not
found while off, the rail gains and loses Time and Invoices on the switch, `/time` opens while on.

**Open.**
- [ ] *Both Shell variants match their frames at 1180px and 390px* — the Shell already switched on
  `billing` (ticket 01); the Cori frames (2a–2c, 3a, 3b, 4a) still have no targets in
  `tools/visual/src/targets.ts`. Ticket 17 added the `cori` persona (the frames call her
  "Jo Okafor") and targets for frame 3a; 2a–2c, 3b and 4a still have none. Add them, run
  `pnpm visual` once, and look at the rail and the phone tab bar.
  - Ticket 18 added frame 3b's sheet; **ticket 19 added frame 2a at 1180px** (0.00% in every
    region), so the Billing-on rail is now compared against a frame: it reads 0.00% down to the
    fifth destination, and the three below it are masked because frame 2a omits Circles and the
    Shell keeps it (which this ticket's own decision already recorded). Frame 2a's phone card is
    screenshotted and not compared, and why is written beside the target and in `docs/BRIEF.md`.
    **Ticket 20 added frame 2b at 1180px** (0.00% in every region: rail, head, day cards,
    entries, flag and the place to add an entry), so the Billing-on rail is now compared against
    a second frame. Frame 2b marks both Time and Invoices in the accent, because it is one page
    for the two; the Shell has a screen for each, so only the one the user is on is marked and
    that row is masked with the reason. Its rail foot is masked too: 2b puts the accounting
    targets there and the Shell follows frame 1a (Live, then the user). Frame 2b's phone card is
    not drawn at all, so the Time screen's 390px layout is derived and listed in `docs/BRIEF.md`.
    **Ticket 21 unmasked frame 2b's right-hand column** — the Invoices half — and added an
    `invoices` region for it, still 0.00%: the card's head and the first two invoices' Client,
    status, detail and amount are compared against the frame, and what the frame says from
    somewhere other than Cori's rows is masked with its reason. **What is still open here: 2c
    and 4a, which are the tickets that draw those screens, and the phone tab bar with the
    Billing module on, which no compared frame reaches.**
- [x] *At most one Time entry per user has no end, enforced at the command seam* — done in ticket
  17: `decide` refuses `timer.start` while an entry with no end exists, with a reason, and the
  partial unique index `time_entry_userId_running_key` stays as the backstop under it.

**Decisions taken.** Rates are cents per hour on the Client, overridable per Project; Bramble's
retainer is stored as $180/h over a 20h budget, and its $200 overage rate is left to ticket 21
(which added `client.overageRateCents` and seeds it at $200, migration 0013).
Turning the module off deletes nothing. Cori reads the same four Providers as Ryan; her billing
Providers are ticket 23.

