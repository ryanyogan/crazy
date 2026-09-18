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

| What                                                                                                                                              | State                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Monorepo on Vite+; format, lint, typecheck, test, build from the root                                                                             | Real                                                                                             |
| Both Workers from one `pnpm dev`, sharing a local D1; Coordinator bound across Workers                                                            | Real                                                                                             |
| Clerk sign-in (Google, GitHub, email code); demo user Ryan without keys                                                                           | Real (the Clerk path has not been exercised with real keys yet)                                  |
| Lazy provisioning: settings row and Coordinator on the first authenticated request; time zone taken from the request                              | Real                                                                                             |
| The Shell at both widths, the More screen, a route behind every destination                                                                       | Real; every route but Today is empty                                                             |
| Live across devices: `/live` hands the socket to the user's Coordinator, patches land in the query cache, the Live indicator shows the connection | Real; nothing pings, so a connection that dies silently is not noticed until the browser notices |
| The current time as an injected value in the web app, which a development request can pin                                                         | Real                                                                                             |
| Visual comparison harness (`pnpm visual`): frames 1a and 1c–1g against their routes, derived phone screenshots                                    | Real; the Cori frames (2a–2c, 3a, 3b, 4a) join with ticket 16                                    |
| Schema for Connection, Circle, Project, Todo, Slot, Brief, calendar event, Signal and the timeline's wording                                      | Real; "one Source, one open Todo" is a partial unique index                                      |
| The Ryan persona seed (`seedPersona` in `@crazy/db/write`): every new user starts from it; `POST /dev/seed` resets                                | Real; Promises, Waiting on and back-dated history to come                                        |
| Today screen: greeting, date, Brief, Take on now, Priority stack with footer, read from D1 by `readToday`                                         | Real on seeded rows; Start and Swap are drawn only                                               |
| The command seam (`decide` and `apply` in `@crazy/shared`), `useCommand`, the Coordinator's single write path                                     | Real, for one command: complete a Todo                                                           |
| The Brief's text, the stack's order and each Todo's reason                                                                                        | Seeded, stored where generated text will live                                                    |
| Today screen: hour timeline, Mentions, the place to add a Todo                                                                                    | Real on seeded rows; Add and dragging are drawn only (07, 08)                                    |
| How each hour of the timeline is worded                                                                                                           | Seeded (`timeline_hour`); derived for an hour with no wording                                    |
| Everything else in the spec                                                                                                                       | Not started                                                                                      |

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
- **A Todo completed today** stays under the Priority stack, ticked and struck through. No frame
  draws a done Todo.
- **A notice** when a change is refused or does not reach the Coordinator: a hairline box above the
  screen, dismissed by the user. No frame draws one.
- **Whether a Mention has been added, and Add.** Frame 1a's Mention rows draw neither. Pressing a
  Mention opens "Added to your Todos" or Add underneath it.
- **Mentions and the place to add a Todo on a phone.** The phone frame stops at the Priority stack;
  they follow it. The harness masks that rectangle of the phone frame and says why.
- **Start, Swap and the stack's footer on a phone.** The phone frame draws none of them, so they
  are hidden below 900px. Start and Swap will need a phone treatment when they are wired (ticket 09).
- **An empty Priority stack** says "Nothing left for today." and the Take on now card is absent.
- Still to come, per the spec: phone layouts for Week, Projects, Circles, Metrics, Time, Invoices
  and Integrations, and the started state of Take on now with the Billing module off.

Three deliberate differences from the frames: the wordmark reads CRAZY where they read TODAY; the
stack's footer says "1 sent back" where frame 1a says "1 moved to backlog"; and the Mentions card
is titled "Mentions" where the frame says "Mentions & follow-ups". The glossary lists both of the
frame's wordings as ones to avoid. The harness draws the frames with all three changes (`WORDMARK`
and `COPY` in `tools/visual/src/targets.ts`).

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
  A mask is a debt: delete it in the ticket that pays it. Today's is the foot of the rail in 1c–1g, which those frames leave empty and 1a draws. Two masks
  are not debts: under the Priority stack on a phone, where the frame stops and the app goes on,
  and the digits of the Live indicator's wake time, which come off the Coordinator's real clock.
  The harness waits for the indicator to read live before it takes a picture.
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
