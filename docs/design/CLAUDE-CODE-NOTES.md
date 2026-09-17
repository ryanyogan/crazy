# Today — technical notes for Claude Code

Companion to `Today Mockups.dc.html`. UI decisions live there; this is the build brief.

## Stack
- TanStack Start (SSR) on Cloudflare Workers. Route loaders fetch the day model server-side; mutations use server functions + optimistic updates (TanStack Query `onMutate` → rollback on error).
- Auth: Clerk. Clerk `userId` is the tenant key everywhere. Clerk webhooks (user.created/deleted) provision/tear down the user's Durable Object.
- Data: one Durable Object (DO) per user ("UserBrain") holds the live day model, todo state machine and connector cursors. D1 for durable history (todos, briefs, metrics). KV for connector OAuth tokens (encrypted). R2 for archived todos > 90d (JSONL by month).
- Connectors: OAuth via Cloudflare Worker routes `/connect/:provider`. Providers in round one: Google (Calendar, Gmail, Drive), Slack, Linear, Notion. Later: GitHub, Todoist, Apple Health. Each connector = `pull(cursor) → events[]`, run by DO alarms (5–15 min) plus provider webhooks where available (Slack Events API, Linear webhooks, Notion polling only).

## Realtime — "cheap socket"
- Client opens a WebSocket to the user's DO. DO uses the Hibernation WebSocket API (`state.acceptWebSocket`) so idle sockets cost nothing; DO wakes only on inbound connector webhook/alarm, pushes a small patch `{type:'patch', ops:[...]}`, then hibernates.
- Client applies patches into the TanStack Query cache (no refetch). Reconnect with backoff; on reconnect send `lastSeq`, DO replays missed ops from a ring buffer (last 200).
- Hourly status: DO alarm on the hour recomputes priorities + "status line" and pushes one patch. Brief regenerated at the user's local 06:00 and on first open after that.

## Todo lifecycle
- Sources: manual, AI-suggested (from mentions/follow-ups), connector items (Linear issue assigned, Slack saved message, Notion @mention, Gmail starred).
- States: `backlog → today → done`, plus `archived`.
- Rules (DO alarm at local midnight):
  - `today` items not touched (no check, no edit, no snooze) within the day → `backlog`, `carriedOver += 1`.
  - Items untouched 90 days → `archived` (moved to R2, searchable).
  - Todos may have `parentProjectId` (long projects) or be one-offs. Project progress = done/total of children.
- Priority: AI scores each candidate on deadline proximity, mentions/pings count, calendar proximity, carry-over count, user energy profile (deep-focus mornings default). Output: ordered stack + one "take on now" + slot suggestion per hour block. Store rationale string per item (shown in UI on hover).

## Brief generation
- Inputs: today's calendar, todo stack, mentions (Slack/Notion/Linear/Gmail last 24h), project status deltas, "circles" (people/tool clusters with overlap detection), good-to-know feed (provider status pages, OOO from calendar).
- Voice: conversational first person ("I'd take X first…"). Cache per day; regenerate on demand.
- Week brief runs Monday 06:00 (or first open) and refreshes Friday 16:00 as a retro.

## Time tracking & invoicing
- Entities: `Client`, `Project(clientId, rate|fee|retainer, rounding, terms, cadence, accountingTarget)`, `TimeEntry(projectId?, start, end?, note, billable, source, todoId?)`, `Invoice(clientId, period, lines[], status: draft|review|sent|paid, externalId)`.
- One running timer per user, stored in the DO (`runningEntry`); start/stop/switch are server functions with optimistic UI; the DO pushes the running state to all devices over the socket so desktop and phone agree. Stop after inactivity heuristics: if a timer runs > 4h with no activity, prompt "still on Meridian?".
- Start a timer from any todo (`todoId` link) or from the bar; project can be changed later, entries are fully editable; untagged entries get an AI project suggestion (from calendar, todo, and the note text) shown as a confirm chip.
- Natural-language add: "2h Meridian synthesis yesterday afternoon" → parsed server-side into an entry.
- Invoicing: cron per client cadence drafts an invoice (group entries → lines by project, apply rounding/rates/retainer overage, per-client terms). Draft → review → send. Sending goes through the client's accounting target (QuickBooks, Xero, FreshBooks via OAuth; Harvest two-way for time), Stripe payment link optional; paid webhooks flip status and post to the brief.
- Never auto-send unless the user enables "Send without review".

## Screens ↔ routes
- `/` Today (brief + timeline + stack + timer bar) · `/week` · `/projects` · `/time` · `/invoices` · `/circles` · `/metrics` · `/integrations`
- Mobile: same routes, single column; bottom tab bar (Today, Week, Projects, More).

## Open questions
- Which providers first for OAuth review (Google verification takes weeks).
- Energy profile: inferred from completion-by-hour history or user-set.
