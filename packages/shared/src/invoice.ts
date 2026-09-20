import { z } from 'zod'
import { addDays } from './clock'
import { formatTracked } from './timer'
import type { ClientArrangement, Provider } from './todo'

// Invoices (frame 2b's right half): what a Client is billed for a period, the
// lines behind it and the arithmetic that built them. Every figure is an
// integer of cents, minutes or seconds — money never touches a float — and the
// moment is always a parameter, as it is everywhere else in this package.
//
// The rule these functions hold: a draft's lines come from the Client's
// billable Time entries in the period, gathered by Project, each line rounded
// up under the Client's rounding and charged at the Project's own rate where
// it has one, else the Client's. A retainer is charged its fee whatever the
// hours, with anything past its budget at the overage rate.

/** Where an invoice has got to. Nothing moves it between these yet (ticket 21). */
export const INVOICE_STATUSES = ['draft', 'review', 'sent', 'paid'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]
export const invoiceStatus = z.enum(INVOICE_STATUSES)

/**
 * The invoices still in her hands. They follow their Client's terms until they
 * go out; one that has been sent or paid keeps what it was sent under, which is
 * why every invoice copies its terms in the first place.
 */
export const UNSENT_INVOICE_STATUSES = [
  'draft',
  'review',
] as const satisfies readonly InvoiceStatus[]

export const isUnsent = (status: InvoiceStatus): boolean =>
  (UNSENT_INVOICE_STATUSES as readonly InvoiceStatus[]).includes(status)

/** What each status is called on the screen, in her own words. */
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  review: 'Ready to review',
  sent: 'Sent',
  paid: 'Paid',
}

/** The one line that says what a status means, so colour is never the only teller. */
export const INVOICE_STATUS_NOTES: Record<InvoiceStatus, string> = {
  draft: 'Still being put together.',
  review: 'Waiting on you to check it.',
  sent: 'With the Client, not yet paid.',
  paid: 'Settled.',
}

/** The label a line wears where the work belongs to no Project (CONTEXT.md, "One-off"). */
export const ONE_OFF_LINE = 'One-off work'

// ── Money ────────────────────────────────────────────────────────────────────

/*
 * One place formats money, and it is told which currency by the row it is
 * formatting. The locale is fixed rather than the reader's: an invoice must
 * read the same to her and to the Client she sends it to, and a machine in
 * another locale must not quietly re-punctuate a figure she has to explain.
 */
const LOCALE = 'en-US'

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string, cents: boolean): Intl.NumberFormat {
  const key = `${currency}/${cents}`
  const held = formatters.get(key)
  if (held) return held
  const made = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })
  formatters.set(key, made)
  return made
}

/** "$5,880.00": an amount with its cents, which is how a total is read out. */
export function money(cents: number, currency: string): string {
  return formatter(currency, true).format(cents / 100)
}

/**
 * "$5,880", or "$5,880.25" where there are cents to say. A list of amounts
 * reads more easily without two zeros on every row, and an amount that is not
 * a whole one is never rounded away.
 */
export function moneyShort(cents: number, currency: string): string {
  return cents % 100 === 0 ? formatter(currency, false).format(cents / 100) : money(cents, currency)
}

// ── Hours ────────────────────────────────────────────────────────────────────

/** Two decimals with a pointless trailing zero dropped: 19.50 reads "19.5". */
function trim(value: string): string {
  return value.endsWith('0') ? value.slice(0, -1) : value
}

/** "19.5": the hours a line bills, as an invoice counts them. */
export function billedHours(minutes: number): string {
  return trim((Math.max(0, minutes) / 60).toFixed(2))
}

/** "17.8": hours as a gauge rather than a bill — what a retainer has used up. */
export function usedHours(seconds: number): string {
  return (Math.max(0, seconds) / 3600).toFixed(1)
}

/**
 * The minutes an invoice bills for a span of tracked seconds: rounded **up** to
 * the Client's increment. A rounding of a minute or less is the seconds rounded
 * up to the minute, which is what "no rounding" means on a bill.
 */
export function billedMinutes(seconds: number, roundingMinutes: number): number {
  const minutes = Math.ceil(Math.max(0, seconds) / 60)
  if (roundingMinutes <= 1) return minutes
  return Math.ceil(minutes / roundingMinutes) * roundingMinutes
}

/** What a span of billed minutes comes to at a rate, in whole cents. */
export function amountCents(minutes: number, rateCents: number): number {
  return Math.round((minutes * rateCents) / 60)
}

/** The local day an invoice falls due: the day it was issued plus its terms. */
export function dueDay(issuedDay: string, paymentTermsDays: number): string {
  return addDays(issuedDay, paymentTermsDays)
}

// ── Building a draft ─────────────────────────────────────────────────────────

/** A Time entry as the arithmetic sees one: a span, and whether it is billable. */
export interface DraftEntry {
  id: string
  projectId: string | null
  billable: boolean
  startedAt: string
  /** Null while it runs; the running spell counts up to the moment handed in. */
  endedAt: string | null
}

/** A Project as a line names one, with its own rate where it overrides the Client's. */
export interface DraftProject {
  id: string
  name: string
  /** Per hour, in cents; null where the Project is charged at the Client's rate. */
  rateCents: number | null
}

/** The terms an invoice is built under, as the invoice itself records them. */
export interface InvoiceTerms {
  arrangement: ClientArrangement
  /** Per hour, in cents. */
  rateCents: number
  /** Per hour past a retainer's budget, in cents; null falls back to the rate. */
  overageRateCents: number | null
  roundingMinutes: number
  paymentTermsDays: number
  /** The budget or retainer in hours, where the arrangement has one. */
  budgetHours: number | null
  currency: string
}

/** One line of a draft, before it is a row. */
export interface DraftLine {
  description: string
  projectId: string | null
  /** The seconds actually tracked behind it, and the minutes it bills. */
  seconds: number
  minutes: number
  rateCents: number
  amountCents: number
  position: number
}

/** What a draft came to: its lines, and the totals that are the sum of them. */
export interface InvoiceDraft {
  lines: DraftLine[]
  /** The sum of the lines' amounts, so a total can never disagree with them. */
  totalCents: number
  /** Seconds actually tracked behind the invoice. */
  seconds: number
  /** Minutes billed, which is the tracked seconds under the rounding rule. */
  minutes: number
}

/** The seconds of a span that fall inside a window, counted no further than now. */
export function secondsIn(
  entry: Pick<DraftEntry, 'startedAt' | 'endedAt'>,
  from: Date,
  to: Date,
  now: Date,
): number {
  const start = Math.max(new Date(entry.startedAt).getTime(), from.getTime())
  const until = Math.min(
    entry.endedAt === null ? now.getTime() : new Date(entry.endedAt).getTime(),
    now.getTime(),
    to.getTime(),
  )
  return Math.max(0, Math.floor((until - start) / 1000))
}

export interface DraftInput {
  /** This Client's Time entries; anything not billable is left out here. */
  entries: readonly DraftEntry[]
  projects: readonly DraftProject[]
  terms: InvoiceTerms
  /** The period's first moment and the moment after its last day. */
  from: Date
  to: Date
  /** The moment the draft is taken at: a running spell counts up to it and no further. */
  now: Date
}

/**
 * A Client's draft for a period, built from their Time entries.
 *
 * The work is gathered by Project — one line per Project, the biggest first —
 * because that is what a Client recognises on a bill and what she can talk
 * through. **Each line is rounded once, after the gathering**, so the hours on
 * a line are the hours worked on that Project rounded up to the Client's
 * increment; rounding every spell separately would charge the increment many
 * times over for the same afternoon's work.
 *
 * A retainer is not gathered at all: its fee is owed whatever the hours, so it
 * is one line for the retainer and, past its budget, a second at the overage
 * rate. Time entries that are not billable, and time that belongs to another
 * Client, never reach here.
 */
export function draftInvoice(input: DraftInput): InvoiceDraft {
  const { entries, projects, terms, from, to, now } = input

  const held: { projectId: string | null; seconds: number }[] = []
  let seconds = 0
  for (const entry of entries) {
    if (!entry.billable) continue
    const spent = secondsIn(entry, from, to, now)
    if (spent <= 0) continue
    seconds += spent
    const found = held.find((each) => each.projectId === entry.projectId)
    if (found) found.seconds += spent
    else held.push({ projectId: entry.projectId, seconds: spent })
  }

  const lines =
    terms.arrangement === 'retainer' && terms.budgetHours !== null
      ? retainerLines(seconds, terms)
      : projectLines(held, projects, terms)

  return {
    lines,
    totalCents: lines.reduce((total, line) => total + line.amountCents, 0),
    seconds,
    minutes: lines.reduce((total, line) => total + line.minutes, 0),
  }
}

/** One line per Project, the most hours first, each rounded once and priced once. */
function projectLines(
  held: readonly { projectId: string | null; seconds: number }[],
  projects: readonly DraftProject[],
  terms: InvoiceTerms,
): DraftLine[] {
  const named = held.map((group) => {
    const project = projects.find((each) => each.id === group.projectId)
    return {
      ...group,
      description: project?.name ?? ONE_OFF_LINE,
      rateCents: project?.rateCents ?? terms.rateCents,
    }
  })
  // The biggest piece of work first; two of a size read in the order a person
  // would list them, so that the same timesheet always draws the same invoice.
  named.sort((a, b) => b.seconds - a.seconds || a.description.localeCompare(b.description))

  return named.map((group, position) => {
    const minutes = billedMinutes(group.seconds, terms.roundingMinutes)
    return {
      description: group.description,
      projectId: group.projectId,
      seconds: group.seconds,
      minutes,
      rateCents: group.rateCents,
      amountCents: amountCents(minutes, group.rateCents),
      position,
    }
  })
}

/** The retainer's fee, and the hours past it at the overage rate. */
function retainerLines(seconds: number, terms: InvoiceTerms): DraftLine[] {
  const budgetHours = terms.budgetHours ?? 0
  const budgetMinutes = budgetHours * 60
  const billed = billedMinutes(seconds, terms.roundingMinutes)
  const overMinutes = Math.max(0, billed - budgetMinutes)
  const overRate = terms.overageRateCents ?? terms.rateCents

  const lines: DraftLine[] = [
    {
      description: `Monthly retainer · ${budgetHours}h`,
      projectId: null,
      // The retainer is owed whatever the hours, so the fee is the budget's,
      // and the seconds beside it are what was actually worked against it.
      seconds: Math.min(seconds, budgetMinutes * 60),
      minutes: budgetMinutes,
      rateCents: terms.rateCents,
      amountCents: amountCents(budgetMinutes, terms.rateCents),
      position: 0,
    },
  ]
  if (overMinutes > 0) {
    lines.push({
      description: 'Hours past the retainer',
      projectId: null,
      seconds: Math.max(0, seconds - budgetMinutes * 60),
      minutes: overMinutes,
      rateCents: overRate,
      amountCents: amountCents(overMinutes, overRate),
      position: 1,
    })
  }
  return lines
}

// ── What an invoice is read as ───────────────────────────────────────────────

/** One Client's invoice for the period, as the list draws a row of it. */
export interface InvoiceRow {
  id: string
  clientId: string
  clientName: string
  number: string
  status: InvoiceStatus
  arrangement: ClientArrangement
  currency: string
  fromDay: string
  toDay: string
  issuedDay: string
  dueDay: string
  totalCents: number
  /** Seconds tracked behind it, and the minutes it bills once rounded. */
  seconds: number
  minutes: number
  rateCents: number
  budgetHours: number | null
  overageRateCents: number | null
  roundingMinutes: number
  paymentTermsDays: number
  lineCount: number
  /** How many of the period's Time entries went into it. */
  entryCount: number
}

/** One line of an invoice, as the opened draft lists it. */
export interface InvoiceLineRow {
  id: string
  description: string
  projectId: string | null
  seconds: number
  minutes: number
  rateCents: number
  amountCents: number
  position: number
}

/** One invoice with its lines: what the opened draft shows. */
export interface InvoiceFull extends InvoiceRow {
  lines: InvoiceLineRow[]
}

/** What the period's invoices come to, by where each of them has got to. */
export interface InvoiceTotals {
  /** Drafts and invoices waiting to be checked: what is still to go out. */
  draftedCents: number
  sentCents: number
  paidCents: number
  /** Sent and not yet paid: what she is waiting on. */
  outstandingCents: number
}

/**
 * What month-end is waiting on: hours that cannot go on a bill yet. Both are
 * the reason a total is lower than it should be, which is the thing she needs
 * told before she sends anything.
 */
export interface MonthEndHold {
  /** Billable seconds in the period for a Client with no invoice in it. */
  unbilledSeconds: number
  /** What those hours are worth at their Clients' rates. */
  unbilledCents: number
  /** Entries in the period that name no Client: hours that can be billed to nobody. */
  noClientCount: number
  noClientSeconds: number
  /** Who Crazy thinks those hours were for, where it thinks the same of all of them. */
  suggestedClientName: string | null
  /** What they would add if that guess were confirmed. */
  suggestedCents: number
}

/** One of the period's Time entries, as the hold is counted over them. */
export interface MonthEndHoldInput {
  clientId: string | null
  projectId: string | null
  billable: boolean
  suggestedClientId: string | null
  /** The seconds of it that fell inside the period, counted no further than now. */
  seconds: number
}

/** The Invoices screen's read model: one period of a user's invoices. */
export interface InvoicesRead {
  /** The local day the period is anchored on, and the period's first and last day. */
  on: string
  from: string
  to: string
  invoices: InvoiceRow[]
  /**
   * The invoice that is open, with its lines: the one the URL names, and
   * failing that the one most in need of her eyes. Null in a period with none.
   */
  open: InvoiceFull | null
  totals: InvoiceTotals
  hold: MonthEndHold
  /** The currency the period's figures are added up in. */
  currency: string
  /**
   * The billing and accounting Providers the user has a Connection to, so that
   * "sync to" on an opened invoice says what the Integrations screen says
   * (`invoiceSyncTargets`) rather than the two screens keeping their own lists.
   */
  billingConnections: Provider[]
}

/**
 * Which invoice a period opens on when the URL names none: the one waiting to
 * be checked, else the first still being put together, else the first there is.
 * Month-end is a queue, and this is the front of it.
 */
export function invoiceToOpen(invoices: readonly InvoiceRow[]): InvoiceRow | null {
  return (
    invoices.find((invoice) => invoice.status === 'review') ??
    invoices.find((invoice) => invoice.status === 'draft') ??
    invoices[0] ??
    null
  )
}

// ── The words the screen says ────────────────────────────────────────────────

const MONTH_LONG = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'long' })
const MONTH_SHORT = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'short' })
const WEEKDAY_LONG = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'long' })

const asDate = (day: string) => new Date(`${day}T00:00:00Z`)

/** "September": what the screen's heading names after "Invoices · ". */
export function invoicePeriodName(on: string): string {
  return MONTH_LONG.format(asDate(on))
}

/** "1–30 Sep": the span an invoice bills, said the way a Client reads it. */
export function invoicePeriodLabel(fromDay: string, toDay: string): string {
  const from = asDate(fromDay)
  const to = asDate(toDay)
  const month = MONTH_SHORT.format(to)
  return from.getUTCMonth() === to.getUTCMonth()
    ? `${from.getUTCDate()}–${to.getUTCDate()} ${month}`
    : `${from.getUTCDate()} ${MONTH_SHORT.format(from)}–${to.getUTCDate()} ${month}`
}

/** "30 Sep": one local day, said short. */
export function dayLabel(day: string): string {
  const date = asDate(day)
  return `${date.getUTCDate()} ${MONTH_SHORT.format(date)}`
}

/**
 * When the next of the period's invoices goes out, as the card's kicker says
 * it: a weekday while it is within the week ahead, a date otherwise, and
 * nothing at all once everything has gone.
 */
export function outLine(invoices: readonly InvoiceRow[], today: string): string | null {
  const days = invoices
    .filter((invoice) => invoice.status === 'draft' || invoice.status === 'review')
    .map((invoice) => invoice.issuedDay)
    .sort()
  const next = days[0]
  if (next === undefined) return null
  if (next <= today) return 'out today'
  // Near enough that a weekday still names one day and not two.
  const withinTheWeek = next <= addDays(today, 6)
  return withinTheWeek ? `out ${WEEKDAY_LONG.format(asDate(next))}` : `out ${dayLabel(next)}`
}

/**
 * The line under a Client's name in the list: what this invoice is, in the
 * terms that Client is on. A project fee or an hourly Client reads hours; a
 * retainer reads how much of the retainer has gone, because the fee is the
 * same either way and the hours are the thing worth watching.
 */
export function invoiceDetail(invoice: InvoiceRow): string {
  switch (invoice.arrangement) {
    case 'project_fee':
      return `${invoice.number} · ${invoicePeriodLabel(invoice.fromDay, invoice.toDay)} · ${billedHours(invoice.minutes)}h`
    case 'hourly':
      return `Hourly · ${billedHours(invoice.minutes)}h so far`
    case 'retainer':
      return invoice.budgetHours === null
        ? `Retainer · ${usedHours(invoice.seconds)}h used`
        : `Fixed · ${invoice.budgetHours}h/mo · ${usedHours(invoice.seconds)}h used`
  }
}

/** "$210/h", as the terms are said in a line rather than a table. */
export function rateLabel(rateCents: number, currency: string): string {
  return `${moneyShort(rateCents, currency)}/h`
}

/** "Net 30", or "Due on receipt" where there are no days to wait. */
export function termsLabel(paymentTermsDays: number): string {
  return paymentTermsDays === 0 ? 'Due on receipt' : `Net ${paymentTermsDays}`
}

/**
 * How this invoice was built, in the sentences she could read to a Client:
 * what was gathered into what, how the hours were rounded, what they were
 * charged at, and when it falls due. Every sentence is about this invoice's
 * own terms — nothing here is a general statement about invoices.
 */
export function explainInvoice(invoice: InvoiceFull): string[] {
  const { currency } = invoice
  const said: string[] = []

  if (invoice.arrangement === 'retainer' && invoice.budgetHours !== null) {
    const over = invoice.lines.find((line) => line.position === 1)
    said.push(
      `${invoice.clientName} is on a retainer: ${invoice.budgetHours} hours a month at ${rateLabel(invoice.rateCents, currency)}, owed whether or not the hours are used.`,
    )
    said.push(
      over
        ? `${formatTracked(invoice.seconds)} tracked this period, which is ${billedHours(over.minutes)}h past the retainer, charged at ${rateLabel(over.rateCents, currency)}.`
        : `${formatTracked(invoice.seconds)} tracked this period, so nothing is past the retainer.`,
    )
  } else {
    const lines = invoice.lineCount
    said.push(
      `I gathered ${invoice.entryCount} ${invoice.entryCount === 1 ? 'Time entry' : 'Time entries'} into ${lines === 1 ? 'one line' : `${lines} lines`}, one for each Project.`,
    )
    said.push(
      invoice.roundingMinutes <= 1
        ? "Each line's hours are billed to the minute; your terms ask for no rounding."
        : `Each line's hours are rounded up to the nearest ${invoice.roundingMinutes} minutes, which is what your terms ask for.`,
    )
    said.push(ratesSentence(invoice))
  }

  said.push(
    `${termsLabel(invoice.paymentTermsDays)}: issued ${dayLabel(invoice.issuedDay)}, due ${dayLabel(invoice.dueDay)}.`,
  )
  return said
}

/** What the lines were charged at: the Client's rate, and any Project on its own. */
function ratesSentence(invoice: InvoiceFull): string {
  const own = invoice.lines.filter((line) => line.rateCents !== invoice.rateCents)
  const base = `The hours are charged at ${rateLabel(invoice.rateCents, invoice.currency)}`
  if (own.length === 0) return `${base}.`
  const named = own
    .map((line) => `${line.description} at ${rateLabel(line.rateCents, invoice.currency)}`)
    .join(', ')
  return `${base}, except ${named}, which ${own.length === 1 ? 'has a rate' : 'have rates'} of its own.`
}

/**
 * What Crazy has to say about one invoice in the list: the short sentence under
 * its amount. It says only what this invoice's own rows say.
 */
export function invoiceNote(invoice: InvoiceRow): string {
  if (invoice.arrangement === 'retainer' && invoice.budgetHours !== null) {
    const left = invoice.budgetHours * 3600 - invoice.seconds
    return left >= 0
      ? `The fee is fixed; ${formatTracked(left)} of the retainer is still unused, and I will flag an overage before anything goes out.`
      : `${formatTracked(-left)} past the retainer, charged at ${rateLabel(invoice.overageRateCents ?? invoice.rateCents, invoice.currency)}.`
  }
  const rounding =
    invoice.roundingMinutes <= 1
      ? 'billed to the minute'
      : `rounded up to ${invoice.roundingMinutes} min`
  return `I gathered ${invoice.entryCount} ${invoice.entryCount === 1 ? 'entry' : 'entries'} into ${invoice.lineCount === 1 ? '1 line' : `${invoice.lineCount} lines`} by Project, ${rounding} under your ${invoice.clientName} terms.`
}

/**
 * What is holding month-end up, in one sentence, or null when nothing is. The
 * hours that name no Client come first: they are the ones a tap can fix.
 */
export function holdLine(hold: MonthEndHold, currency: string): string | null {
  const said: string[] = []
  if (hold.noClientCount > 0) {
    const count = hold.noClientCount
    const worth =
      hold.suggestedClientName === null
        ? 'Give each one a Client so its hours can be billed.'
        : `I think they were ${hold.suggestedClientName}, which would add ${moneyShort(hold.suggestedCents, currency)}.`
    said.push(
      `${count} ${count === 1 ? 'entry names' : 'entries name'} no Client (${formatTracked(hold.noClientSeconds)}). ${worth}`,
    )
  }
  if (hold.unbilledSeconds > 0) {
    said.push(
      `${formatTracked(hold.unbilledSeconds)} of billable work is on no invoice yet, worth ${moneyShort(hold.unbilledCents, currency)}.`,
    )
  }
  return said.length === 0 ? null : said.join(' ')
}
