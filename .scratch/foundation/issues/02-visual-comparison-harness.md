# 02 — Visual comparison harness: diff a route against its frozen frame

**What to build:** A developer runs one script and gets, for a named frame and route, a side-by-side image and a diff image at 1180px and at 390px, with the persona seeded and the clock pinned to the moment the mockup shows. The current time becomes an injected value for the web app so the pin works. The harness proves itself on the only thing that exists so far: the Shell's header and navigation.

**Blocked by:** 01 — Walking skeleton: sign in and see the Shell, served from D1 through both Workers

**Status:** done — awaiting review

- [x] The script renders a frozen frame in isolation (one option from the canvas, not the whole canvas) and the matching route, at both widths
- [x] A pinned time can be supplied for a run, and loaders use it instead of the system clock
- [x] Output is a folder of side-by-side and diff images plus a per-frame mismatch figure
- [x] Routes with no phone frame are screenshotted at 390px without a diff, and are listed as derived
- [x] Running it against the Shell produces a diff that is anti-aliasing noise only
- [x] The project brief explains how to run it and how to read the output

## Comments

**2026-09-17 — agent.** Built. `pnpm visual` (or `pnpm visual 1a`) writes `.visual/`: per frame and width a frame, app, side-by-side and diff picture, plus `report.json` and an `index.html` to read them in. `pnpm check`, `typecheck`, `test` (24 tests) and `build` pass. How to run it and read it is in `docs/BRIEF.md`, "Comparing a screen with its frame".

The Shell's result, which is the proof asked for: `rail` 0.00% on 1a, 1c, 1d, 1e, 1f and 1g at 1180px; `top bar` and `tab bar` 0.00% on 1a at 390px. The diffs show no red in those regions. Whole-frame figures are 2–11% because the screens are empty.

How each box was met, where it is not obvious:

- **A frame in isolation.** The canvas's runtime (`support.js`) is not among the frozen files, and its loops (`<sc-for>`) sit inside `<tbody>` in places, where a browser's parser would throw them out. So `tools/visual/src/template.ts` expands the source text itself, from the canvas's own data script, and the harness then keeps the one card asked for. The card's canvas border and shadow are dropped so its edges are a viewport's edges. Nothing in `docs/design` is touched; Google Fonts is answered with the app's own Barlow files and every other outside request is refused.
- **The persona.** The frame is drawn as the persona the app runs as: "Mara Okafor" → "Ryan Yogan", "MO" → "RY", and the wordmark TODAY → CRAZY. Otherwise no region containing a name could ever read as noise. The app must be running as the demo user; with Clerk keys the harness stops and says so.
- **The pinned time.** `requestNow(timeZone)` in `apps/web/src/server/clock.ts` is now the one place the web app reads the clock. In development it honours a `crazy-now` cookie holding a wall-clock time ("2025-09-17T08:41"), read in the user's time zone by the new `localTimeToInstant` in the shared package (the Rollover will want the same function for local midnight). It answers with an `x-crazy-now` header and the harness fails without it, so a pin cannot be silently ignored. Checked by hand: the pin is echoed as 13:41Z for America/Chicago, a malformed pin is a 500, and the production bundle's `requestNow` compiles to `return new Date()`.
- **Derived routes.** Week, Projects, Circles, Metrics, Integrations and More are screenshotted at 390×844 and listed under "Derived" with no figure.

Decisions worth a look:

- **Regions and masks.** A whole-frame figure means little until a screen is finished, so a target names rectangles (`rail`, `top bar`, `tab bar`) that get their own figure; tickets 03 onward add theirs to `tools/visual/src/targets.ts`. A mask leaves a rectangle out of the figures, is hatched in the diff and prints its reason. Two exist: the Live indicator (until ticket 06), and the foot of the rail in 1c–1g, which those frames leave empty while 1a draws it. The Shell follows 1a.
- **The Shell's read model now returns `now` and `timeZone`**, so something reads the clock on every route and the pin is verifiable everywhere. Nothing displays them yet; the Today screen will.
- The harness uses the dev server on :3000 if one is up, otherwise starts `pnpm dev` itself and stops it after. It reads whatever is in the local D1; a reset-and-seed step belongs with the seed in ticket 03.
- Only the Ryan frames are listed. The Cori frames (2a–2c, 3a, 3b, 4a) need the Cori persona and join in ticket 16; 3a and 3b are component states rather than routes and will need a way to reach each state.
- The harness lives in `tools/visual` (a new workspace glob) and runs as plain TypeScript under Node 24, no build step. Playwright 1.63 needs its Chromium fetched once per machine.
- pixelmatch's default threshold (0.1) is used. It forgives faint colour differences; tighten it in `compare.ts` if a review by eye finds it too kind.
