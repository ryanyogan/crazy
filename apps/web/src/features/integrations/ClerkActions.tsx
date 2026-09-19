import { useClerk, useUser } from '@clerk/tanstack-react-start'
import { type Provider, READ_SCOPES, clerkStrategy } from '@crazy/shared'
import { Button } from '@crazy/ui'
import { useState } from 'react'
import { notify } from '#/lib/notices'

// Everything here needs Clerk mounted, so it is rendered only when Clerk is
// configured. Connect is Clerk's add-external-account flow (ADR 0001): Clerk
// holds what comes of it, and Crazy learns the external account's id and no more.

/** Where Clerk sends the user back to; the screen's loader makes the Connection then. */
const BACK_TO = '/integrations'

interface ConnectProps {
  provider: Provider
  name: string
  /** True when the user already has a Connection here: they are adding another account. */
  another: boolean
}

export function ConnectButton({ provider, name, another }: ConnectProps) {
  const { user } = useUser()
  const [leaving, setLeaving] = useState(false)

  const connect = async () => {
    if (!user) return
    setLeaving(true)
    try {
      const account = await user.createExternalAccount({
        strategy: clerkStrategy(provider),
        redirectUrl: BACK_TO,
        additionalScopes: [...READ_SCOPES[provider]],
        // A second account is only a second account if the Provider asks which.
        ...(another ? { oidcPrompt: 'select_account' } : {}),
      })
      const url = account.verification?.externalVerificationRedirectURL
      if (url) window.location.assign(url.href)
      else setLeaving(false)
    } catch (error) {
      setLeaving(false)
      notify(error instanceof Error ? error.message : `${name} could not be reached through Clerk.`)
    }
  }

  return (
    <Button variant="plain" className="provider__action" onClick={connect} disabled={leaving}>
      {leaving ? 'Opening…' : another ? 'Connect another account' : 'Connect'}
      <span className="sr-only"> {another ? `at ${name}` : name}</span>
    </Button>
  )
}

/** A Connection Clerk reports as lapsed is authorised again by the same flow. */
export function ReauthoriseButton({
  externalAccountId,
  provider,
  name,
}: {
  externalAccountId: string
  provider: Provider
  name: string
}) {
  const { user } = useUser()
  const account = user?.externalAccounts.find((each) => each.id === externalAccountId)
  // Clerk no longer has the account: there is nothing to authorise again, only to connect.
  if (!account) return <ConnectButton provider={provider} name={name} another={false} />

  const reauthorise = async () => {
    try {
      const again = await account.reauthorize({
        redirectUrl: BACK_TO,
        additionalScopes: [...READ_SCOPES[provider]],
      })
      const url = again.verification?.externalVerificationRedirectURL
      if (url) window.location.assign(url.href)
    } catch (error) {
      notify(error instanceof Error ? error.message : `${name} could not be reached through Clerk.`)
    }
  }

  return (
    <Button variant="plain" className="provider__action" onClick={reauthorise}>
      Authorise again<span className="sr-only"> {name}</span>
    </Button>
  )
}

export function ManageAccountButton() {
  const clerk = useClerk()
  return (
    <Button className="account__manage" onClick={() => clerk.openUserProfile()}>
      Manage account
    </Button>
  )
}
