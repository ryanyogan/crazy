import { createReadDb } from '@crazy/db'
import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { sendAttachment } from '#/server/attachments'
import { viewerId } from '#/server/viewer'

// GET /attachments/:id — the file, to the one person it belongs to. The row is
// looked up by its id and the user asking, so anyone else is answered 404
// rather than 403: whether someone else's file exists is not ours to say.
//
// This is the only way to the bytes. The bucket is private, no URL is signed
// and no r2.dev domain is enabled.

export const Route = createFileRoute('/attachments/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const userId = await viewerId()
        if (!userId) return new Response('Sign in first', { status: 401 })

        return sendAttachment(
          { userId, db: createReadDb(env.DB), bucket: env.ATTACHMENTS },
          params.id,
        )
      },
    },
  },
})
