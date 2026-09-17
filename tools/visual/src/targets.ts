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

const NOT_LIVE = 'The Live indicator says "Not live yet" until the socket exists (ticket 06)'

const BELOW_THE_STACK =
  'The phone frame stops at the Priority stack. On a phone, Mentions and the place to add a Todo follow it (derived, docs/BRIEF.md); this is not a debt'

const FOOT_UNDRAWN =
  'This frame leaves the foot of the rail empty; frame 1a draws it (Live and the user), and the Shell follows 1a'

/**
 * The rail is the same in every Billing-off frame, but only 1a draws its foot:
 * the Live line above the user, 18px up from the bottom edge.
 */
function desktop(
  height: number,
  foot: 'drawn' | 'undrawn',
  regions: Record<string, Rect> = {},
): View {
  return {
    regions: { rail: { x: 0, y: 0, width: 168, height }, ...regions },
    masks: [
      foot === 'drawn'
        ? { x: 16, y: height - 68, width: 136, height: 20, why: NOT_LIVE }
        : { x: 16, y: height - 68, width: 136, height: 50, why: FOOT_UNDRAWN },
    ],
  }
}

/** A screen drawn on desktop only, at Ryan's morning. */
function drawn(frame: string, title: string, route: string, height: number): Target {
  return {
    frame,
    title,
    route,
    persona: 'ryan',
    now: RYANS_MORNING,
    desktop: desktop(height, 'undrawn'),
    phone: null,
  }
}

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
      masks: [
        { x: 290, y: 14, width: 82, height: 28, why: NOT_LIVE },
        { x: 0, y: 684, width: 390, height: 141, why: BELOW_THE_STACK },
      ],
    },
  },
  drawn('1c', 'Week', '/week', 720),
  drawn('1d', 'Projects', '/projects', 720),
  drawn('1e', 'Circles', '/circles', 680),
  drawn('1f', 'Metrics', '/metrics', 720),
  drawn('1g', 'Integrations', '/integrations', 680),
]

/** Routes no frame draws at any width. Screenshotted on a phone, never compared. */
export const UNDRAWN: { title: string; route: string }[] = [{ title: 'More', route: '/more' }]
