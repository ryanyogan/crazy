import { CIRCLE_SEATS, LENS_SEATS } from '@crazy/shared'

// Where the Circles figure puts things, in the coordinates frame 1e draws it
// in. These are measurements off the frame, not rules: who sits in which seat,
// and which seats can hold an Overlap between them, are @crazy/shared's
// (packages/shared/src/circles.ts).

/** The figure's own coordinates. It is drawn at whatever width there is. */
export const FIGURE_SIZE = { width: 520, height: 440 } as const

/** A Circle's Providers are written under its count of people; a lens's note under its title. */
export const PEOPLE_LINE_GAP = 16
export const LENS_LINE_GAP = 14

/** One mark for each entry of `List`, in the same order, checked by the compiler. */
type PerEntry<List extends readonly unknown[], Mark> = { [Index in keyof List]: Mark }

interface SeatMark {
  cx: number
  cy: number
  r: number
  /** Where the Circle's name is written, and at what size. */
  name: { x: number; y: number; size: number }
  /** Where its count of people goes; its Providers go a line under. */
  people: { x: number; y: number }
}

/** One mark per seat in CIRCLE_SEATS, in the same order. */
export const SEAT_MARKS: PerEntry<typeof CIRCLE_SEATS, SeatMark> = [
  { cx: 200, cy: 180, r: 130, name: { x: 120, y: 120, size: 16 }, people: { x: 60, y: 190 } },
  { cx: 320, cy: 180, r: 110, name: { x: 345, y: 95, size: 16 }, people: { x: 390, y: 200 } },
  { cx: 250, cy: 290, r: 105, name: { x: 200, y: 385, size: 16 }, people: { x: 150, y: 335 } },
  { cx: 420, cy: 330, r: 70, name: { x: 392, y: 405, size: 14 }, people: { x: 400, y: 324 } },
]

/** One mark per pair in LENS_SEATS, in the same order: where the two seats cross. */
export const LENS_MARKS: PerEntry<typeof LENS_SEATS, { x: number; y: number }> = [
  { x: 260, y: 170 },
  { x: 215, y: 262 },
  { x: 300, y: 270 },
]
