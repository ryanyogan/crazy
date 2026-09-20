import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { storeAttachment } from '#/server/attachments'
import { coordinatorFor } from '#/server/coordinator'
import { viewerId } from '#/server/viewer'

// POST /attachments?todoId=… — a file stored against a Todo. The body is the
// file itself and its `Content-Type` says what it is; both are checked against
// the file's own first bytes before anything is stored.
//
// The user is resolved exactly as every other server route and server function
// resolves it: the Clerk user, or the demo user when no keys are configured.
// No interface sends this yet (docs/BRIEF.md); the seam is here for the one
// that will be drawn.

export const Route = createFileRoute('/attachments')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await viewerId()
        if (!userId) return new Response('Sign in first', { status: 401 })

        const coordinator = coordinatorFor(userId)
        return storeAttachment(
          {
            userId,
            bucket: env.ATTACHMENTS,
            record: (command) => coordinator.command(command),
            // Named here, not by the uploader: the id is half of the key.
            id: crypto.randomUUID(),
          },
          request,
          new URL(request.url).searchParams.get('todoId'),
        )
      },
    },
  },
})
