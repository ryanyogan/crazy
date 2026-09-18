import { createFileRoute } from '@tanstack/react-router'
import { coordinatorFor } from '#/server/coordinator'
import { viewerId } from '#/server/viewer'

// `LIVE_PATH`. The socket a browser keeps open to hear what its user's other devices did.
// The web app only decides whose Coordinator the upgrade goes to: the request
// is handed on as it came, so `?since=` reaches the Coordinator, and the
// Coordinator's 101 goes back as it came. Nothing is ever sent up this socket;
// commands arrive through `sendCommand`.

export const Route = createFileRoute('/live')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
          return new Response('Expected a WebSocket upgrade', { status: 426 })
        }
        // A browser sends cookies with a socket handshake whatever page opened
        // it, and no CORS check applies, so another site could otherwise listen
        // in as the signed-in user.
        if (request.headers.get('Origin') !== new URL(request.url).origin) {
          return new Response('Forbidden', { status: 403 })
        }

        const userId = await viewerId()
        if (!userId) return new Response('Sign in first', { status: 401 })
        return coordinatorFor(userId).fetch(request)
      },
    },
  },
})
