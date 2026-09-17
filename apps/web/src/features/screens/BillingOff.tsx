import { Link } from '@tanstack/react-router'

/** Time and Invoices exist only with the Billing module on. */
export function BillingOff({ title }: { title: string }) {
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{title}</h1>
        <p className="text-muted">
          {title} is part of the Billing module, which is off. It is turned on from the{' '}
          <Link to="/integrations">Integrations screen</Link>.
        </p>
      </header>
    </div>
  )
}
