import {
  type ConnectionView,
  type LifecycleSettings,
  SETTINGS_DEFAULTS,
  connectionStatus,
  provider,
  side,
} from '@crazy/shared'
import type { ReadDb } from '../client'

/** A Connection's bookkeeping row: what Clerk says of it is laid over this (`overlayClerk`). */
export type ConnectionRow = Omit<ConnectionView, 'label' | 'scopes'>

export interface IntegrationsRead {
  connections: ConnectionRow[]
  settings: LifecycleSettings
  /** Whether the Billing module is on. */
  billing: boolean
}

/**
 * The Integrations screen's read model: the user's Connections, oldest first so
 * that a second account at a Provider sits under the first, and the lifecycle
 * settings. No column of a Connection is secret (ADR 0001), so all may be read.
 */
export async function readIntegrations(db: ReadDb, userId: string): Promise<IntegrationsRead> {
  const [rows, settings] = await Promise.all([
    db.connection.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    db.userSettings.findUnique({ where: { userId } }),
  ])
  const { briefTime, sentBackDays, archiveDays, timeZone, billing } = settings ?? SETTINGS_DEFAULTS
  return {
    connections: rows.map((row) => ({
      id: row.id,
      provider: provider.parse(row.provider),
      externalAccountId: row.externalAccountId,
      defaultSide: side.parse(row.defaultSide),
      status: connectionStatus.parse(row.status),
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    })),
    settings: { briefTime, sentBackDays, archiveDays, timeZone },
    billing,
  }
}
