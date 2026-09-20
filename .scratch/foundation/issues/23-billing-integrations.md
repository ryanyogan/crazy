# 23 — Billing Connections and invoice settings per Client

**What to build:** With the Billing module on, the Integrations screen gains a billing and accounting section — Xero and QuickBooks connectable through Clerk, the rest not available yet — and invoice settings per Client: cadence, terms, auto-draft, and send without review, which is off unless she turns it on.

**Blocked by:** 15 — Integrations screen: Account, Connections, Realtime and lifecycle settings, 16 — Turn on the Billing module; the Cori persona

**Status:** done — one deviation from the frame (per-Client switches) and one from the ticket (QuickBooks cannot be brokered), both recorded below

- [x] The section renders only with the Billing module on
- [x] Per-Client settings are commands, optimistic, and persisted on the Client
- [x] Send without review defaults to off
- [x] Visual diff against frame 2c is noise-only at 1180px; the 390px layout is listed as derived
      — **rail 0.00%, `invoice settings` 0.00%**, whole frame 0.00%; the main column is masked,
      because frame 2c draws the billing section as though it were the whole screen (see Open)

## Comments

### 2026-09-19 — built

**Built.** One command, `client.setInvoicing` (`clientId` plus any of `cadence`,
`paymentTermsDays`, `autoDraft`, `sendWithoutReview`), decided in `decide` against the Client's own
row: refused with the Billing module off, refused for a Client that is not the user's, and its
values held to the sets and limits in `@crazy/shared` (`INVOICING_LIMITS`, `CLIENT_CADENCES`) by
the command schema, as `LIFECYCLE_LIMITS` holds the lifecycle settings. It makes one operation,
`client.set`, which `apply` lays over the Integrations cache (optimistic, put back on a refusal)
and `persistOps` writes to the Client — plus `invoice.set` where the terms moved (below).

Migration **`0014_client_invoicing.sql`** adds `client.autoDraft` and `client.sendWithoutReview`,
both `NOT NULL DEFAULT false`, written by hand from `migration:diff` less its `DROP INDEX` (as 0012
and 0013 were) and as two `ADD COLUMN`s rather than the diff's whole-table redefinition behind two
PRAGMAs: the two columns land on the end, every row and foreign key is left alone, and D1 never
sees a `PRAGMA`. `readIntegrations` gained the Clients with billing on and hands back none with it
off; `apps/web/src/server/integrations.ts` passes them through; the screen is
`apps/web/src/features/integrations/` (`BillingProviders.tsx`, `InvoiceSettingsCard.tsx`) styled in
`apps/web/src/styles/integrations.css` under `intg-bill*` and `intg-inv*`, which can collide with
nothing.

**What Clerk's docs say about Xero and QuickBooks** (fetched through the context7 MCP tools,
`/clerk/clerk-docs`, and confirmed against the installed package):

- **Xero is a built-in Clerk social connection.** `docs/guides/configure/auth-strategies/
  social-connections/xero.mdx` ("Add Xero as a social connection") and the provider list in
  `social-connections/overview.mdx` both carry it. The strategy is `oauth_xero`, which
  `clerkStrategy()` already produces. Authoritative for the installed version: `@clerk/shared@4.33.0`
  (the dependency of `@clerk/tanstack-react-start@1.5.15`, the version `apps/web/package.json`
  pins) lists in `dist/oauth.mjs` exactly these OAuth strategies — `oauth_agentid, apple,
  atlassian, bitbucket, box, coinbase, discord, dropbox, enstall, facebook, github, gitlab, google,
  hubspot, huggingface, instagram, line, linear, linkedin, linkedin_oidc, microsoft, notion, slack,
  spotify, tiktok, twitch, twitter, vercel, x, **xero**`.
- **QuickBooks (Intuit) is not one of them.** It is in neither the docs' provider list nor the
  installed union. Clerk's answer for a provider it does not carry is a **custom OIDC provider**
  (`social-connections/custom-provider.mdx`), whose strategy is prefixed `custom_`
  (`oauth_custom_<name>`, per the backend reference for `getUserOauthAccessToken`) and which has to
  be configured in the Clerk Dashboard. There is no Clerk instance configured in this environment
  at all, so that could not be set up, let alone exercised.
- Consequence, and the deviation from this ticket's brief: **Xero is the connectable one**, through
  the same flow as every other Provider (`ConnectButton` → `user.createExternalAccount`, ADR 0001,
  no token stored anywhere), and **QuickBooks is drawn as not available yet** beside Harvest,
  Stripe, FreshBooks and Toggl Track, each wrapped in `NotWired` with the reason in full for
  assistive technology. With no Clerk keys — which is how the demo user and both personas run —
  Xero's Connect degrades exactly as ticket 15's does: drawn, disabled, "Connecting goes through
  Clerk, which is not configured here".

**Checked.** `pnpm check` (no warnings), `pnpm typecheck`, `pnpm test` (**348**, up from 343),
`pnpm build`. Ten new tests at the command seam (`integrations.test.ts`): each of the four settings
lands and shows at once; a Client that is not hers is refused; the Billing module off is refused;
an unknown cadence, negative, over-long or fractional terms and an empty change are refused by the
schema; send without review is false on the Client the tests start from and only a command moves
it; a change of terms re-terms the invoice she has not sent and leaves a sent one alone; a change
that is not the terms touches no invoice; and both screens word a billing Provider the same.
Five read-model tests in workerd (`packages/db/src/read/integrations.test.ts`): the billing section
is read for Cori and not for Ryan, every seeded Client has send without review off and auto-draft
on, frame 2c's cadences and terms are the Client's own columns, a change survives the round trip
through `decide` → `persistOps` → `readIntegrations`, and Meridian's draft moves from 19 Oct to
3 Nov when her terms go from net 30 to net 45 while `billingConnections` stays empty.

`pnpm visual` (whole run, once): **2c whole frame 0.00%, rail 0.00%, invoice settings 0.00%**;
1a 0.00% at both widths, 1c/1d/1e 0.00%, 1f 0.13% (known), **1g 2.47%, down from 3.21%** — the
kicker reset the Invoices screen already made is now the Integrations screen's too, and it moved
1g's own cards onto the frame's baselines; 2a 0.00% in every region, 2b 0.00% in every region,
3a idle 0.01%, 3a running 0.00%, 3a-open 0.03% (picker 0.00%), 3b 0.00%, 4a 0.00% in every region.

By hand, in a browser, at 1180px and 390px, in
`/tmp/claude-1000/-home-ryan-code-crazy/2b7de30a-4494-455f-b726-ce3dc6a9a0a2/scratchpad/t23/`:
`d-integrations` (the screen as Cori), `d-send-asking` (the second yes, mid-way),
`d-send-on` (after it: Meridian's switch on, the question gone), `d-integrations-ryan` and
`p-integrations-ryan` (Billing off — the screen exactly as it was), `p-integrations` and
`p-integrations-derived` (390px), `2c-frame`, `2c-app`, `2c-side-by-side`. Two tabs at once: a
cadence changed in one lands in the other over the socket, and so does send without review; both
survive a reload; no console errors.

**Decisions taken.**

- **Xero is a Provider like any other, in the domain as well as on the screen.** `PROVIDERS` is now
  `WORK_PROVIDERS` and `BILLING_PROVIDERS` together, so the Clerk plumbing, the `connection` row
  and `providerFromClerk` needed nothing new and there is no second connect flow. The Metrics
  screen's "where your todos come from" drops a Provider with no Todos, so Xero cannot appear
  there; frame 1f is unchanged at 0.13%.
- **Auto-draft and send without review are the Client's, not the user's.** Frame 2c draws them once
  under the list; spec story 116 asks for them per Client, and a person who would let one Client's
  invoices go out unread would not say the same of all of them. Each Client's group carries its own
  pair, its own cadence and its own payment terms, and the card is taller than the frame's — which
  is what the `SETTINGS_PER_CLIENT` mask records.
- **Turning it on asks a second time, in place.** Pressing the switch while it is off does not turn
  it on: it opens a question under the row — "Really let Meridian Health's invoices go out unread?"
  — answered by "Yes, send unread" or "Keep reviewing". Turning it **off** takes one press, because
  getting safer is not something to be asked twice about. That Yes is the screen's one solid accent
  fill; nothing else on the Integrations screen takes one.
- **The two switches say plainly what they will do and that nothing is sent today.** The notes sit
  once at the foot of the card and every switch names its note with `aria-describedby`, rather than
  repeating two paragraphs three times.
- **A draft follows its Client's terms; a sent invoice keeps its own.** Ticket 21 copies the terms
  onto every invoice so a rate changed in October cannot move September's bill — but a draft is
  still hers, so `decide` re-terms the invoices in `draft` and `review` (`UNSENT_INVOICE_STATUSES`)
  when the payment terms move, setting `paymentTermsDays` and recounting `dueDay` with `dueDay()`.
  The rule is in `decide` with the invoices loaded beside the Client, not in `persistOps`.
- **Cadence does not change the period, and that stays open** (below).
- **The billing Providers' "reads" lines say only what Crazy would read.** Frame 2c promises
  "Create invoices, customers, mark paid" of QuickBooks and "Two-way time entries" of Harvest; a
  Provider is read-only (ADR 0001), so the cards read "Customers, invoices, paid status" and "Time
  entries you tracked there". Xero's, FreshBooks' and Toggl's are the frame's own words, which
  already describe reads. The section's own line says it outright: read-only, nothing sent
  anywhere, nothing synced.
- **Xero is drawn first, then the frame's order.** The frame puts the connected ones first; the
  only one that can be pressed here is Xero, so it leads, and QuickBooks, Harvest, Stripe,
  FreshBooks and Toggl Track follow in the frame's own order.
- **The cadence tag is a control.** The frame draws "Monthly" as a neutral tag; it is a setting, so
  it is a select in that place, wearing the Side select's treatment. Its words say only *when* —
  "Monthly", "Bi-weekly", "On the 1st" — where the frame's third reads "Retainer · 1st", which says
  the arrangement the terms line under it already says (ticket 21's rule: a tag says one thing).
- **The terms line ends at the terms.** The frame ends each with the accounting Provider that
  Client goes out through ("· QuickBooks", "Harvest + Stripe link"); nothing is connected, so a
  line that named one would be untrue. Everything before it is the frame's own, to the character,
  and is compared.
- **The invoice settings card heads the aside, at frame 2c's 360px.** With the module off the
  column is frame 1g's 340px. That is the one place the app follows 2c's geometry rather than 1g's,
  and it is what lets the card be compared at all.
- **The opened invoice's "Sync to" is off the same list.** `invoiceSyncTargets` in `@crazy/shared`
  words both screens, and `readInvoices` now hands back `billingConnections` (the user's billing
  Connections, from the same `connection` rows the Integrations screen reads), so the two screens
  cannot come to disagree. Ticket 21's "QuickBooks · not connected / Harvest · not connected" is
  now "Xero · not connected" and "QuickBooks · not available yet"; Harvest is gone from the invoice
  because an invoice does not go to a time tracker. That card is inside frame 2b's
  `THIRD_MERIDIAN_LINE` mask, so 2b is unmoved at 0.00%.
- **Every card's kicker on this screen is drawn as the frames draw it** — a plain div's treatment,
  not Industry's heading one — which is the change the Invoices screen already made. It is why 1g
  fell from 3.21% to 2.47%; the rest of 1g's difference is the wording and controls listed as
  derived in `docs/BRIEF.md`, and was not chased (the owner's call, 2026-09-19).
- **Seeded as frame 2c draws the pair:** auto-draft on for all three of Cori's Clients, send
  without review off for all three. The frame's switches are drawn that way round, and off is what
  this ticket asks of the second in any case.

**Open.**

- **Frame 2c's main column cannot be stood where the frame stands it.** The frame draws the billing
  section as though it were the whole screen — "Billing & accounting" as the heading at the top of
  the main column — where in the app it is a section of the Integrations screen, under the
  Providers every user has and under that screen's own heading. The cards themselves are the
  frame's three-column grid at the frame's own width (180px cards, 14px gaps, the same blueprint),
  and they are compared by eye in the screenshots above, not by the harness. A debt for the
  designer: 2c and 1g cannot both be the whole of one screen.
- **The period is still a calendar month, whatever a Client's cadence says** (ticket 21's own open
  note). Wording `readInvoices`' period per Client was considered and left: the period decides
  which entries are gathered, what the totals add up to and what month-end is holding, so a Client
  on a fortnight wants their own span through all of it — and a frame. The cadence is stored,
  shown and changed; nothing reads it yet.
- **Auto-draft and send without review do nothing.** Nothing drafts an invoice on a cadence and
  nothing sends one; both are real settings whose notes say exactly that. They want the invoice
  Workflow (ADR 0002, the shell in ticket 25).
- **Nothing here has been run against real Clerk keys**, as in ticket 15. Xero's Connect, its
  scopes (`accounting.transactions.read`, `accounting.contacts.read`, from memory of Xero's own
  scope names rather than from fetched docs) and the reconcile that turns a verified external
  account into a Connection are all written against the docs and the installed types, not
  exercised. Enabling Xero in a real instance also needs the connection added in the Clerk
  Dashboard, with custom credentials for a production instance.
- **The phone layout is derived** (`docs/BRIEF.md`): one column, the billing cards under the rest
  and the settings card under them. No phone frame draws this screen.
- `client.setInvoicing` changes only the four settings frame 2c puts a control on. The rate, the
  rounding, the arrangement and the budget are the terms of the work itself and no screen offers to
  change them yet; nor is there any way to add a Client, which is what the card says when a user
  with the module on has none.
