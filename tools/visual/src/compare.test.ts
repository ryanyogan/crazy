import { expect, it } from 'vite-plus/test'
import { type Picture, compare } from './compare.ts'

const WHITE = [255, 255, 255, 255]
const BLACK = [0, 0, 0, 255]

/** A white picture with black blocks. */
function picture(width: number, height: number, blocks: number[][] = []): Picture {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) data.set(WHITE, i * 4)
  for (const [x0, y0, w, h] of blocks) {
    for (let y = y0!; y < y0! + h!; y++) {
      for (let x = x0!; x < x0! + w!; x++) data.set(BLACK, (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

it('finds nothing to report between a frame and a faithful screen', () => {
  const frame = picture(40, 20, [[4, 4, 10, 10]])
  const result = compare(frame, picture(40, 20, [[4, 4, 10, 10]]), {
    rail: { x: 0, y: 0, width: 20, height: 20 },
  })
  expect(result.whole).toEqual({ pixels: 0, percent: 0 })
  expect(result.regions.rail).toEqual({ pixels: 0, percent: 0 })
})

it('counts a difference in the region it falls in, and not in the others', () => {
  const frame = picture(40, 20)
  const app = picture(40, 20, [[24, 4, 10, 10]])
  const result = compare(frame, app, {
    rail: { x: 0, y: 0, width: 20, height: 20 },
    main: { x: 20, y: 0, width: 20, height: 20 },
  })
  expect(result.regions.rail!.pixels).toBe(0)
  expect(result.regions.main!.pixels).toBe(100)
  expect(result.regions.main!.percent).toBe(25)
  expect(result.whole.pixels).toBe(100)
  expect(result.whole.percent).toBe(12.5)
})

it('leaves a masked area out of every figure', () => {
  const frame = picture(40, 20)
  const app = picture(40, 20, [[24, 4, 10, 10]])
  const result = compare(frame, app, { main: { x: 20, y: 0, width: 20, height: 20 } }, [
    { x: 24, y: 4, width: 10, height: 10, why: 'not built yet' },
  ])
  expect(result.whole.pixels).toBe(0)
  // The region's share is of what was compared: 400 pixels less the 100 masked.
  expect(result.regions.main).toEqual({ pixels: 0, percent: 0 })
})

it('refuses pictures of different sizes and regions outside the frame', () => {
  expect(() => compare(picture(40, 20), picture(40, 30))).toThrow(/Sizes differ/)
  expect(() =>
    compare(picture(40, 20), picture(40, 20), { lost: { x: 50, y: 0, width: 5, height: 5 } }),
  ).toThrow(/outside the frame/)
})
