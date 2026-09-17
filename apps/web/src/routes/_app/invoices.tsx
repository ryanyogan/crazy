import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { BillingOff } from '#/features/screens/BillingOff'
import { EmptyScreen } from '#/features/screens/EmptyScreen'
import { shellQuery } from '#/lib/queries'

export const Route = createFileRoute('/_app/invoices')({
  component: InvoicesScreen,
})

function InvoicesScreen() {
  const { data: shell } = useSuspenseQuery(shellQuery)
  return shell.billing ? <EmptyScreen title="Invoices" /> : <BillingOff title="Invoices" />
}
