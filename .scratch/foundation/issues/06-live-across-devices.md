# 06 — Live across devices: patches over a hibernating socket

**What to build:** Ryan has the Today screen open in two tabs. Ticking a Todo in one completes it in the other within a moment, without a refetch. If a tab loses its connection it catches up when it reconnects; if it has been away too long it refetches. The header's Live indicator reflects the connection. The Coordinator uses the Agents SDK's hibernating sockets with its own state sync unused, keeps a replay buffer of the last 200 patches, and counts its wakes and what caused the last one.

**Blocked by:** 05 — Complete a Todo: the first command, end to end and optimistic

**Status:** done — awaiting review

- [x] The web app authenticates the socket upgrade with Clerk and forwards it to that user's Coordinator only
- [x] A committed command is broadcast to the user's other sockets as a patch carrying its sequence number
- [x] The client applies patches to the query cache and ignores sequence numbers it has already applied, including its own
- [x] Reconnecting with an older sequence number replays the missed patches in order (Coordinator test)
- [x] A gap larger than the buffer makes the client refetch (Coordinator test)
- [x] Reconnection backs off rather than hammering
- [x] Idle sockets hibernate; the Coordinator records each wake and its cause
- [x] The SDK's state sync is not used anywhere, and the SDK is imported from one module
- [x] The Live indicator shows connected, reconnecting and offline

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

**2026-09-17 — agent, the web half.** `pnpm check`, `typecheck`, `test` (98 tests) and `build` pass; `pnpm visual 1a` reads 0.00% at both widths with the two `NOT_LIVE` masks gone.

- **`apps/web/src/routes/live.ts`**: 426 unless it is an upgrade, 403 unless `Origin` is the app's own, 401 without a viewer, then `coordinatorFor(userId).fetch(request)`. The unknown is settled: a TanStack Start server route hands the Coordinator's 101 back untouched, under `vp dev` (the Cloudflare plugin forwards upgrades) and from the built Worker under `vp preview`. No custom server entry was needed, which also keeps the route behind Clerk's request middleware. Not tried: a deployed Worker, and a signed-in Clerk user (no keys on this machine, as in ticket 01).
- **`getToday` returns `seq`**, read from `lastSeq()` before the D1 read.
- **`hear(applied, message)` in `packages/shared/src/live.ts`** (tested) is the client's whole rule: apply a patch once, ignore one already applied (its own included), adopt the Coordinator's sequence number outright on `refetch` (even backwards, so a wiped Coordinator log cannot leave a client refetching for ever), move only forwards on `hello`.
- **`apps/web/src/lib/live.ts`**: one `Live` per `QueryClient` (a `WeakMap`), started by `useLive()` in the Shell. It connects from the smallest `seq` in the cache, or with no `since` when no cached read model carries one and takes its place from `hello`. `useCommand` marks its own patch applied on the same tracker. A fetch that lands older than what has been applied is made again. Close leads to `reconnectDelay`; the attempt count resets on `hello`, not on open, so a socket that opens and dies still backs off. `offline` hangs up and `online` reconnects at once. `applyToCache` moved to `lib/queries.ts`.
- **`LiveIndicator`** is an `<output>`: "Live · woke HH:MM" in the rail and dot + the Shell loader's time on a phone, as 1a draws; "Connecting…", "Reconnecting…" and "Offline" with a hollow dot otherwise. `clockTime` joined `@crazy/shared`.
- **Harness**: waits for `.live[data-state="live"]`; the only Live mask left is the four digits of the wake time.

Checked in a browser (Playwright, two contexts against `pnpm dev`): a tick in one tab completed the Todo in the other with no server call from the second tab; a tab taken offline read "Offline", came back with `?since=5`, was replayed patch 6 and showed it, again with no server call; a tab's own patch arriving twice changed nothing; with the socket closed on every attempt the indicator read "Reconnecting…" and attempts came at roughly 0.6s, 1.6s, 3.0s, 6.8s.

For review:

- Nothing pings. A ping from the browser would wake the Coordinator, which is what hibernation is there to avoid; `setWebSocketAutoResponse` answers one without waking it, but needs a line in the Coordinator and a timer in the client. Until then a connection that dies without a close (a laptop lid, a NAT timeout) still reads "Live" until the browser notices.
- "Connecting…" is a fourth state, shown on the server render and until the first `hello`; the ticket names three.
- React Query's own refetch-on-reconnect is still on, so a tab that was offline for longer than the 30s stale time refetches as well as being replayed. Harmless, and a second safety net; turn it off if the socket is to be the only way.
