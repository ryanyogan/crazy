import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'

// A plain screenshot of a route, for looking at by hand. `pnpm visual` is the
// comparison; this is the pair of eyes beside it.
//
//   node src/shoot.ts --out /tmp/shots --now 2025-09-17T10:42 \
//     name=/time?view=week name2=/time?view=day

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    out: { type: 'string' },
    now: { type: 'string', default: '2025-09-17T10:42' },
    width: { type: 'string', default: '1180' },
    height: { type: 'string', default: '900' },
    press: { type: 'string' },
    type: { type: 'string' },
    keys: { type: 'string' },
    after: { type: 'string' },
    full: { type: 'boolean', default: false },
  },
})

const origin = new URL(options.url!).origin
const out = options.out!
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: Number(options.width), height: Number(options.height) },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
})
await context.addCookies([{ name: 'crazy-now', value: options.now!, url: origin }])
const tab = await context.newPage()

for (const each of positionals) {
  const at = each.indexOf('=')
  const name = each.slice(0, at)
  const route = each.slice(at + 1)
  await tab.goto(new URL(route, origin).href, { waitUntil: 'networkidle' })
  await tab.evaluate(() => document.fonts.ready)
  if (options.press) {
    for (const selector of options.press.split('|')) {
      await tab.locator(selector).first().click()
      await tab.waitForTimeout(150)
    }
  }
  if (options.type) {
    const at = options.type.lastIndexOf('=')
    await tab
      .locator(options.type.slice(0, at))
      .first()
      .fill(options.type.slice(at + 1))
    await tab.waitForTimeout(150)
  }
  if (options.after) {
    for (const selector of options.after.split('|')) {
      await tab.locator(selector).first().click()
      await tab.waitForTimeout(200)
    }
  }
  if (options.keys) {
    for (const key of options.keys.split('|')) {
      await tab.keyboard.press(key)
      await tab.waitForTimeout(150)
    }
  }
  await tab.waitForTimeout(250)
  const png = await tab.screenshot({ fullPage: options.full })
  await writeFile(join(out, `${name}.png`), png)
  console.log(`${name}.png`)
}

await browser.close()
