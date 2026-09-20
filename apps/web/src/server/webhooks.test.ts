import type { Coordinator } from '@crazy/core'
import { attachmentKey, userPrefix } from '@crazy/shared'
import { env, runInDurableObject } from 'cloudflare:test'
import { beforeEach, expect, it } from 'vite-plus/test'
import { type Recorder, storeAttachment } from './attachments'
import { clerkWebhookSecret, emptyUserPrefix, handleClerkWebhook } from './webhooks'

// Clerk's account-deletion webhook inside workerd, against a real local D1, a
// real local R2 and the real Coordinator. It is a security seam: most of what
// is below is the refusals, because the one thing this endpoint must never do
// is delete an account for someone who is not Clerk.

const COORDINATOR = env.COORDINATOR as DurableObjectNamespace<Coordinator>
const coordinatorFor = (userId: string) => COORDINATOR.get(COORDINATOR.idFromName(userId))

const forget = (userId: string) => coordinatorFor(userId).forget()

/** Everything an account deletion is given, with whatever secret this test wants it to have. */
const deletion = (secret: string | undefined) => ({ secret, forget, bucket: env.ATTACHMENTS })

/**
 * A test signing secret in Clerk's own format: `whsec_` and base64. Signing a
 * payload with it below is the same arithmetic Clerk does — HMAC-SHA256 over
 * `id.timestamp.body`, base64 — so what is exercised is the real verification
 * and not a stand-in for it.
 */
const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const OTHER_SECRET = 'whsec_c3VwZXJzZWNyZXRzdXBlcnNlY3JldHN1cGVy'

const bytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
const base64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))

async function signature(secret: string, id: string, seconds: number, body: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    bytes(secret.replace('whsec_', '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${seconds}.${body}`),
  )
  return `v1,${base64(mac)}`
}

interface Delivery {
  /** The signing secret Clerk used. Anything but `SECRET` is somebody else. */
  secret?: string
  /** Seconds away from now the delivery claims to be. Outside ±300 it is stale. */
  ageSeconds?: number
  id?: string
}

/** A delivery Clerk could have sent, signed the way Clerk signs one. */
async function delivered(payload: unknown, delivery: Delivery = {}): Promise<Request> {
  const body = JSON.stringify(payload)
  const id = delivery.id ?? `msg_${crypto.randomUUID()}`
  const seconds = Math.floor(Date.now() / 1000) - (delivery.ageSeconds ?? 0)
  return new Request('http://localhost/webhooks/clerk', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': String(seconds),
      'svix-signature': await signature(delivery.secret ?? SECRET, id, seconds, body),
    },
    body,
  })
}

const userDeleted = (userId: string) => ({
  type: 'user.deleted',
  object: 'event',
  data: { object: 'user', id: userId, deleted: true },
  event_attributes: { http_request: { client_ip: '127.0.0.1', user_agent: 'Svix' } },
})

/** A very small but entirely real PNG: an 8-bit RGBA pixel. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
])

const GONE = 'user_deleted_account'
const STAYS = 'user_kept_account'

const todoCount = async (userId: string) =>
  (await env.DB.prepare('SELECT count(*) AS rows FROM todo WHERE userId = ?')
    .bind(userId)
    .first<{ rows: number }>())!.rows

const fileCount = async (userId: string) =>
  (await env.ATTACHMENTS.list({ prefix: userPrefix(userId) })).objects.length

const recorderFor = (userId: string): Recorder => {
  const coordinator = coordinatorFor(userId)
  return (command) => coordinator.command(command)
}

/** A user with the persona's rows, a Todo of their own started, and one file. */
async function aUserWithSomething(userId: string, attachmentId: string) {
  await coordinatorFor(userId).provision({ timeZone: 'America/Chicago' })
  const todoId = (await env.DB.prepare('SELECT id FROM todo WHERE userId = ? AND title = ?')
    .bind(userId, 'Book dentist')
    .first<{ id: string }>())!.id
  await storeAttachment(
    { userId, bucket: env.ATTACHMENTS, record: recorderFor(userId), id: attachmentId },
    new Request('http://localhost/attachments', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: PNG,
    }),
    todoId,
  )
  return todoId
}

// Both users start each test whole, whatever the test before did to them: D1,
// the bucket and the two Coordinators are shared across this file.
beforeEach(async () => {
  for (const userId of [GONE, STAYS]) {
    await coordinatorFor(userId).forget()
    await emptyUserPrefix(env.ATTACHMENTS, userId)
  }
  await aUserWithSomething(GONE, 'att_gone')
  await aUserWithSomething(STAYS, 'att_stays')
})

it('refuses a request that carries no signature at all', async () => {
  const unsigned = new Request('http://localhost/webhooks/clerk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(userDeleted(GONE)),
  })

  const answer = await handleClerkWebhook(deletion(SECRET), unsigned)

  expect(answer.status).toBe(401)
  expect(await answer.text()).toBe('That is not a signed Clerk webhook.')
  expect(await todoCount(GONE)).toBeGreaterThan(0)
  expect(await fileCount(GONE)).toBe(1)
})

it('refuses a request signed with somebody else’s secret', async () => {
  const answer = await handleClerkWebhook(
    deletion(SECRET),
    await delivered(userDeleted(GONE), { secret: OTHER_SECRET }),
  )

  expect(answer.status).toBe(401)
  expect(await todoCount(GONE)).toBeGreaterThan(0)
})

it('refuses a correctly signed delivery whose body was changed after signing', async () => {
  const request = await delivered(userDeleted(STAYS))
  const tampered = new Request(request, { body: JSON.stringify(userDeleted(GONE)) })

  const answer = await handleClerkWebhook(deletion(SECRET), tampered)

  expect(answer.status).toBe(401)
  expect(await todoCount(GONE)).toBeGreaterThan(0)
  expect(await todoCount(STAYS)).toBeGreaterThan(0)
})

it('refuses a delivery captured and replayed an hour later', async () => {
  const answer = await handleClerkWebhook(
    deletion(SECRET),
    await delivered(userDeleted(GONE), { ageSeconds: 60 * 60 }),
  )

  expect(answer.status).toBe(401)
  expect(await todoCount(GONE)).toBeGreaterThan(0)
})

it('refuses a delivery timestamped in the future', async () => {
  const answer = await handleClerkWebhook(
    deletion(SECRET),
    await delivered(userDeleted(GONE), { ageSeconds: -60 * 60 }),
  )

  expect(answer.status).toBe(401)
  expect(await todoCount(GONE)).toBeGreaterThan(0)
})

it('refuses everything when no signing secret is configured, signed or not', async () => {
  for (const secret of [undefined, '']) {
    const answer = await handleClerkWebhook(deletion(secret), await delivered(userDeleted(GONE)))

    expect(answer.status).toBe(401)
    expect(await answer.text()).toBe(
      'This endpoint has no signing secret, so it refuses everything.',
    )
    expect(await todoCount(GONE)).toBeGreaterThan(0)
  }
})

it('reads a blank secret as no secret, and a real one as itself', () => {
  expect(clerkWebhookSecret({})).toBeUndefined()
  expect(clerkWebhookSecret({ CLERK_WEBHOOK_SECRET: '' })).toBeUndefined()
  expect(clerkWebhookSecret({ CLERK_WEBHOOK_SECRET: 7 })).toBeUndefined()
  expect(clerkWebhookSecret({ CLERK_WEBHOOK_SECRET: SECRET })).toBe(SECRET)
})

it('does nothing at all for a correctly signed event of another type', async () => {
  const created = {
    type: 'user.created',
    object: 'event',
    data: { id: GONE },
    event_attributes: { http_request: { client_ip: '127.0.0.1', user_agent: 'Svix' } },
  }

  const answer = await handleClerkWebhook(deletion(SECRET), await delivered(created))

  expect(answer.status).toBe(200)
  expect(await answer.json()).toEqual({ type: 'user.created', did: 'nothing' })
  expect(await todoCount(GONE)).toBeGreaterThan(0)
  expect(await fileCount(GONE)).toBe(1)
})

it('takes every row and every file of the deleted user, and nothing of anyone else’s', async () => {
  const had = await todoCount(GONE)
  expect(had).toBeGreaterThan(0)
  const others = await todoCount(STAYS)

  const answer = await handleClerkWebhook(deletion(SECRET), await delivered(userDeleted(GONE)))

  expect(answer.status).toBe(200)
  expect(await answer.json()).toMatchObject({ type: 'user.deleted', userId: GONE, objects: 1 })
  expect(await todoCount(GONE)).toBe(0)
  expect(await fileCount(GONE)).toBe(0)
  expect(
    await env.DB.prepare('SELECT count(*) AS rows FROM user_settings WHERE userId = ?')
      .bind(GONE)
      .first<{ rows: number }>(),
  ).toEqual({ rows: 0 })

  // The other user is untouched, down to the bytes.
  expect(await todoCount(STAYS)).toBe(others)
  expect(await fileCount(STAYS)).toBe(1)
  const key = attachmentKey(
    STAYS,
    (await env.DB.prepare('SELECT todoId FROM attachment WHERE userId = ?')
      .bind(STAYS)
      .first<{ todoId: string }>())!.todoId,
    'att_stays',
  )
  expect(await env.ATTACHMENTS.get(key)).not.toBeNull()
})

it('empties the deleted user’s Coordinator: no patches, no schedules, no alarm', async () => {
  const coordinator = coordinatorFor(GONE)
  // Something to forget: a committed command, and the Rollover waiting.
  expect(await coordinator.lastSeq()).toBeGreaterThan(0)
  expect(await coordinator.rolloverDueAt()).not.toBeNull()

  await handleClerkWebhook(deletion(SECRET), await delivered(userDeleted(GONE)))

  expect(await coordinator.lastSeq()).toBe(0)
  // Nothing of a deleted user's ever fires again — the Rollover least of all.
  expect(await coordinator.rolloverDueAt()).toBeNull()
  await runInDurableObject(coordinator, async (_instance, state) => {
    expect(await state.storage.getAlarm()).toBeNull()
  })
})

it('is a quiet success the second time the same deletion is delivered', async () => {
  const first = await handleClerkWebhook(deletion(SECRET), await delivered(userDeleted(GONE)))
  expect(await first.json()).toMatchObject({ rows: expect.any(Number), objects: 1 })

  // Svix redelivers the same event, id and all, until it is answered.
  const again = await handleClerkWebhook(deletion(SECRET), await delivered(userDeleted(GONE)))

  expect(again.status).toBe(200)
  expect(await again.json()).toEqual({
    type: 'user.deleted',
    userId: GONE,
    rows: 0,
    objects: 0,
  })
})

it('refuses a user.deleted that names no user', async () => {
  const nobody = {
    type: 'user.deleted',
    object: 'event',
    data: { object: 'user', deleted: true },
    event_attributes: { http_request: { client_ip: '127.0.0.1', user_agent: 'Svix' } },
  }

  const answer = await handleClerkWebhook(deletion(SECRET), await delivered(nobody))

  expect(answer.status).toBe(400)
  expect(await todoCount(GONE)).toBeGreaterThan(0)
})

it('lets a Coordinator that has forgotten start again from nothing', async () => {
  await handleClerkWebhook(deletion(SECRET), await delivered(userDeleted(GONE)))

  // The same name, arriving as a new person would. Nothing of the old one is left.
  const settings = await coordinatorFor(GONE).provision({ timeZone: 'Europe/London' })

  expect(settings.timeZone).toBe('Europe/London')
  expect(await todoCount(GONE)).toBeGreaterThan(0)
  expect(await coordinatorFor(GONE).rolloverDueAt()).not.toBeNull()
})
