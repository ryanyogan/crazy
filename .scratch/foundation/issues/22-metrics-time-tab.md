# 22 — Metrics: the Time tab

**What to build:** Cori opens Metrics and the Time tab shows utilisation, billable split, hours per week by Client, when she works, unbilled money by Client, budget and retainer burn, and estimate against actual. The tab appears only with the Billing module on.

**Blocked by:** 14 — Metrics screen: how you actually work, 16 — Turn on the Billing module; the Cori persona

**Status:** done — awaiting review

- [x] Hours by Client, billable split and unbilled totals are computed from Time entries by indexed queries (read-model test)
- [x] Modelled figures and commentary come from snapshot rows
- [x] The Money tab is drawn and not wired
- [x] Visual diff against frame 4a is noise-only at 1180px; the 390px layout is listed as derived
      — **0.00% whole frame and 0.00% in every region** (rail, head, headline figures, hours per week,
      when you work, unbilled, burn, estimates)

## Comments

### 2026-09-19 — built

**Built.** No command and no write path, as the ticket asked: the Time tab is read and derived.
`readMetricsTime(db, userId, now, timeZone, range)` (`packages/db/src/read/metricsTime.ts`) is one
query over `time_entry(userId, startedAt)` for the widest span any card reaches over, plus the
Clients, the Projects and the Todos those spans name — every one of them filtered by `userId`, and
`now` a parameter, with the running spell counted up to it and no further. What the screen makes of
those rows is `viewMetricsTime` in `packages/shared/src/metricsTime.ts`: the six figures, the eight
columns, the heat cells' darknesses, the two kinds of bar, the ratios, and a sentence per chart for
anyone who cannot see it. Nothing there reads a clock.

**Computed, and modelled — the line between them is the point.**

- **Computed by query, from her own rows:** tracked hours and the hours per workday; the billable
  split and the untagged hours; utilisation's numerator; the effective rate; the average and median
  session and how the median moved against the period before; **hours per week by Client over eight
  weeks**, every second of a week in exactly one band; **when she works** (weekday × hour over
  thirty days) and the three figures under it — median first timer, median last stop, Project
  switches a day; **unbilled money by Client**; **budget and retainer burn**, including where the
  month actually stands; **estimate against actual** over the Todos that carry both an estimate and
  a timer; the longest session of the month and how many ran past ninety minutes.
- **Modelled (`metric_snapshot`, four rows, seeded):** the hours a week she means to bill (30) and
  the share of her time she means to be billable (75%) — a target is a decision nobody has recorded
  yet, not a measurement — and two lines of Crazy's commentary, under "when you work" and under
  "estimate vs actual". Without them the two tiles say so ("No billable target set yet") rather than
  showing a figure, exactly as the Todos tab does.
- **Left out rather than modelled:** frame 4a's "avg time-to-invoice 9 days · avg time-to-paid 22
  days". Nothing has ever been sent or paid (ticket 21), so those have nothing behind them at all;
  a modelled figure is Crazy's reading of real data, and these would have been invention. The card
  says what it can count.
- **Estimate against actual is real, not modelled.** Todos carry estimates and Time entries carry
  `todoId` since ticket 19, so the card is computed — over the Todos timed inside the range, gathered
  by **energy**, which is Crazy's own word for a kind of work. Cori has three: Deep focus 1.1×,
  People & admin 1.4×, Quick wins 0.7×.

**Unbilled money is the Invoices screen's own figure, not a second count of it.** `readMetricsTime`
calls `readInvoices` for the month and reads the drafts off it, adding the month-end hold for a
Client with billable hours and no invoice at all; the total is `draftedCents + hold.unbilledCents`.
A read-model test asserts the identity, so the two screens cannot come to different money. By eye:
**$13,755** on both, **Meridian $5,880 / 28.0h** on both, **Bramble 17.8h used, 2h 10m left** on
Metrics, Invoices and the Today screen, and the Time screen's month strip reads **W36 18:50, W37
36:15, W38 14:12** against the chart's 19h, 36h and 14h.

**The seed.** Cori gained **five weeks before September** — twenty-five workdays from Mon 28 Jul to
Fri 29 Aug, fifty spells — so the eight-week chart has eight weeks in it, and **seven finished Todos
with estimates** behind some of them, so estimate-against-actual has something real to measure.
Nothing falls on or after 1 September, so **Meridian 28.0h, Quill 22.5h, Bramble 17h 50m and the
$13,755 are exactly what tickets 19–21 pinned** (frames 2a, 2b and 3a are all still 0.00%). The
seed's invoice loop now runs **per month she worked** rather than for September alone: July's and
August's are `paid`, numbered INV-0036…INV-0041 up to frame 2b's INV-0042, and every line of them is
`draftInvoice` over her own entries. That is what makes "unbilled" mean this month's money and
nothing older. Her four Time-tab snapshot rows are written with the Brief, for today.

**Two tests changed because their world changed**, and neither was weakened: the Coordinator's Cori
test summed Meridian's hours over all time and now sums September's, and the Invoices read-model
test's "a period with no invoices" moved to June, with August asserted `paid` instead.

**No migration.** The Time tab's modelled rows are `metric_snapshot` rows under four new figure
names; the table ticket 14 added already holds a kind, a figure, a label and a value. They are
written **once at the 30-day range** and read there whatever range is chosen, because a target and a
line of commentary are not functions of how far back the screen is looking — the same rule ticket 14
gave the thirty-day strip.

**The screen** is `apps/web/src/features/metrics/`: `MetricsScreen` is now the head and a tab,
`TodosTab` is ticket 14's body unchanged, `TimeTab` and `TimeCharts` are frame 4a's six figures and
five cards, styled in `apps/web/src/styles/metrics.css` on the Industry tokens. Charts are plain DOM,
hidden from assistive technology and answered by a sentence that reads out every figure in them; a
Client's colour comes from `shades.ts` (the order she took them on), and no chart tells anything by
colour alone — the legend names every band and the sentence names it again.

**Checked.** `check` (no warnings), `typecheck`, `test` (**334**, up from 323), `build`. Six
read-model tests in workerd against a seeded D1 (the eight weeks and their bands adding to the week;
the billable split and the untagged count; the unbilled figures being the Invoices screen's to the
cent; the burn rows and their order; the estimate groups; the modelled rows, and a stranger reading
nothing of hers), and five shared tests for the new pure functions (utilisation with and without a
capacity; the burn wording under each arrangement, over budget and on pace; why a Client's money has
not gone out; the weeks the chart names; a time of day and how a median moved).

`pnpm visual`: **4a 0.00% whole frame and 0.00% in every region.** Everything before it unchanged —
1a 0.00% at both widths, 1c/1d/1e 0.00%, 2a 0.00% in every region, 2b 0.00% in every region, 3a idle
0.01%, 3a running 0.00%, 3a-open 0.03% (picker 0.00%), 3b 0.00% — and the two known ones (1f 0.13%,
1g 3.22%). Frame 1f's whole-frame 0.13% is its `backlog ageing` region at 1.36%, which is ticket
12's Projects seed and not this ticket's.

Screenshots in
`/tmp/claude-1000/-home-ryan-code-crazy/2b7de30a-4494-455f-b726-ce3dc6a9a0a2/scratchpad/t22/`:

- Desktop 1180px — `d-time` (the Time tab), `d-time-week`, `d-time-quarter` (the other two ranges),
  `d-todos` (the Todos tab as Cori), `d-money-focused` (the Money option with the focus ring),
  `d-ryan-metrics` and `d-ryan-metrics-time` (the Billing module off: no tab control, and a link to
  the Time tab opens the Todos one), `x-time-month` and `x-invoices` (the two screens the figures
  were cross-checked against).
- Phone 390px — `p-time`, `p-todos`, `p-money-focused`, `p-ryan-metrics`.

By hand, in a browser at both widths: the Money option reports `aria-disabled` and its reason ("The
Money tab is not built yet…"), pressing it leaves the URL at `?tab=time&range=30d`, and Playwright
itself refuses to click it as "not enabled". No console errors at either width.

**Decisions taken.**

- **The tab is the URL's, and Money never reaches it.** `?tab=todos|time` is validated on the route
  with zod and again in the server function; `metricTabInUrl` is the two a user can actually reach,
  so a link can never name a tab that does nothing. With the Billing module off the tab control is
  not drawn at all and `?tab=time` opens the Todos tab — Metrics is every user's screen and only
  this half of it belongs to the module, so `notFound()` would have been wrong here where it is
  right for `/time` and `/invoices`.
- **The Time tab is its own read model and its own query** (`metrics-time`), not part of the Todos
  tab's. A user with the module off never asks for it, and moving between the tabs is a cache hit
  the second time.
- **Three spans are their own, whatever range is chosen**, because their own kickers say so: the
  eight weeks, the thirty days of "when you work", and the month the money is about. Everything else
  — the six figures and the estimate groups — follows the range, which is what the frame's own range
  control is for. This is ticket 14's rule for the thirty-day strip, applied again.
- **"Not billable" is one band, and it is the absence of a bill rather than the absence of a
  Client.** Internal work and an entry she marked not billable both go there. The frame calls it
  "non-billable"; the app says "Not billable", and the Client bands above it are named in full.
- **Utilisation is billable hours over capacity**, not tracked hours: a contractor's utilisation is
  about what she can bill. The capacity is the modelled target, and without one the tile says so.
- **The effective rate values an hour at the rate it was worth**, with no rounding, because it asks
  what her time earned rather than what a bill would say. Rounding belongs to the invoice, and the
  invoice is where it happens (`draftInvoice`, ticket 21).
- **"Untagged time" counts entries with no Client, which is exactly the Time screen's flag**, and
  says it in the same words. The two screens count over different spans — the tab's range against
  the timesheet's period — and each says which, but they will never disagree about the same rows.
  It does mean her deliberate Internal work is counted as needing a Client; that is ticket 20's rule
  and this screen follows it rather than inventing a second one. See Open.
- **The burn bars put what she has bought first**, in the order she took the Clients on, and a
  Client with no cap under them — which is the order frame 4a draws. The black tick is where the
  month actually stands, so it is in the same place on every bar; the frame draws it at two
  different places in one month, which cannot both be true.
- **A retainer's unbilled line is about hours, not money**, because its fee is owed whatever the
  hours: "Retainer · 17.8h used", the same figure the Invoices screen and the Today screen show.
- **The estimate rows are gathered by energy.** Frame 4a's Research / Design / Meetings / Admin are
  nothing a Todo has; energy is Crazy's own word for a kind of work and a Todo carries one.
- **Two solid accent fills, not one** — the chosen tab and the chosen range — because frame 4a draws
  two, exactly as ticket 14 followed frame 1f's two.
- **"Utilisation" where the frame says "Utilization"**, through `COPY`, a seventh deliberate
  difference: the repo writes British English.
- **New CSS blocks are named for what they are** (`byweek`, `heatgrid`, `moneybars`, `estimates`,
  `rhythm`, `legend`). The first draft called the weekly chart `.weeks`, which is the Today screen's
  "This week by Client" card — it broke frame 2a and was caught by `pnpm visual`. Worth remembering:
  this repo's CSS is global.
- **The `dataviz` guidance was read and followed where it does not fight the design system**: a
  legend for every multi-series chart, identity never by colour alone (a text alternative for each),
  categorical colours assigned by the entity and never by rank, no dual axis, thin marks, recessive
  axes. Its palette is **not** used and its validator not run: `industry.css` is the design system as
  shipped and may not be edited (AGENTS.md), and a Client's shades are frozen by frame 2a.

**For review — what is masked in frame 4a, and why.** The layout is the app's to the pixel; what is
masked is what the frame quotes from no timesheet of Cori's, and each mask carries its reason in
`targets.ts`. The six figures and four of their lines; the legend's shortened Client names; the eight
bars, the hours under them and the card's line; the heat cells and the three figures under them; the
line under each unbilled Client and the card's line; each burn row's name, figure and line, the pace
ticks, Quill's bar and the burn legend; and the estimate rows. **What is compared and is the frame's
own**: every card, kicker and axis label, the rail down to the fifth destination, the tab and range
controls, the plot's baseline and its eight week labels, the heat grid's hours and weekdays, the
seeded line under "when you work", and — the part that matters — **the three unbilled Clients'
names, amounts and bar lengths ($5,880 / $4,275 / $3,600 at 100% / 73% / 61%) and Meridian's and
Bramble's burn bars (70% and 89%)**, which the app derives and the frame drew.

**Open.**

- **Cori has no modelled figures for the Todos tab**, so as her it reads "Crazy has not modelled this
  range today" over the six tiles and the strip, with the backlog and the sources counted beneath.
  That is honest — she has five Todos and a fortnight of history — but it is a thin screen. Either
  seed her the Todos tab's snapshot rows too, or let the tab open on Time for a user with the module
  on. It wants a decision rather than a ticket.
- **Frame 4a's fourth estimate row** makes its bottom cards five pixels taller than the app's, and
  that band is masked with the reason. It goes when the designer says what the kinds of work are.
- **"Untagged time" counts her deliberate Internal work.** `viewTime`'s flag does the same (ticket
  20), so the two screens agree, but "5 entries need a Client" is not quite what a spell tracked to
  Admin means. The rule wants one home, and the Time screen is where it lives.
- **The billable share reads 96%** against a modelled 75% target, because almost everything Cori
  tracks is for a Client. It is what her rows say; a persona with a more ordinary mix of admin would
  read nearer the frame's 78%.
- **Nothing ticks.** The Time tab is off the socket, like the Todos tab, Week and Circles: no command
  touches it, so it refetches on the 30s `staleTime`. The running spell's seconds stand still between
  reads.
- Not checked: a signed-in Clerk user; widths between 900px and 1180px; a Client whose name is too
  long for the legend's line (it clips from 900px, by design, and the sentence under the chart still
  says it); a user with Clients but no Time entries at all, beyond the empty-state lines the code
  carries and the stranger the read-model test covers.

**2026-09-19 — review.** One rule changed before this landed: what "needs a Client". It was every
Time entry with no Client, which asked Cori about her own Admin Project every month. It is now
`needsClient` in `packages/shared/src/timer.ts` — no Client *and* no Project — and the Time screen,
the Invoices hold line and this tab's Untagged tile all ask it, so they cannot disagree. Thirty days
now read 2 entries, not 5; frames 2b and 4a are unchanged at 0.00%.

