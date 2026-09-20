# Crazy — project brief

## The product in a page

A person's day is scattered across the tools their work and their personal life run through: a
calendar, chat, an issue tracker, documents, two email accounts. Crazy reads both sides and says
what today holds and the one thing to do now.

A user signs in and lands on the **Today screen**: a **Brief** in the first person, one solid
**Take on now** card, the day's hour timeline with Todos on their **Slots**, the **Priority stack**
and the **Signals** that arrived from their **Providers**. They tick, add, slot, snooze and
**Swap**; the screen responds at once and a second device catches up over a socket that costs
nothing while idle. At local midnight the **Rollover** carries over what they touched and sends
back what they ignored. Week, Projects, Circles, Metrics and the Integrations screen sit beside it.
Someone who bills for their time turns on the **Billing module** and gains a timer bar, a Time
screen, an Invoices screen and billing Connections in the same Shell.

The vocabulary is `CONTEXT.md`. The decisions are `docs/adr/`. The full foundation spec is
`.scratch/foundation/spec.md`, and its tickets are beside it.

## Architecture

```
browser ── apps/web (TanStack Start, SSR) ──reads──▶ D1 (Prisma)
                │                                     ▲
                └─ every write, every socket ─▶ Coordinator (apps/core, one Durable Object per user)
```

- **D1 is the only source of truth.** The Coordinator holds sockets, a sequence counter, a replay
  buffer and schedules, and no domain data. Every write goes optimistic update → server function →
  Coordinator → D1 → `{seq, ops}` patch → hibernate. Per-user serialisation in the Coordinator
  stands in for the transactions the Prisma D1 adapter lacks.
- **Clerk is the only credential store.** A Connection is a Clerk external account plus one
  bookkeeping row. Tokens are fetched from Clerk at the moment of use and never stored.
- Provider pulls will run on a Queue, the Brief, invoice cycle and archive as Workflows, and LLM
  calls through AI Gateway, so the Coordinator never waits on the outside world.

## What is real, seeded and scaffolded

Updated as tickets land.

| What                                                                                                                                                                                                                                                                              | State                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo on Vite+; format, lint, typecheck, test, build from the root                                                                                                                                                                                                             | Real                                                                                                                                                                                                                                                                                                    |
| Both Workers from one `pnpm dev`, sharing a local D1; Coordinator bound across Workers                                                                                                                                                                                            | Real                                                                                                                                                                                                                                                                                                    |
| Clerk sign-in (Google, GitHub, email code); demo user Ryan without keys                                                                                                                                                                                                           | Real (the Clerk path has not been exercised with real keys yet)                                                                                                                                                                                                                                         |
| Lazy provisioning: settings row and Coordinator on the first authenticated request; time zone taken from the request                                                                                                                                                              | Real                                                                                                                                                                                                                                                                                                    |
| The Shell at both widths, the More screen, a route behind every destination                                                                                                                                                                                                       | Real                                                                                                                                                                                                                                                                                                    |
| Live across devices: `/live` hands the socket to the user's Coordinator, patches land in the query cache, the Live indicator shows the connection                                                                                                                                 | Real; nothing pings, so a connection that dies silently is not noticed until the browser notices                                                                                                                                                                                                        |
| The current time as an injected value in the web app, which a development request can pin                                                                                                                                                                                         | Real                                                                                                                                                                                                                                                                                                    |
| Visual comparison harness (`pnpm visual`): frames 1a, 1c–1g, 2a, 2b, 3a, 3b and 4a against their routes, derived phone screenshots                                                                                                                                                | Real; frame 2c joins with the ticket that draws that screen                                                                                                                                                                                                                                             |
| Schema for Connection, Circle, Project, Todo, Slot, Brief, calendar event, Signal and the timeline's wording                                                                                                                                                                      | Real; "one Source, one open Todo" is a partial unique index                                                                                                                                                                                                                                             |
| The Ryan persona seed (`seedPersona` in `@crazy/db/write`): every new user starts from it; `POST /dev/seed` resets                                                                                                                                                                | Real; nothing is stamped later than the moment seeded over                                                                                                                                                                                                                                              |
| Today screen: greeting, date, Brief, Take on now, Priority stack with footer, read from D1 by `readToday`                                                                                                                                                                         | Real on seeded rows; Start and Swap are wired on the desktop, where the frame draws them                                                                                                                                                                                                                |
| The command seam (`decide` and `apply` in `@crazy/shared`), `useCommand`, the Coordinator's single write path                                                                                                                                                                     | Real, for fifteen commands (the Billing module on or off among them): complete, add, snooze a Todo, give it a Slot or take it off, start it or swap it; a Mention, or every Promise at once; the lifecycle settings and time zone, a Connection and its Side; the Rollover; a Source reported complete  |
| The Brief's text, the stack's order and each Todo's reason                                                                                                                                                                                                                        | Seeded, stored where generated text will live                                                                                                                                                                                                                                                           |
| Today screen: hour timeline, Mentions, the place to add a Todo                                                                                                                                                                                                                    | Real on seeded rows; adding, dragging a Todo onto an hour and the hour picker are wired                                                                                                                                                                                                                 |
| How each hour of the timeline is worded                                                                                                                                                                                                                                           | Seeded (`timeline_hour`), while the hour still holds the Todos it was written for; else derived                                                                                                                                                                                                         |
| A Todo's match to a Circle (`circle_match`), and an Overlap's wording (`overlap_note`)                                                                                                                                                                                            | Seeded; nothing writes either yet. An Overlap is never a row — it is a Todo matched to 2+ Circles                                                                                                                                                                                                       |
| Circles screen: the figure of the Circles with their Sides, and this week's Overlaps, read from D1 by `readCircles`                                                                                                                                                               | Real on seeded rows; how many people a Circle holds and its Overlaps' wording are seeded                                                                                                                                                                                                                |
| Week screen: the week's head, the week in numbers, the seven days and their captions, read from D1 by `readWeek` and derived by `viewWeek`                                                                                                                                        | Real on seeded rows; every figure is computed from Todos, Slots and the calendar, none is stored                                                                                                                                                                                                        |
| The Week brief, the note beside a day's figures, each day's short wording, and where the user ties in per Project                                                                                                                                                                 | Seeded, stored where generated text will live (`brief` kind `weekly`, `week_day_note`, `week_day_line`, `tie_in`)                                                                                                                                                                                       |
| Projects screen: each Project with its Circle, open count, status, progress, next milestone and what is on today, read from D1 by `readProjects`                                                                                                                                  | Real on seeded rows; every figure is counted by query, none is stored                                                                                                                                                                                                                                   |
| A Project's history: the Todos behind its progress bar, including ones archived without being done                                                                                                                                                                                | Seeded; the counts are real, the titles are the seed's                                                                                                                                                                                                                                                  |
| Promises and Waiting on (`signal` kinds `promise` and `waiting_on`), and "Turn all into todos" (`signal.addAll`)                                                                                                                                                                  | Real: the command is wired and optimistic. The Signals themselves are seeded, as Mentions are                                                                                                                                                                                                           |
| When the backlog next crosses the archive period, and how many cross with it                                                                                                                                                                                                      | Real, counted from how long each backlog Todo has gone untouched; the Rollover archives them (ticket 10)                                                                                                                                                                                                |
| Integrations screen: Providers and Connections, the Account, the Realtime panel and the lifecycle settings, read by `readIntegrations`                                                                                                                                            | Real. Connect is Clerk's add-external-account flow and has not been exercised with real keys yet; with no keys the demo user's seeded Connections are drawn and Connect is unavailable. Nothing is pulled from a Provider, so "synced" is the seeded moment.                                            |
| The Rollover: a command the Coordinator schedules for the user's next local midnight, and again after it runs and when the time zone changes                                                                                                                                      | Real. Carried over, sent back and archived by the user's own periods; once per local day; its patch tells open tabs the day has turned and they read again. Nothing sends `source.completed` yet: no Provider is pulled                                                                                 |
| The Billing module: `billing.set`, Client and Time entry in the schema, the Cori persona (`POST /dev/seed?persona=cori`)                                                                                                                                                          | Real. The Shell gains and loses Time and Invoices at once, and both routes answer Not found with it off. At most one running Time entry is held by a partial unique index, and `decide` holds the same rule (ticket 17). Frames 2a, 2b, 3a, 3b and 4a are compared; 2c waits on its ticket              |
| Metrics screen: six headline figures, focus by hour of day, backlog ageing, where Todos come from and the thirty-day strip, over Week, 30 days or Quarter, read by `readMetrics`                                                                                                  | Real on seeded rows; the range lives in the URL and switching it does not reload the page                                                                                                                                                                                                               |
| Backlog ageing and where a range's Todos came from                                                                                                                                                                                                                                | Real: counted from Todos at the moment the screen is read, over `todo(userId, state, touchedAt)` and `todo(userId, createdAt)`. Frame 1f's bands were drawn before the Projects seed; its two younger ones now count more                                                                               |
| The six headline figures, the bars by hour of day, the thirty-day strip and the screen's commentary (`metric_snapshot`)                                                                                                                                                           | Seeded, stored where generated data will live, written per range for a day; a day Crazy has not modelled shows none                                                                                                                                                                                     |
| Metrics, the **Time** tab (frame 4a, the Billing module on): utilisation, the billable split, hours per week by Client, when she works, unbilled money by Client, budget and retainer burn, and estimate against actual — read by `readMetricsTime`, derived by `viewMetricsTime` | Real on seeded rows. Every figure about hours is counted from her Time entries over `time_entry(userId, startedAt)`; the unbilled money is `readInvoices`' own figure, so Metrics and Invoices cannot differ by a cent. The tab lives in the URL beside the range                                       |
| The hours a week she means to bill, the share of her time she means to be billable, and the Time tab's two lines of commentary                                                                                                                                                    | Seeded (`metric_snapshot`, written once at the 30-day range): a target is a decision nobody has recorded yet, not a measurement. Without them the two tiles say so rather than showing a figure                                                                                                         |
| Metrics, the **Money** tab                                                                                                                                                                                                                                                        | Drawn and not wired: the option keeps its place in the tab order, is announced as unavailable with the reason, and never reaches the URL                                                                                                                                                                |
| Time screen: the timesheet a Day, a Week or a Month at a time, read by `readTime` and derived by `viewTime`; editing an entry in place, adding one by hand, and confirming the Client Crazy suggested                                                                             | Real on seeded rows. Every figure is counted from the period's own rows at the moment the screen is read; the period lives in the URL. The column frame 2b gives to Invoices is the Invoices screen's own two cards, off the same query (ticket 21)                                                     |
| Who Crazy thinks a Time entry's hours were for (`time_entry.suggestedClientId`)                                                                                                                                                                                                   | Seeded, stored where generated guesses will live; nothing writes one yet. Confirming it is a command                                                                                                                                                                                                    |
| Invoices screen: each Client's invoice for the month with its status, detail and amount, the month's figures, what is holding month-end up, and the opened invoice with its lines, total, terms, due date and how it was built — read by `readInvoices` and `readInvoice`         | Real on seeded rows. Read-only: Send, Preview PDF and the accounting sync are drawn, disabled and announced as unavailable, and no command writes an invoice. The month and the invoice being read live in the URL                                                                                      |
| Invoice and invoice line (migration 0013), and the arithmetic behind them (`draftInvoice` in `@crazy/shared`)                                                                                                                                                                     | Real. A draft's lines are its Client's billable Time entries in the period, gathered by Project, each line rounded up once under the Client's rounding and priced at the Project's rate where it overrides the Client's; a retainer is its fee plus an overage. Integer cents and seconds throughout    |
| Cori's invoices and their lines, one per Client per month she worked                                                                                                                                                                                                              | Seeded, and not typed in: the seed runs `draftInvoice` over the seeded Time entries, so the mockup's $5,880, $4,275 and $3,600 are what her September timesheet comes to. July's and August's were billed and paid, which is what makes "unbilled" on Metrics mean this month's money and nothing older |
| Cori's five weeks before September, and the finished Todos behind some of them                                                                                                                                                                                                    | Seeded (ticket 22), so that "hours per week by Client" reaches back eight weeks and "estimate vs actual" has Todos that carry both an estimate and a timer. Nothing falls on or after 1 September, so her Meridian 28.0h, Quill 22.5h and Bramble 17h 50m are exactly what they were                    |
| Everything else in the spec                                                                                                                                                                                                                                                       | Not started                                                                                                                                                                                                                                                                                             |

## Derived layouts

The frames draw desktop for every screen, but a phone only for the Today screen and the timer
sheet. These are derived from the same primitives rather than drawn, and must be re-checked when
frames exist:

- The **More screen** (phone): a list of the destinations the tab bar leaves out, then the user.
- **The Time screen on a phone.** Frame 2b draws desktop only. One column: the heading with the
  period and the three views, the strip of day cards wrapped onto as many rows as it needs, then
  each entry as a compact two-line row — when it was, whose work it was and the hours on the first
  line, the note and Edit on the second — then the flag, the place to add an entry, and the
  Invoices column underneath it all. A row has no room for an editor inside it there, so the same
  editor rises from the bottom edge in the `Sheet` primitive.
- **Moving between periods on the Time screen.** Frame 2b draws week 38 and no way to reach week 37. Previous, "this week" and next sit between the heading and the three views; the period is in
  the URL (`?view=` and `?on=`, a local day the period is anchored on), so last week can be linked
  to, gone back from and reloaded into, and the period the moment falls in is the plain link with
  no `on` at all.
- **What the Time screen's strip of cards is drawn in.** Frame 2b draws five day cards for a week.
  A day at a time it is the one day; a month at a time it is the month's weeks (W36…W40), so the
  strip is never more than a handful of cards however long the period. A week's strip is Monday to
  Friday, and a weekend day joins it only when it was worked. Each card's bar is its Clients'
  shares drawn against the fullest card in the strip, with the rest dashed, as "This week by
  Client" draws a Client's week. The caption keeps two lines' room whatever it says, so that a
  longer caption on one day does not move the table under the strip.
- **The timesheet's columns are given their widths** rather than taken from what is in them, so
  that they do not move while she edits: a long note must not squeeze the Client column, and the
  running entry's trailing dash must not widen When. A month at a time When takes more room and
  What gives it up. The widths are frame 2b's own.
- **One Time entry, open for changing.** No frame draws it. Pressing a row (or its Edit button)
  opens it under itself, tinted: the day, the two times, the work picker (frame 3a's, as a field),
  the note and a billable box, then Save, Cancel and Remove. Escape puts the row back; enter saves
  from any field. A change the rules will not allow is said in plain words inside the editor,
  because the browser runs the same `decide` the Coordinator will. Save does **not** take the solid
  accent fill: the screen's one fill is the view the segmented control is on.
- **Removing a Time entry.** No frame draws it, and nothing else in the app deletes a row. A
  contractor must be able to take out an entry that was never worked, so Remove sits in the editor
  and asks once in its own words ("Really remove?") rather than in a modal. The running entry
  cannot be removed until it has been stopped.
- **Adding a Time entry by hand.** Frame 2b's field promises to read "2h Meridian synthesis
  yesterday afternoon" into hours; Crazy parses no sentences, so the field takes the new entry's
  note and Add opens the same editor under it, with the day being looked at, a start right after
  the last entry of that day ended, and the work she was last on. Its end is left empty and asked
  for: inventing an end would invent hours.
- **The flag under the timesheet.** Frame 2b's tag says "2 entries need a project" and its sentence
  says it thinks both were Quill's. In the glossary they need a **Client** — Internal is the absence
  of a Client, and a Client with no Project is a perfectly good One-off — so the app says "2 entries
  need a Client", and the flag beside each of those notes is the one-tap Confirm the frame's own
  sentence promises.
- **Where the accounting targets are drawn.** Frame 2b puts "Synced to · QuickBooks · 09:00" in the
  foot of the rail; the Shell follows frame 1a there on every screen (Live, then the user), so the
  targets sit on the opened invoice instead, beside Send, which is where a thing is sent from. All
  three are drawn, disabled and announced as unavailable: Crazy has sent nothing anywhere
  (ticket 23).
- **Where the Invoices half of frame 2b lives.** Frame 2b is one page for Time and Invoices, and
  marks both destinations in its rail; the Shell has a screen for each. The column the frame draws
  beside the timesheet is the Invoices screen's own two cards — the month's invoices, and the one
  most in need of her eyes — read from the same query on both screens, so the two can never come to
  different figures. Nothing in that column acts: Review opens the invoice on its own screen, and
  the Time screen's one solid accent fill stays the chosen view.
- **The Invoices screen.** No frame draws it on its own. At 1180px the month's figures (still to go
  out, sent, paid, outstanding), what is holding month-end up with a link straight to that month of
  the timesheet, and a row per Client fill the left column; the invoice being read sits in a 400px
  column beside them, as the timesheet's does. The month and the invoice being read are both in the
  URL (`?on=` a local day in the month, `?open=` the invoice), so a draft can be linked to, gone
  back from and reloaded into.
- **The Invoices screen on a phone.** One column: the figures two abreast, the hold, the list, then
  the invoice being read underneath it rather than beside it. A long Client's name and a long
  detail line each give way with an ellipsis rather than pushing the status tag or the amount off
  the row. Every amount is set in tabular figures and aligned on its last digit.
- **What an invoice's status tag says.** Frame 2b words its three tags from three different things
  — a status ("Ready to review"), a cadence ("Drafting Fri") and an arrangement ("Retainer"). In
  the app the tag is the Invoice's status and says which of the four it is, so that where an
  invoice has got to is never told by colour alone.
- **The Time screen and the timer.** Frame 2b draws no timer bar on this screen, so the screen
  draws none: while an entry runs the Shell's compact header is over it as it is over every other
  screen. The running entry is in the timesheet, counting up from the moment the loader handed
  over, and is editable like any other — except that it cannot be given an end here, because
  ending it is `timer.stop`'s to decide at its own moment.
- The **sign-in page**, at both widths. No frame exists.
- **Shell order with the Billing module on.** Frame 2a lists Today, Week, Projects, Time, Invoices,
  Metrics, Integrations and omits Circles. The spec keeps Circles, so it is placed after Invoices.
- The Time and Invoices routes with the Billing module **off**: both answer Not found.
- **A month with nothing to invoice.** No frame draws one. The four figures read $0, the hold says
  nothing is holding the month up, and the list says what to do: "Nothing to invoice for this
  month. Track billable hours for a Client and their invoice will be drafted here." A screen with
  nothing on it spends none of the accent.
- **How long a Todo has been carried, and its reason.** Frame 1a's stack rows draw only the Todo,
  its Project and estimate, and its chip. Pressing a Todo opens "carried 1 day · the reason"
  underneath it; closed, the row is the frame's.
- **Snoozing, and the snoozed Todos.** No frame draws either. The same opened row holds "Snooze
  30 min", "1 hour" and "24 hours"; snoozed Todos sit under the stack behind "N snoozed", each with
  the day and time it returns. On a phone that list falls inside the frame's Priority stack
  rectangle, so the harness is never run over a snoozed Todo; the seed has none.
- **Giving a Todo an hour without dragging.** Frame 1a draws only the hint "Drag a todo onto an
  hour to slot it", which a thumb cannot follow. The same opened stack row holds an hour picker
  labelled "Slot" — every hour of the timeline, and "No Slot" — which is the phone's way to give a
  Todo a Slot and the keyboard's. An hour the day cannot take is offered, refused and says why in
  a word or two ("14:00 — a meeting"); the timeline takes the drop on every hour and says the same
  in a notice. The hour under a drag that can hold the Todo is tinted with the accent while the
  drag lasts. No frame draws any of it.
- **A Todo completed today** stays under the Priority stack, ticked and struck through. No frame
  draws a done Todo.
- **A notice** when a change is refused or does not reach the Coordinator: a hairline box above the
  screen, dismissed by the user. No frame draws one.
- **Whether a Mention has been added, and Add.** Frame 1a's Mention rows draw neither. Pressing a
  Mention opens "Added to your Todos" or Add underneath it.
- **Mentions and the place to add a Todo on a phone.** The phone frame stops at the Priority stack;
  they follow it. The harness masks that rectangle of the phone frame and says why.
- **Start, Swap and the stack's footer on a phone.** The phone frame draws none of them, so they
  are hidden below 900px. Ticket 09 wired Start and Swap on the desktop and left the phone without
  them: the harness compares the phone's Take on now card, and the frame draws no actions inside it,
  so a phone treatment needs a frame (or a mask, which is a debt) before it can be added.
- **The started state of Take on now, with the Billing module off.** No frame draws it. The card
  takes the running timer bar's treatment from frame 3a — the accent tint and the accent hairline —
  without the picker, because with the module off there is no timer and no Client to pick; it says
  "Started · since 09:12" where Start and Swap were. The card gives up the solid accent fill while
  it is under way, so a started Today screen has none. With the Billing module **on** there is no
  Take on now card at all: frame 2a drops it, and the stack sits where it was with a start control
  on every row, so the Todo Crazy recommends is the stack's first row and taking it on is the same
  one press as taking on anything else.
- **The Today screen on a phone with the Billing module on.** Frame 2a's phone card draws the
  timer as a solid accent card with Stop and Switch project on it; frame 3b draws the same control
  as a tinted card with the square, and 3b is the one the app follows, so the two frames cannot both
  be met and the screen below the card sits at a different height for that reason alone. Frame 2a's
  phone also leaves the Brief out and lists the day's hours as rows; the app keeps the Brief — it is
  the first thing the screen is for — and keeps frame 1a's sideways hour strip, with each hour's
  Client rule across its head and its tracked figure under the title. Screenshotted at 390px and
  not compared (`tools/visual/src/targets.ts`).
- **What a timeline hour says with the Billing module on.** Frame 2a gives each hour a Client's
  colour down its left edge, the Client's three letters where frame 1a puts the Source chip, and
  the time tracked in it on the right; and it draws the hour by what became of it rather than by
  what is planned for it — the hours the timer is in now framed in the accent, hours with tracked
  time plainly boxed, everything still only planned dashed. A meeting is a meeting either way. Whose
  an hour is comes from what was tracked in it, and failing that from the Todo slotted on it; Crazy
  never reads a Client off a Provider's calendar, so a meeting hour with nothing tracked names
  nobody, where the frame names the Client whose meeting it is.
- **The compact time header.** No frame draws it; it is frame 3a's running bar cut down to a strip
  and uses nothing 3a does not — the accent tint, the accent hairline, the heading face's tabular
  figures and the Client's rule. While a Time entry runs it shows on every Shell screen: a 44px
  strip stuck to the top of the screen from 900px, and below it a 48px strip docked above the tab
  bar, where a thumb is, which the screen clears in bottom padding. On the Today screen the full
  bar is itself what takes those measurements once the page has scrolled past it (a sentinel and an
  `IntersectionObserver`), and the dock waits until the card is out of view, so the timer is never
  shown twice at once. Idle, the header is not drawn at all: only running time follows the user
  around. Its square is not the solid accent fill — an accent hairline box with an `accent-700`
  glyph — so the screen under it keeps its own single fill. Its bottom hairline carries **the
  minute rule**: a 1px `accent-700` line drawn left to right once a minute, one CSS animation
  started part-drawn from where the entry's minute already stands, so it agrees with the seconds
  beside it and on every device; under `prefers-reduced-motion` it stands complete and still.
- **The stop receipt and the start wash.** No frame draws either. Starting washes the tint across
  the header from the square once, ~240ms, whether the press was made here or on another device.
  Stopping holds the header for about 1.5s, still, reading "Stopped · 1h 42m logged to Meridian
  Health" — billing software owes a receipt — and then the compact header leaves and the full bar
  settles to idle. The hold is UI state only; the entry ended when the command said so.
- **The browser tab while a timer runs**: "1:42 · Meridian Health — Crazy", rewritten when the
  minute changes and put back on stop. It comes from the same derived moment as the bar, never
  from a clock.
- **An empty Priority stack** says "Nothing left for today." and the Take on now card is absent.
- **The Circles screen on a phone.** The frame draws desktop only. The two columns fall into one:
  the heading, the figure at the width there is (it keeps its proportions), then the Overlaps and
  the note. Nothing is dropped and nothing scrolls sideways.
- **A Circle the figure has no room for.** Frame 1e's figure seats four, three crossing and one
  standing apart, and a personal Circle takes the one that stands apart. A fifth Circle is named
  under the figure — "Not in the picture: …" — rather than silently left out. The seed has four.
- **Where the Billing module is turned on and off.** No frame draws it. A card under Realtime on the
  Integrations screen, with one switch; its knob crosses over when on, and it takes no solid fill.
- **The time zone on the Integrations screen.** Frame 1g draws no such row. Under the lifecycle
  settings: "Midnight in America/Chicago", and when this device is somewhere else, a button to use
  its zone instead. Every screen reads again once the zone has moved.
- **The Integrations screen on a phone.** The frame draws desktop only. One column: the Providers
  one under another, then the Account, then Realtime and the lifecycle settings.
- **A Connection's default Side, a second account, and authorising again.** Frame 1g draws none of
  them. Each Connection is a line on its Provider's card — which account (Clerk's word), when it
  last synced, and a small Work/Personal choice beside it; a connected Provider offers "Connect
  another account", and a lapsed Connection offers "Authorise again".
- **What the Integrations screen says differently from frame 1g**, because the frame's words are
  not true yet: a card's meta line is the real last sync, not "webhook · 41 todos this month";
  Todoist and Apple Health read "Planned · Not available yet" and cannot be pressed (ADR 0001); the
  Realtime note names what last woke the Coordinator in its own terms ("a screen was opened"), not
  a person; the hourly status line's switch is drawn off and unavailable, because nothing sends one
  yet; and the demo user's Account card says there is no account to manage.
- **The Week screen on a phone**: one column of the same primitives, in the frame's order — the
  week's line and the state of the union, the week in numbers, the seven days one under another
  (each only as tall as what it holds), the legend, then the tie-ins. The short Week brief stands
  in for the long one, as the Today screen's does.
- **Today on the Week screen.** Frame 1c's day cards never pass the `today` flag its own template
  supports, so it draws Wednesday like every other day; the app follows the frame and marks today
  to assistive technology only (`aria-current`). The accent card the template hints at is one rule
  away if the designer meant it.
- **A day Crazy has no words for** shows its figures and nothing under them, rather than inventing
  a line; a day that holds nothing at all says nothing. A week with nothing in it draws no bars.
- **A week Crazy has not written about** keeps the "State of the union" heading and says so under
  it, and shows no tie-in cards. No frame draws either.
- **The Projects screen on a phone.** The frame draws desktop only. The two columns fall into one:
  the heading and the filter, the table, the opened Project, then the Promises, the Waiting on and
  the lifecycle note. The table keeps all five of its columns and wraps inside them rather than
  scrolling sideways — nothing is dropped, as on the Circles screen.
- **A Project opened up, and which one.** Frame 1d draws one Project expanded and no way to have
  chosen it, so the first Project in the table is open when the screen arrives; pressing another
  opens that one, and pressing the open one closes it. A filter that takes the open Project off the
  screen closes it. The squares beside its `today` Todos are marks, not controls: a Todo is ticked
  on the Today screen, and nothing here pretends otherwise.
- **A Promise that has become a Todo** shows "Added to your Todos" under it, and "Turn all into
  todos" is disabled once none is left, saying why to assistive technology. No frame draws either:
  the frame's three Promises are all unadded.
- **The Metrics screen on a phone.** The frame draws desktop only. One column of the same
  primitives, in the frame's order: the heading with the range control beside it, the six figures
  in two columns rather than six, the three charts one under another, then the thirty-day strip
  and its caption. The strip keeps all thirty days at a phone's width, on a 2px gap rather than 3.
- **A range Crazy has not modelled.** The Metrics screen counts the backlog's ageing and where its
  Todos came from whatever day it is opened, but the figures Crazy models are written for one day,
  like the Brief. A day it has not modelled says "Crazy has not modelled this range today." in
  place of the six figures, and the thirty-day strip says the same. No frame draws either.
- Still to come, per the spec: phone layouts for Time and Invoices.

Deliberate differences from the frames, all of them drawn into the frame too, so neither shows up
as a mismatch (`WORDMARK` and `COPY` in `tools/visual/src/targets.ts`):

- The wordmark reads CRAZY where the frames read TODAY.
- The stack's footer says "1 sent back" where frame 1a says "1 moved to backlog"; the Mentions card
  is titled "Mentions" where the frame says "Mentions & follow-ups"; the Circles screen says "Four
  Circles this week" where frame 1e says "Four groups this week", and that Circles are inferred from
  "which Providers the work lives in" where the frame says "which tools". Frame 1d's Today column
  says "2 Todos" where the frame says "2 items", and its lifecycle note "6 backlog Todos" where the
  frame says "6 backlog items". The glossary lists every one of the frame's wordings as one to avoid.
- **The repo writes British English**, so the Metrics screen says "Backlog ageing" where frame 1f
  says "Backlog aging".
- **A Project belongs to one Circle** (CONTEXT.md), so frame 1d's "Platform + Design" is one
  Circle in the app, and it is named "Platform team" as frame 1e's figure names it.
- **Crazy words every age the same way**, so the Waiting on the frame dates "since Tue" reads "2d".
- **A Todo is listed under its own title.** Frame 1d shortens two of the Todos inside the expanded
  Project ("Finish session-token spike"); the app shows the title frame 1a draws.

## Comparing a screen with its frame

```sh
pnpm visual            # every frame, then the routes no frame draws
pnpm visual 1a 1c      # named frames only
pnpm visual 1a --now 2025-09-17T16:30   # the same screen at another moment
```

It uses the app at `http://localhost:3000` if one is running and otherwise starts `pnpm dev`
itself and stops it afterwards (`--url http://localhost:3100` for another port). It needs the demo
user, so no Clerk keys. Before each frame it resets the demo user to the frame's persona at the
frame's moment (`POST /dev/seed`, below), so whatever you had changed in the app is gone afterwards. Everything lands in `.visual/` (ignored by git); open `.visual/index.html`.
Once per machine, fetch its browser: `pnpm --filter @crazy/visual exec playwright install chromium`.

For each frame and width it writes `-frame.png`, `-app.png`, `-side-by-side.png` and `-diff.png`,
and `report.json` holds the figures. How to read them:

- **A mismatch is a pixel that differs beyond anti-aliasing** (pixelmatch, threshold 0.1). In a
  diff, red differs, yellow is anti-aliasing and is not counted, and hatching is a mask.
- **The whole-frame figure** is only meaningful once the screen is built. **Region figures** are
  what a ticket signs off: a named rectangle of the frame, such as `rail`, `top bar`, `tab bar` and
  the Today screen's `brief`, `take on now` and `priority stack`. "Noise only" means a region reads
  0.00% and its diff shows no red. Add a screen's regions to `tools/visual/src/targets.ts` as the
  screen is built.
- **A mask** leaves out a rectangle the app is known not to match yet, and the report prints why.
  A mask is a debt: delete it in the ticket that pays it. Today's are the foot of the rail in 1c–1g,
  which those frames leave empty and 1a draws, and frame 1c's bars: the meetings third of each day's
  strip, whose heights follow no scale the frame is consistent about, and one or two pixels at the
  top edge of five of the Todo bars, where the frame's percentages are hand-rounded to a multiple of
  five and the app's are the count of Todos over the week's largest count. Both go when a designer
  settles what the bars measure; the numbers behind them are in `tools/visual/src/targets.ts`.
  Frame 1d's expanded Project carries two more, both places where the frame disagrees with itself
  or with frame 1a: the third row of "Today's children", which the frame draws as a Todo completed
  today — seeding one would add a done row under frame 1a's frozen Priority stack — and with it the
  card's bottom edge, 20px higher without that row; and the backlog count, because the frame's
  "12 open", "Backlog · 9" and "2 on today" cannot all be true. Every other row of that card agrees
  with the frame to the pixel.
  Frame 1f carries one more: the bars of "Focus hours by hour of day". The frame gives each bar a
  percentage height inside a grid row of automatic height, which resolves to nothing, so it draws
  ten hour labels and no bars at all. The app puts the bar in a row of its own so the percentage
  has something to be a percentage of; the labels underneath keep the frame's baseline to the pixel
  and are compared. It goes when the frame draws its own bars.
  Two masks are not debts: under the Priority stack on a phone, where the frame stops and the app
  goes on, and the digits of the Live indicator's wake time, which come off the Coordinator's real
  clock (the harness waits for the indicator to read live before it takes a picture).
- **Derived** routes (no phone frame) are screenshotted at 390px and listed without a figure.
- The pictures are one viewport, the size of the frame. If the page runs longer, the report says
  by how much.

It can also put one frame's card into another frame's screen, which is what frame 2a needs: 2a
draws the timer as a segmented picker the app does not have, and the bar it does have is frame 3a's,
drawn on its own beside it. Rather than mask the band and compare nothing there, the target names
the band and the card that goes in it (`compose` in `tools/visual/src/targets.ts`) — which is what
the canvas itself suggests trying next under frame 3a, "put the 3a bar into 2a" — so the screen
below stands where the app stands it and can be compared at all.

How it draws a frame: the canvas's own runtime is not among the frozen files, so the harness
expands the canvas's loops and values itself (`tools/visual/src/template.ts`), keeps the one card
asked for, and drops the canvas's border and shadow around it so the card's edges are a viewport's
edges. The frame is drawn as the persona the app runs as: Mara Okafor becomes Ryan Yogan and the
wordmark becomes CRAZY, so neither shows up as a difference. It gets the same self-hosted Barlow
files as the app, and no request leaves the machine.

How the moment is pinned: each frame names the wall-clock time it shows (`2025-09-17T08:41` for
Ryan). The harness sends it as the `crazy-now` cookie; `requestNow` reads it in the user's time
zone and answers with an `x-crazy-now` header, and the harness fails if that header is missing, so
a pin is never silently ignored. A production build does not contain the cookie's name.

## Seeded data

`seedPersona` (`packages/db/src/seed/`) replaces everything a user has with a persona's content,
laid over a moment: the mockups' Wednesday 08:41 becomes that moment's day, so Slots, the Brief and
"carried over from yesterday" stay true whenever it runs. The Coordinator runs it when it provisions
a new user, because until Providers are pulled there is nothing else to show. In development,
`curl -X POST localhost:3000/dev/seed` resets the signed-in user to the Ryan persona as of now (send
a `crazy-now` cookie to choose the moment); a production build answers 404. A day after seeding,
the Brief and the Slots belong to yesterday and the screen says less; reseed.

Crazy's wording of an hour (`timeline_hour`) records the Todos it was written for. It is used while
the hour still holds exactly those Todos, and otherwise the hour is worded from what it holds now —
so a re-planned hour never reads as the plan it was, and an hour put back the way Crazy had it
reads the way Crazy wrote it. No user command deletes generated text.

Behind that week sits the month and the quarter the Metrics screen counts: back-dated Todos,
finished and still waiting, laid the same way. None of them is in `today`, holds a Slot, is matched
to a Circle or was finished inside the week the Week screen shows, so adding them left the Today,
Week and Circles screens exactly where they were. At the mockups' Wednesday they add up to frame
1f's figures — 34 in the backlog across the four bands, and 122 Todos in thirty days from Linear,
Slack, Notion, Google and Ryan himself.

The mockups' week is laid on the week that moment falls in, a day of it per weekday, so the Week
screen is whole whichever day the persona is seeded on. Today is always the Today screen's own day,
so its weekday's content stands aside for frame 1a's; a day behind today holds work that is done and
a day ahead holds work that is planned, and nothing is ever recorded as finished in the future.
Seeded on the mockups' Wednesday, which is what the harness pins, the week is frame 1c's exactly.

## The design source

`docs/design/` is frozen: `Today Mockups.dc.html` (the frames), `CLAUDE-CODE-NOTES.md` (its
technical notes, partly overruled by the ADRs), and the Industry system's `styles.css` and
`readme.md` at the path the mockup links them from. They come from the Claude Design project
`3daa06cb-5eb9-4362-b712-3344efb90c3d`. The app's copy of the stylesheet
(`packages/ui/src/styles/industry.css`) differs only in dropping the Google Fonts import.

## Backlog, in order

The tickets in `.scratch/foundation/issues/`: 03–04 the Today screen
→ 05 complete a Todo → 06 live across devices → 07–09 add, snooze, slot, start and Swap → 10 the
Rollover → 11–15 Week, Projects and Signals, Circles, Metrics, Integrations → 16–23 the Billing
module → 24 the Attachment seam → 25 shells for the Queue, Workflows and AI Gateway.

Not in the foundation at all: pulling from Providers, generating any text or ordering, invoice
PDFs and sending, moving archives to R2, deployment and CI.
