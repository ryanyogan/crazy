import {
  type DraftEntry,
  type DraftProject,
  billedHours,
  draftInvoice,
  holdLine,
  invoiceDetail,
  localTimeToInstant,
  money,
  moneyShort,
  startOfDay,
} from '@crazy/shared'
import { env } from 'cloudflare:test'
import { beforeAll, expect, it } from 'vite-plus/test'
import { createReadDb } from '../index'
import { createDb, seedPersona } from '../write'
import { readInvoice, readInvoices } from './invoices'
import { readTime } from './time'

// Frame 2b's moment: Wednesday 17 Sep 2025, 10:42 on Cori's wall clock, with
// September's invoices behind it.
const timeZone = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, timeZone)!
const now = at('2025-09-17T10:42')
const userId = 'user_cori_invoices'

const db = () => createReadDb(env.DB)
const read = (on?: string) => readInvoices(db(), userId, now, timeZone, on)

beforeAll(async () => {
  await seedPersona(createDb(env.DB), { persona: 'cori', userId, now, timeZone })
})

it('reads one invoice per Client for the month, with frame 2b own figures', async () => {
  const period = await read()
  expect({ from: period.from, to: period.to }).toEqual({ from: '2025-09-01', to: '2025-09-30' })

  expect(
    period.invoices.map((invoice) => [
      invoice.clientName,
      invoice.status,
      invoiceDetail(invoice),
      moneyShort(invoice.totalCents, invoice.currency),
    ]),
  ).toEqual([
    ['Meridian Health', 'review', 'INV-0042 · 1–30 Sep · 28.0h', '$5,880'],
    ['Quill & Co', 'draft', 'Hourly · 22.5h so far', '$4,275'],
    ['Bramble', 'draft', 'Fixed · 20h/mo · 17.8h used', '$3,600'],
  ])
})

it('adds the period up by where each invoice has got to', async () => {
  const { totals, invoices } = await read()

  // Nothing has ever been sent, because nothing sends one yet (ticket 21).
  expect(totals.draftedCents).toBe(invoices.reduce((sum, each) => sum + each.totalCents, 0))
  expect(money(totals.draftedCents, 'USD')).toBe('$13,755.00')
  expect([totals.sentCents, totals.paidCents, totals.outstandingCents]).toEqual([0, 0, 0])
})

it('says what is holding month-end up: the hours that name no Client', async () => {
  const { hold, currency } = await read()

  // Every billable Client has an invoice this month, so nothing billable is off one.
  expect(hold.unbilledSeconds).toBe(0)
  // Tue 14:00–14:40 and Wed 08:10–08:30, both tracked to Internal (frame 2b).
  expect(hold.noClientCount).toBe(2)
  expect(hold.noClientSeconds).toBe(60 * 60)
  expect(hold.suggestedClientName).toBe('Quill & Co')
  expect(moneyShort(hold.suggestedCents, currency)).toBe('$190')
  expect(holdLine(hold, currency)).toBe(
    '2 entries name no Client (1h 00m). I think they were Quill & Co, which would add $190.',
  )
})

it('has a seeded draft whose lines are what the arithmetic makes of the seeded entries', async () => {
  const period = await read()
  const meridian = period.invoices.find((invoice) => invoice.clientName === 'Meridian Health')!
  const invoice = (await readInvoice(db(), userId, meridian.id, timeZone))!

  // The same period the invoice bills, read off the timesheet rather than the invoice.
  const month = await readTime(db(), userId, now, timeZone, 'month', '2025-09-17')
  const entries: DraftEntry[] = month.rows
    .filter((row) => row.clientId === invoice.clientId)
    .map((row) => ({
      id: row.id,
      projectId: row.projectId,
      billable: row.billable,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
    }))
  const projects: DraftProject[] = month.projects.map((project) => ({
    id: project.id,
    name: project.name,
    rateCents: null,
  }))

  const built = draftInvoice({
    entries,
    projects,
    terms: {
      arrangement: invoice.arrangement,
      rateCents: invoice.rateCents,
      overageRateCents: invoice.overageRateCents,
      roundingMinutes: invoice.roundingMinutes,
      paymentTermsDays: invoice.paymentTermsDays,
      budgetHours: invoice.budgetHours,
      currency: invoice.currency,
    },
    from: startOfDay(invoice.fromDay, timeZone),
    to: startOfDay('2025-10-01', timeZone),
    now,
  })

  // The seeded draft is not a typed-in figure: it is this function over those rows.
  expect(built.totalCents).toBe(invoice.totalCents)
  expect(built.seconds).toBe(invoice.seconds)
  expect(built.lines.map((line) => [line.description, line.minutes, line.amountCents])).toEqual(
    invoice.lines.map((line) => [line.description, line.minutes, line.amountCents]),
  )
  // And it is frame 2b's own draft: 28.0h at $210, net 30, due 19 October.
  expect(billedHours(invoice.minutes)).toBe('28.0')
  expect(money(invoice.totalCents, invoice.currency)).toBe('$5,880.00')
  expect([invoice.issuedDay, invoice.dueDay]).toEqual(['2025-09-19', '2025-10-19'])
  // The total is the sum of the lines to the cent.
  expect(invoice.lines.reduce((sum, line) => sum + line.amountCents, 0)).toBe(invoice.totalCents)
})

it('reads an earlier month as billed and paid, and nothing at all before she began', async () => {
  // Her five weeks before September were invoiced and settled (ticket 22), so
  // nothing older than this month is waiting to go out.
  const august = await read('2025-08-15')
  expect(august.invoices.map((invoice) => invoice.status)).toEqual(['paid', 'paid', 'paid'])
  expect(august.totals.draftedCents).toBe(0)
  expect(august.totals.outstandingCents).toBe(0)
  expect(august.totals.paidCents).toBeGreaterThan(0)
  expect(august.hold.unbilledSeconds).toBe(0)

  // A month before she tracked anything holds nothing at all.
  const june = await read('2025-06-15')
  expect(june.invoices).toEqual([])
  expect(june.totals.draftedCents).toBe(0)
  expect(june.hold.noClientCount).toBe(0)

  // An id is read by userId as well, so one from somewhere else finds nothing.
  const period = await read()
  expect(await readInvoice(db(), 'user_someone_else', period.invoices[0]!.id, timeZone)).toBe(null)
})
