import { invoicePeriodName, wallClock } from '@crazy/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { invoicesQuery } from '#/lib/queries'
import { InvoiceDraft } from './InvoiceDraft'
import { InvoiceList } from './InvoiceList'

/**
 * The Invoices half of frame 2b, beside the timesheet. Frame 2b is one page
 * for Time and Invoices; the Shell has a screen for each, so the column the
 * frame draws here is the same two cards the Invoices screen draws, read from
 * the same query — the month's invoices, and the one most in need of her eyes.
 *
 * Nothing here acts: Review opens the invoice on its own screen, which is
 * where sending would live. The Time screen's one solid accent fill is the
 * chosen view, so no button in this column takes it.
 */
export function InvoicesAside({ on }: { on?: string }) {
  const { data } = useSuspenseQuery(invoicesQuery(on))
  const read = data.invoices
  const today = wallClock(new Date(data.now), data.timeZone).day
  return (
    <aside className="time__aside inv__aside">
      <InvoiceList read={read} today={today} heading={`Invoices · ${invoicePeriodName(read.on)}`} />
      {read.open !== null && <InvoiceDraft invoice={read.open} />}
    </aside>
  )
}
