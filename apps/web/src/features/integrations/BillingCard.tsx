import { Blueprint } from '@crazy/ui'
import { useCommand } from '#/lib/useCommand'

/**
 * The Billing module's switch. No frame draws where it lives (docs/BRIEF.md):
 * it sits under Realtime, beside the other things a user sets once. Turning it
 * on gives the Shell Time and Invoices at once; turning it off loses nothing.
 */
export function BillingCard({ on }: { on: boolean }) {
  const command = useCommand()

  return (
    <Blueprint as="section" className="card billing" aria-labelledby="billing-title">
      <h2 id="billing-title" className="card-kicker">
        Billing module
      </h2>
      <div className="setting">
        <span id="billing-switch">Timer, Time entries, Clients and invoices</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="billing-switch"
          className="switch switch--live"
          onClick={() => command.mutate({ type: 'billing.set', on: !on })}
        />
      </div>
      <p className="realtime__note">
        {on
          ? 'On. Time and Invoices are in the Shell. Turning it off hides them and keeps everything you have tracked.'
          : 'Off. Turn it on if you bill for your time.'}
      </p>
    </Blueprint>
  )
}
