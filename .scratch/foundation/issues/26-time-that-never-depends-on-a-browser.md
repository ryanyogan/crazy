# 26 — Time that never depends on a browser

**What to find out, then build:** Ryan, 2026-09-19: *it is critical that time is always working
regardless of browser state*. Crazy will be used on several devices at once and will eventually have
an API with native controls (a phone widget, a lock-screen control, a menu-bar item). Decide which
Cloudflare services carry that, and what the timer has to change to be ready for it.

**Type:** research, then tasks

**Blocked by:** 17 — The timer bar: start, stop and note

**Status:** needs-triage

## Where the design already stands (ticket 17)

The running timer is a Time entry with no end, in D1. Nothing counts: elapsed time is `now − start`
wherever it is drawn, so a closed tab, a sleeping phone or a hibernated Durable Object loses nothing,
and every device that reads the row agrees. That is the part that must never regress — no ticket may
move the running state into a browser, a socket or the Coordinator's memory.

## What a browser still carries today, and should not

- [ ] **A press that never arrives.** Start and Stop are decided at the Coordinator's clock when the
  command lands. A press made offline, or in a tab killed mid-request, is lost, and a late one is
  stamped late. Commands want an optional `at` the device vouches for (bounded: never in the future,
  never before the running entry's start, never older than some limit) and an idempotency key —
  `timer.start` already names its entry id, which serves; `timer.stop` should name the entry it ends.
  The browser queues unsent commands (IndexedDB) and replays them.
- [ ] **A timer nobody stops.** Left running overnight it is twelve billable hours. The spec puts the
  inactivity prompt out of scope for the foundation; it is the first thing this ticket brings in.
  The Coordinator's alarm (already used for the Rollover) wakes at a limit after the start and
  decides a server-only command — flag the entry, or cap it — with no browser open.
- [ ] **Telling a device that is not looking.** The live socket reaches open tabs only. A native
  control or a closed phone needs a push.

## Cloudflare services, as a first reading (from memory, not yet checked against current docs)

- **Durable Object (the Coordinator), one per user** — already the single writer, so "only one
  running entry" is serialised by construction, for browsers and native clients alike. Its **alarms**
  are the server-side clock: long-running limits, the inactivity prompt, entries that cross local
  midnight. Hibernating WebSockets stay the fan-out to open tabs. The fit is exact; nothing to add.
- **D1** — stays the truth. No KV for timer state: KV is eventually consistent and would let two
  devices disagree about whether a timer is running.
- **Queues** — for what the Coordinator must never await: web push / APNs / FCM sends, webhooks to
  billing Providers. The Coordinator enqueues and returns.
- **Workflows** — only if a multi-step, retried job appears (month-end invoice runs); not the timer.
- **The API** — a plain Worker route in front of `coordinatorFor(userId)` sending the same commands,
  authenticated by Clerk (session tokens for first-party native apps; API keys or OAuth if third
  parties ever come). No second write path. Rate Limiting binding on it.
- **Native controls** — iOS Live Activities and Android ongoing notifications draw elapsed time from
  a start timestamp on the device, which is the same model as the bar; they need a push on
  start/stop/switch (APNs/FCM from a Queue consumer) and nothing per second.

## Questions to settle

- How far back may a device-vouched `at` reach, and what does the user see when it is refused?
- Cap, flag or prompt for the forgotten timer — and at how many hours?
- Does an entry that crosses local midnight split at the Rollover?
- Clerk for native and API auth: what it offers today for machine tokens (check current docs).
