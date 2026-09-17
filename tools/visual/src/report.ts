import type { Browser } from 'playwright'
import { PNG } from 'pngjs'
import type { Mask, Mismatch, Picture } from './compare.ts'

// What a run leaves behind: pictures to look at and figures to read.

export function toPng(picture: Picture): Buffer {
  const png = new PNG({ width: picture.width, height: picture.height })
  png.data = Buffer.from(picture.data)
  return PNG.sync.write(png)
}

const inline = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`

/** The frame and the app next to each other, each under its name. */
export async function sideBySide(browser: Browser, frame: Buffer, app: Buffer): Promise<Buffer> {
  const tab = await browser.newPage({ deviceScaleFactor: 1 })
  try {
    await tab.setContent(`<!doctype html>
<style>
  body { margin: 0; width: max-content; display: flex; gap: 24px; padding: 24px; background: #fff;
         font: 600 13px/1 system-ui, sans-serif; color: #1d1f20 }
  figure { margin: 0; display: grid; gap: 10px }
  img { display: block; outline: 1px solid #c8c8cb }
</style>
<figure>Frame<img src="${inline(frame)}"></figure>
<figure>App<img src="${inline(app)}"></figure>`)
    return await tab.locator('body').screenshot()
  } finally {
    await tab.close()
  }
}

/** One width of one target, as it goes into report.json and the page. */
export interface Result {
  frame: string | null
  title: string
  route: string
  width: number
  /** Compared against a frame, or derived: screenshotted only, because no frame draws it. */
  kind: 'compared' | 'derived'
  pinned: string
  servedAt: string
  overflow: number
  whole?: Mismatch
  regions?: Record<string, Mismatch>
  masks?: Mask[]
  files: { app: string; frame?: string; sideBySide?: string; diff?: string }
}

export const percent = (mismatch: Mismatch) => `${mismatch.percent.toFixed(2)}%`

const escape = (text: string) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)

export function reportPage(results: Result[], ranAt: string): string {
  const compared = results.filter((result) => result.kind === 'compared')
  const derived = results.filter((result) => result.kind === 'derived')
  const figures = (result: Result) =>
    [['whole frame', result.whole!] as const, ...Object.entries(result.regions ?? {})]
      .map(
        ([name, mismatch]) =>
          `<tr><td>${escape(name)}</td><td>${percent(mismatch)}</td><td>${mismatch.pixels} px</td></tr>`,
      )
      .join('')

  return `<!doctype html>
<meta charset="utf-8">
<title>Crazy · visual comparison</title>
<style>
  body { margin: 32px; font: 14px/1.5 system-ui, sans-serif; color: #1d1f20; background: #f2f2f3 }
  h1 { font-size: 22px } h2 { font-size: 17px; margin: 40px 0 4px } p { margin: 4px 0; max-width: 80ch }
  table { border-collapse: collapse; margin: 10px 0 } td { padding: 2px 18px 2px 0; font-variant-numeric: tabular-nums }
  img { display: block; max-width: 100%; margin: 12px 0; outline: 1px solid #c8c8cb }
  .note { color: #5d5d60 }
</style>
<h1>Visual comparison</h1>
<p class="note">Run ${escape(ranAt)}. A mismatch is a pixel that differs beyond anti-aliasing. In a diff, red
differs, yellow is anti-aliasing and hatching is masked: left out of the figures, for the reason given.</p>
${compared
  .map(
    (result) => `<h2>${escape(result.frame!)} · ${escape(result.title)} · ${result.width}px</h2>
<p class="note"><code>${escape(result.route)}</code> at ${escape(result.pinned)} (served at ${escape(result.servedAt)})${
      result.overflow > 0
        ? ` · the page runs ${result.overflow}px below the frame, which the pictures leave out`
        : ''
    }</p>
<table>${figures(result)}</table>
${(result.masks ?? []).map((mask) => `<p class="note">Masked: ${escape(mask.why)}</p>`).join('')}
<img src="${escape(result.files.sideBySide!)}" alt="Frame beside app">
<img src="${escape(result.files.diff!)}" alt="Diff">`,
  )
  .join('\n')}
${
  derived.length === 0
    ? ''
    : `<h2>Derived: no frame draws these</h2>
<p class="note">Screenshotted so they can be looked at; there is nothing to compare them with. Re-check them
when frames are drawn.</p>
${derived
  .map(
    (result) =>
      `<p>${escape(result.title)} · <code>${escape(result.route)}</code> · ${result.width}px</p>
<img src="${escape(result.files.app)}" alt="${escape(result.title)} at ${result.width}px">`,
  )
  .join('\n')}`
}
`
}
