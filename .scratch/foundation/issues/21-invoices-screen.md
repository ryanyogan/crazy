# 21 — Invoices screen: drafts you can read

**What to build:** Cori opens Invoices and sees each Client's invoice for the period with status, detail and amount. She opens a draft and reads its lines, hours, amounts, total, terms, due date and the explanation of how it was built. Send, Preview PDF and accounting sync are drawn and unavailable. Invoices and their lines are seeded.

**Blocked by:** 16 — Turn on the Billing module; the Cori persona

**Status:** done — read-only, as the ticket asked; one deviation from the frame's draft recorded as designer debt

- [x] Adds Invoice and invoice line to the schema with statuses draft, review, sent and paid
- [x] Seed reproduces the mockup's invoices and the Meridian draft
      — the three amounts and the Meridian total are the frame's to the cent; its **third line** is not
      reproducible from Cori's Projects, see the Decisions
- [x] Line amounts and the total agree with the seeded Time entries under the Client's rate and rounding
      — the seed calls `draftInvoice` rather than typing figures, and a read-model test re-runs it
- [x] Send, Preview PDF and sync are disabled and announced as unavailable
- [x] Visual diff against the Invoices half of frame 2b is noise-only at 1180px; the 390px layout is listed as derived
      — **`invoices` region 0.00%**, whole frame 0.00%

## Comments

### 2026-09-19 — built

**Built.** No command and no write path: an invoice is seeded and read, which is what the ticket
asked for. Migration **`0013_invoices.sql`** adds `invoice` (the Client, the period as two local
days, the status, the number, the issue and due days, the terms as they stood — arrangement, rate,
overage rate, rounding, payment terms, budget hours, currency — and the totals in cents and
seconds) and `invoice_line` (description, optional Project, the seconds tracked behind it, the
minutes billed, the rate, the amount, the position). It also adds `client.overageRateCents`, which
ticket 16 left open. Every row carries `userId`; one invoice per Client per period is a unique
index; written by hand from `migration:diff` less its `DROP INDEX`, as 0012 was.

**The arithmetic is `packages/shared/src/invoice.ts`** and nothing else computes money. A draft's
lines are the Client's **billable** Time entries in the period, gathered **by Project** — one line
each, biggest first — each line **rounded up once, after the gathering**, and priced at the
Project's own rate where it overrides the Client's. A **retainer** is not gathered at all: its fee
is owed whatever the hours, so it is one line for the budget at the retainer rate and, past it, a
second at the overage rate. The total is the sum of the lines, so cents cannot drift away from
them; minutes and cents are integers throughout and no figure ever touches a float. The due day is
the issue day plus the payment terms, counted in days (`addDays`), never off a clock; `now` is a
parameter here as everywhere, and a running spell counts up to it and no further.

**The seed** (`cori.ts`) runs that function over her own Time entries rather than quoting the
mockup: her September comes to **Meridian $5,880.00 (28.0h at $210, 15-min rounding), Quill $4,275
(22.5h at $190, 6-min) and Bramble $3,600 (the 20h retainer, 17h 50m used, nothing over)** — the
frame's own three figures, and $13,755 drafted, which is the figure frame 1f quotes as unbilled.
Meridian's is `INV-0042`, `review`; the other two are `draft`. The monthly and bi-weekly Clients
issue on this week's Friday (19 Sep), which is what her Brief says, and the retainer on the 1st of
next month — so Meridian's draft falls due 19 Oct, exactly as the frame prints it.

**The read models** are `readInvoices(db, userId, now, timeZone, on?, open?)` and
`readInvoice(db, userId, id, timeZone)` (`packages/db/src/read/invoices.ts`), both filtered by
`userId`. The period is a month. Each row carries its status, its detail, its amount and how many
of the period's entries went into it; the period's totals are drafted, sent, paid and outstanding;
and **what is holding month-end up** is counted from the period's own entries — billable hours for
a Client with no invoice this period, and the entries that name no Client, with what Crazy thinks
they were worth. `readInvoices` also hands back the invoice that is open, with its lines: the URL's
where it names one, else the one waiting to be checked. One query serves both screens.

**The screen** is `apps/web/src/features/invoices/`, styled in `apps/web/src/styles/invoices.css`.
Frame 2b is one page for Time and Invoices, so its right-hand column is the Invoices screen's own
two cards drawn beside the timesheet (`InvoicesAside`), off the same query — the Time screen's
"Coming with Invoices" stand-in is gone. `/invoices` puts the month's four figures, the hold with a
link straight to that month of the timesheet, and a row per Client in the left column, with the
invoice being read in a 400px column beside them. The month and the invoice are both in the URL
(`?on=` a local day, `?open=` the invoice), validated with zod in `validateSearch` the way the Time
screen does it, so a draft can be linked to, gone back from and reloaded into.

**Checked.** `check` (no warnings), `typecheck`, `test` (**323**, up from 308), `build`. Eleven new
shared tests pin the arithmetic (rounding once per line and not per spell; one line per Project,
biggest first; a Project's own rate beside the Client's; not-billable and no-Project work; a
running spell counted to the moment handed in; a retainer under and over its budget with the $200
overage; the due day across a month end, a year and February; integer cents at an awkward rate and
increment; the currency said from the row; and the sentences the draft explains itself in). Five
read-model tests in workerd pin the seeded world: frame 2b's three rows with their details and
amounts, the period's totals, the hold and its sentence, **the seeded Meridian draft re-derived by
`draftInvoice` over the entries read back out of D1** (lines, minutes, amounts, total, seconds),
and a month with nothing in it plus an id read as somebody else.

`pnpm visual`: **2b 0.00% in every region, `invoices` among them**, and everything before it
unchanged — 1a 0.00% at both widths, 1c/1d/1e 0.00%, 2a 0.00% in every region, 3a idle 0.01%,
3a running 0.00%, 3a-open 0.03% (picker 0.00%), 3b 0.00% — and the two known ones (1f 0.13%,
1g 3.21%).

By hand, in a browser, against the screenshots in
`/tmp/claude-1000/-home-ryan-code-crazy/2b7de30a-4494-455f-b726-ce3dc6a9a0a2/scratchpad/t21/`:

- Desktop 1180px — `d-invoices` (the list and Meridian's draft), `d-invoices-quill` (Bramble's
  retainer invoice opened, "Monthly retainer · 20h · 20.0 · $3,600", due 31 Oct),
  `d-invoices-empty` and `d-invoices-august` (August: four zeros and "Nothing to invoice for this
  month"), `d-invoices-from-time` (Review pressed in the Time screen's column, which navigates to
  `/invoices?on=…&open=…`), `d-invoices-longname` (a 51-character Client's name), `d-time` (the
  Time screen with the column in place of the stand-in).
- Phone 390px — `p-invoices`, `p-invoices-empty`, `p-invoices-longname`, `p-time`.
- Pressed: Review from the Time column navigates and the invoice opens; the month steps back to
  August and forward again; a deep link reloads with the same invoice open; Preview PDF reports
  `aria-disabled` and its reason ("Crazy cannot render an invoice as a PDF yet…") and does nothing.
  No console errors.

**Decisions taken.**

- **Frame 2b's Invoices half lives on both screens, off one read model.** The frame is one page and
  the Shell has a screen for each half; drawing the column twice from two queries would have let
  the two disagree about a figure at month-end, which is the one thing this screen may not do.
  `InvoicesAside` is the frame's two cards; `/invoices` is the same two with the month's figures
  and the hold around them.
- **The Time screen's "This period" figures and its accounting targets are gone from that column.**
  The ticket said to replace the stand-in with what the frame draws there, and the frame draws
  invoices. The figures were already in the day cards and the table; the targets moved onto the
  opened invoice, beside Send, which is where a thing is sent from. The 2b mask over the rail's
  foot keeps its place with that reason rewritten.
- **Rounding is per line, after the gathering, not per Time entry.** "Grouped by project, rounded to
  15 min" is the order the frame's own sentence puts them in, and it is the rule she can explain:
  the line's hours are the hours worked on that Project rounded up. Rounding each spell separately
  charges the increment once for every time she looked up from her desk. On Cori's seed the two
  rules happen to give the same figures, so nothing in the frames turns on it; the choice is
  recorded here because a Client will one day ask.
- **A draft counts the running spell up to the moment it is taken at.** Every other figure in the
  app does (`viewTime`, `readWeekByClient`), and frame 2b's $5,880 includes the 1h 42m she is in
  the middle of. An invoice drafted at a moment is a statement about that moment.
- **The frame's third Meridian line cannot be reproduced, and true arithmetic wins.** Frame 2b's
  draft reads "Discovery research · interviews & synthesis 19.5", "Stakeholder workshops 6.0",
  "Project management & reporting 2.5" — but "Project management & reporting" is not one of Cori's
  Projects; it is the note on one of her Discovery entries, and frame 3a's own picker draws Meridian
  with exactly two Projects and is frozen at 0.00%, so a third cannot be seeded without breaking it.
  Gathering her September by Project gives two lines, **22.0h at $210 = $4,620 and 6.0h = $1,260,
  which is 28.0h and $5,880.00** — the frame's hours, total, terms and due date to the cent, one
  line short. The draft card is masked from there down with that reason. **A debt for the designer.**
- **A tag says the status and nothing else.** The frame words its three tags from three different
  things — a status ("Ready to review"), a cadence ("Drafting Fri") and an arrangement
  ("Retainer"). An invoice is in one of four states and the tag says which, so where it has got to
  is never told by colour alone; Meridian's is the one the two agree on and it is compared, and the
  other is masked. The detail line under the name still reads in the Client's own terms, which is
  where the frame's three wordings went: "INV-0042 · 1–30 Sep · 28.0h", "Hourly · 22.5h so far",
  "Fixed · 20h/mo · 17.8h used".
- **The row's first button opens the invoice; it does not send it.** The frame's "Review & send" is
  one control for two things and only one of them exists, so the button is "Review" (or "View" once
  an invoice has gone) and is a real link. Send sits on the opened invoice, drawn and `NotWired`.
- **The solid accent fill is the Review of the invoice waiting to be checked, on the Invoices
  screen only.** In the Time screen's column nothing takes it: that screen already spends its one
  fill on the chosen view (ticket 20), and the frame draws two.
- **A retainer's "used" hours are tracked hours, its billed hours are rounded.** "17.8h used" is a
  gauge against the 20h she has bought, the same figure the Today screen's "2h 10m left" comes
  from; the line bills the retainer's own 20h. The two are different questions and the screen says
  both.
- **No August invoices are seeded, so sent, paid and outstanding are all $0.** The seed only has
  Time entries back to the 3rd, and an invoice whose lines were typed rather than derived would be
  the one thing this ticket is against. Nothing has ever been sent because nothing sends one; the
  four figures are drawn anyway, because the truth is the point.
- **On a phone the opened invoice follows the list rather than rising in the `Sheet`.** It is a
  document to read, not a form to fill in, and the URL already addresses it; a sheet would have put
  a dismissable layer between her and a number she has to be able to scroll through.
- **`invoiceToOpen` is a rule, not a default.** With no invoice named the column opens the one
  waiting to be checked, then the first still being put together. Month-end is a queue and this is
  the front of it.
- **The list's rows carry the card's 8px gap**, because frame 2b lays its rows out as the card's own
  children and that is where the space between them comes from. Without it the rows are evenly
  spaced but every hairline after the first sits 8px high.

**Open.**

- **The opened draft is compared only down to its kicker.** The missing third line puts everything
  under it a line higher than the frame, and the list card is a pixel taller than the frame's, so
  the whole of the second card is masked. The figures are pinned by a read-model test instead
  (`invoices.test.ts`, "has a seeded draft whose lines are what the arithmetic makes of the seeded
  entries"), not by the harness. It goes when the designer says what the third line was.
- The second and third invoices' sentences and buttons are masked as well, so the compared
  `invoices` region is the card's head and the first two rows' Client, status, detail and amount —
  which is the money, but it is less than the whole column.
- **An invoice never changes state.** `draft → review → sent → paid` is a Workflow (ADR 0002) and
  nothing drives it; the statuses are seeded. Whoever builds the cycle should decide there whether
  re-drafting an invoice rebuilds its lines, and what happens to one whose Time entries are edited
  after it was drafted — today the invoice keeps the figures it was built with and nothing notices.
- **The period is a month and only a month.** Quill is bi-weekly and Bramble bills on the 1st, so
  neither Client's real cycle is the screen's period; the screen shows what each of them has run up
  inside the month. A Client on a fortnight wants their own span, and that wants a frame.
- `entryCount` is counted from the period's Time entries rather than recorded on the invoice, so
  "I gathered 9 entries into 2 lines" follows the timesheet rather than the draft. Once an invoice
  can be re-drafted the two can disagree, and the count should move onto the row.
- Dev only, and unchanged from tickets 17–20: the Coordinator stamps the real clock, so the seed
  laid down by `POST /dev/seed` without a pinned cookie puts the running entry on the real day and
  Meridian's draft counts it to the real moment. Everything the harness compares is read, not
  pressed.
