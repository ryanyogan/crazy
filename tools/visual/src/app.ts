import type { Browser } from 'playwright'
import type { Picture } from './compare.ts'
import { toPicture } from './frame.ts'

// Screenshots a route of the running app as a persona, at a pinned moment.

/** apps/web/src/server/clock.ts reads the first and answers with the second. */
const PINNED_NOW_COOKIE = 'crazy-now'
const PINNED_NOW_HEADER = 'x-crazy-now'

/**
 * Puts the app in the state a frame shows: everything the demo user has is
 * replaced with the persona's content, laid over the frame's moment. The route
 * exists on the dev server only (apps/web/src/routes/dev/seed.ts).
 */
export async function seedApp(origin: string, persona: string, now: string): Promise<void> {
  const response = await fetch(new URL(`/dev/seed?persona=${persona}`, origin), {
    method: 'POST',
    headers: { cookie: `${PINNED_NOW_COOKIE}=${now}` },
  })
  if (!response.ok) {
    throw new Error(`Seeding ${persona} answered ${response.status}: ${await response.text()}`)
  }
}

export interface Shot {
  picture: Picture
  png: Buffer
  /** The moment the server says it served the page at. */
  servedAt: string
  /** How much taller than the viewport the page is; what the screenshot leaves out. */
  overflow: number
}

export async function shootRoute(
  browser: Browser,
  origin: string,
  route: string,
  now: string,
  viewport: { width: number; height: number },
): Promise<Shot> {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  try {
    await context.addCookies([{ name: PINNED_NOW_COOKIE, value: now, url: origin }])
    const tab = await context.newPage()
    const strays = new Set<string>()
    tab.on('request', (request) => {
      const url = new URL(request.url())
      if (url.origin !== origin && url.protocol !== 'data:') strays.add(url.origin)
    })

    const response = await tab.goto(new URL(route, origin).href, { waitUntil: 'networkidle' })
    if (!response?.ok()) throw new Error(`${route} answered ${response?.status() ?? 'nothing'}`)
    if (new URL(tab.url()).pathname.startsWith('/sign-in')) {
      throw new Error(
        'The app asked for a sign-in. The harness compares as the demo user: run it with no Clerk keys configured.',
      )
    }
    const servedAt = response.headers()[PINNED_NOW_HEADER]
    if (!servedAt) {
      throw new Error(
        `${route} ignored the pinned time. The pin is honoured by the dev server only (pnpm dev), and only where a loader reads the clock.`,
      )
    }
    if (strays.size > 0) throw new Error(`${route} made requests to ${[...strays].join(', ')}`)

    await tab.evaluate(() => document.fonts.ready)
    // The frames draw a connected app, and the socket opens after the page has loaded.
    await tab
      .locator('.live[data-state="live"]')
      .waitFor({ timeout: 10_000 })
      .catch(() => {
        throw new Error(`${route} never went live: the socket to the Coordinator did not connect`)
      })
    const overflow = await tab.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    )
    const png = await tab.screenshot()
    return { picture: toPicture(png), png, servedAt, overflow: Math.max(0, overflow) }
  } finally {
    await context.close()
  }
}
