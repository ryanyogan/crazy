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
  // The second mockup's sample user, who bills three Clients for her time. She
  // is the same demo user with her world laid over, so the app says the demo
  // user's name where the frames say hers.
  cori: {
    replaces: [
      ['Jo Okafor', 'Ryan Yogan'],
      ['Jo', 'Ryan'],
      ['>JO<', '>RY<'],
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
  // "Item" is one of the words the glossary keeps off a Todo, and frame 1d's
  // Today column and lifecycle note both use it as the name of the thing.
  ['>2 items<', '>2 Todos<'],
  ['>1 item<', '>1 Todo<'],
  ['6 backlog items archive in 12 days.', '6 backlog Todos archive in 12 days.'],
  // A Project belongs to one Circle (CONTEXT.md), so no Project is "Platform +
  // Design"; and the Circle frame 1e names "Platform team" is named that here.
  ['Platform + Design', 'Platform team'],
  ['Platform · 12 open', 'Platform team · 12 open'],
  // Crazy words every age the same way, and this one is two days old.
  ['since Tue', '2d'],
  // The frame shortens two of the Todos it lists inside the expanded Project;
  // the app shows each Todo's own title, which is what frame 1a draws.
  ['Finish session-token spike', 'Finish Cloudflare session-token spike'],
  ['Reply to Priya on rate limits', 'Reply to Priya on edge rate limits'],
  // The repo writes British English, here and in the ticket that asked for it.
  ['Backlog aging', 'Backlog ageing'],
  // Frame 3a's picker gives one Project a qualifier as part of its name. The
  // Project is called Admin; that it is not billable follows from its having
  // no Client, which is what the Internal group it sits under already says.
  ['Admin · not billable', 'Admin'],
]

export interface View {
  regions: Record<string, Rect>
  masks: Mask[]
}

/**
 * A frame that draws one piece of a screen rather than the whole of it. The
 * frame's card is that wide, and the app is compared with the element where it
 * actually sits, cropped to the frame's own height.
 */
export interface Part {
  selector: string
  width: number
  /**
   * Which edge of the element the frame's height is measured from. A frame of
   * something that rises from the bottom of the screen — frame 3b's sheet — is
   * a frame of its foot, so its height is counted back from the bottom edge.
   */
  from?: 'top' | 'bottom'
}

export interface Target {
  /** What a developer names: usually the option's id on the canvas, "1a". */
  frame: string
  /** The option on the canvas, where several targets share one: frame 3a's two states. */
  option?: string
  /** Which card of that option, where it draws more than one at a width. */
  card?: number
  title: string
  route: string
  persona: keyof typeof PERSONAS
  /** The moment the frame shows, on the persona's wall clock. */
  now: string
  /** Seeded with the persona's timer already stopped: the only way to see the idle bar. */
  timer?: 'idle'
  /**
   * A control the harness presses before the shot, so that a frame of
   * something opened is reached by opening it. The app holds no state for the
   * harness's sake: frames 3a (open) and 3b are the picker, pressed open.
   */
  open?: string
  part?: Part
  /** Null where no desktop frame is drawn: frame 3b's sheet is a phone's. */
  desktop: View | null
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

const DONE_TODAY =
  "The foot of the expanded Project: the third row of \"Today's children\", which the frame draws as a Todo completed today (struck through), and the card's bottom edge, which sits 20px higher without it. Seeding a Todo done today would put a done row under frame 1a's Priority stack, which is frozen at 0.00%, so the seed has none and the card draws the two that are open. Every other row of the card agrees with the frame to the pixel. A debt for the designer: the two frames cannot both be right"

const BACKLOG_COUNT =
  'The backlog count inside the expanded Project. The frame says 12 open, Backlog · 9 and 2 on today, and 9 + 2 is 11: the three numbers cannot all be true. The app counts what it holds — 10 waiting and 2 on today — and honours the open count the table draws. A debt for the designer'

/** What frame 1d draws inside the expanded Project that the app knowingly does not. */
const PROJECT_CARD: Mask[] = [
  { x: 190, y: 608, width: 580, height: 44, why: DONE_TODAY },
  { x: 486, y: 520, width: 80, height: 20, why: BACKLOG_COUNT },
]

const FOCUS_BARS =
  'The bars of "Focus hours by hour of day". Frame 1f gives each bar a percentage height inside a grid row of automatic height, which resolves to nothing, so the frame draws ten labels and no bars at all. The app puts the bar in a row of its own so the percentage has something to be a percentage of, and draws them; the hour labels underneath keep the frame\'s baseline to the pixel and are compared. A debt for the designer: it goes when the frame draws its own bars'

/** Wednesday 17 Sep 2025, 10:42: 1h 42m into Meridian's synthesis in the second mockup. */
const CORIS_MORNING = '2025-09-17T10:42'

/** The timer bar is as wide as the screen beside the rail: 1180 less the rail's 168. */
const TIMER_BAR = 1012

const SEEDED_FIGURES =
  "The bar's own figures. Frame 3a is drawn on its own beside the timesheet frames and quotes hours that are not in any of them (today 1h 28m, Meridian today 2h 05m, last stopped 08:55, and a running entry 17 seconds past the minute). The app counts what Cori's seeded Time entries actually come to at the pinned moment, which is what makes the numbers real. A debt for the designer: 3a and 2b cannot both be right"

const SEEDED_NOTE =
  "The words inside the note field. The frame draws it empty, showing its placeholder; the Time entry Cori has running is seeded with the note frame 2b's timesheet gives it, so the field shows that instead. The field itself is compared"

const CARD_NOT_SCREEN =
  'Below the bar, on either side of the dropdown. Frame 3a draws the open picker on a card 410px tall so that the panel has something to hang in; in the app the panel hangs over the Today screen, which is what fills these two bands. The bar and the dropdown are compared'

const NOTE_BEHIND_THE_PICKER =
  "The part of the note field that the dropdown does not cover. Frame 3a's open card leaves the note out — the panel is drawn over where it sits — and the app does not take a running entry's note away while its picker is open"

const OPEN_CARD_ROW =
  "The bar's own row: the trigger, and the line that says how to drive the list. Frame 3a's open card lays that row out from the top of the card and nudges the line down 8px; its idle and running cards centre the row, which is what the app does and what those two frames are compared against. Two or three pixels, in the one card of the three that differs. A debt for the designer"

const SEARCH_FOCUSED =
  "The search field. It takes the focus as the list opens, so the app draws it wearing the accent focus ring every control here keeps; the frame draws no focus anywhere. The field is otherwise the frame's, and what it holds is compared through the rows below it"

const ABOVE_THE_CLIENTS =
  "Everything above the first Client. Frame 3b paints the screen behind the sheet as one flat panel, where the app dims the Today screen it is over; and the app's sheet has a taller head than the frame's card has room for at 560px — its handle and heading, the search field, the work timed lately that a thumb reaches first, and the place to name a Project, which frame 3b's sheet leaves out although its dropdown has one. The sheet is anchored to the bottom edge, so the Clients and their Projects — what the sheet is for — sit in the same places in both, and are compared"

const PICKER_FIGURES =
  "The picker's right-hand column: the hours each Client has had and what each Project last did. The frame quotes hours that are in no timesheet in the mockups (14h 05m for Meridian, 6h 30m for Quill), and gives each Project a line of a different kind — a meeting from the calendar, an hour left on a retainer. The app counts this week from Cori's seeded Time entries and says when the Project was last timed. A debt for the designer: the column needs one meaning"

/**
 * Frame 3a draws the timer bar on its own, at the width of the screen beside
 * the rail, and draws its idle and running states as separate cards. Each is
 * compared with the bar where it sits at the top of the Today screen.
 */
function timerBar(frame: string, title: string, card: number, masks: Mask[]): Target {
  return {
    frame,
    option: '3a',
    card,
    title,
    route: '/',
    persona: 'cori',
    now: CORIS_MORNING,
    ...(card === 0 ? { timer: 'idle' as const } : {}),
    part: { selector: '.timer__bar', width: TIMER_BAR },
    desktop: { regions: {}, masks },
    // The phone timer is frame 3b's, which the bottom sheet comes with (ticket 18).
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
  {
    ...drawn('1d', 'Projects', '/projects', 720),
    // The expanded Project and the two Signal cards are blueprints: measured
    // with their corner marks, 6px beyond the box.
    desktop: desktop(
      720,
      'undrawn',
      {
        heading: { x: 196, y: 22, width: 568, height: 43 },
        projects: { x: 196, y: 77, width: 568, height: 398 },
        expanded: { x: 190, y: 481, width: 580, height: 170 },
        promises: { x: 786, y: 16, width: 372, height: 243 },
        'waiting on': { x: 786, y: 263, width: 372, height: 169 },
        lifecycle: { x: 792, y: 442, width: 360, height: 36 },
      },
      PROJECT_CARD,
    ),
  },
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
  drawn(
    '1f',
    'Metrics',
    '/metrics',
    720,
    {
      head: { x: 196, y: 22, width: 956, height: 43 },
      // The six figures and the three charts are blueprints: measured with
      // their corner marks, 6px beyond the box.
      'headline figures': { x: 190, y: 79, width: 968, height: 109 },
      'focus by hour': { x: 190, y: 196, width: 373, height: 262 },
      'backlog ageing': { x: 571, y: 196, width: 290, height: 262 },
      'todo sources': { x: 868, y: 196, width: 290, height: 262 },
      'the last 30 days': { x: 196, y: 471, width: 956, height: 61 },
    },
    [{ x: 212, y: 262, width: 329, height: 132, why: FOCUS_BARS }],
  ),
  drawn('1g', 'Integrations', '/integrations', 680),
  timerBar('3a', 'Today · timer idle', 0, [
    {
      x: 0,
      y: 64,
      width: TIMER_BAR,
      height: 23,
      why: 'The frame\'s last line — "idle · dropdown preselects the most likely project from your calendar and last entry" — is a note about the mockup, not anything the bar says, so the app\'s bar ends above it and the screen below shows through the band',
    },
    { x: 690, y: 20, width: 306, height: 24, why: SEEDED_FIGURES },
  ]),
  timerBar('3a-running', 'Today · timer running', 1, [
    {
      x: 440,
      y: 58,
      width: 340,
      height: 30,
      why: 'The sentence beside the note field — "Changing the dropdown while running splits the entry at now." — is a note about the mockup, and describes the switch, which is ticket 18\'s',
    },
    { x: 690, y: 20, width: 306, height: 24, why: SEEDED_FIGURES },
    { x: 140, y: 22, width: 28, height: 24, why: SEEDED_FIGURES },
    { x: 26, y: 60, width: 410, height: 26, why: SEEDED_NOTE },
  ]),
  {
    frame: '3a-open',
    option: '3a',
    card: 2,
    title: 'Today · timer picker open',
    route: '/',
    persona: 'cori',
    now: CORIS_MORNING,
    open: '.timer__pick',
    part: { selector: '.timer__bar', width: TIMER_BAR },
    desktop: {
      // The dropdown itself, which is what this frame is of.
      regions: { picker: { x: 176, y: 56, width: 420, height: 320 } },
      masks: [
        { x: 0, y: 101, width: 176, height: 309, why: CARD_NOT_SCREEN },
        { x: 596, y: 101, width: 416, height: 309, why: CARD_NOT_SCREEN },
        { x: 18, y: 54, width: 158, height: 38, why: NOTE_BEHIND_THE_PICKER },
        { x: 466, y: 100, width: 130, height: 240, why: PICKER_FIGURES },
        { x: 138, y: 24, width: 26, height: 26, why: SEEDED_FIGURES },
        { x: 176, y: 10, width: 420, height: 42, why: OPEN_CARD_ROW },
        { x: 830, y: 10, width: 182, height: 32, why: OPEN_CARD_ROW },
        { x: 184, y: 60, width: 424, height: 40, why: SEARCH_FOCUSED },
      ],
    },
    phone: null,
  },
  {
    frame: '3b',
    option: '3b',
    card: 1,
    title: 'Today · the picker as a bottom sheet',
    route: '/',
    persona: 'cori',
    now: CORIS_MORNING,
    open: '.timer__pick',
    // The sheet rises from the bottom edge, so the frame is of its foot.
    part: { selector: 'dialog.sheet', width: PHONE, from: 'bottom' },
    desktop: null,
    phone: {
      regions: { clients: { x: 0, y: 178, width: PHONE, height: 382 } },
      masks: [
        { x: 0, y: 0, width: PHONE, height: 178, why: ABOVE_THE_CLIENTS },
        { x: 250, y: 200, width: 126, height: 330, why: PICKER_FIGURES },
      ],
    },
  },
]

/** Routes no frame draws at any width. Screenshotted on a phone, never compared. */
export const UNDRAWN: { title: string; route: string }[] = [{ title: 'More', route: '/more' }]
