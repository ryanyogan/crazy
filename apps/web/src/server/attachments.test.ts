import type { Coordinator } from '@crazy/core'
import { createReadDb } from '@crazy/db'
import { ATTACHMENT_LIMITS, attachmentKey } from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { type Recorder, sendAttachment, storeAttachment } from './attachments'

// The Attachment seam inside workerd: a real local R2, a real local D1 and the
// real Coordinator deciding and writing every row. The routes themselves are
// four lines each — resolve the user, hand over the bindings — so what is
// exercised here is everything under them.

// The app's own binding is the cross-Worker one, which carries no type; here
// the Coordinator is in this test Worker (test/wrangler.jsonc), so it has one.
const COORDINATOR = env.COORDINATOR as DurableObjectNamespace<Coordinator>
const coordinatorFor = (userId: string) => COORDINATOR.get(COORDINATOR.idFromName(userId))

const recorderFor = (userId: string): Recorder => {
  const coordinator = coordinatorFor(userId)
  return (command) => coordinator.command(command)
}

const db = () => createReadDb(env.DB)

/** A very small but entirely real PNG: an 8-bit RGBA pixel. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
])

const upload = (body: BodyInit, contentType: string) =>
  new Request('http://localhost/attachments', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  })

const todoOf = async (userId: string, title: string) =>
  (await env.DB.prepare('SELECT id FROM todo WHERE userId = ? AND title = ?')
    .bind(userId, title)
    .first<{ id: string }>())!.id

/** The two users the whole file is about: each with the persona's Todos, and nothing of the other's. */
const OWNER = 'user_attach_owner'
const STRANGER = 'user_attach_stranger'
let ownerTodo = ''
let strangerTodo = ''

beforeAll(async () => {
  await coordinatorFor(OWNER).provision({ timeZone: 'America/Chicago' })
  await coordinatorFor(STRANGER).provision({ timeZone: 'America/Chicago' })
  ownerTodo = await todoOf(OWNER, 'Book dentist')
  strangerTodo = await todoOf(STRANGER, 'Book dentist')
})

const store = (userId: string, id: string, todoId: string | null, request: Request) =>
  storeAttachment(
    { userId, bucket: env.ATTACHMENTS, record: recorderFor(userId), id },
    request,
    todoId,
  )

it('stores a picture against the owner’s Todo and hands it back to them, byte for byte', async () => {
  const stored = await store(OWNER, 'att_read', ownerTodo, upload(PNG, 'image/png'))
  expect(stored.status).toBe(201)
  expect(await stored.json()).toMatchObject({
    id: 'att_read',
    todoId: ownerTodo,
    contentType: 'image/png',
    size: PNG.byteLength,
  })

  const read = await sendAttachment(
    { userId: OWNER, db: db(), bucket: env.ATTACHMENTS },
    'att_read',
  )

  expect(read.status).toBe(200)
  expect(read.headers.get('content-type')).toBe('image/png')
  expect(read.headers.get('content-disposition')).toBe('inline')
  expect(read.headers.get('x-content-type-options')).toBe('nosniff')
  expect(read.headers.get('cache-control')).toBe('private, no-store')
  expect(new Uint8Array(await read.arrayBuffer())).toEqual(PNG)
})

it("the bytes sit under the owner's own prefix, at a key nobody supplied", async () => {
  await store(OWNER, 'att_key', ownerTodo, upload(PNG, 'image/png'))

  const key = attachmentKey(OWNER, ownerTodo, 'att_key')
  expect(key.startsWith(`users/${OWNER}/`)).toBe(true)
  const row = await env.DB.prepare(
    'SELECT userId, key, size, contentType FROM attachment WHERE id = ?',
  )
    .bind('att_key')
    .first<{ userId: string; key: string; size: number; contentType: string }>()
  expect(row).toEqual({ userId: OWNER, key, size: PNG.byteLength, contentType: 'image/png' })

  const object = await env.ATTACHMENTS.get(key)
  expect(object).not.toBe(null)
  expect(object?.httpMetadata?.contentType).toBe('image/png')
  expect(object?.customMetadata).toMatchObject({ userId: OWNER, todoId: ownerTodo })
})

it("another user's read is 404, and says nothing about the file existing", async () => {
  await store(OWNER, 'att_private', ownerTodo, upload(PNG, 'image/png'))

  const theirs = await sendAttachment(
    { userId: STRANGER, db: db(), bucket: env.ATTACHMENTS },
    'att_private',
  )
  expect(theirs.status).toBe(404)

  // Word for word what an id that never existed is answered with: the two
  // cannot be told apart, so a file's existence is never revealed.
  const nothing = await sendAttachment(
    { userId: STRANGER, db: db(), bucket: env.ATTACHMENTS },
    'att_never',
  )
  expect(nothing.status).toBe(404)
  expect(await theirs.text()).toBe('No such Attachment.')
  expect(await nothing.text()).toBe('No such Attachment.')
})

it("a Todo that is not the uploader's stores nothing, anywhere", async () => {
  const answer = await store(STRANGER, 'att_intruder', ownerTodo, upload(PNG, 'image/png'))

  expect(answer.status).toBe(404)
  expect(
    await env.DB.prepare('SELECT id FROM attachment WHERE id = ?').bind('att_intruder').first(),
  ).toBe(null)
  expect(await env.ATTACHMENTS.get(attachmentKey(STRANGER, ownerTodo, 'att_intruder'))).toBe(null)
  expect(await env.ATTACHMENTS.get(attachmentKey(OWNER, ownerTodo, 'att_intruder'))).toBe(null)
})

it('a file that is not a picture is refused before anything is stored', async () => {
  const text = await store(OWNER, 'att_text', ownerTodo, upload('hello', 'text/plain'))
  expect(text.status).toBe(415)

  // The dangerous one: a script under a type the app does serve.
  const lying = await store(
    OWNER,
    'att_lying',
    ownerTodo,
    upload('<svg onload="alert(1)"></svg>', 'image/png'),
  )
  expect(lying.status).toBe(415)
  expect(await lying.text()).toBe('That file is not the picture it says it is.')

  for (const id of ['att_text', 'att_lying']) {
    expect(await env.DB.prepare('SELECT id FROM attachment WHERE id = ?').bind(id).first()).toBe(
      null,
    )
    expect(await env.ATTACHMENTS.get(attachmentKey(OWNER, ownerTodo, id))).toBe(null)
  }
})

it('a file over the cap is refused however small its headers claim to be', async () => {
  const tooBig = new Uint8Array(ATTACHMENT_LIMITS.maxBytes + 1)
  tooBig.set(PNG, 0)
  const request = new Request('http://localhost/attachments', {
    method: 'POST',
    headers: { 'content-type': 'image/png', 'content-length': '12' },
    body: tooBig,
  })

  const answer = await store(OWNER, 'att_big', ownerTodo, request)

  expect(answer.status).toBe(413)
  expect(
    await env.DB.prepare('SELECT id FROM attachment WHERE id = ?').bind('att_big').first(),
  ).toBe(null)
  expect(await env.ATTACHMENTS.get(attachmentKey(OWNER, ownerTodo, 'att_big'))).toBe(null)
})

it('an upload with no Todo, and one with a Todo nobody has, are both refused', async () => {
  expect((await store(OWNER, 'att_none', null, upload(PNG, 'image/png'))).status).toBe(400)
  expect((await store(OWNER, 'att_ghost', 'todo_nobody', upload(PNG, 'image/png'))).status).toBe(
    404,
  )
})

it('the row is taken out again when the bytes cannot be stored', async () => {
  const broken = {
    put: () => Promise.reject(new Error('R2 is having a day')),
  } as unknown as R2Bucket

  const answer = await storeAttachment(
    { userId: OWNER, bucket: broken, record: recorderFor(OWNER), id: 'att_failed' },
    upload(PNG, 'image/png'),
    ownerTodo,
  )

  expect(answer.status).toBe(500)
  // No row pointing at bytes that are not there.
  expect(
    await env.DB.prepare('SELECT id FROM attachment WHERE id = ?').bind('att_failed').first(),
  ).toBe(null)
})

it("one user cannot take out another's Attachment", async () => {
  await store(OWNER, 'att_theirs', ownerTodo, upload(PNG, 'image/png'))

  expect(
    await coordinatorFor(STRANGER).command({
      type: 'attachment.remove',
      attachmentId: 'att_theirs',
    }),
  ).toEqual({ ok: false, reason: 'That Attachment is not one of yours.' })
  expect(
    await env.DB.prepare('SELECT id FROM attachment WHERE id = ?').bind('att_theirs').first(),
  ).not.toBe(null)
})

it("the stranger's own file is their own, and each user reads only theirs", async () => {
  await store(STRANGER, 'att_mine', strangerTodo, upload(PNG, 'image/png'))

  const mine = await sendAttachment(
    { userId: STRANGER, db: db(), bucket: env.ATTACHMENTS },
    'att_mine',
  )
  expect(mine.status).toBe(200)
  expect(
    (await sendAttachment({ userId: OWNER, db: db(), bucket: env.ATTACHMENTS }, 'att_mine')).status,
  ).toBe(404)
})
