import { type ReadDb, readAttachment } from '@crazy/db'
import {
  ATTACHMENT_LIMITS,
  ATTACHMENT_REFUSALS,
  type Command,
  type CommandResult,
  attachmentKey,
  declaredType,
  isAttachmentType,
  sniffImageType,
} from '@crazy/shared'

// Server only. The two halves of the Attachment seam: taking a file in, and
// handing it back to the one person it belongs to.
//
// This Worker moves the bytes because it is the one that authenticates the
// request and holds the body. It does not decide anything: the rule — whose
// Todo it is, what may be attached and how much of it — is `decide` in
// @crazy/shared, asked through the user's Coordinator, which records the
// metadata in D1 and never touches a bucket itself (ADR 0002).
//
// Nothing here is given a binding or a user of its own: both are handed in, so
// that a test can exercise this against a real bucket and a real D1 without a
// route, and so that no path through it can forget whose file it is.

/** What the user's Coordinator does with a command. Every write goes through it (ADR 0002). */
export type Recorder = (command: Command) => Promise<CommandResult>

export interface Uploading {
  userId: string
  bucket: R2Bucket
  record: Recorder
  /**
   * The Attachment's id. It is named here rather than taken from the request,
   * because it is half of where the bytes land: an uploader who could choose it
   * could choose a key.
   */
  id: string
}

export interface Reading {
  userId: string
  db: ReadDb
  bucket: R2Bucket
}

const refusal = (status: number, reason: string) =>
  new Response(reason, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

/** A file's first bytes are enough to know what it is; a whole 10 MB is not needed. */
const SNIFF_BYTES = 16

/**
 * Everything the body holds, or `'too big'` as soon as it holds more than the
 * cap. The count is kept while reading rather than taken from `Content-Length`:
 * a header is a claim by whoever is uploading, and this is the file. A body
 * that goes over is abandoned mid-stream, so nothing bigger than the cap is
 * ever held or stored.
 */
async function bodyWithin(
  body: ReadableStream<Uint8Array> | null,
  cap: number,
): Promise<Uint8Array | 'too big'> {
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > cap) {
        await reader.cancel()
        return 'too big'
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.byteLength
  }
  return bytes
}

/**
 * A file stored against a Todo.
 *
 * The order is deliberate: the Coordinator decides and records before a single
 * byte reaches the bucket, so nothing a user does not own and nothing outside
 * the limits is ever stored. The cost of that order is the other way round — a
 * row can exist for a moment with no object behind it — so a put that fails
 * takes the row out again (`attachment.remove`). Storing first and recording
 * after would trade a row that lies for an object nobody can reach, which is
 * worse: the row is ours to put right, and a stray object is billed for ever.
 */
export async function storeAttachment(
  where: Uploading,
  request: Request,
  todoId: string | null,
): Promise<Response> {
  if (!todoId) return refusal(400, 'Which Todo is this for? Send ?todoId=.')

  // What the request says it is. Compared as a type, never as the raw header.
  const contentType = declaredType(request.headers.get('content-type'))
  if (!isAttachmentType(contentType)) return refusal(415, ATTACHMENT_REFUSALS.type)

  // Believed only when it refuses: a header may lie about being small, and the
  // count below catches that, but one that admits to being too big saves a read.
  const claimed = Number(request.headers.get('content-length'))
  if (Number.isFinite(claimed) && claimed > ATTACHMENT_LIMITS.maxBytes) {
    return refusal(413, ATTACHMENT_REFUSALS.size)
  }

  const bytes = await bodyWithin(request.body, ATTACHMENT_LIMITS.maxBytes)
  if (bytes === 'too big') return refusal(413, ATTACHMENT_REFUSALS.size)
  if (bytes.byteLength === 0) return refusal(400, ATTACHMENT_REFUSALS.empty)

  // The file itself, against what it claims to be. A text file or an HTML page
  // under an image type would be stored and later served back from this app's
  // own origin, which is the one thing `nosniff` cannot save a reader from.
  const sniffed = sniffImageType(bytes.subarray(0, SNIFF_BYTES))
  if (sniffed !== contentType) {
    return refusal(415, 'That file is not the picture it says it is.')
  }

  const decided = await where.record({
    type: 'attachment.add',
    id: where.id,
    todoId,
    contentType,
    size: bytes.byteLength,
  })
  if (!decided.ok) {
    // A Todo that is not theirs is answered 404, not 403: whether someone
    // else's Todo exists is not something an answer should say.
    const status = decided.reason === ATTACHMENT_REFUSALS.notYourTodo ? 404 : 400
    return refusal(status, decided.reason)
  }

  const key = attachmentKey(where.userId, todoId, where.id)
  try {
    await where.bucket.put(key, bytes, {
      httpMetadata: { contentType },
      // Enough to tell, from the object alone, whose it is — for a lifecycle
      // rule or an export. Nothing reads it back: the row is the truth.
      customMetadata: { userId: where.userId, todoId },
    })
  } catch (error) {
    // The bytes are not there, so the row must not stay: it would point at
    // nothing. If this fails too the row is left, and the file reads as gone.
    await where.record({ type: 'attachment.remove', attachmentId: where.id })
    return refusal(500, `The file could not be stored: ${error}`)
  }

  const written = decided.patch.ops.find((op) => op.type === 'attachment.insert')
  return Response.json(
    {
      id: where.id,
      todoId,
      contentType,
      size: bytes.byteLength,
      // The moment the Coordinator recorded it at, never this Worker's own clock.
      createdAt: written?.attachment.createdAt ?? null,
    },
    { status: 201, headers: { 'cache-control': 'private, no-store' } },
  )
}

/**
 * A file handed back to its owner, and to nobody else. The row is looked up by
 * its id *and* the user asking, so someone else's id finds nothing and is
 * answered 404 rather than 403: a refusal that says "not yours" says that it
 * exists. There is no other way to the bytes — the bucket is private and no
 * URL is ever signed.
 */
export async function sendAttachment(where: Reading, id: string): Promise<Response> {
  const row = await readAttachment(where.db, where.userId, id)
  if (!row) return refusal(404, 'No such Attachment.')

  const object = await where.bucket.get(row.key)
  // The row is there and the object is not: a put that failed after its row was
  // written, or a bucket that has lost it. There is nothing to hand back.
  if (!object) return refusal(404, 'No such Attachment.')

  return new Response(object.body, {
    headers: {
      // The type D1 holds, which is the one the file's own bytes were checked
      // against — not whatever the object's metadata says now.
      'content-type': row.contentType,
      'content-disposition': 'inline',
      // Belt to the sniffing done on the way in: the browser is not to guess.
      'x-content-type-options': 'nosniff',
      // One person's file: no shared cache may hold it, and no disk need.
      'cache-control': 'private, no-store',
    },
  })
}
