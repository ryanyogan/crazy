# 25 — Shells for the Queue, the Workflows, the AI Gateway and account deletion

**What to build:** Each later feature has a declared, bound and deployable place to go: the Provider-pull Queue and its consumer, the Brief, invoice and archive Workflows, and the AI Gateway binding — each an empty handler that logs and returns. A Clerk webhook for account deletion removes the user's rows and their Coordinator's storage.

**Blocked by:** 01 — Walking skeleton: sign in and see the Shell, served from D1 through both Workers

**Status:** ready-for-agent

- [ ] The Queue, three Workflows and AI Gateway are bound in the core Worker and start locally
- [ ] Each shell has a one-line note in the project brief saying what will fill it, per ADR 0002
- [ ] The deletion webhook verifies Clerk's signature and deletes the user's data; an unsigned request is refused (test)
- [ ] No shell calls a Provider or an LLM
