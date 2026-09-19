# 15 — Integrations screen: Account, Connections, Realtime and lifecycle settings

**What to build:** Ryan opens Integrations and sees each Provider with its status, scopes and last activity. He presses Connect on Google and authorises it through Clerk; a Connection appears with its real scopes. He connects a second Google account and sets its default Side to personal. Providers Clerk cannot broker are shown as not available yet. The Account card reads from Clerk and links to account management. The Realtime panel shows his socket's true state, today's wake count and what last woke it. He changes the Brief time, the sent-back period and the archive period.

**Blocked by:** 05 — Complete a Todo: the first command, end to end and optimistic, 06 — Live across devices: patches over a hibernating socket

**Status:** done — awaiting review

- [x] Connect uses Clerk's add-external-account flow; no third-party token is stored anywhere
- [x] A Connection row records Provider, Clerk external account id, default Side and status, and nothing secret
- [x] Two Connections to one Provider are supported
- [x] Connection status and scopes shown are those Clerk reports
- [x] Unavailable Providers are rendered as not available yet and cannot be pressed
- [x] The Realtime panel reads the Coordinator's real wake counters
- [x] Lifecycle settings are commands, optimistic, and the Rollover honours them
- [x] Without Clerk keys the screen renders for the demo user with Connect unavailable
- [x] Visual diff against frame 1g is noise-only at 1180px; the 390px layout is listed as derived

## Comments

### 2026-09-19 — built

**What was built.** Three commands at the seam: `settings.set` (Brief time, sent-back period,
archive period, each within limits), `connection.add` and `connection.setSide`. `connection.add`
is server-only (`SERVER_ONLY`): the Integrations loader asks Clerk for the user's external
accounts, and any verified one at a Provider Crazy reads that has no bookkeeping row is handed to
the Coordinator as a Connection — which is also where Clerk's add-external-account flow lands the
user back. The row holds Provider, Clerk's external account id, default Side and status; status,
scopes and the account's address are read from Clerk on every load and never stored (`overlayClerk`).
`readIntegrations` is the read model; the Realtime panel reads `Coordinator.realtime()` (wakes since
the user's local midnight, and what last woke it) and this browser's own socket state. `useCommand`
now decides against, and rolls back, the Integrations cache as well as Today's.

**Checked.** `check`, `typecheck`, `test`, `build`; seven tests at the command seam
(`integrations.test.ts`); screenshots at 1180px and 390px as the demo user, no sideways scroll, no
console errors; `pnpm visual 1g` once: whole frame 2.90%, rail 0.00% — the difference is the wording
and controls listed as derived in `docs/BRIEF.md`, not layout.

**Not checked.** Anything with real Clerk keys: Connect, a second Google account, Authorise again,
Manage account, and the Account card's real figures. The Clerk calls were written against its
current docs and the installed types, not run. The read-only scopes asked for (`READ_SCOPES`) are
from memory of each Provider's scope names, not from fetched docs — check them when keys exist.

**Decisions taken.**
- Every verified Clerk external account at a brokered Provider is a Connection, including the one
  the user signed in with; its scopes are whatever Clerk reports, so a sign-in-only Google reads so.
- A new Connection defaults to the work Side; the user sets a second account to personal.
- A Connection whose external account Clerk no longer has is shown as needing authorising again,
  not deleted: Todos still name it as their Source.
- "The Rollover honours them": the settings are stored where ticket 10's Rollover will read them;
  there is no Rollover yet to prove it against.
- The hourly status line is not a setting in the spec's schema, so its switch is drawn off and unavailable.
- Visual diff is not noise-only and was not chased further (project owner's call, 2026-09-19: keep
  verification light; screenshots suffice for UI).

