import type { AttachmentRead, AttachmentType } from '@crazy/shared'
import { attachmentType } from '@crazy/shared'
import type { ReadDb } from '../client'

/** An Attachment as the route that serves the file needs it: the metadata, and where the bytes are. */
export interface AttachmentRow extends AttachmentRead {
  contentType: AttachmentType
  /** Where the bytes are in R2. It never leaves the server. */
  key: string
}

/**
 * One Attachment, by its id and the user asking. The user is half the key on
 * purpose: someone else's id finds nothing, so the route answers 404 and the
 * existence of another person's file is never revealed.
 */
export async function readAttachment(
  db: ReadDb,
  userId: string,
  id: string,
): Promise<AttachmentRow | null> {
  const row = await db.attachment.findFirst({
    where: { id, userId },
    select: { id: true, todoId: true, key: true, contentType: true, size: true, createdAt: true },
  })
  if (!row) return null
  return {
    id: row.id,
    todoId: row.todoId,
    key: row.key,
    contentType: attachmentType.parse(row.contentType),
    size: row.size,
    createdAt: row.createdAt.toISOString(),
  }
}
