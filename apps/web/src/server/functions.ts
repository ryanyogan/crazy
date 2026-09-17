import { createReadDb, readToday } from '@crazy/db'
import { type CommandResult, command, initials } from '@crazy/shared'
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { requestNow } from './clock'
import { coordinatorFor } from './coordinator'
import { settingsFor } from './settings'
import { viewerId, viewerName } from './viewer'

// The browser's only door to the server. Reads go to D1 directly; anything
// that changes data is handed to the user's Coordinator.

export const getViewer = createServerFn().handler(async () => ({ userId: await viewerId() }))

/** What the Shell shows. */
export const getShell = createServerFn().handler(async () => {
  const userId = await viewerId()
  if (!userId) throw redirect({ to: '/sign-in' })

  const [name, settings] = await Promise.all([viewerName(userId), settingsFor(userId)])

  return {
    name,
    initials: initials(name),
    billing: settings.billing,
    // The moment and zone every screen under the Shell formats against.
    now: requestNow(settings.timeZone).toISOString(),
    timeZone: settings.timeZone,
  }
})

/** The Today screen's read model, at the moment this request is served. */
export const getToday = createServerFn().handler(async () => {
  const userId = await viewerId()
  if (!userId) throw redirect({ to: '/sign-in' })

  const { timeZone } = await settingsFor(userId)
  const now = requestNow(timeZone)
  return {
    ...(await readToday(createReadDb(env.DB), userId, now, timeZone)),
    now: now.toISOString(),
    timeZone,
  }
})

/**
 * Every change the browser makes. The web app decides nothing and writes
 * nothing: the command goes to the user's Coordinator, and its answer comes
 * back, a refusal included, for the browser to keep or roll back.
 */
export const sendCommand = createServerFn({ method: 'POST' })
  .validator(command)
  .handler(async ({ data }): Promise<CommandResult> => {
    const userId = await viewerId()
    if (!userId) throw redirect({ to: '/sign-in' })
    return coordinatorFor(userId).command(data)
  })
