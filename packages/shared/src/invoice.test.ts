import { expect, it } from 'vite-plus/test'
import { localTimeToInstant } from './clock'
import {
  type DraftEntry,
  type DraftProject,
  type InvoiceFull,
  type InvoiceTerms,
  amountCents,
  billedHours,
  billedMinutes,
  draftInvoice,
  dueDay,
  explainInvoice,
  invoiceDetail,
  money,
  moneyShort,
} from './invoice'

// Cori's terms, as frame 2c writes them and the seed holds them.
const timeZone = 'America/Chicago'
const at = (local: string) => localTimeToInstant(local, timeZone)!
const now = at('2025-09-17T10:42')
const from = at('2025-09-01T00:00')
const to = at('2025-10-01T00:00')

const MERIDIAN: InvoiceTerms = {
  arrangement: 'project_fee',
  rateCents: 210_00,
  overageRateCents: null,
  roundingMinutes: 15,
  paymentTermsDays: 30,
  budgetHours: 40,
  currency: 'USD',
}

const BRAMBLE: InvoiceTerms = {
  arrangement: 'retainer',
  rateCents: 180_00,
  overageRateCents: 200_00,
  roundingMinutes: 15,
  paymentTermsDays: 30,
  budgetHours: 20,
  currency: 'USD',
}

const PROJECTS: DraftProject[] = [
  { id: 'discovery', name: 'Discovery research', rateCents: null },
  { id: 'workshops', name: 'Stakeholder workshops', rateCents: null },
  { id: 'onboarding', name: 'Onboarding v3', rateCents: null },
]

let next = 0
const entry = (
  day: string,
  fromTime: string,
  untilTime: string | null,
  projectId: string | null,
  billable = true,
): DraftEntry => ({
  id: `entry-${next++}`,
  projectId,
  billable,
  startedAt: at(`${day}T${fromTime}`).toISOString(),
  endedAt: untilTime === null ? null : at(`${day}T${untilTime}`).toISOString(),
})

const draft = (entries: DraftEntry[], terms = MERIDIAN, projects = PROJECTS) =>
  draftInvoice({ entries, projects, terms, from, to, now })

it('rounds each line up to the Client increment, once, after the gathering', () => {
  // 1h50m and 1h05m on the same Project is 2h55m, which bills as 3h — not the
  // 2h + 1h15m that rounding each spell separately would have charged.
  const made = draft([
    entry('2025-09-08', '09:00', '10:50', 'discovery'),
    entry('2025-09-09', '09:00', '10:05', 'discovery'),
  ])

  expect(made.lines).toHaveLength(1)
  expect(made.lines[0]!.seconds).toBe((110 + 65) * 60)
  expect(made.lines[0]!.minutes).toBe(180)
  expect(billedHours(made.lines[0]!.minutes)).toBe('3.0')
  expect(made.totalCents).toBe(630_00)
})

it('gathers one line per Project, the most hours first, and totals the lines', () => {
  const made = draft([
    entry('2025-09-08', '09:00', '12:00', 'workshops'),
    entry('2025-09-09', '09:00', '13:00', 'discovery'),
    entry('2025-09-10', '09:00', '11:00', 'discovery'),
  ])

  expect(made.lines.map((line) => [line.description, billedHours(line.minutes)])).toEqual([
    ['Discovery research', '6.0'],
    ['Stakeholder workshops', '3.0'],
  ])
  // The total is the sum of the lines, so cents can never drift away from them.
  expect(made.totalCents).toBe(made.lines.reduce((sum, line) => sum + line.amountCents, 0))
  expect(made.totalCents).toBe(1890_00)
  expect(made.minutes).toBe(540)
})

it('charges a Project at its own rate where it has one, and the Client rate otherwise', () => {
  const made = draft(
    [
      entry('2025-09-08', '09:00', '11:00', 'discovery'),
      entry('2025-09-09', '09:00', '11:00', 'workshops'),
    ],
    MERIDIAN,
    [
      { id: 'discovery', name: 'Discovery research', rateCents: 250_00 },
      { id: 'workshops', name: 'Stakeholder workshops', rateCents: null },
    ],
  )

  expect(made.lines.map((line) => [line.rateCents, line.amountCents])).toEqual([
    [250_00, 500_00],
    [210_00, 420_00],
  ])
  expect(made.totalCents).toBe(920_00)
})

it('leaves out what is not billable, and work that belongs to no Project is a One-off line', () => {
  const made = draft([
    entry('2025-09-08', '09:00', '11:00', 'discovery'),
    entry('2025-09-08', '13:00', '15:00', 'discovery', false),
    entry('2025-09-09', '09:00', '10:00', null),
  ])

  expect(made.lines.map((line) => line.description)).toEqual(['Discovery research', 'One-off work'])
  expect(made.seconds).toBe(3 * 3600)
  expect(made.totalCents).toBe(630_00)
})

it('counts a running spell up to the moment handed in and no further', () => {
  // Begun at 09:00 and still going at 10:42: 1h42m, which bills as 1h45m.
  const made = draft([entry('2025-09-17', '09:00', null, 'discovery')])

  expect(made.seconds).toBe(102 * 60)
  expect(made.lines[0]!.minutes).toBe(105)
  expect(made.totalCents).toBe(367_50)
})

it('bills a retainer its fee whatever the hours, and the overage past it', () => {
  const under = draftInvoice({
    entries: [entry('2025-09-08', '09:00', '17:00', 'onboarding')],
    projects: PROJECTS,
    terms: BRAMBLE,
    from,
    to,
    now,
  })
  expect(under.lines.map((line) => line.description)).toEqual(['Monthly retainer · 20h'])
  expect(under.totalCents).toBe(3600_00)

  // 22h on the retainer: 20h at $180 and 2h at the $200 overage rate.
  const over = draftInvoice({
    entries: [
      entry('2025-09-08', '09:00', '17:00', 'onboarding'),
      entry('2025-09-09', '09:00', '17:00', 'onboarding'),
      entry('2025-09-10', '09:00', '15:00', 'onboarding'),
    ],
    projects: PROJECTS,
    terms: BRAMBLE,
    from,
    to,
    now,
  })
  expect(over.lines.map((line) => [line.description, line.minutes, line.amountCents])).toEqual([
    ['Monthly retainer · 20h', 1200, 3600_00],
    ['Hours past the retainer', 120, 400_00],
  ])
  expect(over.totalCents).toBe(4000_00)
  expect(over.totalCents).toBe(over.lines.reduce((sum, line) => sum + line.amountCents, 0))
})

it('falls due the payment terms after the day it is issued, counted in days', () => {
  expect(dueDay('2025-09-19', 30)).toBe('2025-10-19')
  expect(dueDay('2025-09-19', 15)).toBe('2025-10-04')
  expect(dueDay('2025-10-01', 30)).toBe('2025-10-31')
  // Across a year, and across the end of a month with 28 days.
  expect(dueDay('2025-12-20', 30)).toBe('2026-01-19')
  expect(dueDay('2026-02-01', 30)).toBe('2026-03-03')
})

it('never lets a rounding or a rate leave money in a float', () => {
  // A six-minute increment at an odd rate: every figure lands on a whole cent.
  expect(billedMinutes(61 * 60, 6)).toBe(66)
  expect(amountCents(66, 193_33)).toBe(21266)
  expect(Number.isInteger(amountCents(66, 193_33))).toBe(true)
  expect(billedMinutes(0, 15)).toBe(0)
  // No rounding at all is the seconds rounded up to the minute.
  expect(billedMinutes(61, 1)).toBe(2)
})

it('says money in the currency of the row, with cents only where there are cents', () => {
  expect(money(588_000, 'USD')).toBe('$5,880.00')
  expect(moneyShort(588_000, 'USD')).toBe('$5,880')
  expect(moneyShort(588_025, 'USD')).toBe('$5,880.25')
  expect(moneyShort(588_000, 'EUR')).toBe('€5,880')
})

const FULL: InvoiceFull = {
  id: 'invoice',
  clientId: 'meridian',
  clientName: 'Meridian Health',
  number: 'INV-0042',
  status: 'review',
  arrangement: 'project_fee',
  currency: 'USD',
  fromDay: '2025-09-01',
  toDay: '2025-09-30',
  issuedDay: '2025-09-19',
  dueDay: '2025-10-19',
  totalCents: 5880_00,
  seconds: 100_620,
  minutes: 1680,
  rateCents: 210_00,
  budgetHours: 40,
  overageRateCents: null,
  roundingMinutes: 15,
  paymentTermsDays: 30,
  lineCount: 2,
  entryCount: 9,
  lines: [
    {
      id: 'a',
      description: 'Discovery research',
      projectId: 'discovery',
      seconds: 79_020,
      minutes: 1320,
      rateCents: 210_00,
      amountCents: 4620_00,
      position: 0,
    },
    {
      id: 'b',
      description: 'Stakeholder workshops',
      projectId: 'workshops',
      seconds: 21_600,
      minutes: 360,
      rateCents: 210_00,
      amountCents: 1260_00,
      position: 1,
    },
  ],
}

it('explains how it was built in sentences a Client could be read', () => {
  expect(explainInvoice(FULL)).toEqual([
    'I gathered 9 Time entries into 2 lines, one for each Project.',
    "Each line's hours are rounded up to the nearest 15 minutes, which is what your terms ask for.",
    'The hours are charged at $210/h.',
    'Net 30: issued 19 Sep, due 19 Oct.',
  ])
  expect(invoiceDetail(FULL)).toBe('INV-0042 · 1–30 Sep · 28.0h')
})
