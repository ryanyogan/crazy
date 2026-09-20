import {
  type InvoiceFull,
  type Provider,
  billedHours,
  dayLabel,
  explainInvoice,
  invoiceSyncTargets,
  money,
  moneyShort,
  termsLabel,
} from '@crazy/shared'
import { Blueprint, NotWired, Table } from '@crazy/ui'

const SEND_WHY =
  'Crazy cannot send an invoice yet. It has no accounting or payment Connection to send one through, and it has never sent anything.'

const PDF_WHY =
  'Crazy cannot render an invoice as a PDF yet. Nothing has been drawn for a Client to read.'

/** Said of a target that is connected: there is still nothing that pushes anything to it. */
const SYNC_WHY =
  'Crazy has nothing that pushes an invoice out. A Connection is read-only, and nothing has been sent anywhere.'

/**
 * One invoice opened: its lines, the hours and amount of each, the total with
 * its terms and due date, and the plain sentences saying how it was built —
 * the grouping, the rounding and the rate — which are there so that she can
 * read them straight to the Client who asks.
 *
 * Every figure on it was computed when the invoice was drafted and is read
 * back here; nothing is recounted in a component, and nothing on this card
 * changes anything. Send, Preview PDF and the accounting targets are drawn,
 * disabled and announced as unavailable, because none of them is wired.
 */
export function InvoiceDraft({
  invoice,
  actions = false,
  connected = [],
}: {
  invoice: InvoiceFull
  /** Whether the card carries Send and the accounting targets (the Invoices screen). */
  actions?: boolean
  /** The billing Providers she has a Connection to; the Integrations screen's own rows. */
  connected?: readonly Provider[]
}) {
  const unsent = invoice.status === 'draft' || invoice.status === 'review'
  const targets = invoiceSyncTargets(connected)
  const said = explainInvoice(invoice)
  return (
    <Blueprint as="section" className="card inv__draft" aria-labelledby="inv-draft">
      <h2 id="inv-draft" className="card-kicker">
        {unsent ? 'Invoice draft' : 'Invoice'} · {invoice.clientName} · {invoice.number}
      </h2>

      <Table className="inv__lines">
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col" className="inv__num">
              Hrs
            </th>
            <th scope="col" className="inv__num">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td className="inv__num">{billedHours(line.minutes)}</td>
              <td className="inv__num">{moneyShort(line.amountCents, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>
              Total · {termsLabel(invoice.paymentTermsDays).toLowerCase()} · due{' '}
              {dayLabel(invoice.dueDay)}
            </th>
            <td className="inv__num inv__total">{money(invoice.totalCents, invoice.currency)}</td>
          </tr>
        </tfoot>
      </Table>

      <div className="inv__how">
        <h3 className="inv__how-title">How this was built</h3>
        {said.map((sentence) => (
          <p key={sentence}>{sentence}</p>
        ))}
      </div>

      {actions && (
        <div className="inv__send">
          <NotWired why={SEND_WHY}>
            <button type="button" className="btn btn-secondary">
              Send to {invoice.clientName}
            </button>
          </NotWired>
          <NotWired why={PDF_WHY}>
            <button type="button" className="btn btn-ghost">
              Preview PDF
            </button>
          </NotWired>
        </div>
      )}

      {actions && (
        <div className="inv__sync">
          <h3 className="inv__how-title">Sync to</h3>
          {/* The same Providers the Integrations screen draws, with the same
              word for where each has got to (`invoiceSyncTargets`). */}
          <div className="inv__targets">
            {targets.map((target) => (
              <NotWired key={target.name} why={target.why ?? SYNC_WHY}>
                <button type="button" className="tag tag-neutral inv__target">
                  {target.name} · {target.status}
                </button>
              </NotWired>
            ))}
          </div>
          <p className="inv__how-note">
            An invoice will go out through an accounting Provider and its paid status will come
            back. Crazy has sent nothing anywhere.
          </p>
        </div>
      )}
    </Blueprint>
  )
}
