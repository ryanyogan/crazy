import {
  type InvoiceFull,
  type InvoiceRow,
  type InvoiceTotals,
  type InvoicesRead,
  type MonthEndHold,
  type MonthEndHoldInput,
  addDays,
  amountCents,
  billedMinutes,
  clientArrangement,
  invoiceStatus,
  invoiceToOpen,
  needsClient,
  periodOf,
  secondsIn,
  startOfDay,
  wallClock,
} from '@crazy/shared'
import type { ReadDb } from '../client'

/**
 * One period of a user's invoices as D1 holds them (frame 2b's right half):
 * each Client's invoice for the month with where it has got to and what it
 * comes to, what the period adds up to, and what is holding month-end up.
 *
 * The arithmetic that built an invoice is `draftInvoice` in @crazy/shared and
 * ran when it was drafted; this reads what it came to. What is *not* on an
 * invoice yet is counted here, from the period's own Time entries — because
 * the thing she needs told before she sends anything is which hours are
 * missing from the total she is looking at.
 *
 * Only the user's own rows are read, and only the period's.
 */
export async function readInvoices(
  db: ReadDb,
  userId: string,
  now: Date,
  timeZone: string,
  /** The local day the period is anchored on; the day the moment falls on by default. */
  anchorDay?: string,
  /** The invoice the URL asks to open; the one most in need of her eyes by default. */
  openId?: string,
): Promise<InvoicesRead> {
  const on = anchorDay ?? wallClock(now, timeZone).day
  const { from, to } = periodOf('month', on)
  const periodStart = startOfDay(from, timeZone)
  const periodEnd = startOfDay(addDays(to, 1), timeZone)

  const [invoiceRows, entries, clients] = await Promise.all([
    db.invoice.findMany({
      where: { userId, fromDay: from },
      include: {
        client: { select: { name: true } },
        // The minutes a row bills are the sum of its lines': read, never
        // recounted, so a row can never disagree with what is under it.
        lines: { select: { minutes: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    // Every entry with a second inside the period: what the invoices were built
    // from, and what was left out of them.
    db.timeEntry.findMany({
      where: {
        userId,
        startedAt: { lt: periodEnd },
        OR: [{ endedAt: null }, { endedAt: { gt: periodStart } }],
      },
      select: {
        id: true,
        clientId: true,
        projectId: true,
        billable: true,
        startedAt: true,
        endedAt: true,
        suggestedClientId: true,
      },
    }),
    db.client.findMany({
      where: { userId },
      select: { id: true, name: true, rateCents: true, roundingMinutes: true },
    }),
  ])

  /** How many of the period's entries a Client put into their invoice. */
  const entryCountFor = (clientId: string) =>
    entries.filter(
      (entry) =>
        entry.clientId === clientId &&
        entry.billable &&
        secondsIn(asSpan(entry), periodStart, periodEnd, now) > 0,
    ).length

  const invoices: InvoiceRow[] = invoiceRows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    clientName: row.client.name,
    number: row.number,
    status: invoiceStatus.parse(row.status),
    arrangement: clientArrangement.parse(row.arrangement),
    currency: row.currency,
    fromDay: row.fromDay,
    toDay: row.toDay,
    issuedDay: row.issuedDay,
    dueDay: row.dueDay,
    totalCents: row.totalCents,
    seconds: row.seconds,
    minutes: row.lines.reduce((total, line) => total + line.minutes, 0),
    rateCents: row.rateCents,
    budgetHours: row.budgetHours,
    overageRateCents: row.overageRateCents,
    roundingMinutes: row.roundingMinutes,
    paymentTermsDays: row.paymentTermsDays,
    lineCount: row.lines.length,
    entryCount: entryCountFor(row.clientId),
  }))

  const invoiced = new Set(invoices.map((invoice) => invoice.clientId))
  const hold = monthEndHold(
    entries.map((entry) => ({
      clientId: entry.clientId,
      projectId: entry.projectId,
      billable: entry.billable,
      suggestedClientId: entry.suggestedClientId,
      seconds: secondsIn(asSpan(entry), periodStart, periodEnd, now),
    })),
    clients,
    invoiced,
  )

  // The URL's invoice where it names one of this period's, and the one most in
  // need of her eyes otherwise — so the column beside the list is never empty
  // while there is something to look at.
  const wanted =
    invoices.find((invoice) => invoice.id === openId) ?? invoiceToOpen(invoices) ?? null

  return {
    on,
    from,
    to,
    invoices,
    open: wanted === null ? null : await readInvoice(db, userId, wanted.id, timeZone),
    totals: totalsOf(invoices),
    hold,
    // Everything she bills is in one currency until a Client is in another;
    // the period takes the first invoice's, and the default has to be something.
    currency: invoices[0]?.currency ?? 'USD',
  }
}

const asSpan = (entry: { startedAt: Date; endedAt: Date | null }) => ({
  startedAt: entry.startedAt.toISOString(),
  endedAt: entry.endedAt?.toISOString() ?? null,
})

/** What the period's invoices come to, by where each of them has got to. */
function totalsOf(invoices: readonly InvoiceRow[]): InvoiceTotals {
  const sum = (of: (invoice: InvoiceRow) => boolean) =>
    invoices.reduce((total, invoice) => (of(invoice) ? total + invoice.totalCents : total), 0)
  const sentCents = sum((invoice) => invoice.status === 'sent')
  return {
    draftedCents: sum((invoice) => invoice.status === 'draft' || invoice.status === 'review'),
    sentCents,
    paidCents: sum((invoice) => invoice.status === 'paid'),
    // Outstanding is what has gone out and not come back: a paid invoice is settled.
    outstandingCents: sentCents,
  }
}

/**
 * Hours in the period that are on no invoice: billable work for a Client that
 * has no invoice this period, and entries that name no Client at all, which
 * can be billed to nobody until she says whose they were.
 */
function monthEndHold(
  entries: readonly MonthEndHoldInput[],
  clients: readonly { id: string; name: string; rateCents: number; roundingMinutes: number }[],
  invoiced: ReadonlySet<string>,
): MonthEndHold {
  let unbilledSeconds = 0
  let unbilledCents = 0
  let noClientCount = 0
  let noClientSeconds = 0
  const suggested = new Set<string>()

  for (const entry of entries) {
    if (entry.seconds <= 0) continue
    // The user's own work is nobody's to bill and is not asked about.
    if (entry.clientId === null && !needsClient(entry)) continue
    if (entry.clientId === null) {
      noClientCount += 1
      noClientSeconds += entry.seconds
      if (entry.suggestedClientId !== null) suggested.add(entry.suggestedClientId)
      continue
    }
    if (!entry.billable || invoiced.has(entry.clientId)) continue
    const client = clients.find((each) => each.id === entry.clientId)
    unbilledSeconds += entry.seconds
    if (client) {
      unbilledCents += amountCents(
        billedMinutes(entry.seconds, client.roundingMinutes),
        client.rateCents,
      )
    }
  }

  // Crazy names a Client for the stray hours only when it thinks the same of
  // every one of them; two guesses are no guess she can act on in one tap.
  const only = suggested.size === 1 ? [...suggested][0]! : null
  const client = only === null ? null : (clients.find((each) => each.id === only) ?? null)
  return {
    unbilledSeconds,
    unbilledCents,
    noClientCount,
    noClientSeconds,
    suggestedClientName: client?.name ?? null,
    suggestedCents:
      client === null
        ? 0
        : amountCents(billedMinutes(noClientSeconds, client.roundingMinutes), client.rateCents),
  }
}

/**
 * One invoice with its lines: what the opened draft shows. Read by id and by
 * `userId`, so an id from somewhere else finds nothing.
 */
export async function readInvoice(
  db: ReadDb,
  userId: string,
  id: string,
  timeZone: string,
): Promise<InvoiceFull | null> {
  const row = await db.invoice.findFirst({
    where: { userId, id },
    include: {
      client: { select: { name: true } },
      lines: { orderBy: { position: 'asc' } },
    },
  })
  if (!row) return null

  const periodStart = startOfDay(row.fromDay, timeZone)
  const periodEnd = startOfDay(addDays(row.toDay, 1), timeZone)
  const entryCount = await db.timeEntry.count({
    where: {
      userId,
      clientId: row.clientId,
      billable: true,
      startedAt: { lt: periodEnd },
      OR: [{ endedAt: null }, { endedAt: { gt: periodStart } }],
    },
  })

  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.client.name,
    number: row.number,
    status: invoiceStatus.parse(row.status),
    arrangement: clientArrangement.parse(row.arrangement),
    currency: row.currency,
    fromDay: row.fromDay,
    toDay: row.toDay,
    issuedDay: row.issuedDay,
    dueDay: row.dueDay,
    totalCents: row.totalCents,
    seconds: row.seconds,
    minutes: row.lines.reduce((total, line) => total + line.minutes, 0),
    rateCents: row.rateCents,
    budgetHours: row.budgetHours,
    overageRateCents: row.overageRateCents,
    roundingMinutes: row.roundingMinutes,
    paymentTermsDays: row.paymentTermsDays,
    lineCount: row.lines.length,
    entryCount,
    lines: row.lines.map((line) => ({
      id: line.id,
      description: line.description,
      projectId: line.projectId,
      seconds: line.seconds,
      minutes: line.minutes,
      rateCents: line.rateCents,
      amountCents: line.amountCents,
      position: line.position,
    })),
  }
}
