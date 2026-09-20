import type { Browser, Page } from 'playwright'
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
export async function seedApp(
  origin: string,
  persona: string,
  now: string,
  /** `idle` seeds a persona's running Time entry already ended (frame 3a, idle). */
  timer?: 'idle',
): Promise<void> {
  const url = new URL(`/dev/seed?persona=${persona}`, origin)
  if (timer) url.searchParams.set('timer', timer)
  const response = await fetch(url, {
    method: 'POST',
    headers: { cookie: `${PINNED_NOW_COOKIE}=${now}` },
  })
  if (!response.ok) {
    throw new Error(`Seeding ${persona} answered ${response.status}: ${await response.text()}`)
  }
}

/** Where the part sits on the page, and how much of the page around it the frame reaches. */
async function clipFor(tab: Page, part: Part) {
  const box = await tab.locator(part.selector).boundingBox()
  if (!box) throw new Error(`Nothing on the page matches ${part.selector}`)
  // A frame of something that rises from the bottom of the screen is a frame of
  // its foot: the crop ends where the element does (frame 3b's sheet).
  const y = part.from === 'bottom' ? box.y + box.height - part.height : box.y + (part.at?.y ?? 0)
  // To the nearest whole pixel: a screenshot is a whole number of rows, and an
  // element that lands on a half — Industry's spacing scale is in fractions of
  // a pixel — would otherwise be cropped from a different half each run.
  return {
    x: Math.round(box.x + (part.at?.x ?? 0)),
    y: Math.round(y),
    width: part.width ?? box.width,
    height: part.height,
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

/** One piece of a screen, where a frame draws that piece rather than the whole of it. */
export interface Part {
  /** The element the frame is of, in the running app. */
  selector: string
  /** The frame's own height: what the app is cropped to, so the two can be compared. */
  height: number
  /** Which edge of the element the frame's height is measured from; the top by default. */
  from?: 'top' | 'bottom'
  /** The frame's own width, where the frame draws part of the element rather than all of it. */
  width?: number
  /** Where inside the element the crop begins; its top-left corner by default. */
  at?: { x: number; y: number }
}

export async function shootRoute(
  browser: Browser,
  origin: string,
  route: string,
  now: string,
  viewport: { width: number; height: number },
  part?: Part,
  /** A control to press before the shot: how a frame of an opened thing is reached. */
  open?: string,
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
    // A frame of something the user has opened is reached by opening it: the
    // harness presses the control, and the app has no state it would not.
    if (open) {
      await tab.locator(open).click()
      await tab.waitForTimeout(200)
    }
    const overflow = await tab.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    )
    // A frame that draws one piece of a screen is compared with that piece where
    // it sits, cropped to the frame's own height: the frames' last line is often
    // a note about the mockup rather than anything the app says, and a target
    // masks that band with its reason.
    // `fullPage` so that a part further down the screen than the viewport is
    // still cropped from where it sits; the page is never scrolled, so the
    // clip's coordinates are the element's own either way.
    const png = await tab.screenshot(
      part ? { clip: await clipFor(tab, part), fullPage: true } : undefined,
    )
    return { picture: toPicture(png), png, servedAt, overflow: Math.max(0, overflow) }
  } finally {
    await context.close()
  }
}
