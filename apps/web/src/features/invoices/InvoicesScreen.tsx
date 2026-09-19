import {
  holdLine,
  invoicePeriodLabel,
  invoicePeriodName,
  isThisPeriod,
  moneyShort,
  periodStep,
  wallClock,
} from '@crazy/shared'
import { StatTile } from '@crazy/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, getRouteApi } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { invoicesQuery } from '#/lib/queries'
import { InvoiceDraft } from './InvoiceDraft'
import { InvoiceList } from './InvoiceList'

const route = getRouteApi('/_app/invoices')

/**
 * The Invoices screen (frame 2b's right half, given a screen of its own): what
 * is going out this month, to whom, for how much, and what is holding it up.
 * Month-end is a batch job, so the period is a month and the whole of it is on
 * one screen — the figures at the head, a row per Client, and the invoice she
 * is reading beside them.
 *
 * Which month and which invoice are the URL's, so an invoice can be linked to,
 * gone back from and reloaded into. Every figure was computed when the invoice
 * was drafted and is read back; nothing here writes anything, and the three
 * controls that would — Send, Preview PDF and the accounting sync — are drawn,
 * disabled and announced as unavailable.
 */
export function InvoicesScreen() {
  const { on, open } = route.useSearch()
  const navigate = route.useNavigate()
  const { data } = useSuspenseQuery(invoicesQuery(on, open))
  const read = data.invoices
  const now = new Date(data.now)
  const today = wallClock(now, data.timeZone).day
  const anchor = on ?? read.on
  const here = isThisPeriod('month', anchor, now, data.timeZone)
  const hold = holdLine(read.hold, read.currency)

  const go = (next?: string) => void navigate({ search: { on: next, open: undefined } })

  return (
    <div className="screen inv">
      <section className="inv__main" aria-labelledby="inv-title">
        <div className="inv__head">
          <h1 id="inv-title" className="screen__title">
            Invoices · {invoicePeriodName(read.on)}
          </h1>
          <div className="inv__period">
            <button
              type="button"
              className="btn btn-ghost inv__step"
              onClick={() => go(periodStep('month', anchor, -1))}
              aria-label="The month before this one"
            >
              <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost inv__now"
              onClick={() => go(undefined)}
              disabled={here}
            >
              This month
            </button>
            <button
              type="button"
              className="btn btn-ghost inv__step"
              onClick={() => go(periodStep('month', anchor, 1))}
              aria-label="The month after this one"
            >
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>

        <p className="inv__span">{invoicePeriodLabel(read.from, read.to)}</p>

        <ul className="inv__figures">
          <StatTile
            as="li"
            label="Still to go out"
            value={moneyShort(read.totals.draftedCents, read.currency)}
            note="drafts and invoices waiting to be checked"
          />
          <StatTile
            as="li"
            label="Sent"
            value={moneyShort(read.totals.sentCents, read.currency)}
            note="with Clients this period"
          />
          <StatTile
            as="li"
            label="Paid"
            value={moneyShort(read.totals.paidCents, read.currency)}
            note="settled this period"
          />
          <StatTile
            as="li"
            label="Outstanding"
            value={moneyShort(read.totals.outstandingCents, read.currency)}
            note="sent and not yet paid"
          />
        </ul>

        {/* What month-end is waiting on: hours that cannot go on a bill yet,
            and the way straight to the timesheet that holds them. */}
        <div className="inv__hold">
          {hold === null ? (
            <p className="inv__hold-line">
              Nothing is holding this month up: every hour tracked in it is on an invoice or marked
              not billable.
            </p>
          ) : (
            <>
              <p className="inv__hold-line">{hold}</p>
              <Link
                to="/time"
                search={{ view: 'month' as const, on: read.from }}
                className="btn btn-secondary inv__hold-link"
              >
                Put the hours right
              </Link>
            </>
          )}
        </div>

        <InvoiceList
          read={read}
          today={today}
          accent
          heading={`Each Client · ${invoicePeriodName(read.on)}`}
        />
      </section>

      {/* The invoice she is reading. One column on a phone, where it follows
          the list instead of sitting beside it (derived, docs/BRIEF.md). */}
      {read.open !== null && (
        <aside className="inv__aside">
          <InvoiceDraft invoice={read.open} actions />
        </aside>
      )}
    </div>
  )
}
