import pixelmatch from 'pixelmatch'

// Compares two screenshots of the same size. Pure: RGBA bytes in, figures and
// a diff picture out.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** A part of the frame the app is known not to match yet, left out of the figures. */
export interface Mask extends Rect {
  why: string
}

export interface Picture {
  width: number
  height: number
  /** RGBA, four bytes a pixel. */
  data: Uint8Array
}

export interface Mismatch {
  /** Pixels that differ beyond anti-aliasing, masks excluded. */
  pixels: number
  /** The same as a share of the pixels compared, 0–100. */
  percent: number
}

export interface Comparison {
  whole: Mismatch
  regions: Record<string, Mismatch>
  /** The app under a wash, differing pixels in red, anti-aliasing in yellow, masks hatched. */
  diff: Picture
}

const MASK_FILL = [128, 128, 128, 255] as const
const HATCH = [90, 90, 90, 255] as const

function clip(rect: Rect, within: Picture): Rect {
  const x = Math.max(0, Math.min(rect.x, within.width))
  const y = Math.max(0, Math.min(rect.y, within.height))
  return {
    x,
    y,
    width: Math.max(0, Math.min(rect.x + rect.width, within.width) - x),
    height: Math.max(0, Math.min(rect.y + rect.height, within.height) - y),
  }
}

function paint(
  picture: Picture,
  rect: Rect,
  colour: (x: number, y: number) => readonly number[] | null,
) {
  const { x: left, y: top, width, height } = clip(rect, picture)
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      const rgba = colour(x, y)
      if (rgba) picture.data.set(rgba, (y * picture.width + x) * 4)
    }
  }
}

/**
 * A rectangle of a picture, as a picture of its own. How a frame that draws a
 * whole screen is compared with one part of it: the frame is cut to the part,
 * and the app is cut to the same size where that part actually sits.
 */
export function cropPicture(picture: Picture, rect: Rect): Picture {
  const { x, y, width, height } = clip(rect, picture)
  const data = new Uint8Array(width * height * 4)
  for (let row = 0; row < height; row++) {
    const from = ((y + row) * picture.width + x) * 4
    data.set(picture.data.subarray(from, from + width * 4), row * width * 4)
  }
  return { width, height, data }
}

function area(rect: Rect, within: Picture): number {
  const { width, height } = clip(rect, within)
  return width * height
}

/**
 * How far `app` is from `frame`. Anti-aliasing is not counted as a mismatch.
 * Masked areas count for nothing, in the whole or in any region they overlap.
 */
export function compare(
  frame: Picture,
  app: Picture,
  regions: Record<string, Rect> = {},
  masks: Mask[] = [],
): Comparison {
  if (frame.width !== app.width || frame.height !== app.height) {
    throw new Error(
      `Sizes differ: frame ${frame.width}×${frame.height}, app ${app.width}×${app.height}`,
    )
  }
  const { width, height } = frame
  const blank = (picture: Picture): Picture => {
    const copy = { ...picture, data: Uint8Array.from(picture.data) }
    for (const mask of masks) paint(copy, mask, () => MASK_FILL)
    return copy
  }
  const left = blank(frame)
  const right = blank(app)

  // Once as a bare mask to count from, once as the picture a person reads.
  const differing = new Uint8Array(width * height * 4)
  pixelmatch(left.data, right.data, differing, width, height, { diffMask: true })
  const diff: Picture = { width, height, data: new Uint8Array(width * height * 4) }
  pixelmatch(left.data, right.data, diff.data, width, height, { alpha: 0.25 })
  for (const mask of masks) {
    paint(diff, mask, (x, y) => ((x + y) % 6 === 0 ? HATCH : null))
  }

  const masked = new Uint8Array(width * height)
  for (const mask of masks) {
    const { x: mx, y: my, width: mw, height: mh } = clip(mask, frame)
    for (let y = my; y < my + mh; y++) masked.fill(1, y * width + mx, y * width + mx + mw)
  }

  const measure = (rect: Rect): Mismatch => {
    const { x: left, y: top, width: w, height: h } = clip(rect, frame)
    let pixels = 0
    let compared = 0
    for (let y = top; y < top + h; y++) {
      for (let x = left; x < left + w; x++) {
        if (masked[y * width + x]) continue
        compared++
        const at = (y * width + x) * 4
        // Red is a mismatch; yellow (green channel set) is anti-aliasing.
        if (differing[at + 3]! > 0 && differing[at + 1]! === 0) pixels++
      }
    }
    return { pixels, percent: compared === 0 ? 0 : (pixels / compared) * 100 }
  }

  return {
    whole: measure({ x: 0, y: 0, width, height }),
    regions: Object.fromEntries(
      Object.entries(regions).map(([name, rect]) => {
        if (area(rect, frame) === 0) throw new Error(`Region "${name}" lies outside the frame`)
        return [name, measure(rect)]
      }),
    ),
    diff,
  }
}
