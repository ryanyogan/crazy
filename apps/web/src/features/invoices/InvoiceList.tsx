import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_NOTES,
  type InvoiceRow,
  type InvoicesRead,
  invoiceDetail,
  invoiceNote,
  moneyShort,
  outLine,
} from '@crazy/shared'
import { Blueprint, NotWired, Tag } from '@crazy/ui'
import { Link } from '@tanstack/react-router'

/** The tone each status wears. The word on the tag says which it is; the tone only helps. */
const TONES = {
  draft: 'neutral',
  review: 'accent',
  sent: 'outline',
  paid: 'accent',
} as const

const PDF_WHY =
  'Crazy cannot render an invoice as a PDF yet. Nothing has been drawn for a Client to read.'

/**
 * Each Client's invoice for the period, as frame 2b's first card lists them:
 * who it is for, where it has got to, what it covers, what it comes to, and
 * what Crazy has to say about how it was put together.
 *
 * The card is drawn in two places — beside the timesheet on the Time screen
 * and on the Invoices screen itself — from the one read model, so the two can
 * never disagree about a figure. Only the Invoices screen may spend the
 * screen's one solid accent fill on the invoice that needs reading.
 */
export function InvoiceList({
  read,
  today,
  accent = false,
  heading,
}: {
  read: InvoicesRead
  /** The user's local day, so "out Friday" is said against the day she is in. */
  today: string
  accent?: boolean
  heading: string
}) {
  const out = outLine(read.invoices, today)
  return (
    <Blueprint
      as="section"
      className={`card inv__list${accent ? ' inv__list--choosing' : ''}`}
      aria-labelledby="inv-list"
    >
      <h2 id="inv-list" className="card-kicker">
        {out === null ? heading : `${heading} · ${out}`}
      </h2>
      {read.invoices.length === 0 ? (
        <p className="inv__none">
          Nothing to invoice for this month. Track billable hours for a Client and their invoice
          will be drafted here.
        </p>
      ) : (
        <ul className="inv__rows">
          {read.invoices.map((invoice) => (
            <InvoiceRowItem
              key={invoice.id}
              invoice={invoice}
              on={read.on}
              open={read.open?.id === invoice.id}
              accent={accent}
            />
          ))}
        </ul>
      )}
    </Blueprint>
  )
}

function InvoiceRowItem({
  invoice,
  on,
  open,
  accent,
}: {
  invoice: InvoiceRow
  on: string
  open: boolean
  accent: boolean
}) {
  // A draft is read before it goes; anything already out is only looked at.
  const unsent = invoice.status === 'draft' || invoice.status === 'review'
  const action = unsent ? 'Review' : 'View'
  const solid = accent && invoice.status === 'review'
  return (
    <li className="inv__row" data-status={invoice.status} data-open={open ? '' : undefined}>
      <span className="inv__client">{invoice.clientName}</span>
      {/* The word on the tag is the status itself, so nobody has to read a
          colour to know where an invoice has got to. */}
      <Tag
        tone={TONES[invoice.status]}
        className="inv__status"
        title={INVOICE_STATUS_NOTES[invoice.status]}
      >
        {INVOICE_STATUS_LABELS[invoice.status]}
      </Tag>
      <span className="inv__detail">{invoiceDetail(invoice)}</span>
      <span className="inv__amount">{moneyShort(invoice.totalCents, invoice.currency)}</span>
      <p className="inv__note">{invoiceNote(invoice)}</p>
      <span className="inv__actions">
        <Link
          to="/invoices"
          search={{ on, open: invoice.id }}
          className={`btn ${solid ? 'btn-primary' : 'btn-secondary'} inv__open`}
        >
          {action}
          <span className="sr-only"> {invoice.clientName}’s invoice</span>
        </Link>
        <NotWired why={PDF_WHY}>
          <button type="button" className="btn btn-ghost inv__pdf">
            Preview PDF
          </button>
        </NotWired>
      </span>
    </li>
  )
}
