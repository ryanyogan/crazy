# 25 — Shells for the Queue, the Workflows, the AI Gateway and account deletion

**What to build:** Each later feature has a declared, bound and deployable place to go: the Provider-pull Queue and its consumer, the Brief, invoice and archive Workflows, and the AI Gateway binding — each an empty handler that logs and returns. A Clerk webhook for account deletion removes the user's rows and their Coordinator's storage.

**Blocked by:** 01 — Walking skeleton: sign in and see the Shell, served from D1 through both Workers

**Status:** done — everything runs locally; the Queue, the AI Gateway and the Clerk endpoint are the owner's to create (see "Open")

- [x] The Queue, three Workflows and AI Gateway are bound in the core Worker and start locally
- [x] Each shell has a one-line note in the project brief saying what will fill it, per ADR 0002
- [x] The deletion webhook verifies Clerk's signature and deletes the user's data; an unsigned request is refused (test)
- [x] No shell calls a Provider or an LLM

## Comments

### 2026-09-19 — built

**Built.** Five shells on the core Worker, and one webhook on the web one.

- **`apps/core/wrangler.jsonc`** gains, in one go: `"queues"` with producer
  `{ binding: "PROVIDER_PULL", queue: "crazy-provider-pull" }` and a consumer on the same queue
  (`max_batch_size: 10`, `max_batch_timeout: 30`, `max_retries: 3`, no dead-letter queue — see
  Decisions); `"workflows"` with `crazy-brief`/`BRIEF`/`BriefWorkflow`,
  `crazy-invoice`/`INVOICE`/`InvoiceWorkflow` and `crazy-archive`/`ARCHIVE`/`ArchiveWorkflow`;
  `"ai": { "binding": "AI" }` with `"vars": { "AI_GATEWAY_ID": "" }`; and
  `"r2_buckets"` binding `ATTACHMENTS` → `crazy-attachments` here as well as on the web Worker.
  `wrangler types` regenerated `worker-configuration.d.ts`.
- **The Queue consumer** is `providerPull` (`apps/core/src/queue/provider-pull.ts`), wired as the
  `queue` handler in `src/index.ts`. It logs each message — id, attempt, body — and **acks message
  by message** rather than letting the batch ack itself, because when it has a body a message that
  could not be handled must be `retry()`ed on its own and not take the batch with it.
- **The three Workflows** (`apps/core/src/workflows/{brief,invoice,archive}.ts`) each extend
  `WorkflowEntrypoint` from `cloudflare:workers`, declare the payload the real job will take
  (always a `userId`, and local days rather than moments, because the time is always a parameter)
  and take exactly one `step.do('nothing yet', …)` that logs and returns. One step, because the
  docs say a Workflow must call at least one to be a valid Workflow.
- **The AI Gateway** is `aiGateway(env)` (`apps/core/src/ai.ts`), which nothing calls. It reads the
  gateway id from the `AI_GATEWAY_ID` var and throws a sentence naming it when it is blank, rather
  than calling a model outside a gateway. (The id is read into a `string` local first: `wrangler
  types` gives a var the literal type of whatever is in the config, so `env.AI_GATEWAY_ID` alone is
  typed `""`.)
- **Each shell file opens with what will fill it and what it must never do**, per ADR 0002: the
  Queue and the Workflows hand their writes to `coordinatorFor(userId)` as commands and never touch
  D1 themselves; none of them may be awaited by the Coordinator; the invoice Workflow must never
  write to a Provider (ADR 0001, read-only); the model calls go through `ai.ts` and never straight
  at a provider. **No shell calls a Provider or an LLM anywhere, commented out or otherwise.**
- **`deleteUser` and `USER_TABLES`** (`packages/db/src/delete.ts`, exported from
  `@crazy/db/write`): all **21** tables that carry a `userId`, children before the rows they point
  at, each `deleteMany({ where: { userId } })`, answering the row count.
- **`Coordinator.forget()`** starts with `await this.ready()` (not `awake`: a wake is a note about
  a user who is about to have none), deletes the rows through `inTurn` like every other write,
  cancels **every** schedule through the SDK so the Rollover can never fire again, closes every
  socket with code 1000, empties its own storage, and resets `rolloverChecked` so the name could be
  provisioned again from nothing. Two new helpers in the one module allowed to import the SDK
  (`coordinator/sdk.ts`): `cancelEverySchedule` and `closeEverySocket`, plus `forgetStorage`.
- **`POST /webhooks/clerk`** (`apps/web/src/routes/webhooks.clerk.ts`) is six lines: the secret,
  the Coordinator and the bucket handed to `handleClerkWebhook` (`apps/web/src/server/webhooks.ts`),
  which is where everything happens — exactly the shape ticket 24 gave the Attachment routes, and
  for the same reason: the refusals are testable without a route.
- **`apps/web/.dev.vars.example`** is new, because the webhook's secret is a Worker secret and
  therefore a different file from `.env.local`, which holds the Clerk keys.

**What the docs said** (fetched through the context7 MCP tools, against the installed versions):

- **Cloudflare Queues** (`/websites/developers_cloudflare_queues`): the config shape is
  `queues.producers[{ queue, binding }]` and `queues.consumers[{ queue, max_batch_size,
  max_batch_timeout, max_retries }]`; the consumer is the Worker's `queue()` handler over a
  `MessageBatch`, with `ack()`/`retry()` per message. On local development it says producer and
  consumer run together under one `wrangler dev` and that **consumer concurrency is not supported
  locally**. A queue must exist before deploy (`wrangler queues create`).
- **Cloudflare Workflows** (`/websites/developers_cloudflare_workflows`): `class X extends
  WorkflowEntrypoint<Env, Params>` with `run(event, step)`, imported from `cloudflare:workers`;
  "A Workflow must extend this class and define a `run` method with at least one step call to be
  considered a valid Workflow" — which is why each shell has one. Config is
  `workflows[{ name, binding, class_name }]`. Local development is a plain `wrangler dev` session,
  and the changelog for 2026-04-01 adds `--local`/`--port` to every `wrangler workflows` command
  for driving one in that session. **Nothing is created by hand: `wrangler deploy` creates the
  Workflows from the config.**
- **AI Gateway / the Workers AI binding**
  (`/llmstxt/developers_cloudflare_ai-gateway_llms-full_txt`): the binding is `{"ai": {"binding":
  "AI"}}`, and a gateway is reached either as `env.AI.run(model, input, { gateway: { id } })` or
  through `env.AI.gateway(gatewayName).run(...)`. The gateway id is a call-time argument, so **the
  binding deploys with no gateway in existence** — nothing validates an id until something asks for
  a model. There is no `wrangler ai-gateway` command (confirmed against `wrangler ai --help` on the
  installed 4.133.0); a gateway is created in the dashboard.
- **Clerk webhooks** (`/clerk/clerk-docs`, and the installed `@clerk/backend@3.18.1` read
  directly): `verifyWebhook(request, { signingSecret })` exists and is re-exported by
  `@clerk/tanstack-react-start/webhooks` (`@clerk/tanstack-react-start@1.5.15`, a **direct**
  dependency — `@clerk/backend` is not). It is Standard Webhooks via the `standardwebhooks`
  package, which is pure JS (`fast-sha256`, `@stablelib/base64`, a hand-written `timingSafeEqual`)
  and so runs in workerd: **HMAC-SHA256 over `id.timestamp.body`, base64, a `whsec_`-prefixed
  base64 secret, a `v1,<sig>` space-separated signature header, and a ±300-second tolerance**. It
  reads the `svix-*` headers and maps them onto the `webhook-*` ones. Clerk's own environment
  variable is `CLERK_WEBHOOK_SIGNING_SECRET`; this endpoint passes `signingSecret` explicitly from
  `CLERK_WEBHOOK_SECRET` as the ticket names it, so the "no secret ⇒ refuse" rule is ours and not
  the library's throw. `user.deleted` carries `UserDeletedJSON` — `{ object, id?, deleted,
  external_id? }` — so **`id` is optional** and a delivery without one is refused.

**Checked.** `pnpm check` (no warnings), `pnpm typecheck`, `pnpm test` (**390**, up from 371 at
ticket 24), `pnpm build` — the core Worker's dry-run lists `COORDINATOR`, `BRIEF`, `INVOICE`,
`ARCHIVE`, `PROVIDER_PULL`, `DB`, `ATTACHMENTS`, `AI` and `AI_GATEWAY_ID`.

Three new tests in `apps/core/src/shells.test.ts`: the Queue consumer acks every message in a batch,
retries none, and adds no row to D1; **all three Workflows, started through their real bindings
(`env.BRIEF.create(…)` and so on), reach `complete` inside the workerd pool** and add no row; and
`aiGateway` says `AI_GATEWAY_ID` rather than calling a model. The row count is taken over
`USER_TABLES`, which is also the list that deleting a user walks.

Three new tests in `packages/db/src/delete.test.ts`. The first is the one that matters over time:
it reads `sqlite_master` and `PRAGMA table_info` and fails if any table in D1 carrying a `userId`
is not named in `USER_TABLES` — so a table added by a later migration cannot be left behind. Then:
deleting Cori's world leaves nothing of hers in any of the 21 tables and every row of the other
user's untouched; and deleting a user who has nothing, or who has already been deleted, is 0.

Thirteen new tests in `apps/web/src/server/webhooks.test.ts`, inside workerd against a real local
D1, a real local R2 and the real Coordinator, with two users who each have the persona's rows and a
stored picture. Payloads are signed with a test `whsec_` secret using the same arithmetic Clerk
uses, through Web Crypto. Refused: a request with no `svix-*` headers at all; one signed with
somebody else's secret; one correctly signed and then edited; one an hour old; one an hour in the
future; and — signed or not — **every request when the secret is `undefined` or `''`**. Then: a
correctly signed `user.created` does nothing at all and says so; a correctly signed `user.deleted`
takes every row and every file of that user and nothing of the other's, down to reading the other's
object back out of the bucket; the Coordinator is left with no patches (`lastSeq()` back to 0), no
Rollover waiting and no alarm; a second delivery answers `200` with `rows: 0, objects: 0`; a
`user.deleted` naming no user is `400`; and a Coordinator that has forgotten can be provisioned
again from nothing. No test was deleted.

**By hand against the dev server** (restarted for the new bindings, and left running). The local
Explorer lists on `crazy-core`: `BRIEF`/`BriefWorkflow`, `INVOICE`/`InvoiceWorkflow`,
`ARCHIVE`/`ArchiveWorkflow`, `ATTACHMENTS` and the shared D1 — no binding errors in the log.

| What                                                                 | Status                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| unsigned `POST /webhooks/clerk`, **no secret configured**            | **401** "This endpoint has no signing secret, so it refuses everything."    |
| unsigned, with a secret configured                                   | **401** "That is not a signed Clerk webhook."                               |
| correctly signed `user.deleted` for a user who has nothing           | **200** `{"rows":0,"objects":0}`                                            |
| correctly signed but timestamped an hour ago                         | **401**                                                                     |
| correctly signed `user.created`                                      | **200** `{"type":"user.created","did":"nothing"}`                           |
| correctly signed `user.deleted` for the demo user, one file uploaded | **200** `{"userId":"user_demo_ryan","rows":139,"objects":2}` — 0 rows left  |
| the same delivery again                                              | **200** `{"rows":0,"objects":0}`                                            |

(The second object was the picture ticket 24's own manual run left in the local bucket, which is
the "reseeded development bucket keeps objects nothing points at" note in `docs/BRIEF.md` — and
which deleting the account swept up.)

`pnpm visual` (whole run, once): 1a 0.00% at both widths, 1c/1d/1e 0.00%, **1f 0.13% (known)**,
**1g 2.46% (known ≈2.5%)**, 2a, 2b, 2c and 4a 0.00% in every region, 3a idle 0.01%, 3a running
0.00%, 3a-open 0.03% (picker 0.00%), 3b 0.00%. No screen moved, which is the point.

The local database is left seeded as **Cori with the timer running**, and `apps/web/.dev.vars` was
removed again, so the local endpoint refuses everything.

**Decisions taken.**

- **Clerk's webhook is on the web Worker, not core.** The spec puts *Provider* webhook routes on
  core, and they still belong there beside the Queue that will carry what they say. Clerk is not a
  Provider: it is the account itself (ADR 0001), its SDK and keys are the web Worker's, and the web
  Worker is the only one the outside world can reach — `crazy-core` has `workers_dev: false` and no
  route, deliberately. Deciding the other way would mean either exposing the whole core Worker
  publicly or giving it a route of its own, and then it would still need the Attachment bucket to
  finish the job. Recorded in `docs/BRIEF.md`, "Deleting an account".
- **The rows first, the files second, and the files are the route's.** The Coordinator never
  touches a bucket (ticket 24), so `forget()` answers a row count and the route then empties
  `users/<userId>/` (`userPrefix`, new in `@crazy/shared` and now what `attachmentKey` and
  `keyBelongsTo` are built from). Rows first because a row that outlives its bytes reads as a file
  that is gone, while bytes that outlive their row are unreachable and billed for ever. If the
  files fail, the answer is a `500`, Clerk redelivers, and the second delivery finds no rows and
  finishes the files — which is the same property that makes a duplicate delivery harmless.
- **`forget()` empties the Durable Object's storage; it does not `deleteAll()` and does not
  `destroy()`.** Both of those *drop* tables. `ctx.storage.deleteAll()` takes the Agents SDK's own
  tables with it and leaves the instance unable to answer another call — proved, not guessed: the
  first version of this failed every test with `no such table: cf_agents_jobs`. The SDK's
  `destroy()` does the same and then aborts the isolate. A webhook is redelivered until it is
  answered, so the one thing this must not do is fail to answer. `forgetStorage` therefore deletes
  every row from every table in the instance's own SQLite that is not the runtime's
  (`sqlite_%`, `_cf_%`), clears the key-value side through its own API, and deletes the alarm. The
  same nothing is left behind, and the instance can still speak.
- **A blank secret is no secret.** `clerkWebhookSecret` treats `''` and a non-string exactly as
  missing, and `handleClerkWebhook` refuses before it looks at anything else. There is no path
  through this endpoint that skips verification.
- **Replay protection is the library's ±5 minutes against the runtime clock**, and deliberately not
  `requestNow()`. The tolerance is about real elapsed time; taking it from the web app's pinnable
  clock would let a development request with a `crazy-now` cookie replay a captured delivery. This
  is the one place in the request path that reads the clock on purpose.
- **One refusal for every kind of bad signature.** A missing header, a wrong secret, an edited body
  and a stale timestamp are all `401` "That is not a signed Clerk webhook."; the reason goes to the
  log. `user.deleted` with no `id` is `400`, because that is a malformed event rather than a
  forgery.
- **Only `user.deleted` is acted on.** Any other correctly signed event answers `200` and says it
  did nothing, so a mis-configured dashboard subscription is visible rather than silently dropped —
  and never acted on.
- **`ATTACHMENTS` is now bound on core too.** Ticket 24 declined to, on the grounds that it would
  be a binding nothing uses; the archive Workflow now exists as the thing that will use it, and
  this ticket's job is to give each later feature a bound place to go. The cost is one line and one
  ordering constraint at deploy (the bucket must exist before `crazy-core` deploys, not only before
  `crazy-web` does), which is written down. Nothing on core reads or writes it.
- **No dead-letter queue.** It would be a second queue, needing a second `wrangler queues create`,
  for messages nothing sends. What to do with a pull that fails three times is a decision the first
  real pull should make.
- **`AI_GATEWAY_ID` is a var, not a constant.** The owner sets the id in `wrangler.jsonc` without
  touching code, and blank means "no gateway yet" rather than "call a model outside one".
- **The webhook tests live in `apps/web`, not `apps/core`.** The ticket suggested core; the route
  and its handler are in the web app, and `apps/web` has had a workerd project since ticket 24 with
  D1, R2 and the real Coordinator bound — which is exactly what these need. The shells' own tests
  are in `apps/core`, where they live.
- **`user_settings` is deleted last.** While it is there the user still exists, so a run that
  stopped half way is a user whose settings still say what time zone to finish the job in.
- **Nothing revokes anything at Clerk.** A Connection holds no token (ADR 0001); Clerk has already
  taken the account away, which is why the webhook arrived.

**Open.**

- **The owner must create these before `wrangler deploy` succeeds** (all in `docs/BRIEF.md`,
  "Before this can be deployed"): `wrangler queues create crazy-provider-pull`;
  `wrangler r2 bucket create crazy-attachments` (ticket 24's, now needed by **both** Workers);
  `wrangler secret put CLERK_WEBHOOK_SECRET` on `crazy-web`; and in the Clerk dashboard,
  **Configure → Webhooks → Add Endpoint** at `https://<web domain>/webhooks/clerk` subscribed to
  **`user.deleted` only**, whose Signing Secret is that wrangler secret. The Workflows need no
  command — `wrangler deploy` creates them. **Deploy succeeds with no AI Gateway id and no webhook
  secret set**: the `AI` binding never validates an id until something asks for a model, and the
  endpoint simply refuses every request until a secret exists.
- **An AI Gateway has no wrangler command.** It is created in the dashboard (AI → AI Gateway →
  Create Gateway) and its id goes in `AI_GATEWAY_ID`. Nothing calls a model, so it can wait.
- **The `ai` binding costs ten seconds at the end of `pnpm test`.** The workerd pool opens a remote
  proxy for it ("AI bindings always access remote resources"), and vitest then prints "close timed
  out after 10000ms". Every test passes and the command exits 0; removing the binding makes it go
  away, which is how this was confirmed. Fidelity was chosen over the ten seconds — the pool runs
  against the app's real `wrangler.jsonc`, which is what makes the Workflow and Queue bindings real
  in the tests.
- **The local Queue was not exercised end to end.** Nothing in the app sends to it, so there was
  nothing to press: the consumer is exercised directly in workerd with a hand-made batch. The
  binding is declared, `pnpm dev` starts with it and the dry-run lists it; that a message posted
  locally reaches the consumer is untested. The Workflows *were* exercised through their real
  bindings, locally and in the pool.
- **Nothing has run against a real Cloudflare account**: no queue, no gateway, no Clerk endpoint,
  no deploy. Every status above is the local runtime.
- **The Clerk path has still not been exercised with real keys**, so the signature arithmetic is
  checked against the library Clerk itself ships, not against a delivery Clerk sent.
- **A deleted account's Durable Object is emptied, not destroyed.** An empty Coordinator with no
  schedules and no sockets costs nothing and hibernates, but the object itself still exists. If
  that ever matters, `destroy()` is the SDK's answer and wants the deferred form
  (`_cf_scheduleDestroy`, `@internal` today) so that the webhook can still be answered.
- **Nothing stops the same deletion being processed twice at once.** Two simultaneous deliveries of
  one event would both delete, and both succeed: the writes are serialised by the Coordinator and
  deleting is idempotent. Svix does not deliver in parallel, and nothing here depends on that.
- **The shells log to `console.log` and nowhere else.** Observability is on for both Workers; what
  a real Queue consumer or Workflow should record is the first real job's decision.
