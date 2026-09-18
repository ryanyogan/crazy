import { SOURCE_KINDS, type Side, type SourceKind } from './todo'

// The Circles screen, frame 1e: the groups a user moves in, each with its Side,
// and this week's Overlaps. Crazy infers a Circle; an **Overlap** is not stored
// at all — it is a Todo matched to more than one Circle (CONTEXT.md), so
// everything here is read off those matches.
//
// The rules live here; where the figure puts a seat on screen is the screen's
// (apps/web/src/features/circles/figure.ts).

/** One group of people and Providers, as the screen reads it. */
export interface Circle {
  id: string
  name: string
  side: Side
  /** How many people Crazy has counted in it; null until it has looked. */
  people: number | null
  /** The Providers its work lives in. */
  providers: SourceKind[]
}

/** A Todo matched to more than one Circle: doing it serves both. */
export interface Overlap {
  /** The Todo it is. An Overlap has no identity of its own. */
  todoId: string
  title: string
  /** The Circles the Todo is matched to. Always two or more. */
  circleIds: string[]
  /** Why it serves them; generated text, like the Brief. Null until Crazy writes it. */
  text: string | null
  /** Who is in it, as Crazy words it: "Sam · Lena · Priya". */
  people: string | null
  /** When it lands: "Today 13:00 → 14:00". */
  timing: string | null
  /** The two lines Crazy writes where the two Circles meet, if it wrote any. */
  figure: { title: string; note: string } | null
}

/** What the Circles screen holds, as D1 has it at one moment. */
export interface Circles {
  circles: Circle[]
  overlaps: Overlap[]
}

/**
 * The figure's seats as a shape rather than as pixels: three that cross one
 * another and one that stands apart. The arrangement is frame 1e's, drawn by
 * hand; what is derived is who sits where.
 */
export const CIRCLE_SEATS = [
  { apart: false },
  { apart: false },
  { apart: false },
  { apart: true },
] as const

/** The pairs of seats that cross, and so can hold an Overlap between them. */
export const LENS_SEATS = [
  [0, 1],
  [0, 2],
  [1, 2],
] as const satisfies readonly (readonly [number, number])[]

export interface SeatedCircle {
  circle: Circle
  /** Its place in CIRCLE_SEATS. */
  seatIndex: number
  /**
   * Drawn as a dashed outline rather than washed in. It says the Circle is on
   * the personal Side, never where the figure happened to seat it.
   */
  outline: boolean
}

export interface Lens {
  todoId: string
  /** Its place in LENS_SEATS: the two seats it is written between. */
  at: number
  title: string
  note: string
}

/** An Overlap with the Circles it is matched to, as the screen tags them. */
export interface ViewOverlap extends Overlap {
  circles: Circle[]
}

export interface CirclesView {
  /** The Circles the figure draws, in seat order. */
  seated: SeatedCircle[]
  /** Circles the figure has no seat left for. They are named, never drawn. */
  unseated: Circle[]
  /** The Overlaps written where two seats cross. */
  lenses: Lens[]
  /** This week's Overlaps, the ones serving most Circles first. */
  overlaps: ViewOverlap[]
  /** "Four Circles this week. …" */
  lede: string
}

/** Most people first; a Circle Crazy has not counted follows the ones it has. */
function bySize(a: Circle, b: Circle): number {
  return (b.people ?? -1) - (a.people ?? -1) || a.name.localeCompare(b.name, 'en')
}

/**
 * Gives each Circle a seat in the figure. A personal Circle takes the seat that
 * stands apart from the cluster, because that is what the Side means here, and
 * the work Circles take the crossing seats, the one with most people first.
 * Whichever seats that leaves are filled rather than left empty, and a Circle
 * with no seat at all is named beside the figure rather than dropped.
 */
function seatCircles(circles: readonly Circle[]): {
  seated: SeatedCircle[]
  unseated: Circle[]
} {
  const free = CIRCLE_SEATS.map((seat, seatIndex) => ({ ...seat, seatIndex }))
  const seated: SeatedCircle[] = []
  const unseated: Circle[] = []

  const sit = (circle: Circle, at: number) => {
    const [taken] = free.splice(at, 1)
    if (taken) {
      seated.push({ circle, seatIndex: taken.seatIndex, outline: circle.side === 'personal' })
    }
  }

  const ordered = [...circles].sort(bySize)
  const left = ordered.filter((circle) => {
    const at = free.findIndex(({ apart }) => apart === (circle.side === 'personal'))
    if (at < 0) return true
    sit(circle, at)
    return false
  })
  for (const circle of left) {
    if (free.length === 0) unseated.push(circle)
    else sit(circle, 0)
  }

  seated.sort((a, b) => a.seatIndex - b.seatIndex)
  return { seated, unseated }
}

/** The Overlaps written where two seats cross. One lens holds one Overlap. */
function lensesFor(seated: readonly SeatedCircle[], overlaps: readonly Overlap[]): Lens[] {
  const seatOf = new Map(seated.map(({ circle, seatIndex }) => [circle.id, seatIndex]))
  const written = new Set<string>()

  return LENS_SEATS.flatMap((pair, at) => {
    const overlap = overlaps.find((each) => {
      if (!each.figure || written.has(each.todoId)) return false
      const seats = each.circleIds.map((id) => seatOf.get(id))
      return pair.every((seat) => seats.includes(seat))
    })
    if (!overlap?.figure) return []
    written.add(overlap.todoId)
    return [{ todoId: overlap.todoId, at, ...overlap.figure }]
  })
}

/** How many, in words, up to the ten a screen can hold. */
const COUNTS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
] as const

function countWord(count: number): string {
  return COUNTS[count] ?? String(count)
}

/** "12 people", "1 person"; nothing where Crazy has not counted. */
export function peopleLabel(people: number | null): string | null {
  if (people === null) return null
  return `${people} ${people === 1 ? 'person' : 'people'}`
}

/** "Slack · Linear": the Providers a Circle's work lives in. */
export function providersLabel(providers: readonly SourceKind[]): string | null {
  if (providers.length === 0) return null
  return providers.map((kind) => SOURCE_KINDS[kind].short).join(' · ')
}

/** "Sam · Lena · Priya · Today 13:00 → 14:00", leaving out whatever Crazy has not said. */
export function overlapMeta(overlap: Pick<Overlap, 'people' | 'timing'>): string | null {
  const parts = [overlap.people, overlap.timing].filter((part) => part !== null)
  return parts.length === 0 ? null : parts.join(' · ')
}

/** Everything the Circles screen derives from what D1 holds. */
export function viewCircles(circles: Circles): CirclesView {
  const { seated, unseated } = seatCircles(circles.circles)
  const byId = new Map(circles.circles.map((circle) => [circle.id, circle]))
  // Serving more Circles counts for more; a tie keeps the order it arrived in,
  // which is the oldest Overlap first.
  const overlaps = [...circles.overlaps]
    .sort((a, b) => b.circleIds.length - a.circleIds.length)
    .map((overlap) => ({
      ...overlap,
      circles: overlap.circleIds.map((id) => byId.get(id)).filter((circle) => circle !== undefined),
    }))
  const count = circles.circles.length

  return {
    seated,
    unseated,
    lenses: lensesFor(seated, overlaps),
    overlaps,
    lede: `${countWord(count)} ${count === 1 ? 'Circle' : 'Circles'} this week. Overlaps are where a single todo serves two circles; those get scored higher.`,
  }
}
