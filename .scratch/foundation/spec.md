# Spec: Crazy foundation — every screen drawn, every interaction wired, on seeded data

Status: ready-for-agent

Vocabulary in this spec is the glossary in `CONTEXT.md`. Architecture is bound by ADR 0001 (Clerk holds all third-party credentials) and ADR 0002 (D1 is the only source of truth; the per-user Durable Object coordinates). The design source is the Claude Design project `3daa06cb-5eb9-4362-b712-3344efb90c3d`, file `Today Mockups.dc.html`, on the "Industry" design system. Where that project's own technical notes disagree with the ADRs, the ADRs win.

## Problem Statement

A person's day is scattered across the tools their work and their personal life run through — a calendar, chat, an issue tracker, documents, two email accounts. Nothing looks across all of it and says "here is what today holds, and here is the one thing to do now." Lists that try to do this fill up with things the person never agreed to, never get finished, and stop being trusted. People who bill for their time have a second problem on top: the hours they work are recorded somewhere else again, disconnected from the todos that caused them, and turning those hours into invoices is a monthly chore.

Today there is a set of design mockups for a product that answers this, and nothing else: no repository, no running app, no data model. Before any individual feature can be driven out, there has to be a real application to drive it into — one where every screen exists as drawn, every control does what it implies, and the architecture already has a place for the parts that come later.

## Solution

Crazy: one place that reads both sides of a life and tells a person what to do with today.

This spec delivers the foundation. A user signs in and lands on the Today screen: a Brief written in the first person, one solid Take on now card, the day's hour timeline with Todos slotted between meetings, the Priority stack, and the Signals that arrived from their Providers. They can tick, add, slot, snooze and Swap, and the screen responds instantly; a second device catches up within a moment over a socket that costs nothing while idle. At their local midnight the Rollover carries over what they worked on and sends back what they ignored. Week, Projects, Circles, Metrics and the Integrations screen are all present and readable. A user who bills for their time turns on the Billing module and gains a timer bar on the Today screen, a Time screen with an editable timesheet, an Invoices screen, and billing Connections — in the same Shell.

Everything is pixel-faithful to the mockups on desktop and on a phone. The prose and analytics that will later be generated — Briefs, Signals, Circles, modelled metrics — are present as seeded data stored exactly where generated data will live, so the screens do not change when generation arrives. Anything not yet wired is drawn, disabled, and says so; nothing is faked.

## User Stories

### Signing in and the Shell

1. As a new user, I want to sign in with an account I already have, so that I do not create another password.
2. As a user, I want my data created for me the first time I arrive, so that I land on a working Today screen rather than a setup step.
3. As a developer without Clerk keys, I want the app to run as a demo user (the Ryan persona), so that I can work on it offline.
4. As a user, I want one navigation frame around every screen, so that I always know where I am.
5. As a user with the Billing module off, I want the Shell to show Today, Week, Projects, Circles, Metrics and Integrations, so that I see nothing about billing I do not use.
6. As a user with the Billing module on, I want Time and Invoices added to the Shell, so that billing is one tap away.
7. As a phone user, I want a bottom tab bar of Today, Week, Projects and More, so that the main screens are reachable with a thumb.
8. As a phone user with the Billing module on, I want the tab bar to be Today, Time, Invoices and More, so that the things I use hourly are on the bar.
9. As a phone user, I want everything not on the tab bar to be under More, so that no screen is unreachable on a phone.
10. As a user, I want the wordmark to read CRAZY in the mockups' heading treatment, so that the product carries its own name.
11. As a user, I want my initials and name in the header taken from my account, so that the app is recognisably mine.
12. As a keyboard user, I want a visible accent focus ring on every control, so that I can see where I am.
13. As a user of assistive technology, I want controls that are not wired yet to be announced as unavailable, so that I am not misled.

### The Today screen

14. As a user, I want a greeting, the date and the time the status was last refreshed at the top of the Today screen, so that I know how current it is.
15. As a user, I want a Brief in the first person, so that I understand what the day holds and why Crazy recommends what it does.
16. As a user, I want the Brief to mention what was carried over and what was sent back at the last Rollover, so that nothing moves without my knowing.
17. As a user, I want exactly one Take on now card, as the only solid accent object on the screen, so that the next thing to do is unmistakable.
18. As a user, I want Take on now to show the Todo, its Project, its estimate, the hours it fits and why it matters, so that I can trust the recommendation.
19. As a user, I want to press Start on Take on now, so that the Todo is marked as started and counts as Touched.
20. As a user with the Billing module on, I want Start to begin a timer on that Todo, so that starting work and tracking it are one action.
21. As a user, I want to press Swap to decline the Take on now, so that the next fitting Todo takes its place.
22. As a user, I want a swapped Todo to stay lower in the Priority stack for the rest of the day, so that it does not bounce straight back.
23. As a user, I want Swap not to count as a touch, so that a Todo I keep dodging is still sent back eventually.
24. As a user, I want no Take on now card when nothing fits or the day is done, so that the card never lies.
25. As a user, I want an hour-by-hour timeline of my day, so that I can see where the time goes.
26. As a user, I want meetings shown as tinted fills, focus blocks as framed, and free hours as dashed, so that I can read the day's shape at a glance.
27. As a user, I want meetings to be read-only on the timeline, so that Crazy never alters my calendar.
28. As a user, I want to drag a Todo onto an hour to give it a Slot, so that I can plan my own day.
29. As a phone user, I want a way to give a Todo a Slot without dragging, so that planning works with a thumb.
30. As a user, I want slotting a Todo to count as a touch, so that planning something is recognised as engaging with it.
31. As a user, I want the Priority stack to list my `today` Todos in recommended order with their Project and estimate, so that I know what follows the current one.
32. As a user, I want to see the reason behind a Todo's position, so that the ordering is not a black box.
33. As a user, I want a small chip on each Todo showing the Provider its Source is at, so that I know where it came from.
34. As a user, I want a Todo I typed myself to show no chip, so that the chips mean something.
35. As a user, I want to tick a Todo and see it complete instantly, so that the app feels immediate.
36. As a user, I want a failed change to roll back visibly, so that I am never shown a state the server does not hold.
37. As a user, I want to add a Todo from the Today screen, so that capturing a thought takes seconds.
38. As a user, I want a Todo I add to be able to have no Project and no Client, so that One-offs are first-class.
39. As a user, I want to snooze a Todo, so that I can defer it without losing it.
40. As a user, I want to see "carried N days" on a Todo that has been carried over, so that I notice what is dragging.
41. As a user, I want the stack footer to count what was carried over and what was sent back, so that I can see the Rollover's result at a glance.
42. As a user, I want a list of Mentions with who, where, what and how long ago, so that I can see who is waiting on me.
43. As a user, I want to press Add on a Mention to turn it into a Todo, so that I decide what enters my day.
44. As a user, I want a Mention I have already added to show as added rather than offering Add again, so that I do not create duplicates.
45. As a user, I want Crazy never to create a Todo from a Signal on its own, so that my day only contains what I agreed to.
46. As a phone user, I want the Today screen as a single column in the order Brief, Take on now, timeline, Priority stack, so that it matches the phone mockup exactly.

### The Rollover

47. As a user, I want the Rollover to happen at my local midnight, so that "a day" means my day.
48. As a user, I want a `today` Todo I touched but did not finish to be carried over, so that work in progress stays in front of me.
49. As a user, I want a `today` Todo I left untouched to be sent back to `backlog`, so that tomorrow's list is honest.
50. As a user, I want creating a Todo to count as a touch, so that something I jot down late at night is still there in the morning.
51. As a user, I want a sent-back Todo's carry count to reset, so that the count reflects a continuous run.
52. As a user, I want to choose how long a Todo may go untouched before it is sent back, so that the rule fits my pace.
53. As a user, I want a `backlog` Todo untouched for my chosen archive period to become `archived`, so that the backlog does not grow forever.
54. As a user, I want my time zone detected when I first sign in, so that I do not have to configure the Rollover.
55. As a user, I want a Todo whose Source is completed at its Provider to become `done`, so that I do not tick things twice.
56. As a user, I want nothing else about a Source to change my Todo's state, so that the lifecycle is mine.

### Week

57. As a user, I want a Week screen with a first-person state of the union, so that I know whether the week is on track.
58. As a user, I want the week in numbers — Todos done of planned, focus hours, carried over — so that I can gauge it quickly.
59. As a user, I want each day of the week summarised with done, planned and meetings, so that I can see the week's shape.
60. As a user, I want a "where you tie in" list per Project, so that I know where I am the dependency.

### Projects and Signals

61. As a user, I want a Projects screen listing each Project with its Circle, open count, status, progress, next milestone and what is on today, so that long work stays visible.
62. As a user, I want to filter Projects by All, Work and Personal, so that I can look at one Side of my life at a time.
63. As a user, I want a Project's progress derived from its Todos, so that I never maintain a percentage by hand.
64. As a user, I want to expand a Project to see today's Todos and its backlog with ages, so that I can see what is waiting inside it.
65. As a user, I want a "You said you'd…" list of my Promises, so that I keep my word.
66. As a user, I want to turn all Promises into Todos in one action, so that catching up is quick.
67. As a user, I want a Waiting on list, so that I can see what others owe me.
68. As a user, I want Waiting on entries never to become Todos, so that other people's work does not clutter my day.
69. As a user, I want the lifecycle explained on the Projects screen with how many Todos archive soon, so that archiving never surprises me.

### Circles

70. As a user, I want a Circles screen showing the groups I move in, so that I can see how my week divides.
71. As a user, I want each Circle to have a Side, so that Crazy knows work from personal.
72. As a user, I want Overlaps called out with their people and timing, so that I can see where one Todo serves two Circles.
73. As a user, I want it explained that Circles are inferred and can be renamed or merged, so that I know the grouping is mine to correct.

### Metrics

74. As a user, I want a Metrics screen with Week, 30 days and Quarter ranges, so that I can see how I actually work.
75. As a user, I want headline figures with their change against the previous period, so that I can see direction as well as level.
76. As a user, I want focus hours by hour of day, so that I learn when I finish things.
77. As a user, I want backlog ageing, so that I can see what is about to archive.
78. As a user, I want to see which Providers my Todos come from, so that I know where my work originates.
79. As a user, I want a 30-day completion heatmap, so that I can see streaks.
80. As a user with the Billing module on, I want a Time tab with utilisation, billable split, hours per week by Client, when I work, unbilled money by Client, budget and retainer burn, and estimate against actual, so that I understand my business.
81. As a user, I want the simple figures computed from my real Todos and Time entries, so that the numbers move as I use the app.

### The timer (Billing module on)

82. As a user who bills for time, I want a timer bar on the Today screen with one square Start/Stop, so that tracking is always one press away.
83. As a user, I want the idle timer to preselect the most likely Client and Project, so that I rarely have to choose.
84. As a user, I want the running timer to show elapsed time, the Client and Project, since when, whether it is billable, and today's total for that Client, so that I know exactly what is being tracked.
85. As a user, I want to add a note to the running Time entry, so that the invoice line writes itself.
86. As a user, I want only one running timer, so that my hours can never overlap.
87. As a user, I want changing the Client or Project while running to split the Time entry at now, so that switching work is one action and both spans are right.
88. As a user, I want the picker grouped by Client with each Project's hours, searchable, and operable with arrows, enter and escape, so that switching is fast.
89. As a user, I want Internal offered alongside my Clients, so that I can track work that is for no one.
90. As a user, I want to pick a Client with no Project, so that a billable One-off needs no ceremony.
91. As a user, I want choosing a Project that has a Client to set that Client, so that a Time entry can never contradict its Project.
92. As a user, I want "+ New project" in the picker, so that I can create one without leaving what I am doing.
93. As a phone user, I want the picker as a bottom sheet with recent choices first, so that switching works one-handed.
94. As a user, I want to start a timer from any Todo, so that the Time entry is tied to the Todo that caused it.
95. As a user, I want the timer running on my phone to show as running on my desktop, so that every device agrees.
96. As a user, I want tracked hours to land on the day's timeline, so that the timeline shows what happened as well as what was planned.
97. As a user, I want this week's hours by Client on the Today screen, so that I can see where the week is going.

### Time and Invoices (Billing module on)

98. As a user, I want a Time screen with Day, Week and Month views and daily totals, so that I can review my timesheet.
99. As a user, I want to edit any Time entry's times, Client, Project, note and billable flag, so that the record is right.
100. As a user, I want to add a Time entry by hand, so that I can record work I forgot to time.
101. As a user, I want Time entries with no Client flagged with a suggested Client I can confirm in one tap, so that stray hours get billed.
102. As a user, I want to mark a Time entry for a Client as not billable, so that I can do a favour without invoicing it.
103. As a user, I want an Invoices screen listing each Client's invoice for the period with its status, detail and amount, so that I know what is going out.
104. As a user, I want to open a draft invoice and see its lines, hours, amounts, total, terms and due date, so that I can check it.
105. As a user, I want the draft to say how it was built — grouping, rounding, rate — so that I can explain it to my Client.
106. As a user, I want Send, Preview PDF and accounting sync shown but unavailable, so that I can see what is coming without being misled.

### Integrations

107. As a user, I want an Integrations screen listing each Provider with its status, scopes and last activity, so that I know what Crazy can see.
108. As a user, I want to press Connect and authorise a Provider through my account provider, so that Crazy never holds my credentials.
109. As a user, I want to connect a second account at the same Provider, so that work and personal Google both feed my day.
110. As a user, I want each Connection to have a default Side, so that Todos arriving through it land on the right Side.
111. As a user, I want Providers that cannot be connected yet shown as not available yet, so that I know they are planned.
112. As a user, I want an Account card showing how I signed in, my security status and a link to manage my account, so that account matters are in one place.
113. As a user, I want a Realtime panel showing whether my socket is connected and sleeping, how many times it woke today and what last woke it, so that the live behaviour is transparent.
114. As a user, I want to set the Brief time, the sent-back period and the archive period, so that the lifecycle fits me.
115. As a user with the Billing module on, I want billing and accounting Providers listed separately, so that I can see where my hours and invoices go.
116. As a user with the Billing module on, I want invoice settings per Client — cadence, terms, auto-draft, send without review — so that each Client is billed their way.
117. As a user, I want to turn the Billing module on and off, so that the app fits whether or not I bill for my time.

### Live behaviour

118. As a user with two devices, I want a change on one to appear on the other within a moment, so that I never see stale state.
119. As a user whose connection dropped, I want missed changes replayed when I reconnect, so that I do not need to reload.
120. As a user who has been offline too long for replay, I want the screen to refetch, so that it is still correct.
121. As a user, I want a Live indicator in the header, so that I know the screen is current.
122. As the operator, I want an idle open tab to cost nothing, so that the product stays cheap to run.

### Attachments (seam only)

123. As a developer, I want to store a file against a Todo through an authenticated route, so that the Attachment feature can be built once it is drawn.
124. As a user, I want my Attachments readable only by me, so that a photo of a receipt is never public.

### Building on the foundation

125. As a developer, I want a seed that reproduces the mockups exactly for the Ryan persona (Billing module off) and the Cori persona (Billing module on), so that every screen can be compared with its frame.
126. As a developer, I want the current time to be an injected value everywhere, so that screens and the Rollover can be tested at a pinned moment.
127. As a developer, I want a script that screenshots each route and its frozen frame at 1180px and 390px and produces diffs, so that "pixel perfect" is measured rather than asserted.
128. As a developer, I want the screens without a phone frame listed as derived, so that they are re-checked when frames are drawn.
129. As a developer, I want empty but bound shells for the Provider-pull Queue, the Brief Workflow, the invoice Workflow, the archive Workflow and the AI Gateway, so that each later feature has a place to go.
130. As a developer or agent new to the repo, I want a short brief of what Crazy is, where things live and which conventions hold, so that I can contribute without reading this conversation.

## Implementation Decisions

### Shape of the system

- A pnpm monorepo on the Vite+ toolchain (dev, build, test, lint and format from one tool), with dependency versions held in a workspace catalog. The sibling repo `runway` is the working reference for this toolchain.
- Two deployable Workers and three packages.
  - **Web app** — TanStack Start, server-rendered. Routes, loaders, server functions, Clerk. It reads D1 directly and never writes to it. It authenticates WebSocket upgrades and forwards them to the user's Coordinator.
  - **Core Worker** — no UI. Hosts the Coordinator, the Queue consumer, the Workflows and the Provider webhook routes. Bound to the same D1 database and R2 bucket.
  - **Shared package** — pure TypeScript with no Workers or React imports: validation schemas, the command and patch types, and the domain rules (see "The command seam").
  - **Database package** — Prisma schema, generated client, SQL migrations, the persona seed, and the read-model queries.
  - **UI package** — the Industry design system and the React primitives every screen reuses.
- Screen-specific composition lives in the web app, grouped by feature. Primitives used by more than one screen live in the UI package.

### Credentials and Connections (ADR 0001)

- Clerk is the only credential store. A Connection is a Clerk external account plus one bookkeeping row: Provider, Clerk external account id, default Side, sync cursor, last sync, status. No third-party token is ever persisted.
- Connect calls Clerk's add-external-account flow. The server obtains a token from Clerk at the moment of use.
- Round-one Providers are those Clerk can broker: Google, Slack, Linear, Notion, GitHub, and under the Billing module Xero and QuickBooks (custom OIDC). Harvest, FreshBooks, Todoist and Apple Health are rendered as not available yet.
- All Provider scopes are read-only. Crazy never changes a Source.
- In this spec Connections can be made and are shown with their true status and scopes; no data is pulled.
- A user's rows and Coordinator are provisioned lazily on their first authenticated request. A Clerk webhook handles account deletion only.
- With no Clerk keys configured, the web app runs as a demo user seeded as the Ryan persona.

### State and the Coordinator (ADR 0002)

- D1, through Prisma, holds all domain data. The Prisma D1 adapter has no interactive transactions; per-user serialisation in the Coordinator stands in for them.
- The Coordinator is one Durable Object per user, built on Cloudflare's Agents SDK for its named schedules, hibernating sockets and Workflow bridge. The SDK's own state sync is banned. The SDK version is pinned and used from a single module.
- The Coordinator holds no domain data: only the sockets, a sequence counter, a replay buffer of the last 200 patches, its wake counters, and its schedules (Rollover at local midnight, hourly status, Brief time).
- Every write follows one path: optimistic cache update → server function → Coordinator → D1 → stamp sequence number → broadcast patch → hibernate. The web app and any future Queue consumer or Workflow hand their writes to the Coordinator; nothing else writes to D1.
- The Coordinator never awaits a Provider or an LLM.
- The Queue, the three Workflows and the AI Gateway binding are declared and bound with empty handlers. Their division of labour is recorded in ADR 0002.

### The command seam

- Every change a user can make is a **command**: a small validated value such as "complete this Todo", "slot this Todo at 14:00", "swap the Take on now", "switch the timer to this Client and Project", "add this Mention", "run the Rollover".
- The shared package exposes one pure decision function — current state, a command and the current time in; a list of patch operations out — and one pure function that applies patch operations to state. They contain every domain rule: Todo state transitions, what counts as Touched, carried over against sent back, the carry count, archive ageing, Swap, the single running Time entry, split-at-now, "a Project's Client wins", Side derivation, and "one Source, one open Todo".
- The same two functions run in the browser for the optimistic update and in the Coordinator for the real one, which is what keeps the optimistic UI truthful. The Coordinator is otherwise thin: load the state the command needs, decide, persist the operations, broadcast them.
- The current time is always a parameter. Nothing in the shared package, the loaders or the Coordinator reads the system clock directly.

### Schema

- Entities: User settings (time zone, Brief time, sent-back period, archive period, Billing module on/off), Connection, Circle (with Side), Project (optional Circle, optional Client, status, next milestone), Client (rate, rounding, payment terms, cadence, auto-draft, send-without-review), Todo, Slot, calendar event (a meeting or focus block read from a Provider; seeded here, read-only always), Signal, Time entry, Invoice and invoice line, Brief (daily and weekly), Attachment, and metric snapshots for the modelled figures.
- A Todo has a state (`backlog`, `today`, `done`, `archived`), an estimate, a carry count, a last-touched moment, a stack position with its one-line reason, an optional Project, an optional Client, and an optional Source (Connection, the item's id at the Provider, a link back). A Source is unique among open Todos.
- A Time entry has a start, an optional end, a note, a billable override, and optional Client, Project and Todo. At most one Time entry per user has no end. If its Project has a Client, its Client must be that Client.
- A Signal has a kind (Mention, Promise, Waiting on), a person, text, a time, the Provider item it came from, and the Todo it was added as, if any.
- Internal is not stored; it is how "no Client" is displayed.
- Side is stored only on Circle (and as a Connection's default). Everything else derives it.
- `archived` is a Todo state in D1. Moving archived Todos to R2 belongs to the archive Workflow, which is a shell here.
- Migrations are SQL files applied with Wrangler and generated by diffing the Prisma schema.
- Queries behind Metrics and Week are indexed for the way they filter; D1 bills on rows scanned.

### Reads and the client

- One query definition per read model (Today, Week, Projects, Circles, Metrics, Time, Invoices, Integrations). Loaders ensure the data during SSR; screens read it with suspense queries.
- One optimistic-mutation hook wraps every command: apply the shared decision function to the cache, send, roll back on error, and reconcile on settle.
- One socket hook connects to the Coordinator, applies incoming patches to the query cache, ignores sequence numbers already seen, reconnects with backoff sending the last sequence number seen, and refetches when the gap exceeds the replay buffer.
- Take on now is derived from the Priority stack and the calendar gap; in seeded data it is stack position one.

### Attachments

- An R2 bucket for Attachments and archives, a metadata row per Attachment (owner, Todo, content type, size), and authenticated upload and read routes under a per-user key prefix. No public bucket URLs. No UI, because none is drawn.

### Interface and styling

- The Industry stylesheet is included as shipped with its tokens untouched; every colour, font, space and shadow comes from its variables. Plain CSS, no utility framework. Lucide icons at stroke 1.5.
- Barlow and Barlow Condensed are self-hosted rather than loaded from Google Fonts, to avoid a flash of fallback text and the layout shift it causes in condensed headings.
- The blueprint frame with its four corner marks is one primitive, used by every card, figure and primary button. The solid accent fill appears once per screen.
- UI primitives: blueprint frame, button, tag, source chip, segmented control, stat tile, timeline row, table, dialog, bottom sheet, tab bar, and a "not wired yet" wrapper that disables its child and tells assistive technology why.
- One DOM serves phone and desktop, mobile-first, with a single breakpoint at 900px. Desktop content is capped at the frames' 1180px. Tablets in portrait get the phone layout.
- The home route is frame 1a. The 3a timer bar, and the 3b bottom sheet on a phone, replace the segmented picker drawn in 2a and render only with the Billing module on. Frame 1b is not built.
- Phone layouts are pixel-faithful for the Today screen and the timer sheet, which are drawn. Week, Projects, Circles, Metrics, Time, Invoices and Integrations have no phone frame; their phone layouts are derived (single column, the same primitives, the same tab bar) and listed as derived in the project brief.
- The started state of Take on now with the Billing module off has no frame; it reuses the running timer bar's treatment without the picker and is listed as derived.

### Seeded data

- The seed takes a persona, a Clerk user id and a display name. Ryan reproduces the mockups' first sample user with the Billing module off; Cori reproduces the second with it on. All other sample content is kept as drawn.
- Seeded and later generated: Brief and Week brief text, Priority stack reasons, good-to-know items, Signals, Circles and Overlaps, and the modelled metrics with their commentary.
- The seed includes enough back-dated Todos and Time entries that simple metrics (hours by Client, unbilled totals, backlog ageing, Todo sources) are computed by real queries.
- The Mention that already has a Todo in the mockup's stack is seeded as added, so it does not offer Add.

### Project documentation

- A short agent-facing brief at the repo root: what Crazy is, where things live, the conventions above, and an instruction to read the glossary before naming anything.
- A longer project brief under the docs folder: the product in a page; what is real, seeded and scaffolded; the derived layouts; the feature backlog in order.
- The four design files are copied into the docs folder and frozen as the reference for comparison.

## Testing Decisions

- A good test here states a behaviour a user would recognise — "a Todo untouched all day is sent back at the Rollover and its carry count resets" — and asserts only on outcomes visible at the seam. It does not assert on which internal function was called, on Prisma calls, or on component structure, so it survives refactoring.
- **Primary seam: the command seam in the shared package.** Given a state, a command and a time, assert the patch operations and the resulting state. This one seam covers the whole domain, runs as plain unit tests with no Workers runtime, and is where most tests live. Cases to cover: every Todo transition; each kind of touch and each non-touch (appearing in the stack, Swap); carried over against sent back, including a Todo created at 23:50 and a configurable sent-back period; archive ageing; completion of a Source; Swap ordering and its persistence through the day; starting, stopping and switching the timer, including the split and the single-running-entry rule; the Client and Project invariant and the four Client/Project combinations; Side derivation in each fallback order; adding a Signal, adding it twice, and Waiting on never becoming a Todo; turning the Billing module on and off.
- **Coordinator seam (few tests).** In the Workers test pool against a local D1: a command is persisted and returns a patch with the next sequence number; two concurrent commands for one user are applied in order; a reconnect with an old sequence number replays what was missed; a gap larger than the buffer tells the client to refetch; the Rollover schedule fires at the user's local midnight given an injected time.
- **Read-model seam (few tests).** Against a seeded local D1 at the mockups' pinned time, each read model returns what its frame shows — the right Take on now, stack order, counts and totals — for both personas.
- **Visual seam.** A Playwright script renders each frozen frame and its route at 1180px and 390px with the matching persona and pinned clock, and writes side-by-side and diff images. It runs locally on demand and is reviewed by eye; it is not a CI gate until the screens settle. Derived phone layouts are screenshotted without a diff.
- No component unit tests for the UI primitives; the visual seam covers them.
- Prior art: this repository is empty, so there is none in it. `runway` runs its tests through the same Vite+ test command and is the reference for configuration.

## Out of Scope

- Pulling anything from a Provider, inbound Provider webhooks, and writing back to a Provider.
- Generating Briefs, Priority stack ordering and reasons, Signals, Circles, Overlaps, Client suggestions or any other LLM output; the hourly re-prioritisation itself.
- Natural-language Time entry ("2h Meridian synthesis yesterday afternoon").
- Drafting invoices on a cadence, invoice PDFs, sending invoices, accounting sync, payment links and paid status.
- Moving archived Todos to R2 and searching the archive.
- The inactivity prompt on a long-running timer, and a pause state for the timer.
- Any interface for Attachments, and Client logos.
- Providers Clerk cannot broker.
- Frame 1b, energy grouping, a dark variant, and emailed metrics.
- Renaming and merging Circles (the screen explains it; the controls are not drawn).
- Deployment to a real Cloudflare account and a production Clerk instance. Local development is complete without them; they need keys, a D1 database, an R2 bucket and an AI Gateway id from the owner.
- CI, and making the visual comparison a gate.

## Further Notes

- The build order that keeps something demonstrable at each step: scaffold the monorepo and both Workers → the UI primitives → the schema, seed and command seam → the Today screen to a pixel match on both widths → the Coordinator and socket → the remaining routes → the Billing module screens → the Attachment seam and the shells.
- Current documentation for TanStack Start, the Clerk TanStack SDK, the Prisma D1 adapter, the Agents SDK and Vite+ is to be fetched before writing against them; all five move quickly.
- The mockup's own technical notes describe a Durable Object that owns live state, KV-stored OAuth tokens and Worker-hosted OAuth routes. All three were considered and rejected; see the ADRs before "restoring" any of them.
- The running cost of this architecture is dominated by the flat Workers Paid fee; the costs that will grow are LLM calls and Clerk's per-user pricing, which is why the AI Gateway binding is present from the start.
