import { createReadDb, readUserSettings } from '@crazy/db'
import type { UserSettings } from '@crazy/shared'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { coordinatorFor } from './coordinator'

// Server only.

function requestTimeZone(): string | undefined {
  const zone = getRequest().cf?.timezone
  return typeof zone === 'string' ? zone : undefined
}

/**
 * The user's settings, provisioning them if this is their first request.
 * Cloudflare knows the time zone the request came from, so the Rollover needs
 * no configuring.
 */
export async function settingsFor(userId: string): Promise<UserSettings> {
  return (
    (await readUserSettings(createReadDb(env.DB), userId)) ??
    coordinatorFor(userId).provision({ timeZone: requestTimeZone() })
  )
}
