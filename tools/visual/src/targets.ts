import type { Mask, Rect } from './compare.ts'

// What can be compared: each frame of the canvas that draws a route, the
// persona and moment it shows, and the parts worth a figure of their own.
// Rectangles are in frame pixels, measured on the frame.

export const DESKTOP = 1180
export const PHONE = 390
export type Width = typeof DESKTOP | typeof PHONE

/** Who a frame shows. The app must be running as this persona. */
export interface Persona {
  /** The sample user the mockup draws, and the persona that stands in for them. */
  replaces: [from: string, to: string][]
}

export const PERSONAS = {
  // The demo user, which is who the app runs as with no Clerk keys configured.
  ryan: {
    replaces: [
      ['Mara Okafor', 'Ryan Yogan'],
      ['Mara', 'Ryan'],
      ['>MO<', '>RY<'],
    ],
  },
} satisfies Record<string, Persona>

/** The wordmark reads CRAZY where the frames read TODAY (docs/BRIEF.md). */
export const WORDMARK: [from: RegExp, to: string] = [/(letter-spacing:\.04em">)TODAY</g, '$1CRAZY<']

/**
 * Words the app says differently on purpose, so the frame is drawn saying them
 * too. The glossary (CONTEXT.md) calls the Rollover's outcome "sent back" and
 * lists the frame's wording among the ones to avoid.
 */
export const COPY: [from: string, to: string][] = [
  ['1 moved to backlog', '1 sent back'],
  // "Follow-up" is loose talk for all three kinds of Signal; the card lists Mentions.
  ['>Mentions &amp; follow-ups<', '>Mentions<'],
  // "Group" and "tool" are the words the glossary keeps off a Circle and a
  // Provider, and frame 1e uses each as the name of the thing.
  ['Four groups this week.', 'Four Circles this week.'],
  ['which tools the work lives in', 'which Providers the work lives in'],
]

export interface View {
  regions: Record<string, Rect>
  masks: Mask[]
}

export interface Target {
  /** The option's id on the canvas, which is also what a developer names: "1a". */
  frame: string
  title: string
  route: string
  persona: keyof typeof PERSONAS
  /** The moment the frame shows, on the persona's wall clock. */
  now: string
  desktop: View
  /** Null where no phone frame is drawn: the phone layout is derived. */
  phone: View | null
}

/** Wednesday 17 Sep 2025, 08:41: "It is Wednesday 08:41" in the first mockup. */
const RYANS_MORNING = '2025-09-17T08:41'

const WOKE_AT =
  'When the Coordinator last woke is read off the real clock, not the pinned one: the frame says 08:59'

const BELOW_THE_STACK =
  'The phone frame stops at the Priority stack. On a phone, Mentions and the place to add a Todo follow it (derived, docs/BRIEF.md); this is not a debt'

const FOOT_UNDRAWN =
  'This frame leaves the foot of the rail empty; frame 1a draws it (Live and the user), and the Shell follows 1a'

/**
 * The rail is the same in every Billing-off frame, but only 1a draws its foot:
 * the Live line above the user, 18px up from the bottom edge. Only the digits
 * of its wake time are masked.
 */
function desktop(
  height: number,
  foot: 'drawn' | 'undrawn',
  regions: Record<string, Rect> = {},
  masks: Mask[] = [],
): View {
  return {
    regions: { rail: { x: 0, y: 0, width: 168, height }, ...regions },
    masks: [
      foot === 'drawn'
        ? { x: 80, y: height - 66, width: 28, height: 15, why: WOKE_AT }
        : { x: 16, y: height - 68, width: 136, height: 50, why: FOOT_UNDRAWN },
      ...masks,
    ],
  }
}

/** A screen drawn on desktop only, at Ryan's morning. */
function drawn(
  frame: string,
  title: string,
  route: string,
  height: number,
  regions: Record<string, Rect> = {},
  masks: Mask[] = [],
): Target {
  return {
    frame,
    title,
    route,
    persona: 'ryan',
    now: RYANS_MORNING,
    desktop: desktop(height, 'undrawn', regions, masks),
    phone: null,
  }
}

/** The left edge of each of the seven day cards' bar strips; they sit at one height. */
const BAR_STRIPS = [207, 345, 484, 622, 760, 898, 1037]

const MEETING_BARS =
  "The meetings bar. The frame draws Monday's two meetings at 40% and Thursday's one at 30%, Wednesday's three at 60% and Friday's two at 50%: no scale counts meetings that way, and nor do their hours (Wednesday holds two of them). The app counts meetings on the same scale as the Todos beside them. The two Todo bars are compared"

const HAND_ROUNDED_BARS =
  "The top edge of a day's done or planned bar, one or two pixels of it. The app draws the count of Todos over the week's largest count; the frame's percentages are hand-rounded to a multiple of five (Monday draws 6 of 7 as 90%, not 86%). Measured in pixels of the 36px strip, frame against app: Mon done 34/32, Tue done 26/27, Wed planned 37/37, Thu planned 23/22, Fri planned 17/17, Sat planned 7/6, Sun planned 5/6 — so Wednesday and Friday need nothing. A debt for the designer: it goes when the bars' scale is settled"

/**
 * The bars of the seven day cards: the meetings third of each strip, and the
 * top edge of the two Todo bars, where the frame's hand-rounded percentages
 * and the app's counts differ by a pixel or two.
 */
const DAY_BARS: Mask[] = [
  ...BAR_STRIPS.map((x) => ({ x: x + 70, y: 247, width: 34, height: 36, why: MEETING_BARS })),
  // The pixels a bar's top edge differs by, day by day: the done bar's third of
  // the strip on Monday and Tuesday, the planned bar's on Thursday, Saturday
  // and Sunday. Wednesday and Friday agree to the pixel and are compared whole.
  ...(
    [
      ['done', 0, 250, 2],
      ['done', 1, 257, 1],
      ['planned', 3, 261, 1],
      ['planned', 5, 277, 1],
      ['planned', 6, 278, 1],
    ] as const
  ).map(([bar, index, y, height]) => ({
    x: BAR_STRIPS[index]! + (bar === 'done' ? 0 : 35),
    y,
    width: 34,
    height,
    why: HAND_ROUNDED_BARS,
  })),
]

export const TARGETS: Target[] = [
  {
    frame: '1a',
    title: 'Today',
    route: '/',
    persona: 'ryan',
    now: RYANS_MORNING,
    // Blueprint cards are measured with their corner marks, 6px beyond the box.
    desktop: desktop(870, 'drawn', {
      brief: { x: 168, y: 0, width: 632, height: 196 },
      'take on now': { x: 805, y: 15, width: 354, height: 174 },
      timeline: { x: 168, y: 196, width: 632, height: 454 },
      'priority stack': { x: 805, y: 198, width: 354, height: 404 },
      mentions: { x: 805, y: 602, width: 354, height: 198 },
      'add a todo': { x: 805, y: 800, width: 354, height: 40 },
    }),
    phone: {
      regions: {
        'top bar': { x: 0, y: 0, width: 390, height: 42 },
        brief: { x: 0, y: 42, width: 390, height: 90 },
        'take on now': { x: 0, y: 132, width: 390, height: 106 },
        timeline: { x: 0, y: 238, width: 390, height: 50 },
        'priority stack': { x: 0, y: 288, width: 390, height: 396 },
        'tab bar': { x: 0, y: 825, width: 390, height: 45 },
      },
      masks: [{ x: 0, y: 684, width: 390, height: 141, why: BELOW_THE_STACK }],
    },
  },
  drawn(
    '1c',
    'Week',
    '/week',
    720,
    {
      'state of the union': { x: 196, y: 22, width: 548, height: 161 },
      'week in numbers': { x: 766, y: 16, width: 392, height: 106 },
      'the week': { x: 196, y: 203, width: 956, height: 230 },
      legend: { x: 196, y: 453, width: 956, height: 17 },
      'where you tie in': { x: 190, y: 490, width: 968, height: 128 },
    },
    DAY_BARS,
  ),
  drawn('1d', 'Projects', '/projects', 720),
  {
    ...drawn('1e', 'Circles', '/circles', 680),
    // The figure and the Overlap cards are blueprints: measured with their
    // corner marks, 6px beyond the box.
    desktop: desktop(680, 'undrawn', {
      heading: { x: 190, y: 18, width: 532, height: 88 },
      figure: { x: 190, y: 106, width: 532, height: 460 },
      overlaps: { x: 736, y: 18, width: 424, height: 644 },
    }),
  },
  drawn('1f', 'Metrics', '/metrics', 720),
  drawn('1g', 'Integrations', '/integrations', 680),
]

/** Routes no frame draws at any width. Screenshotted on a phone, never compared. */
export const UNDRAWN: { title: string; route: string }[] = [{ title: 'More', route: '/more' }]
