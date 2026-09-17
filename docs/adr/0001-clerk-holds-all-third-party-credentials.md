---
status: accepted
---

# Clerk holds all third-party credentials

The design notes have the app run its own OAuth (`/connect/:provider` Worker routes, encrypted tokens in KV). We decided instead that Clerk is the only credential store: a Connection is a Clerk external account, users add one with `createExternalAccount`, and the server asks Clerk for a fresh token (`getUserOauthAccessToken`) each time it needs one. We never persist a third-party token; our database keeps only bookkeeping per Connection (provider, Clerk external account id, sync cursor, status). Handling OAuth, refresh and revocation across many providers is the hard, risky part of this product and is not where we want to spend effort.

## Consequences

- Round-one Providers are limited to what Clerk can broker: its built-in social connections plus custom OIDC-compatible ones (QuickBooks qualifies). Plain-OAuth2 providers in the mocks — Harvest, FreshBooks, Todoist — and Apple Health cannot go through Clerk; they are shown as not available yet rather than getting a second OAuth path. Revisit if one of them becomes essential.
- Clerk refreshes tokens only when asked, so background sync must fetch the token at the start of each run rather than cache it.
- Inbound provider webhooks (Slack Events, Linear) are outside Clerk and remain ours to build.
