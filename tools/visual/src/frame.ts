import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, normalize } from 'node:path'
import type { Browser } from 'playwright'
import { PNG } from 'pngjs'
import type { Picture } from './compare.ts'
import { COPY, type Compose, type Persona, WORDMARK } from './targets.ts'
import { canvasValues, expand } from './template.ts'

// Draws one option of the frozen canvas on its own, at the size it is drawn,
// as the persona the app runs as. Nothing is fetched from outside this machine.

const REPO = join(import.meta.dirname, '../../..')
const DESIGN = join(REPO, 'docs/design')
const CANVAS = join(DESIGN, 'Today Mockups.dc.html')
/** A made-up origin: every request to it is answered from the frozen files. */
const ORIGIN = 'http://frame.invalid'

const HELMET = /<helmet>([\s\S]*?)<\/helmet>/
const BODY = /<\/helmet>([\s\S]*?)<\/x-dc>/
const SCRIPT = /<script\b[\s\S]*?<\/script>/g

/** The whole canvas as a plain page: loops expanded, persona swapped in, no scripts. */
export async function canvasPage(persona: Persona): Promise<string> {
  const canvas = await readFile(CANVAS, 'utf8')
  const head = HELMET.exec(canvas)?.[1]
  const body = BODY.exec(canvas)?.[1]
  if (head === undefined || body === undefined) throw new Error('The canvas has no <x-dc> body')

  let drawn = expand(body, canvasValues(canvas)).replace(...WORDMARK)
  for (const [from, to] of [...persona.replaces, ...COPY]) drawn = drawn.replaceAll(from, to)
  return `<!doctype html><html><head><meta charset="utf-8">${head.replace(SCRIPT, '')}</head><body>${drawn}</body></html>`
}

// The frozen stylesheet imports Barlow from Google Fonts. The frame gets the
// same self-hosted files the app serves instead, so both draw the same glyphs.
const fromUi = createRequire(join(REPO, 'packages/ui/package.json'))
const FACES = [
  '@fontsource/barlow/400.css',
  '@fontsource/barlow/500.css',
  '@fontsource/barlow/700.css',
  '@fontsource/barlow-condensed/400.css',
  '@fontsource/barlow-condensed/600.css',
]

async function fontFaces(): Promise<string> {
  const sheets = await Promise.all(
    FACES.map(async (face) => {
      const family = face.split('/')[1]
      const css = await readFile(fromUi.resolve(face), 'utf8')
      return css.replaceAll('url(./files/', `url(${ORIGIN}/fonts/${family}/files/`)
    }),
  )
  return sheets.join('\n')
}

const TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

export function toPicture(png: Buffer): Picture {
  const { width, height, data } = PNG.sync.read(png)
  return { width, height, data: new Uint8Array(data) }
}

export interface DrawnFrame {
  picture: Picture
  png: Buffer
}

/**
 * The card of `option` drawn at `width`, without the canvas's own border and
 * shadow around it, so its edges are the edges of a viewport. An option that
 * draws several states at one width — frame 3a draws the timer idle, running
 * and with its picker open — names which of them by `card`.
 */
export async function drawFrame(
  browser: Browser,
  page: string,
  option: string,
  width: number,
  card = 0,
  compose?: Compose,
): Promise<DrawnFrame> {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  try {
    const faces = await fontFaces()
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.hostname === 'fonts.googleapis.com') {
        return route.fulfill({ contentType: 'text/css', body: faces })
      }
      if (url.origin !== ORIGIN) return route.abort()
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: page })

      const path = normalize(decodeURIComponent(url.pathname))
      const font = /^\/fonts\/([\w-]+)\/(files\/[\w.-]+)$/.exec(path)
      const file = font
        ? join(dirname(fromUi.resolve(`@fontsource/${font[1]}/package.json`)), font[2]!)
        : join(DESIGN, path)
      const type = TYPES[path.slice(path.lastIndexOf('.'))]
      // The canvas's runtime scripts are not among the frozen files, nor needed.
      if (!type) return route.abort()
      return route.fulfill({ contentType: type, body: await readFile(file) })
    })

    const tab = await context.newPage()
    await tab.goto(`${ORIGIN}/`)
    const height = await tab.evaluate(
      ({ option, width, card, compose }) => {
        const cardsOf = (id: string, at: number) =>
          [...document.querySelectorAll<HTMLElement>(`[id="${id}"] .dv-card`)].filter(
            (each) => each.style.width === `${at}px`,
          )
        const wanted = cardsOf(option, width)[card]
        if (!wanted) return null
        // One frame's piece put into another's screen, which is what the canvas
        // itself suggests trying next under frame 3a ("put the 3a bar into 2a").
        // The band keeps the place and the edges the screen gives it; what fills
        // it is the other frame's, at the size that frame draws it.
        if (compose) {
          const band = wanted.querySelector<HTMLElement>(compose.replace)
          const source = cardsOf(compose.with.option, compose.with.width)[compose.with.card]
          if (!band || !source) return null
          band.style.cssText = `${source.style.cssText};${compose.band}`
          band.replaceChildren(...source.children)
        }
        wanted.style.border = '0'
        wanted.style.boxShadow = 'none'
        wanted.style.maxWidth = 'none'
        document.body.replaceChildren(wanted)
        // A card whose content does not land on whole pixels is taken to the
        // nearest: a viewport is a whole number of rows.
        return Math.round(wanted.getBoundingClientRect().height)
      },
      { option, width, card, compose: compose ?? null },
    )
    if (height === null) {
      throw new Error(`Frame ${option} has no card ${card} drawn at ${width}px`)
    }

    await tab.setViewportSize({ width, height })
    await tab.evaluate(() => document.fonts.ready)
    const png = await tab.screenshot()
    return { picture: toPicture(png), png }
  } finally {
    await context.close()
  }
}
