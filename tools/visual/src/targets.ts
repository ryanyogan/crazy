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
  // The glossary's word is Todo, and the card is the Priority stack: an
  // ordering of Todos and not a list of its own. Frame 2a's heading says what
  // the control on each row is for, which is worth keeping.
  [
    '>Todos · press ▸ to start a timer on one<',
    '>Priority stack · press ▸ to start a timer on one<',
  ],
  // A Client is a Client, capitalised, wherever the app says it (CONTEXT.md).
  ['>This week by client<', '>This week by Client<'],
  // Frame 3a's picker gives one Project a qualifier as part of its name. The
  // Project is called Admin; that it is not billable follows from its having
  // no Client, which is what the Internal group it sits under already says.
  ['Admin · not billable', 'Admin'],
  // Frame 2b's timesheet flags the two spells tracked to Internal as needing a
  // project. In the glossary they need a **Client**: Internal is the absence of
  // a Client, and a Client with no Project is a perfectly good One-off. The
  // words are the app's and the frame is drawn saying them, so that the table's
  // columns fall where the frame's own layout puts them.
  ['2 entries need a project', '2 entries need a Client'],
  ['project? likely Quill', 'Client? likely Quill &amp; Co'],
  ['I think both were Quill; tap to confirm.', 'I think both were Quill &amp; Co; tap to confirm.'],
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

/**
 * One frame's piece put into another frame's screen. Frame 2a draws the timer
 * as a segmented picker the app does not have; the bar it does have is frame
 * 3a's, which is drawn on its own beside it. Rather than mask the whole band
 * and compare nothing there, the harness puts 3a's card into 2a's bar — which
 * is what the canvas itself suggests trying next under frame 3a ("put the 3a
 * bar into 2a") — so the screen below it stands where the app stands it.
 */
export interface Compose {
  /** The band of this frame's card that the other frame's card goes into. */
  replace: string
  /** Which card goes in it, and the width it is drawn at. */
  with: { option: string; card: number; width: number }
  /** What the band keeps of its own: the edges the screen around it gives it. */
  band: string
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
  /** Another frame's card put into a band of this one's (desktop only). */
  compose?: Compose
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
  'Below the bar: either side of the dropdown, and the strip under its foot. Frame 3a draws the open picker on a card 410px tall so that the panel has something to hang in; in the app the panel hangs over the Today screen, which is what fills these bands. The bar and the dropdown are compared'

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

const RAIL_CIRCLES =
  "The foot of the rail's nav. Frame 2a lists seven destinations and leaves Circles out; the Shell keeps Circles with the Billing module on, because a Circle is how work and life are told apart and turning on billing does not stop a person having both (ticket 16). The five destinations above it are compared"

const WOKE_AT_2A =
  'The Live line. Frame 2a writes "Live" alone where frame 1a writes "Live · woke 08:59"; the Shell follows 1a, and when the Coordinator last woke is read off the real clock rather than the pinned one'

const LOGGED_ON_THE_HOUR =
  'The tracked figures on the two hours the running entry spans. The frame puts the whole spell — 1:42 — on the hour it began and leaves the next blank; the app counts each hour\'s own share of it (1:00 and 0:42), which is what "logged time per hour" means and what makes the column add up to the day. The other seven hours\' figures are compared'

const WHOSE_MEETING =
  "The meeting hour's Client rule and chip. The frame says the 11:00 hour is Quill's, from the meeting in the calendar; the app says whose an hour is from what was tracked in it and what is slotted on it, and Crazy never reads a Client off a Provider's calendar. The hour's words and its tint are compared"

const START_GLYPH =
  "The glyph inside the control on each Todo. The frame draws the character ▸; the app draws Lucide's play at stroke 1.5, as every other icon in the app is drawn, and the Todo the timer is on wears a solid mark in its place. The control's box is compared"

const PAST_THE_FRAME =
  "The 17:00 hour. Frame 2a's card is 780px tall and its timeline runs out at 16:00; the app draws the day to 17:00 as frame 1a does, and the row falls where the frame has nothing"

const WEEK_FIGURES =
  'The rows of "This week by Client". The frame quotes hours from no timesheet in the mockups (14h 05m for Meridian against a 28h month, 17h 50m for Bramble) and lists three Clients; the app counts Cori\'s seeded Time entries since Monday, orders them by hours, and lists Internal as well, because work for nobody is still work. The card\'s heading and its edges are compared'

const BELOW_THE_WEEK =
  'Below the two cards frame 2a draws. Mentions and the place to add a Todo follow them on the Today screen, as they do in frame 1a; this frame has nothing there'

/*
 * A note for Cori's other frames, when their tickets add them (2b, 2c, 4a):
 * shoot them with `timer: 'idle'`. With a Time entry running the Shell draws
 * the compact time header over every screen (ticket 27) — a 44px strip at the
 * top on desktop, a 48px dock above the tab bar on a phone — and none of those
 * frames draws it. Frame 2a is the exception: it is the Today screen, where the
 * full bar is drawn and the header keeps away.
 */

const BOTH_DESTINATIONS =
  'The Invoices destination. Frame 2b is one page for Time and Invoices and marks both in the accent; the Shell has a screen for each, so only the one the user is on is marked'

const STILL_RUNNING =
  "What says the first entry is still running: the dash after 09:00, the word under the note, and Wednesday's caption. The shot is taken with the timer stopped, because a running entry puts the Shell's compact header over every screen (ticket 27) and frame 2b draws none — the only way to see this screen at the frame's pinned moment (ticket 17's Comments). The hours the entry came to are the same either way and are compared"

const RAIL_FOOT_2B =
  'The foot of the rail. Frame 2b puts the accounting targets there ("Synced to · QuickBooks · 09:00"); the Shell follows frame 1a on every screen (Live, then the user), and the targets are the Time screen\'s own, where the app draws them — plainly not wired, because Crazy has sent nothing anywhere'

const THE_INVOICES_HALF =
  "The right-hand column. Frame 2b is one page for Time and Invoices — its rail marks both destinations — and the Shell has a screen for each. The Invoices column is ticket 21's; until then the column holds what the Time screen itself can say: the period's figures, and where the hours are meant to go"

const PERIOD_NAV =
  'The way between periods. Frame 2b draws none: it shows week 38 and no way to reach week 37. A timesheet that cannot go back to last week is no use at month-end, so the app puts previous, "this week" and next between the heading and the views (derived, docs/BRIEF.md)'

const CONFIRM_IS_A_CONTROL =
  "The flag beside a note that names no Client. The frame draws it as grey text; in the app it is the one-tap Confirm the frame's own sentence promises, so it wears the accent and an underline. Its words are the app's in both (COPY)"

const THE_ADD_FIELD =
  'What the field to add an entry says. Frame 2b promises to read "2h Meridian synthesis yesterday afternoon" into hours; Crazy does not parse a sentence, and a field that looked as if it did would be faked. The field takes the new entry\'s note and Add opens the row for its times. The field, the button and their box are compared'

const DAY_CARD_FIGURES_WHY =
  "A day card's figure, bar and line. Frame 2b's daily totals do not add up to the entries the frame itself lists — Monday's two rows come to 6:00 and its card says 7:45, Wednesday's to 2:02 against 3:10 — and its bars are hand-drawn percentages; Thursday and Friday are captioned from a calendar and an invoice cycle that are not this screen's. The app counts Cori's real entries, draws each day against the fullest one, and says what the day holds. The cards themselves, their boxes and their day names are compared. A debt for the designer"

/** The five day cards' innards: the figure, the bar and the line under it. */
const DAY_CARD_FIGURES: Mask[] = [0, 1, 2, 3, 4].flatMap((index) => {
  const x = 196 + index * 107.6
  return [
    { x: x + 34, y: 88, width: 58, height: 29, why: DAY_CARD_FIGURES_WHY },
    { x: x + 10, y: 117, width: 79, height: 56, why: DAY_CARD_FIGURES_WHY },
  ]
})

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
        { x: 176, y: 392, width: 420, height: 18, why: CARD_NOT_SCREEN },
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
    frame: '2a',
    title: 'Today · the Billing module on',
    route: '/',
    persona: 'cori',
    now: CORIS_MORNING,
    // Frame 3a's running bar in place of frame 2a's segmented picker, which is
    // a control the app does not have. The band keeps the hairline onto the
    // screen that 2a gives it, which is the one the app draws too.
    compose: {
      replace: 'main > div:first-child',
      with: { option: '3a', card: 1, width: TIMER_BAR },
      band: 'width:auto;border-bottom:1px solid var(--color-accent-300)',
    },
    desktop: {
      regions: {
        rail: { x: 0, y: 0, width: 168, height: 780 },
        brief: { x: 168, y: 101, width: 632, height: 160 },
        timeline: { x: 190, y: 261, width: 600, height: 350 },
        // The two cards are blueprints: measured with their corner marks, 6px
        // beyond the box.
        'priority stack': { x: 805, y: 115, width: 354, height: 290 },
        'this week by client': { x: 805, y: 405, width: 354, height: 285 },
      },
      masks: [
        { x: 308, y: 20, width: 30, height: 26, why: SEEDED_FIGURES },
        { x: 852, y: 20, width: 296, height: 26, why: SEEDED_FIGURES },
        { x: 194, y: 60, width: 416, height: 28, why: SEEDED_NOTE },
        {
          x: 610,
          y: 60,
          width: 302,
          height: 28,
          why: "The sentence beside the note field, which frame 3a's running card draws as a note about the mockup",
        },
        { x: 16, y: 232, width: 140, height: 96, why: RAIL_CIRCLES },
        { x: 16, y: 704, width: 140, height: 26, why: WOKE_AT_2A },
        { x: 745, y: 298, width: 45, height: 72, why: LOGGED_ON_THE_HOUR },
        { x: 255, y: 388, width: 470, height: 28, why: WHOSE_MEETING },
        { x: 1114, y: 163, width: 26, height: 212, why: START_GLYPH },
        { x: 190, y: 608, width: 600, height: 80, why: PAST_THE_FRAME },
        { x: 804, y: 446, width: 354, height: 250, why: WEEK_FIGURES },
        { x: 804, y: 690, width: 354, height: 90, why: BELOW_THE_WEEK },
      ],
    },
    /*
     * Frame 2a's phone card is not compared, and is a screenshot instead. It
     * draws the timer as a solid accent card with Stop and Switch project on
     * it, where frame 3b draws the same control as a tinted card with the
     * square — and 3b is the one ticket 17 built and the one frozen here, so
     * the two frames cannot both be met. Everything below the card sits at a
     * different height for that reason alone, and a comparison of it would be
     * masks and nothing else. Frame 2a's phone also leaves the Brief out
     * altogether; the app keeps it, because a Brief is the first thing the
     * screen is for. Listed as derived in docs/BRIEF.md.
     */
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
  {
    frame: '2b',
    title: 'Time · the timesheet',
    route: '/time',
    persona: 'cori',
    now: CORIS_MORNING,
    // Frame 2b draws no time header, so the timer is stopped for the shot (see
    // the note above). Its timesheet draws the entry as still running, so the
    // three places that say so are masked with that reason.
    timer: 'idle',
    desktop: {
      regions: {
        rail: { x: 0, y: 0, width: 168, height: 820 },
        head: { x: 196, y: 22, width: 528, height: 43 },
        // The cards are blueprints: measured with their corner marks, 6px
        // beyond the box.
        'day cards': { x: 190, y: 73, width: 540, height: 113 },
        entries: { x: 196, y: 194, width: 528, height: 375 },
        flag: { x: 196, y: 583, width: 528, height: 40 },
        'add an entry': { x: 196, y: 637, width: 528, height: 36 },
      },
      masks: [
        { x: 16, y: 196, width: 140, height: 28, why: BOTH_DESTINATIONS },
        { x: 16, y: 232, width: 140, height: 96, why: RAIL_CIRCLES },
        { x: 8, y: 690, width: 152, height: 130, why: RAIL_FOOT_2B },
        { x: 724, y: 0, width: 456, height: 820, why: THE_INVOICES_HALF },
        { x: 396, y: 28, width: 130, height: 34, why: PERIOD_NAV },
        ...DAY_CARD_FIGURES,
        { x: 246, y: 242, width: 16, height: 22, why: STILL_RUNNING },
        { x: 384, y: 236, width: 240, height: 38, why: STILL_RUNNING },
        { x: 505, y: 292, width: 120, height: 22, why: CONFIRM_IS_A_CONTROL },
        { x: 461, y: 379, width: 120, height: 22, why: CONFIRM_IS_A_CONTROL },
        { x: 200, y: 643, width: 352, height: 24, why: THE_ADD_FIELD },
      ],
    },
    /*
     * No phone frame: the Time screen's 390px layout is derived — one column,
     * each entry a compact two-line row, and the editor in the bottom sheet
     * rather than inside a row. Listed as derived in docs/BRIEF.md and
     * screenshotted, never compared.
     */
    phone: null,
  },
]

/** Routes no frame draws at any width. Screenshotted on a phone, never compared. */
export const UNDRAWN: { title: string; route: string }[] = [{ title: 'More', route: '/more' }]
