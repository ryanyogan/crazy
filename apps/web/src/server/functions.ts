import {
  createReadDb,
  readCircles,
  readMetrics,
  readProjects,
  readToday,
  readWeek,
} from '@crazy/db'
import { type CommandResult, SERVER_ONLY, command, initials, metricRange } from '@crazy/shared'
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { requestNow } from './clock'
import { coordinatorFor } from './coordinator'
import { integrationsFor } from './integrations'
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

  const { timeZone, billing } = await settingsFor(userId)
  const now = requestNow(timeZone)
  // Before the read, not beside it: a socket opened from this is replayed
  // whatever was committed while D1 was being read (Coordinator.lastSeq).
  const seq = await coordinatorFor(userId).lastSeq()
  return {
    ...(await readToday(createReadDb(env.DB), userId, now, timeZone, billing)),
    seq,
    now: now.toISOString(),
    timeZone,
  }
})

/** The Week screen's read model: the week the moment of this request falls in. */
export const getWeek = createServerFn().handler(async () => {
  const userId = await viewerId()
  if (!userId) throw redirect({ to: '/sign-in' })

  const { timeZone } = await settingsFor(userId)
  const now = requestNow(timeZone)
  return readWeek(createReadDb(env.DB), userId, now, timeZone)
})

/**
 * The Projects screen's read model. It carries a sequence number like Today's,
 * because turning a Promise into a Todo is a command and its patch lands here.
 */
export const getProjects = createServerFn().handler(async () => {
  const userId = await viewerId()
  if (!userId) throw redirect({ to: '/sign-in' })

  const { timeZone } = await settingsFor(userId)
  const now = requestNow(timeZone)
  const seq = await coordinatorFor(userId).lastSeq()
  return {
    ...(await readProjects(createReadDb(env.DB), userId, now, timeZone)),
    seq,
    now: now.toISOString(),
    timeZone,
  }
})

/** The Circles screen's read model, at the moment this request is served. */
export const getCircles = createServerFn().handler(async () => {
  const userId = await viewerId()
  if (!userId) throw redirect({ to: '/sign-in' })

  const { timeZone } = await settingsFor(userId)
  const now = requestNow(timeZone)
  return readCircles(createReadDb(env.DB), userId, now, timeZone)
})

/** The Integrations screen: Connections as Clerk reports them, settings, and the Coordinator's counters. */
export const getIntegrations = createServerFn().handler(async () => {
  const userId = await viewerId()
  if (!userId) throw redirect({ to: '/sign-in' })

  const { timeZone } = await settingsFor(userId)
  return integrationsFor(userId, requestNow(timeZone), timeZone)
})

/**
 * The Metrics screen's read model, for one range. The range comes off the URL,
 * so it is validated here as well as there: a server function is a door.
 */
export const getMetrics = createServerFn()
  .validator(z.object({ range: metricRange }))
  .handler(async ({ data }) => {
    const userId = await viewerId()
    if (!userId) throw redirect({ to: '/sign-in' })

    const { timeZone } = await settingsFor(userId)
    const now = requestNow(timeZone)
    return readMetrics(createReadDb(env.DB), userId, now, timeZone, data.range)
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
    // What only Clerk can vouch for is not the browser's to say (`reconcile`).
    if (SERVER_ONLY.includes(data.type)) return { ok: false, reason: 'That is not yours to send.' }
    return coordinatorFor(userId).command(data)
  })
