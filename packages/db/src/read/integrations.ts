import {
  type ClientInvoicing,
  type ConnectionView,
  type LifecycleSettings,
  SETTINGS_DEFAULTS,
  clientArrangement,
  clientCadence,
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
  /**
   * How each Client is billed, oldest first, for the billing section of the
   * screen (frame 2c). Empty with the Billing module off: a Client exists only
   * with it on, and a screen that drew them would be showing a part of the app
   * the user has turned off.
   */
  clients: ClientInvoicing[]
}

/**
 * The Integrations screen's read model: the user's Connections, oldest first so
 * that a second account at a Provider sits under the first, the lifecycle
 * settings, and — with the Billing module on — how each Client is billed. No
 * column of a Connection is secret (ADR 0001), so all may be read.
 */
export async function readIntegrations(db: ReadDb, userId: string): Promise<IntegrationsRead> {
  const [rows, settings] = await Promise.all([
    db.connection.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    db.userSettings.findUnique({ where: { userId } }),
  ])
  const { briefTime, sentBackDays, archiveDays, timeZone, billing } = settings ?? SETTINGS_DEFAULTS

  // The Clients and what they are billed in. Everything she bills is in one
  // currency until a Client is in another, which is the rule the Invoices read
  // model already goes by (`readInvoices`); the invoice is where a currency is
  // written down, so it is read from the latest of them.
  const [clientRows, latestInvoice] = billing
    ? await Promise.all([
        db.client.findMany({
          where: { userId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            arrangement: true,
            rateCents: true,
            roundingMinutes: true,
            budgetHours: true,
            overageRateCents: true,
            cadence: true,
            paymentTermsDays: true,
            autoDraft: true,
            sendWithoutReview: true,
          },
        }),
        db.invoice.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { currency: true },
        }),
      ])
    : [[], null]
  const currency = latestInvoice?.currency ?? 'USD'

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
    clients: clientRows.map((row) => ({
      ...row,
      arrangement: clientArrangement.parse(row.arrangement),
      cadence: clientCadence.parse(row.cadence),
      currency,
    })),
  }
}
