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

| What                                                                                                                                              | State                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Monorepo on Vite+; format, lint, typecheck, test, build from the root                                                                             | Real                                                                                                                                                                                                                                                         |
| Both Workers from one `pnpm dev`, sharing a local D1; Coordinator bound across Workers                                                            | Real                                                                                                                                                                                                                                                         |
| Clerk sign-in (Google, GitHub, email code); demo user Ryan without keys                                                                           | Real (the Clerk path has not been exercised with real keys yet)                                                                                                                                                                                              |
| Lazy provisioning: settings row and Coordinator on the first authenticated request; time zone taken from the request                              | Real                                                                                                                                                                                                                                                         |
| The Shell at both widths, the More screen, a route behind every destination                                                                       | Real; every route but Today, Week and Circles is empty                                                                                                                                                                                                       |
| Live across devices: `/live` hands the socket to the user's Coordinator, patches land in the query cache, the Live indicator shows the connection | Real; nothing pings, so a connection that dies silently is not noticed until the browser notices                                                                                                                                                             |
| The current time as an injected value in the web app, which a development request can pin                                                         | Real                                                                                                                                                                                                                                                         |
| Visual comparison harness (`pnpm visual`): frames 1a and 1c–1g against their routes, derived phone screenshots                                    | Real; the Cori frames (2a–2c, 3a, 3b, 4a) join with ticket 16                                                                                                                                                                                                |
| Schema for Connection, Circle, Project, Todo, Slot, Brief, calendar event, Signal and the timeline's wording                                      | Real; "one Source, one open Todo" is a partial unique index                                                                                                                                                                                                  |
| The Ryan persona seed (`seedPersona` in `@crazy/db/write`): every new user starts from it; `POST /dev/seed` resets                                | Real; nothing is stamped later than the moment seeded over; Promises, Waiting on, history to come                                                                                                                                                            |
| Today screen: greeting, date, Brief, Take on now, Priority stack with footer, read from D1 by `readToday`                                         | Real on seeded rows; Start and Swap are wired on the desktop, where the frame draws them                                                                                                                                                                     |
| The command seam (`decide` and `apply` in `@crazy/shared`), `useCommand`, the Coordinator's single write path                                     | Real, for thirteen commands: complete, add, snooze a Todo, give it a Slot or take it off, start it or swap it; a Mention; the lifecycle settings and time zone, a Connection and its Side; the Rollover; a Source reported complete                          |
| The Brief's text, the stack's order and each Todo's reason                                                                                        | Seeded, stored where generated text will live                                                                                                                                                                                                                |
| Today screen: hour timeline, Mentions, the place to add a Todo                                                                                    | Real on seeded rows; adding, dragging a Todo onto an hour and the hour picker are wired                                                                                                                                                                      |
| How each hour of the timeline is worded                                                                                                           | Seeded (`timeline_hour`), while the hour still holds the Todos it was written for; else derived                                                                                                                                                              |
| A Todo's match to a Circle (`circle_match`), and an Overlap's wording (`overlap_note`)                                                            | Seeded; nothing writes either yet. An Overlap is never a row — it is a Todo matched to 2+ Circles                                                                                                                                                            |
| Circles screen: the figure of the Circles with their Sides, and this week's Overlaps, read from D1 by `readCircles`                               | Real on seeded rows; how many people a Circle holds and its Overlaps' wording are seeded                                                                                                                                                                     |
| Week screen: the week's head, the week in numbers, the seven days and their captions, read from D1 by `readWeek` and derived by `viewWeek`        | Real on seeded rows; every figure is computed from Todos, Slots and the calendar, none is stored                                                                                                                                                             |
| The Week brief, the note beside a day's figures, each day's short wording, and where the user ties in per Project                                 | Seeded, stored where generated text will live (`brief` kind `weekly`, `week_day_note`, `week_day_line`, `tie_in`)                                                                                                                                            |
| Integrations screen: Providers and Connections, the Account, the Realtime panel and the lifecycle settings, read by `readIntegrations`            | Real. Connect is Clerk's add-external-account flow and has not been exercised with real keys yet; with no keys the demo user's seeded Connections are drawn and Connect is unavailable. Nothing is pulled from a Provider, so "synced" is the seeded moment. |
| The Rollover: a command the Coordinator schedules for the user's next local midnight, and again after it runs and when the time zone changes      | Real. Carried over, sent back and archived by the user's own periods; once per local day; its patch tells open tabs the day has turned and they read again. Nothing sends `source.completed` yet: no Provider is pulled                                      |
| Everything else in the spec                                                                                                                       | Not started                                                                                                                                                                                                                                                  |

## Derived layouts

The frames draw desktop for every screen, but a phone only for the Today screen and the timer
sheet. These are derived from the same primitives rather than drawn, and must be re-checked when
frames exist:

- The **More screen** (phone): a list of the destinations the tab bar leaves out, then the user.
- The **sign-in page**, at both widths. No frame exists.
- **Shell order with the Billing module on.** Frame 2a lists Today, Week, Projects, Time, Invoices,
  Metrics, Integrations and omits Circles. The spec keeps Circles, so it is placed after Invoices.
- The Time and Invoices routes with the Billing module **off**: a line saying the module is off.
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
  it is under way, so a started Today screen has none. With the Billing module on (ticket 20) Start
  will begin a timer and the bar will hold the elapsed time.
- **An empty Priority stack** says "Nothing left for today." and the Take on now card is absent.
- **The Circles screen on a phone.** The frame draws desktop only. The two columns fall into one:
  the heading, the figure at the width there is (it keeps its proportions), then the Overlaps and
  the note. Nothing is dropped and nothing scrolls sideways.
- **A Circle the figure has no room for.** Frame 1e's figure seats four, three crossing and one
  standing apart, and a personal Circle takes the one that stands apart. A fifth Circle is named
  under the figure — "Not in the picture: …" — rather than silently left out. The seed has four.
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
- Still to come, per the spec: phone layouts for Projects, Metrics, Time, Invoices
  and Integrations.

Five deliberate differences from the frames: the wordmark reads CRAZY where they read TODAY; the
stack's footer says "1 sent back" where frame 1a says "1 moved to backlog"; the Mentions card
is titled "Mentions" where the frame says "Mentions & follow-ups"; the Circles screen says "Four
Circles this week" where frame 1e says "Four groups this week"; and it says Circles are inferred
from "which Providers the work lives in" where the frame says "which tools". The glossary lists
every one of the frame's wordings as one to avoid. The harness draws the frames with all five
changes (`WORDMARK` and `COPY` in `tools/visual/src/targets.ts`).

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
  Two masks are not debts: under the Priority stack on a phone, where the frame stops and the app
  goes on, and the digits of the Live indicator's wake time, which come off the Coordinator's real
  clock (the harness waits for the indicator to read live before it takes a picture).
- **Derived** routes (no phone frame) are screenshotted at 390px and listed without a figure.
- The pictures are one viewport, the size of the frame. If the page runs longer, the report says
  by how much.

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
