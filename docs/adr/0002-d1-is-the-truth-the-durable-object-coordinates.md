---
status: accepted
---

# D1 is the only source of truth; the per-user Durable Object coordinates

The design notes give each user a Durable Object that owns the live day model, with D1 as history. We decided instead that D1 (through Prisma) holds all domain data and the per-user Durable Object — the Coordinator — holds none: it keeps the user's WebSockets, a sequence counter, a short replay buffer of recent patches, and the alarms. Every write goes server function → Coordinator → D1 → broadcast patch; every read is an ordinary SSR loader against D1. One store and one schema keeps Metrics, Week and Invoices as plain SQL, and because a Durable Object is single-threaded per user, routing writes through it gives us per-user serialisation — which stands in for the interactive transactions the Prisma D1 adapter lacks.

## Consequences

- The Coordinator never awaits the outside world. Durable Objects bill wall-clock time while awake, so anything that talks to a Provider or an LLM runs elsewhere (billed on CPU time) and hands its writes back to the Coordinator to commit and broadcast. Short, idempotent, high-volume jobs — Provider pulls, inbound Provider webhooks — go on a Queue. Multi-step jobs whose steps must not repeat or that wait on a person — the brief, the invoice cycle (draft → review → send → paid), archiving to R2 — are Workflows. The Coordinator's own schedule only fires the trigger, because it is the one place that knows the user's local midnight, hour and 06:00.
- Sockets use the Hibernation API so an idle open tab costs nothing.
- Writing to D1 from anywhere other than the Coordinator bypasses ordering and the broadcast. Don't.
- The Coordinator is required in local dev from the first day.
- The Coordinator is built on Cloudflare's Agents SDK (`Agent`) for its named schedules (a raw Durable Object has a single alarm slot), hibernating socket handling and the Workflow-to-client broadcast bridge. `setState` — the SDK's own state sync — is banned, because it would make the Coordinator a second owner of domain state; clients receive our `{seq, ops}` patches instead. The SDK is pinned and used from one module so it can be swapped for a raw Durable Object.
