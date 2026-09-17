# 15 — Integrations screen: Account, Connections, Realtime and lifecycle settings

**What to build:** Ryan opens Integrations and sees each Provider with its status, scopes and last activity. He presses Connect on Google and authorises it through Clerk; a Connection appears with its real scopes. He connects a second Google account and sets its default Side to personal. Providers Clerk cannot broker are shown as not available yet. The Account card reads from Clerk and links to account management. The Realtime panel shows his socket's true state, today's wake count and what last woke it. He changes the Brief time, the sent-back period and the archive period.

**Blocked by:** 05 — Complete a Todo: the first command, end to end and optimistic, 06 — Live across devices: patches over a hibernating socket

**Status:** ready-for-agent

- [ ] Connect uses Clerk's add-external-account flow; no third-party token is stored anywhere
- [ ] A Connection row records Provider, Clerk external account id, default Side and status, and nothing secret
- [ ] Two Connections to one Provider are supported
- [ ] Connection status and scopes shown are those Clerk reports
- [ ] Unavailable Providers are rendered as not available yet and cannot be pressed
- [ ] The Realtime panel reads the Coordinator's real wake counters
- [ ] Lifecycle settings are commands, optimistic, and the Rollover honours them
- [ ] Without Clerk keys the screen renders for the demo user with Connect unavailable
- [ ] Visual diff against frame 1g is noise-only at 1180px; the 390px layout is listed as derived
