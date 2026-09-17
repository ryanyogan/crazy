import { useSignIn, useSignUp } from '@clerk/tanstack-react-start'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { type Provider, SignInScreen } from './SignInScreen'

const OAUTH = { google: 'oauth_google', github: 'oauth_github' } as const

/**
 * Clerk behind the custom sign-in page. Sign-in doubles as sign-up: "your
 * account is created on first sign-in".
 */
export function ClerkSignIn() {
  const { signIn, errors, fetchStatus } = useSignIn()
  const { signUp } = useSignUp()
  const navigate = useNavigate()
  const [codeSent, setCodeSent] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const finish = async () => {
    const attempt = signIn.status === 'complete' ? signIn : signUp
    await attempt.finalize({ navigate: () => navigate({ to: '/' }) })
  }

  /** Runs one Clerk call and surfaces its error, if any, under the form. */
  const attempt = async (call: () => Promise<{ error: unknown }>) => {
    setFailure(null)
    const { error } = await call()
    if (error) setFailure(error instanceof Error ? error.message : 'Something went wrong')
    return !error
  }

  const signInWith = async (provider: Provider) => {
    await attempt(() =>
      signIn.sso({
        strategy: OAUTH[provider],
        redirectCallbackUrl: '/sso-callback',
        redirectUrl: '/',
      }),
    )
  }

  const sendCode = async (emailAddress: string) => {
    const created = await attempt(() =>
      signIn.create({ identifier: emailAddress, signUpIfMissing: true }),
    )
    if (created && (await attempt(() => signIn.emailCode.sendCode()))) setCodeSent(true)
  }

  const verifyCode = async (code: string) => {
    if (!(await attempt(() => signIn.emailCode.verifyCode({ code })))) return
    // An unknown email comes back as a transfer: carry it over into a sign-up.
    if (signIn.isTransferable) await attempt(() => signUp.create({ transfer: true }))
    await finish()
  }

  return (
    <SignInScreen
      signInWith={signInWith}
      sendCode={sendCode}
      verifyCode={codeSent ? verifyCode : undefined}
      busy={fetchStatus === 'fetching'}
      error={failure ?? errors?.global?.[0]?.message ?? null}
    />
  )
}
