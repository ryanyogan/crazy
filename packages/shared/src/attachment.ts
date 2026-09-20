import { z } from 'zod'

// A file a user deliberately added to a Todo (CONTEXT.md, "Attachment"): a
// photo of a receipt, a screenshot. The bytes live in R2, the metadata in D1,
// and the row is the only way to find the bytes — there is no public URL.
// Nothing here reads the clock or touches a binding; it is what both sides of
// the seam agree on.

/**
 * What may be attached, and how much of it.
 *
 * The types are the ones a receipt or a screenshot actually arrives as. SVG is
 * deliberately not among them: it is a document rather than a picture, it can
 * carry script, and an Attachment is served inline from the app's own origin,
 * where that script would run as the signed-in user. `nosniff` is no help —
 * `image/svg+xml` is exactly what the browser would be told to render. If a
 * drawing ever has to be attached it wants its own decision and its own
 * sanitiser, not a sixth member of this list.
 */
export const ATTACHMENT_LIMITS = {
  contentTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  /** 10 MB: a phone photo with room to spare, and a Worker can hold it while it is checked. */
  maxBytes: 10 * 1024 * 1024,
} as const

export type AttachmentType = (typeof ATTACHMENT_LIMITS.contentTypes)[number]

export const attachmentType = z.enum(ATTACHMENT_LIMITS.contentTypes)

/** Whether a content type is one of the few an Attachment may be. */
export function isAttachmentType(type: string): type is AttachmentType {
  return (ATTACHMENT_LIMITS.contentTypes as readonly string[]).includes(type)
}

/** The refusals, worded once so the command seam and the route say the same thing. */
export const ATTACHMENT_REFUSALS = {
  notYourTodo: 'That Todo is not one of yours.',
  notYours: 'That Attachment is not one of yours.',
  empty: 'An empty file is nothing to attach.',
  type: `An Attachment is a picture: ${ATTACHMENT_LIMITS.contentTypes.join(', ')}.`,
  size: `An Attachment may be ${ATTACHMENT_LIMITS.maxBytes / (1024 * 1024)} MB at most.`,
} as const

/**
 * A content type as a header gives it — `image/png; charset=binary`, `IMAGE/PNG`
 * — reduced to the type itself. What is compared is never the raw header.
 */
export function declaredType(header: string | null): string {
  return (header ?? '').split(';')[0]!.trim().toLowerCase()
}

/**
 * Where an Attachment's bytes live. Derived from the owner, the Todo and the
 * Attachment — never supplied by a caller — so every object a user has sits
 * under their own prefix and a listing, a lifecycle rule or an export can be
 * written per user. R2 keys are flat strings: the `/`s are a convention, so
 * nothing can be escaped by putting one in an id.
 */
export function attachmentKey(userId: string, todoId: string, attachmentId: string): string {
  return `users/${userId}/todos/${todoId}/${attachmentId}`
}

/** Whether a key belongs to this user, which is what "per-user prefix" means. */
export function keyBelongsTo(key: string, userId: string): boolean {
  return key.startsWith(`users/${userId}/`)
}

const starts = (bytes: Uint8Array, signature: readonly number[], at = 0): boolean =>
  signature.every((byte, index) => bytes[at + index] === byte)

const ascii = (text: string): number[] => [...text].map((each) => each.charCodeAt(0))

/**
 * What the first bytes say a file is, or null for anything else. A declared
 * content type is a claim by whoever is uploading; this is the file itself, and
 * an Attachment is stored only when the two agree. It is a guard against a
 * script or an HTML page being stored and later served back under an image
 * type, not a full parse: a real PNG header on a file of nonsense passes, and
 * is still only ever handed back as an image.
 */
export function sniffImageType(bytes: Uint8Array): AttachmentType | null {
  if (starts(bytes, [0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  // Every JPEG begins SOI + the first marker; what follows differs by encoder.
  if (starts(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (starts(bytes, ascii('GIF87a')) || starts(bytes, ascii('GIF89a'))) return 'image/gif'
  // RIFF....WEBP: a container whose size sits between the two words.
  if (starts(bytes, ascii('RIFF')) && starts(bytes, ascii('WEBP'), 8)) return 'image/webp'
  return null
}

/** An Attachment as a route hands it back: the metadata, and never the key. */
export interface AttachmentRead {
  id: string
  todoId: string
  contentType: AttachmentType
  size: number
  createdAt: string
}
