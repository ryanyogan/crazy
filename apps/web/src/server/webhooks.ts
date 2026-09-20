import { type WebhookEvent, verifyWebhook } from '@clerk/tanstack-react-start/webhooks'
import { userPrefix } from '@crazy/shared'

// Server only. Clerk owns the account (ADR 0001), so Clerk is the only thing
// that can say an account is gone, and this is where it says it. It is the one
// webhook Crazy answers: account deletion and nothing else, as the spec has it.
//
// Nothing here is given a binding, a secret or a user of its own: all three are
// handed in, so the refusals can be exercised against a real Coordinator, a
// real D1 and a real R2 without a route, and so no path through it can forget
// whose account it is deleting.

/** What an account deletion needs to be carried out. */
export interface Deletion {
  /**
   * The endpoint's signing secret (`CLERK_WEBHOOK_SECRET`, a wrangler secret).
   * Undefined when none is configured, and then every request is refused —
   * never waved through. An endpoint that cannot tell Clerk from anyone else
   * must not delete accounts.
   */
  secret: string | undefined
  /**
   * The user's Coordinator, which deletes every row they have. It is the only
   * thing that writes to D1 (ADR 0002), and it answers how many rows there
   * were. Asking twice is not an error.
   */
  forget: (userId: string) => Promise<number>
  /**
   * Where the user's files are. The Coordinator never touches a bucket, so
   * emptying `users/<userId>/` is this Worker's half of the job — it is the one
   * that holds the binding (docs/BRIEF.md, "The Attachment seam").
   */
  bucket: R2Bucket
}

const refusal = (status: number, reason: string) =>
  new Response(reason, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

/**
 * An account Clerk says is gone.
 *
 * The signature is checked first and against nothing else: Clerk signs the
 * body with the endpoint's own secret (Standard Webhooks — HMAC-SHA256 over
 * `id.timestamp.body`), and `verifyWebhook` refuses a signature that does not
 * match, headers that are missing, and a timestamp outside five minutes, which
 * is what keeps a captured delivery from being replayed later.
 *
 * Then the rows, then the files, in that order: a row that outlived its bytes
 * is a file that reads as gone, and bytes that outlive their row are a file
 * nobody can reach and everybody pays for. If the files fail this answers a
 * failure, and Clerk delivers again; the second delivery finds no rows to
 * delete, says so quietly, and finishes the files.
 */
export async function handleClerkWebhook(where: Deletion, request: Request): Promise<Response> {
  if (!where.secret) {
    return refusal(401, 'This endpoint has no signing secret, so it refuses everything.')
  }

  let event: WebhookEvent
  try {
    event = await verifyWebhook(request, { signingSecret: where.secret })
  } catch (error) {
    // One answer for every way a request can fail to be Clerk's — a missing
    // header, a wrong signature, a stale timestamp. What went wrong goes to the
    // log, not to whoever sent it.
    console.log(`clerk webhook refused: ${error}`)
    return refusal(401, 'That is not a signed Clerk webhook.')
  }

  // The endpoint is subscribed to `user.deleted` alone, and says so rather than
  // acting on anything else that reaches it.
  if (event.type !== 'user.deleted') {
    return Response.json({ type: event.type, did: 'nothing' })
  }

  const userId = event.data.id
  if (!userId) return refusal(400, 'A user.deleted with no user is nothing to act on.')

  const rows = await where.forget(userId)
  let objects: number
  try {
    objects = await emptyUserPrefix(where.bucket, userId)
  } catch (error) {
    console.log(`clerk webhook: ${userId}'s rows are gone, their files are not: ${error}`)
    return refusal(500, 'That account’s files could not all be deleted.')
  }

  console.log(`clerk webhook: deleted ${userId} — ${rows} rows, ${objects} files`)
  return Response.json({ type: event.type, userId, rows, objects })
}

/** R2 takes at most this many keys in one delete, and lists at most this many at once. */
const AT_A_TIME = 1000

/**
 * Deletes everything one user has in the bucket, and answers how many objects
 * that was. Everything of theirs is under `users/<userId>/` (`userPrefix`),
 * which is what the per-user prefix is for: this is a listing rather than a
 * search, and it cannot reach anybody else's file.
 */
export async function emptyUserPrefix(bucket: R2Bucket, userId: string): Promise<number> {
  const prefix = userPrefix(userId)
  let removed = 0
  for (;;) {
    const listed = await bucket.list({ prefix, limit: AT_A_TIME })
    if (listed.objects.length === 0) return removed
    await bucket.delete(listed.objects.map((object) => object.key))
    removed += listed.objects.length
    // Deleting shortens the listing, so the next page is another first page.
    if (!listed.truncated) return removed
  }
}

/**
 * The endpoint's signing secret. It is a wrangler secret rather than a var, so
 * it is not in the generated `Env` and is read from the Worker's environment by
 * name. Blank counts as not configured: a secret that is there but empty must
 * refuse exactly as a missing one does.
 */
export function clerkWebhookSecret(env: unknown): string | undefined {
  const secret = (env as { CLERK_WEBHOOK_SECRET?: unknown }).CLERK_WEBHOOK_SECRET
  return typeof secret === 'string' && secret !== '' ? secret : undefined
}
