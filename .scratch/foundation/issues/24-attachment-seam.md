# 24 — The Attachment seam

**What to build:** A developer can store a file against a Todo and read it back through authenticated routes, and no one else can. There is no interface, because none is drawn. This binds the R2 bucket and adds the Attachment metadata.

**Blocked by:** 03 — Today screen shows the Brief, Take on now and the Priority stack

**Status:** done — the bucket itself is the owner's to create (`crazy-attachments`); everything is exercised against the local R2

- [x] Upload stores the bytes under a per-user key prefix and records owner, Todo, content type and size
- [x] Upload rejects a Todo the user does not own, non-image content types and oversize files
- [x] Read returns the file only to its owner; there is no public URL
- [x] Tests cover upload, owner read, and another user's refused read
- [x] The project brief records that the interface awaits a frame

## Comments

### 2026-09-19 — built

**Built.** Two routes, one command seam and one private bucket.

- **The bucket.** `apps/web/wrangler.jsonc` gains
  `"r2_buckets": [{ "binding": "ATTACHMENTS", "bucket_name": "crazy-attachments" }]`. The **web**
  Worker holds it because it is the one that authenticates the request and has the body in its
  hands; the **Coordinator** decides `attachment.add` and writes the row and never touches the
  bucket, which is ADR 0002 to the letter ("the Coordinator never awaits the outside world"). The
  spec's line that the Core Worker is "bound to the same D1 database and R2 bucket" is about the
  archive Workflow, which is not written — binding it there now would be a binding nothing uses.
  Recorded in `docs/BRIEF.md`, "The Attachment seam".
- **Schema.** `Attachment` (`id`, `userId`, `todoId` → `todo` with `onDelete: Cascade`, `key`
  unique, `contentType`, `size`, `createdAt` with no default), indexed `(userId, todoId)`.
  Migration **`0015_attachments.sql`**, written by hand from `migration:diff` less its
  `DROP INDEX "time_entry_userId_running_key"` — as 0012, 0013 and 0014 were, because the diff
  does not know the partial unique index from 0011 that is the backstop under "at most one running
  timer". `pnpm db:generate`, then `pnpm db:migrate`: 4 commands, applied.
- **The command.** `attachment.add` (`id`, `todoId`, `contentType`, `size`) in `decide`: refuses a
  Todo that is not the user's (only their own are ever loaded, so another's is simply absent),
  anything outside `ATTACHMENT_LIMITS.contentTypes`, an empty file, and anything over
  `ATTACHMENT_LIMITS.maxBytes`. One operation, `attachment.insert`; `persistOps` writes the row and
  **derives the key there** — `users/<userId>/todos/<todoId>/<id>` (`attachmentKey`) — from the
  user the write is for, so no caller can name where a file lands. `attachment.remove` is the pair
  (loaded through `attachmentsNamed` → `CommandState.attachments`, refused for anyone else's), and
  it earns its place: it is how a put that fails after its row was written is put right. Both are
  `SERVER_ONLY`. Neither reaches `apply`: no cached read model holds an Attachment, because no
  screen draws one.
- **`ATTACHMENT_LIMITS`** and the rest of the shared vocabulary are in
  `packages/shared/src/attachment.ts`: the four types, the 10 MB cap, the refusal wording,
  `attachmentKey`, `declaredType` and `sniffImageType`.
- **The routes.** `apps/web/src/routes/attachments.ts`
  (`POST /attachments?todoId=…`) and `apps/web/src/routes/attachments.$id.ts`
  (`GET /attachments/:id`). Each is four lines: resolve the user with `viewerId()` exactly as
  `/live` and `/dev/seed` do — the Clerk user, or the demo user with no keys — and hand the
  bindings to `apps/web/src/server/attachments.ts`, which is where everything happens.
  `storeAttachment` refuses on the declared type, refuses a `Content-Length` that admits to being
  too big, reads the body counting as it goes and abandons it the moment it passes the cap, sniffs
  the first 16 bytes against the declared type, asks the Coordinator, and only then puts the object
  with `httpMetadata.contentType` (and `customMetadata` naming the owner and the Todo).
  `sendAttachment` reads the row by id **and** userId through `readAttachment` (`@crazy/db`, a
  `ReadDb`, no writing methods), and streams `object.body` with `Content-Type` from the row,
  `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: private,
  no-store`.
- **`@crazy/db/write` is not imported anywhere in `apps/web`**, including the new tests; lint is
  green on 206 files. Nothing in shared, the read model or the Coordinator reads the clock — the
  Attachment's `createdAt` is the Coordinator's moment, read back out of the patch and handed to
  the uploader rather than taken from the web Worker's own clock.

**What the docs said** (fetched through the context7 MCP tools, against the installed versions):

- **R2's Workers API** (`/websites/developers_cloudflare_r2`): `put(key, body, { httpMetadata:
  { contentType }, customMetadata })`, `get(key)` returning `null` when there is no object, and
  `object.body` as the response body — which is what `sendAttachment` does. The docs' own download
  example also shows `writeHttpMetadata(headers)`; this route deliberately does **not** use it, and
  sets the type from the D1 row instead, so what is served is the type the bytes were checked
  against rather than whatever the object's metadata says later. Binding shape from the same
  source: `"r2_buckets": [{ "binding": …, "bucket_name": … }]`, local by default under
  `.wrangler/state` unless `"remote": true`.
- **`@cloudflare/vitest-pool-workers` 0.22.0** (`/cloudflare/workers-sdk`): bindings come from the
  wrangler config the pool is pointed at — the fixture shows `r2_buckets` beside `d1_databases`,
  `durable_objects` and `migrations` in one `wrangler.jsonc` — and `miniflare.bindings` adds
  test-only ones (which is how `TEST_MIGRATIONS` already reaches both existing projects).
  `isolatedStorage` and `singleWorker` no longer exist in the pool's schema.
- **TanStack Start server routes** (`/websites/tanstack_start_framework_react`, for
  `@tanstack/react-start@1.168.56`): `createFileRoute('/x')({ server: { handlers: { POST } } })`,
  the handler taking `{ request, params }` and returning a `Response` with its own headers, and
  `routes/users/$id/…` giving `params.id`. `attachments.ts` and `attachments.$id.ts` generate as
  parent and child and both are matched: confirmed by curl, not by reading.

**Checked.** `pnpm check` (no warnings), `pnpm typecheck`, `pnpm test` (**371**, up from 348 at
ticket 23), `pnpm build` — the web Worker's built config carries
`"r2_buckets":[{"binding":"ATTACHMENTS","bucket_name":"crazy-attachments"}]`.

Thirteen new tests at the command seam (`packages/shared/src/attachment.test.ts`): a picture on the
user's own Todo is recorded at the command's moment; each of the four types is allowed; a Todo that
is not theirs is refused and is not told apart from one that is gone; `text/plain`, `text/html`,
`application/pdf`, `image/svg+xml` and `application/octet-stream` are each refused; the cap refuses
one byte over and allows exactly the cap; an empty file is refused; only the user's own Attachment
can be removed; a key is derived and belongs to its owner, and an id full of `../` still does,
because an R2 key is a flat string; each picture is recognised by its first bytes and an SVG or an
HTML page is not; a content type is compared as its type and never as the header it arrived in.

Ten new tests inside workerd (`apps/web/src/server/attachments.test.ts`) against a **real local R2,
a real local D1 and the real Coordinator**: upload then owner read gives back the same bytes, the
same content type and all four headers; the row and the object sit at
`users/<owner>/todos/<todo>/<id>` with the owner's `customMetadata`; another user's read is 404 and
word for word what an id that never existed is answered with; a Todo that is not the uploader's
stores nothing in either place; a text file and a script claiming to be a PNG are both 415 and
store nothing; an 11 MB body under a `content-length: 12` header is 413 and stores nothing; no
`todoId` is 400 and an unknown one 404; a put that throws takes the row out again; one user cannot
remove another's Attachment; and each of two users reads only their own file.

**That last project is new**: `apps/web/vitest.config.ts` + `apps/web/test/` (a wrangler config
binding `DB`, `ATTACHMENTS` and `COORDINATOR`, and a `main` that re-exports the real Coordinator),
added to the root `vite.config.ts` alongside the `core` and `db` projects. `apps/web` had no tests
before because there was nothing there to test at a seam — screens are compared with frames, and
there are no component unit tests. This is the web app's first seam that moves bytes and refuses
people, so it is tested where it lives. No test was deleted.

**By hand against the dev server** (restarted to pick up the binding, and left running), as the
demo user on Cori's `Research synthesis · discovery interviews`:

| What                                                     | Status                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| `--data-binary` a 70-byte PNG                            | **201** `{"id":"8c58a5c5…","contentType":"image/png","size":70,…}`  |
| `GET /attachments/<id>`                                  | **200**, bytes identical (`cmp`), all four headers as specified      |
| `GET /attachments/not-a-real-id`                         | **404**                                                              |
| a text file as `text/plain`                              | **415** "An Attachment is a picture: …"                              |
| a text file claiming `image/png`                         | **415** "That file is not the picture it says it is."                |
| an 11 MB PNG                                             | **413** "An Attachment may be 10 MB at most."                        |
| `?todoId=made-up-todo`                                   | **404** "That Todo is not one of yours."                             |
| no `todoId`                                              | **400**                                                              |
| an empty body                                            | **400** "An empty file is nothing to attach."                        |
| `curl -F file=@pixel.png` (multipart)                    | **415** — the body is the file; see Decisions                        |

The row that was written: `key = users/user_demo_ryan/todos/user_demo_ryan/todo/synthesis/8c58a5c5…`,
`image/png`, 70 bytes. Every refusal left the `attachment` table and the bucket untouched. The local
bucket `crazy-attachments` shows up in the dev session's R2 listing.

`pnpm visual` (whole run, once): 1a 0.00% at both widths, 1c/1d/1e 0.00%, **1f 0.13% (known)**,
**1g 2.46% (known ≈2.5%)**, 2a 0.00% in every region, 2b 0.00% in every region, 2c 0.00% in every
region, 3a idle 0.01%, 3a running 0.00%, 3a-open 0.03% (picker 0.00%), 3b 0.00%, 4a 0.00% in every
region. No screen moved, which is the point: nothing is drawn.

The local database is left seeded as **Cori with the timer running**.

**Decisions taken.**

- **The web Worker moves the bytes; the Coordinator never touches R2.** It is the one that
  authenticates the request and holds the body, and a Durable Object bills wall-clock time while
  awake (ADR 0002). The Coordinator's part is the one thing only it can do: decide against D1 and
  write, in the user's own order.
- **Decide first, store second.** Nothing a user does not own and nothing outside the limits ever
  reaches the bucket, which is what the ticket asks. The cost is the other direction — a row can
  exist for a moment with no object — so a put that throws sends `attachment.remove`. Storing
  first would trade a row we can put right for an object nobody can reach and everybody pays for.
- **SVG is out.** It is a document, not a picture: it can carry script, and an Attachment is served
  inline from this app's own origin, where that script would run as the signed-in user. `nosniff`
  is no defence, because `image/svg+xml` is exactly what the browser would be told to render. If a
  drawing ever has to be attached it wants its own decision and a sanitiser, not a fifth member of
  a list. PNG, JPEG, WebP and GIF are in; the cap is **10 MB** — a phone photo with room to spare,
  and small enough that a Worker can hold one while it is checked.
- **The size is counted, never taken from a header.** `Content-Length` is believed only when it
  refuses (it saves reading a body that admits to being too big); the body is read chunk by chunk
  and abandoned the moment it passes the cap. And the file's first bytes must be the picture it
  claims to be, so a script under `image/png` is refused before anything is stored.
- **The body is the file; multipart is not accepted.** `curl -F` is answered 415. Parsing a
  multipart form means buffering a body before a cap can be applied to it, which is the one thing
  this route takes care not to do. A drawn interface sends the file as the body, with its type.
- **The Attachment's id is named by the route**, with `crypto.randomUUID()`, not by whoever is
  uploading: the id is half of the key. (The command still takes the id from its caller, as
  `todo.add` does, because `decide` is pure and names nothing.)
- **404, never 403**, both for a read of someone else's file and for an upload to someone else's
  Todo. A refusal that says "not yours" says that it exists.
- **The served `Content-Type` comes from D1**, not from the object's metadata: the row holds the
  type the bytes were actually checked against.
- **`attachment.remove` exists, and no route calls it.** It is the compensation above. Deleting a
  file on purpose is an interface's job and no interface is drawn; a `DELETE` route with nothing to
  press it would be a door nobody has a reason to open.
- **`apps/web` gets its own workerd test project** (above), rather than the refusals going untested
  or being tested against a fake. It is a security seam.
- **The seed says `attachment.deleteMany` outright** rather than leaning on the Todo's cascade, as
  every other child table in `seedPersona` does. It does not empty the bucket (below).

**Open.**

- **The bucket has to be created**: `crazy-attachments`, by the owner, with
  `wrangler r2 bucket create crazy-attachments`. Nothing here has run against a real Cloudflare
  account; every test and every curl above is the local R2 under `.wrangler/state`. **Keep it
  private**: no custom domain, no r2.dev public access. Nothing in the code signs a URL or lists
  the bucket.
- **`POST /dev/seed` empties the rows but not the bucket.** A reseeded development bucket keeps
  objects nothing points at. Emptying it would mean the web Worker listing and deleting a prefix on
  a development route; it is local disk, and it is written down instead.
- **Nothing deletes an Attachment when its Todo goes.** The row cascades with the Todo (the FK);
  the object does not. Nothing deletes a Todo today, and when something does, the object wants the
  archive Workflow rather than a delete in a request path.
- **There is no interface**, which is the ticket. No screen adds, lists or shows a file; no read
  model outside `readAttachment` mentions one; `apply` handles neither operation because no cached
  state holds an Attachment. `docs/BRIEF.md` records where the seam is and the limits a drawn
  interface has to live inside.
- **A file is not scanned, only sniffed.** A real PNG header on a file of nonsense is stored. It is
  only ever handed back to its owner, under its own type, with `nosniff` and
  `Content-Disposition: inline` — but this is not a virus scanner and does not claim to be.
- **Nothing rate-limits uploads.** A signed-in user can fill their own prefix 10 MB at a time.
  Quotas want a place to live (a setting, a figure on a screen) and neither is drawn.
- **`Content-Length` is not set on the read.** The body is streamed from R2; the object's size is
  known and could be sent, and was left off rather than risk a header that disagrees with the
  stream.
- **The archive Workflow will want this bucket in `apps/core`** (ADR 0002, spec: "Moving archived
  Todos to R2"). It is a shell in ticket 25 and binds nothing yet.
