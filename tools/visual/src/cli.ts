import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { seedApp, shootRoute } from './app.ts'
import { compare } from './compare.ts'
import { canvasPage, drawFrame } from './frame.ts'
import { type Result, percent, reportPage, sideBySide, toPng } from './report.ts'
import { ensureApp } from './server.ts'
import { DESKTOP, PERSONAS, PHONE, TARGETS, type Target, UNDRAWN, type Width } from './targets.ts'

// pnpm visual [frame…] — compare routes of the running app with their frozen
// frames. See docs/BRIEF.md, "Comparing a screen with its frame".

const REPO = join(import.meta.dirname, '../../..')
/** The phone viewport for a route no phone frame gives a height to. */
const PHONE_HEIGHT = 844
/** Tall enough to hold the whole of a screen a frame draws one part of. */
const PART_VIEWPORT = 900

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    out: { type: 'string', default: join(REPO, '.visual') },
    now: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

if (options.help) {
  console.log(`Usage: pnpm visual [frame…] [--now 2025-09-17T08:41] [--url origin] [--out folder]

Frames: ${TARGETS.map((target) => `${target.frame} (${target.title})`).join(', ')}
With no frame named, all of them, then the routes no frame draws.
--now overrides the moment a frame shows, as the persona's wall clock reads it.`)
  process.exit(0)
}

const unknown = positionals.filter((name) => !TARGETS.some((target) => target.frame === name))
if (unknown.length > 0) {
  console.error(`No such frame: ${unknown.join(', ')}. Try --help.`)
  process.exit(1)
}
const targets = TARGETS.filter(
  (target) => positionals.length === 0 || positionals.includes(target.frame),
)
const out = options.out
const origin = new URL(options.url).origin

const stopApp = await ensureApp(origin)
const browser = await chromium.launch()
const results: Result[] = []

async function save(name: string, png: Buffer): Promise<string> {
  await writeFile(join(out, name), png)
  return name
}

async function compareAt(target: Target, width: Width): Promise<Result> {
  const view = (width === DESKTOP ? target.desktop : target.phone)!
  const now = options.now ?? target.now
  const page = await canvasPage(PERSONAS[target.persona])
  // A frame that draws one part of a screen is drawn at that part's width, and
  // the app is cropped to where the part sits; the rest is drawn whole.
  const { part } = target
  const frame = await drawFrame(
    browser,
    page,
    target.option ?? target.frame,
    part?.width ?? width,
    target.card,
  )
  const { height } = frame.picture
  const app = await shootRoute(
    browser,
    origin,
    target.route,
    now,
    { width, height: part ? PART_VIEWPORT : height },
    part && { selector: part.selector, height, from: part.from },
    target.open,
  )
  const { whole, regions, diff } = compare(frame.picture, app.picture, view.regions, view.masks)

  const stem = `${target.frame}-${width}`
  return {
    frame: target.frame,
    title: target.title,
    route: target.route,
    width,
    kind: 'compared',
    pinned: now,
    servedAt: app.servedAt,
    overflow: app.overflow,
    whole,
    regions,
    masks: view.masks,
    files: {
      frame: await save(`${stem}-frame.png`, frame.png),
      app: await save(`${stem}-app.png`, app.png),
      sideBySide: await save(
        `${stem}-side-by-side.png`,
        await sideBySide(browser, frame.png, app.png),
      ),
      diff: await save(`${stem}-diff.png`, toPng(diff)),
    },
  }
}

async function derivedAt(title: string, route: string, now: string): Promise<Result> {
  const viewport = { width: PHONE, height: PHONE_HEIGHT }
  const app = await shootRoute(browser, origin, route, now, viewport)
  const stem = route === '/' ? 'today' : route.slice(1).replaceAll('/', '-')
  return {
    frame: null,
    title,
    route,
    width: PHONE,
    kind: 'derived',
    pinned: now,
    servedAt: app.servedAt,
    overflow: app.overflow,
    files: { app: await save(`derived-${stem}-${PHONE}.png`, app.png) },
  }
}

function announce(result: Result) {
  const name = `${result.frame ?? 'derived'} ${result.title} ${result.width}px`
  if (result.kind === 'derived') return console.log(`${name}: screenshot only, no frame draws it`)
  const parts = Object.entries(result.regions ?? {}).map(
    ([region, mismatch]) => `${region} ${percent(mismatch)}`,
  )
  console.log(
    `${name}: whole frame ${percent(result.whole!)}${parts.map((part) => ` · ${part}`).join('')}`,
  )
}

try {
  await rm(out, { recursive: true, force: true })
  await mkdir(out, { recursive: true })

  for (const target of targets) {
    await seedApp(origin, target.persona, options.now ?? target.now, target.timer)
    for (const width of [DESKTOP, PHONE] as const) {
      // A frame of one part of a screen is drawn at one width; the phone's
      // timer is frame 3b's, and the screen around it is compared by its own
      // target, so there is nothing to shoot a second time here.
      if (width === PHONE && target.part && !target.phone) continue
      // A frame only a phone is drawn for: frame 3b's sheet.
      if (width === DESKTOP && !target.desktop) continue
      const result =
        width === PHONE && !target.phone
          ? await derivedAt(target.title, target.route, options.now ?? target.now)
          : await compareAt(target, width)
      results.push(result)
      announce(result)
    }
  }
  if (positionals.length === 0) {
    for (const { title, route } of UNDRAWN) {
      const result = await derivedAt(title, route, options.now ?? TARGETS[0]!.now)
      results.push(result)
      announce(result)
    }
  }

  const ranAt = new Date().toISOString()
  await writeFile(join(out, 'report.json'), `${JSON.stringify({ ranAt, results }, null, 2)}\n`)
  await writeFile(join(out, 'index.html'), reportPage(results, ranAt))
  console.log(`\nOpen ${relative(REPO, join(out, 'index.html'))} (from the repo root)`)
} finally {
  await browser.close()
  stopApp()
}
