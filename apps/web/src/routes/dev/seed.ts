import { PERSONAS, type Persona } from '@crazy/shared'
import { createFileRoute } from '@tanstack/react-router'
import { requestNow } from '#/server/clock'
import { coordinatorFor } from '#/server/coordinator'
import { settingsFor } from '#/server/settings'
import { viewerId } from '#/server/viewer'

// Development only. POST /dev/seed?persona=ryan throws away everything the
// signed-in user has and lays the persona's content over this request's
// moment, which the `crazy-now` cookie can pin. It is how `pnpm visual` puts
// the app in the state a frame shows. A production build answers 404 and holds
// no call to the Coordinator's reseed.

export const Route = createFileRoute('/dev/seed')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!import.meta.env.DEV) return new Response('Not found', { status: 404 })

        const userId = await viewerId()
        if (!userId) return new Response('Sign in first', { status: 401 })
        const persona = new URL(request.url).searchParams.get('persona') ?? 'ryan'
        if (!PERSONAS.includes(persona as Persona)) {
          return new Response(`No such persona. Try: ${PERSONAS.join(', ')}`, { status: 400 })
        }

        const { timeZone } = await settingsFor(userId)
        const now = requestNow(timeZone).toISOString()
        // `?timer=idle` seeds a persona's running Time entry already ended, so
        // that the idle timer bar can be seen at a pinned moment (frame 3a).
        const timer = new URL(request.url).searchParams.get('timer') === 'idle' ? 'idle' : undefined
        await coordinatorFor(userId).reseed({ persona: persona as Persona, now, timer })
        return Response.json({ persona, userId, now, timer: timer ?? 'running' })
      },
    },
  },
})
