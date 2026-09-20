import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { coordinatorFor } from '#/server/coordinator'
import { clerkWebhookSecret, handleClerkWebhook } from '#/server/webhooks'

// POST /webhooks/clerk — the one webhook Crazy answers: an account Clerk says
// is gone. It is on this Worker rather than the core one because this is the
// Worker the outside world can reach (the core Worker has no public route by
// design), because Clerk is this Worker's to speak to (ADR 0001), and because
// deleting an account needs both the user's Coordinator — bound here — and the
// Attachment bucket, which only this Worker holds. Inbound *Provider* webhooks
// are a different thing and belong on the core Worker beside the Queue that
// carries what they say (docs/BRIEF.md, "Deleting an account").
//
// Nothing here decides anything: the signature, the event and the order of the
// deleting are all `handleClerkWebhook`.

export const Route = createFileRoute('/webhooks/clerk')({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleClerkWebhook(
          {
            secret: clerkWebhookSecret(env),
            // The one write path: the user's own Coordinator (ADR 0002).
            forget: (userId) => coordinatorFor(userId).forget(),
            bucket: env.ATTACHMENTS,
          },
          request,
        ),
    },
  },
})
