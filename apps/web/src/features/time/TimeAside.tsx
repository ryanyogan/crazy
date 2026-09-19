import { type TimeScreenView, formatTracked } from '@crazy/shared'
import { Blueprint, NotWired, Tag } from '@crazy/ui'

/** Where hours are meant to end up, once Crazy can send them (ticket 23). */
const TARGETS = [
  {
    name: 'QuickBooks',
    why: 'Crazy does not send Time entries to QuickBooks yet. Connecting an accounting Provider comes with the Invoices screen.',
  },
  {
    name: 'Harvest',
    why: 'Harvest cannot be connected yet: it needs an OAuth path Crazy does not have (ADR 0001).',
  },
]

/**
 * What the period came to, beside the timesheet, and where the hours are meant
 * to go next. Frame 2b gives this column to the Invoices half of the page,
 * which is a screen of its own here (ticket 21); until then it holds the two
 * things the Time screen itself can say — the period's figures, and the
 * accounting targets, drawn and plainly not wired, because nothing is faked.
 */
export function TimeAside({ view }: { view: TimeScreenView }) {
  const { totals } = view
  return (
    <aside className="time__aside">
      <Blueprint as="section" className="card time__summary" aria-labelledby="time-summary">
        <h2 id="time-summary" className="card-kicker">
          This period
        </h2>
        <dl className="time__figures">
          <div>
            <dt>Tracked</dt>
            <dd className="time__figure">{formatTracked(totals.seconds)}</dd>
          </div>
          <div>
            <dt>Billable</dt>
            <dd className="time__figure">{formatTracked(totals.billableSeconds)}</dd>
          </div>
          <div>
            <dt>Not billable</dt>
            <dd className="time__figure">{formatTracked(totals.notBillableSeconds)}</dd>
          </div>
        </dl>
        <p className="time__summary-note">
          {totals.noClient === 0
            ? 'Every entry in this period names a Client.'
            : view.flag !== null && `${view.flag} before this period can be invoiced.`}
        </p>
      </Blueprint>

      <Blueprint as="section" className="card time__sync" aria-labelledby="time-sync">
        <h2 id="time-sync" className="card-kicker">
          Synced to
        </h2>
        <div className="time__targets">
          {TARGETS.map((target) => (
            <NotWired key={target.name} why={target.why}>
              <button type="button" className="tag tag-neutral time__target">
                {target.name} · not connected
              </button>
            </NotWired>
          ))}
        </div>
        <p className="card-body">
          Time entries will sync out and paid status will sync back. Nothing has been sent yet.
        </p>
        <NotWired why="Crazy has no accounting Connection to send these hours to yet.">
          <button type="button" className="btn btn-secondary time__send">
            Send this period
          </button>
        </NotWired>
        <Tag tone="outline" className="time__coming">
          Coming with Invoices
        </Tag>
      </Blueprint>
    </aside>
  )
}
