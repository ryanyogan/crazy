# 06 — Live across devices: patches over a hibernating socket

**What to build:** Ryan has the Today screen open in two tabs. Ticking a Todo in one completes it in the other within a moment, without a refetch. If a tab loses its connection it catches up when it reconnects; if it has been away too long it refetches. The header's Live indicator reflects the connection. The Coordinator uses the Agents SDK's hibernating sockets with its own state sync unused, keeps a replay buffer of the last 200 patches, and counts its wakes and what caused the last one.

**Blocked by:** 05 — Complete a Todo: the first command, end to end and optimistic

**Status:** in progress — Coordinator half built, web half not started

- [ ] The web app authenticates the socket upgrade with Clerk and forwards it to that user's Coordinator only
- [x] A committed command is broadcast to the user's other sockets as a patch carrying its sequence number
- [ ] The client applies patches to the query cache and ignores sequence numbers it has already applied, including its own
- [x] Reconnecting with an older sequence number replays the missed patches in order (Coordinator test)
- [x] A gap larger than the buffer makes the client refetch (Coordinator test)
- [ ] Reconnection backs off rather than hammering
- [x] Idle sockets hibernate; the Coordinator records each wake and its cause
- [x] The SDK's state sync is not used anywhere, and the SDK is imported from one module
- [ ] The Live indicator shows connected, reconnecting and offline

## Comments

**2026-09-17 — agent, stopped part way at the user's request.** `pnpm check`, `typecheck` and `test` (94 tests) pass as left. Nothing in the browser uses a socket yet; the Live indicator still says "Not live yet" and its harness masks are still in place.

Built:

- **`packages/shared/src/live.ts`** (tested): the messages a Coordinator sends (`patch`, `hello {seq, wokeAt}`, `refetch {seq}`), `LIVE_PATH = '/live'` with `?since=`, the client's bookkeeping of applied sequence numbers (`Applied`, `hasApplied`, `markApplied` — it copes with a client's own patch arriving over HTTP before earlier ones arrive over the socket), and `reconnectDelay(attempt, random)`: 1s doubling to 30s, cut by up to half at random.
- **The Coordinator** (`apps/core/src/coordinator/`): `sdk.ts` turns off the SDK's identity and protocol frames and exposes `socketOpened/Spoke/Closed`, `toEverySocket`, `socketCount`; `PatchLog.since(seq)` replays or answers `'gap'`; `WakeLog` (`wakes.ts`) records the first thing asked of each new instance, with its cause; `command()` broadcasts its patch to every socket (the sender ignores it by sequence number); `reseed()` broadcasts `refetch`; `lastSeq()` and `realtime({since})` are there for loaders and for ticket 15's Realtime panel. `live.test.ts` covers greeting, broadcast, isolation between users, replay, the gap, a never-issued sequence number, reseed, hibernation (`state.getWebSockets()`) and the wake record.

Left to do, as designed:

1. **`/live` server route in `apps/web`**: refuse a request that is not an upgrade, check `Origin` is the app's own (cookies ride on cross-site socket handshakes), `viewerId()` or 401, then `coordinatorFor(userId).fetch(request)` so `?since=` travels as is. Unknown: whether TanStack Start hands a 101 with `webSocket` back untouched, and whether the Cloudflare Vite plugin forwards upgrades in dev. If not, handle `/live` in a custom server entry ahead of Start's handler.
2. **`getToday` returns `seq`**, read from `coordinatorFor(userId).lastSeq()` *before* the D1 read, so a socket opened from it is replayed anything the read might have missed (operations set values, so applying one twice is harmless).
3. **`apps/web/src/lib/live.ts` + a hook mounted once in the Shell**: start from the smallest `seq` in the cache; on `patch`, skip if `hasApplied`, else `applyToCache` and `markApplied`; on `refetch`, invalidate everything and adopt its `seq`; on close, `reconnectDelay` with `since = applied.upTo`; `online`/`offline` events. `useCommand`'s `onSuccess` must `markApplied(patch.seq)` on the same tracker (keep it per `QueryClient`, e.g. a `WeakMap`, not module state).
4. **`LiveIndicator`**: connected reads "Live · woke HH:MM" on desktop (from `hello.wokeAt`, in the user's zone) and dot + the loader's time on a phone, as frame 1a draws; plus reconnecting and offline. Then delete the two `NOT_LIVE` masks in `tools/visual/src/targets.ts`, have the harness wait for the live state before its screenshot, and mask only the wake time's digits (the Coordinator's clock is real, the frame says 08:59 at a pinned 08:41).
5. Two-tab check in a browser (tick in one, appears in the other without a refetch; drop and restore the connection), then the ticket write-up and `docs/BRIEF.md` (Live indicator row, masks paragraph).
