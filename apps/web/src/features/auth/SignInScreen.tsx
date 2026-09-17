import { Blueprint } from '@crazy/ui'
import { type FormEvent, useState } from 'react'

export type Provider = 'google' | 'github'

export interface SignInActions {
  signInWith: (provider: Provider) => void
  /** Email a one-time code to `email`. */
  sendCode: (email: string) => void
  /** Present once a code is on its way; submits what the user typed. */
  verifyCode?: (code: string) => void
  busy?: boolean
  error?: string | null
}

/**
 * The sign-in page, free of any auth library: it draws the page and reports
 * intent. features/auth/ClerkSignIn supplies the actions. No frame is drawn
 * for it; the layout is derived from the Industry system.
 */
export function SignInScreen({ signInWith, sendCode, verifyCode, busy, error }: SignInActions) {
  const [value, setValue] = useState('')
  const awaitingCode = verifyCode !== undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (awaitingCode) verifyCode(value)
    else sendCode(value)
    setValue('')
  }

  return (
    <main className="signin">
      <div className="signin__form">
        <span className="shell__wordmark">CRAZY</span>
        <h1 className="signin__headline">Work and life, one day.</h1>
        <p className="text-muted">
          Sign in with an account you already have. Yours is created the first time you arrive.
        </p>

        <Blueprint
          as="button"
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={() => signInWith('google')}
        >
          Continue with Google
        </Blueprint>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={busy}
          onClick={() => signInWith('github')}
        >
          Continue with GitHub
        </button>

        <div className="signin__or">or</div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="signin-field">{awaitingCode ? 'Code from your email' : 'Email'}</label>
            <input
              id="signin-field"
              className="input"
              key={awaitingCode ? 'code' : 'email'}
              type={awaitingCode ? 'text' : 'email'}
              inputMode={awaitingCode ? 'numeric' : 'email'}
              autoComplete={awaitingCode ? 'one-time-code' : 'email'}
              placeholder={awaitingCode ? '123456' : 'you@example.com'}
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-block" disabled={busy}>
            {awaitingCode ? 'Verify' : 'Send code'}
          </button>
          {error && (
            <p className="signin__error" role="alert">
              {error}
            </p>
          )}
        </form>
        {/* Clerk mounts its bot-protection widget here when a sign-up needs one. */}
        <div id="clerk-captcha" />
      </div>
    </main>
  )
}
