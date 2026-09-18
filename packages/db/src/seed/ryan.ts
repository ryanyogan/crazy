import {
  type CalendarEventKind,
  type Energy,
  type ProjectStatus,
  type Side,
  type SourceKind,
  SOURCE_KINDS,
  addDays,
  localTimeToInstant,
  startOfDay,
  startOfWeek,
  wallClock,
} from '@crazy/shared'
import type { Prisma } from '../generated/prisma/client'
import type { SeedInput } from './index'

// Ryan: the mockups' first sample user (drawn as Mara Okafor, a platform
// engineering lead), Billing module off. The content is frame 1a's, on the
// mockups' Wednesday. Everything the mockups word as generated — the Brief, the
// stack's order and reasons — is kept as drawn.

interface SeedTodo {
  key: string
  title: string
  project?: string
  minutes: number
  energy: Energy
  reason: string
  source?: { kind: SourceKind; item: string; ref?: string }
  /** Rollovers in a row it has been carried over; it was last touched the day before. */
  carried?: number
  slots: number[]
}

/** The Priority stack, top first. */
const STACK: SeedTodo[] = [
  {
    key: 'spike',
    title: 'Finish Cloudflare session-token spike',
    project: 'auth',
    minutes: 120,
    energy: 'deep_focus',
    reason: "unblocks Priya and Friday's milestone",
    source: { kind: 'linear_issue', item: 'hal-212', ref: 'HAL-212' },
    slots: [9, 10],
  },
  {
    key: 'reply-priya',
    title: 'Reply to Priya on edge rate limits',
    project: 'auth',
    minutes: 15,
    energy: 'quick_win',
    reason: 'Priya asked twice in #platform yesterday',
    source: { kind: 'slack_message', item: 'platform-1758049260' },
    slots: [12],
  },
  {
    key: 'review-sam',
    title: "Review Sam's onboarding PR",
    project: 'onboarding',
    minutes: 45,
    energy: 'deep_focus',
    reason: 'you are the last reviewer before Design ships v2 on Thursday',
    source: { kind: 'linear_issue', item: 'hal-198', ref: 'HAL-198' },
    carried: 1,
    slots: [13],
  },
  {
    key: 'q4-section-2',
    title: 'Draft Q4 priorities, section 2',
    project: 'q4',
    minutes: 60,
    energy: 'deep_focus',
    reason: 'Devon reads the doc on Monday morning',
    source: { kind: 'notion_page', item: 'q4-priorities' },
    carried: 2,
    slots: [15],
  },
  {
    key: 'prep-devon',
    title: 'Prep 1:1 notes for Devon',
    minutes: 20,
    energy: 'people_admin',
    reason: 'your 1:1 with Devon is at 16:30',
    source: { kind: 'calendar_event', item: 'one-to-one-devon' },
    slots: [16],
  },
  {
    key: 'movers-deposit',
    title: 'Send movers deposit',
    project: 'move',
    minutes: 5,
    energy: 'quick_win',
    reason: 'Northside Movers want the deposit by Friday',
    source: { kind: 'gmail_message', item: 'northside-movers-deposit' },
    carried: 1,
    slots: [17],
  },
  {
    key: 'dentist',
    title: 'Book dentist',
    minutes: 5,
    energy: 'quick_win',
    reason: 'five minutes between meetings',
    slots: [12],
  },
]

/**
 * The rest of the week frame 1c draws, a day of it per weekday, so the persona
 * lands on the week it is seeded in whatever day that is. A day behind today
 * holds work that is done; a day ahead holds work that is planned; the day that
 * *is* today is left to the Today persona above, which is the week's middle day
 * in the mockups. Nothing is ever recorded as done in the future.
 *
 * The Week screen's figures are computed from these, so the Todos, their
 * estimates and their days are the content: on the mockups' Wednesday that is
 * 11 of 27 done, 6.5 hours of finished work and four Todos carried.
 */
interface SeedWeekTodo {
  key: string
  title: string
  project?: string
  minutes: number
  energy: Energy
  /** The hours of its day it sits on. */
  slots: number[]
  /** The hour it was finished at, on a day that has passed. */
  doneAt: string
  /** Rollovers in a row it had been carried over by then. */
  carried?: number
}

/** A meeting on one of the week's days. Frame 1a draws today's; these are the rest. */
interface SeedWeekEvent {
  key: string
  title: string
  who?: string
  from: string
  until: string
}

/**
 * How Crazy words one thing a day holds, in the few words the card has room
 * for: `todo` names a Todo of that day, `event` one of its meetings. Generated
 * text, like the timeline's hours. How long a Todo has been carried is derived
 * from the Todo, so no wording says it.
 */
interface SeedWeekLine {
  text: string
  todo?: string
  event?: string
}

interface SeedWeekDay {
  /** Monday is 0. */
  weekday: number
  work: SeedWeekTodo[]
  meetings: SeedWeekEvent[]
  lines: SeedWeekLine[]
  /** The words Crazy adds beside the day's figures. Never a number. */
  note?: string
}

const STANDUP = { title: 'Platform standup', who: '12 people', from: '11:00', until: '11:30' }

const WEEK: SeedWeekDay[] = [
  {
    weekday: 0,
    work: [
      {
        key: 'mon-kickoff',
        title: 'Kick off the auth migration milestone',
        project: 'auth',
        minutes: 45,
        energy: 'deep_focus',
        slots: [9],
        doneAt: '09:50',
      },
      {
        key: 'mon-q4-outline',
        title: 'Outline the Q4 priorities doc',
        project: 'q4',
        minutes: 60,
        energy: 'deep_focus',
        slots: [10],
        doneAt: '11:05',
      },
      {
        key: 'mon-headcount',
        title: 'Reply to Devon about headcount',
        minutes: 15,
        energy: 'people_admin',
        slots: [11],
        doneAt: '11:40',
      },
      {
        key: 'mon-staging-key',
        title: 'Rotate the staging API key',
        project: 'auth',
        minutes: 30,
        energy: 'quick_win',
        slots: [13],
        doneAt: '13:35',
      },
      {
        key: 'mon-book-movers',
        title: 'Book Northside Movers',
        project: 'move',
        minutes: 30,
        energy: 'people_admin',
        slots: [14],
        doneAt: '14:40',
      },
      {
        key: 'mon-easy-run',
        title: 'Easy run, 8 km',
        project: 'marathon',
        minutes: 30,
        energy: 'quick_win',
        slots: [17],
        doneAt: '18:05',
      },
    ],
    meetings: [
      { key: 'standup-mon', ...STANDUP },
      {
        key: 'weekly-planning',
        title: 'Weekly planning',
        who: 'Platform',
        from: '13:00',
        until: '14:30',
      },
    ],
    lines: [
      { text: 'Kickoff auth milestone', todo: 'mon-kickoff' },
      { text: 'Q4 doc outline', todo: 'mon-q4-outline' },
    ],
  },
  {
    weekday: 1,
    work: [
      {
        key: 'tue-kv-secret',
        title: 'Rotate the KV secret',
        project: 'auth',
        minutes: 60,
        energy: 'deep_focus',
        slots: [9],
        doneAt: '10:10',
      },
      {
        key: 'tue-onboarding-copy',
        title: 'Review the onboarding copy',
        project: 'onboarding',
        minutes: 45,
        energy: 'deep_focus',
        slots: [10],
        doneAt: '11:00',
      },
      {
        key: 'tue-packing-boxes',
        title: 'Order packing boxes',
        project: 'move',
        minutes: 30,
        energy: 'quick_win',
        slots: [13],
        doneAt: '13:25',
      },
      {
        key: 'tue-platform-inbox',
        title: 'Triage the platform inbox',
        minutes: 30,
        energy: 'people_admin',
        slots: [14],
        doneAt: '14:35',
        carried: 1,
      },
      {
        key: 'tue-race-entry',
        title: 'Confirm the race entry',
        project: 'marathon',
        minutes: 15,
        energy: 'quick_win',
        slots: [16],
        doneAt: '16:20',
      },
    ],
    meetings: [
      { key: 'standup-tue', ...STANDUP },
      { key: 'design-sync', title: 'Design sync', who: 'Design', from: '15:00', until: '16:00' },
      {
        key: 'product-review',
        title: 'Product review',
        who: 'Product + Platform',
        from: '16:00',
        until: '17:00',
      },
    ],
    lines: [
      { text: 'Rotate KV secret', todo: 'tue-kv-secret' },
      // Sam's PR was placed on Tuesday and not finished, so Tuesday carried it;
      // the Todo is in today's stack, and the "(carried)" comes off its count.
      { text: "Sam's PR", todo: 'review-sam' },
    ],
  },
  {
    weekday: 2,
    work: [
      {
        key: 'wed-pair-priya',
        title: 'Pair with Priya on the edge worker',
        project: 'auth',
        minutes: 60,
        energy: 'deep_focus',
        slots: [10],
        doneAt: '11:10',
      },
      {
        key: 'wed-runbook-index',
        title: 'Update the platform runbook index',
        project: 'auth',
        minutes: 30,
        energy: 'quick_win',
        slots: [13],
        doneAt: '13:40',
      },
      {
        key: 'wed-groceries',
        title: "Order the week's groceries",
        minutes: 15,
        energy: 'quick_win',
        slots: [17],
        doneAt: '17:20',
      },
    ],
    meetings: [
      { key: 'standup-wed', ...STANDUP },
      {
        key: 'platform-weekly',
        title: 'Platform weekly',
        who: 'Platform',
        from: '15:00',
        until: '16:00',
      },
    ],
    lines: [
      { text: 'Pair on the edge worker', todo: 'wed-pair-priya' },
      { text: 'Runbook index', todo: 'wed-runbook-index' },
    ],
  },
  {
    weekday: 3,
    work: [
      {
        key: 'thu-q4-section-3',
        title: 'Draft Q4 priorities, section 3',
        project: 'q4',
        minutes: 60,
        energy: 'deep_focus',
        slots: [9],
        doneAt: '10:05',
      },
      {
        key: 'thu-runbook',
        title: 'Write the auth migration runbook',
        project: 'auth',
        minutes: 45,
        energy: 'deep_focus',
        slots: [11],
        doneAt: '11:50',
      },
      {
        key: 'thu-runbook-to-design',
        title: 'Send the auth runbook to Design',
        project: 'auth',
        minutes: 30,
        energy: 'people_admin',
        slots: [13],
        doneAt: '13:35',
      },
      {
        key: 'thu-movers-window',
        title: 'Confirm the movers arrival window',
        project: 'move',
        minutes: 30,
        energy: 'quick_win',
        slots: [16],
        doneAt: '16:30',
      },
    ],
    meetings: [
      {
        key: 'onboarding-ship',
        title: 'Onboarding v2 ship review',
        who: 'Design + Platform',
        from: '14:00',
        until: '15:00',
      },
    ],
    lines: [
      { text: 'Q4 doc: sections 2–3', todo: 'thu-q4-section-3' },
      { text: 'Runbook to Design', todo: 'thu-runbook-to-design' },
    ],
    note: 'Q4 held',
  },
  {
    weekday: 4,
    work: [
      {
        key: 'fri-ship-sessions',
        title: 'Ship edge sessions to production',
        project: 'auth',
        minutes: 120,
        energy: 'deep_focus',
        slots: [9, 10],
        doneAt: '11:15',
      },
      {
        key: 'fri-runbook-priya',
        title: 'Hand the runbook to Priya',
        project: 'auth',
        minutes: 30,
        energy: 'people_admin',
        slots: [13],
        doneAt: '13:30',
      },
      {
        key: 'fri-movers-balance',
        title: 'Check the movers deposit cleared',
        project: 'move',
        minutes: 30,
        energy: 'quick_win',
        slots: [16],
        doneAt: '16:20',
      },
    ],
    meetings: [
      { key: 'standup-fri', ...STANDUP },
      {
        key: 'milestone-demo',
        title: 'Edge sessions demo',
        who: 'Platform + Leadership',
        from: '15:00',
        until: '16:00',
      },
    ],
    lines: [
      { text: 'Auth migration milestone', todo: 'fri-ship-sessions' },
      { text: 'Movers deposit', todo: 'fri-movers-balance' },
    ],
    note: 'Sam out',
  },
  {
    weekday: 5,
    work: [
      {
        key: 'sat-long-run',
        title: 'Long run, 16 km',
        project: 'marathon',
        minutes: 120,
        energy: 'deep_focus',
        slots: [8, 9],
        doneAt: '10:20',
      },
    ],
    meetings: [],
    lines: [{ text: 'Long run · 16 km', todo: 'sat-long-run' }],
  },
  {
    weekday: 6,
    work: [
      {
        key: 'sun-pack-kitchen',
        title: 'Pack the kitchen',
        project: 'move',
        minutes: 45,
        energy: 'quick_win',
        slots: [15],
        doneAt: '15:50',
      },
    ],
    meetings: [],
    lines: [{ text: 'Pack kitchen', todo: 'sun-pack-kitchen' }],
  },
]

/**
 * How Crazy words today itself on the Week screen. Today is always the Today
 * persona's day, whatever weekday it falls on, so its wording hangs off the
 * Todos and meetings frame 1a draws.
 */
const TODAY_LINES: SeedWeekLine[] = [
  { text: 'Session spike', todo: 'spike' },
  { text: 'Design review 14:00', event: 'design-review' },
  { text: '1:1 Devon', event: 'one-to-one-devon' },
]

/**
 * What Tuesday did not finish: placed on it, carried by its Rollover, and in
 * today's stack now. Only seeded once Tuesday has passed.
 */
const CARRIED_FROM_TUESDAY: { todo: string; hour: number }[] = [
  { todo: 'review-sam', hour: 13 },
  { todo: 'movers-deposit', hour: 17 },
]

/** The calendar as frame 1a's timeline draws it: three meetings, and the focus blocks the deep work sits in. */
const EVENTS: {
  key: string
  kind: CalendarEventKind
  title: string
  who?: string
  from: string
  until: string
}[] = [
  { key: 'focus-morning', kind: 'focus', title: 'Focus', from: '09:00', until: '11:00' },
  {
    key: 'standup',
    kind: 'meeting',
    title: 'Platform standup',
    who: '12 people',
    from: '11:00',
    until: '11:30',
  },
  { key: 'focus-13', kind: 'focus', title: 'Focus', from: '13:00', until: '14:00' },
  {
    key: 'design-review',
    kind: 'meeting',
    title: 'Onboarding design review',
    who: 'Design + Platform',
    from: '14:00',
    until: '15:00',
  },
  { key: 'focus-15', kind: 'focus', title: 'Focus', from: '15:00', until: '16:00' },
  {
    key: 'one-to-one-devon',
    kind: 'meeting',
    title: '1:1 with Devon',
    who: 'Devon',
    from: '16:30',
    until: '17:00',
  },
]

/** The timeline's hours in the mockup's words, which are generated text like the Brief's. */
const HOURS: { hour: number; title: string; note: string; source: SourceKind }[] = [
  { hour: 8, title: 'Brief · inbox skim', note: 'free', source: 'gmail_message' },
  {
    hour: 9,
    title: 'Finish Cloudflare session-token spike',
    note: 'deep focus · HAL-212',
    source: 'linear_issue',
  },
  { hour: 10, title: '↳ spike continues', note: 'deep focus', source: 'linear_issue' },
  { hour: 11, title: 'Platform standup', note: '30m · 12 people', source: 'calendar_event' },
  {
    hour: 12,
    title: 'Reply to Priya · book dentist',
    note: 'quick wins · 20m',
    source: 'slack_message',
  },
  {
    hour: 13,
    title: "Review Sam's onboarding PR",
    note: 'carried 1 day · 45m',
    source: 'linear_issue',
  },
  {
    hour: 14,
    title: 'Onboarding design review',
    note: '1h · Design + Platform',
    source: 'calendar_event',
  },
  {
    hour: 15,
    title: 'Draft Q4 priorities · section 2',
    note: 'carried · 1h',
    source: 'notion_page',
  },
  {
    hour: 16,
    title: 'Prep notes · 1:1 with Devon 16:30',
    note: '20m + 30m',
    source: 'calendar_event',
  },
  { hour: 17, title: 'Send movers deposit · follow-ups', note: 'wrap-up', source: 'gmail_message' },
]

/**
 * Who is waiting on Ryan. Priya's message is the Source of a Todo already in
 * the stack, so it is seeded as added; the others are items of their own.
 */
const MENTIONS: {
  key: string
  person: string
  text: string
  daysAgo: number
  time: string
  source: { kind: SourceKind; item: string; ref?: string }
  addedAs?: string
}[] = [
  {
    key: 'priya-rate-limit',
    person: 'Priya',
    text: 'in #platform: can you confirm the edge worker rate limit?',
    daysAgo: 1,
    time: '15:21',
    source: { kind: 'slack_message', item: 'platform-1758049260' },
    addedAs: 'reply-priya',
  },
  {
    key: 'devon-q4-comment',
    person: 'Devon',
    text: 'commented on your section of Q4 Priorities',
    daysAgo: 1,
    time: '07:30',
    source: { kind: 'notion_page', item: 'q4-priorities-comment-devon' },
  },
  {
    key: 'sam-review-request',
    person: 'Sam',
    text: 'requested your review on HAL-198',
    daysAgo: 1,
    time: '07:05',
    source: { kind: 'linear_issue', item: 'hal-198-review-request', ref: 'HAL-198' },
  },
  {
    key: 'northside-deposit-due',
    person: 'Northside Movers',
    text: 'deposit due Friday',
    daysAgo: 2,
    time: '08:10',
    source: { kind: 'gmail_message', item: 'northside-movers-reminder' },
  },
]

/**
 * The Circles frame 1e draws. Crazy infers these, so the count of people and
 * the Providers each Circle's work lives in are inferred with them; the Personal
 * Circle has no count, as the frame shows.
 */
const CIRCLES: {
  key: string
  name: string
  side: Side
  people?: number
  providers: SourceKind[]
}[] = [
  {
    key: 'platform',
    name: 'Platform team',
    side: 'work',
    people: 12,
    providers: ['slack_message', 'linear_issue'],
  },
  {
    key: 'design',
    name: 'Design',
    side: 'work',
    people: 5,
    providers: ['notion_page', 'slack_message'],
  },
  {
    key: 'leadership',
    name: 'Leadership',
    side: 'work',
    people: 3,
    providers: ['notion_page', 'gmail_message'],
  },
  {
    key: 'personal',
    name: 'Personal',
    side: 'personal',
    providers: ['gmail_message', 'calendar_event'],
  },
]

/**
 * Frame 1e's Overlaps. Each is a Todo of its own, matched to two Circles —
 * nothing else makes an Overlap — waiting in the backlog, so the Today screen
 * is untouched. Everything the mockup words as generated is kept as drawn,
 * including the shorter wording it writes inside the figure.
 */
const OVERLAPS: {
  key: string
  title: string
  circles: [string, string]
  text: string
  people: string
  timing: string
  figure?: { title: string; note: string }
  /** Days before today the Todo was made; the oldest Overlap is listed first. */
  createdDaysAgo: number
}[] = [
  {
    key: 'onboarding-v2-review',
    title: 'Onboarding v2 design review',
    circles: ['platform', 'design'],
    text: 'Your PR review and the design decision land on the same day. Do the review first so the meeting can be about what ships.',
    people: 'Sam · Lena · Priya',
    timing: 'Today 13:00 → 14:00',
    figure: { title: 'Onboarding v2', note: 'Sam · Priya · Lena' },
    createdDaysAgo: 5,
  },
  {
    key: 'auth-in-q4-doc',
    title: 'Auth migration in the Q4 doc',
    circles: ['platform', 'leadership'],
    text: 'Section 2 is the migration story. Finishing the spike today gives you real numbers for it tomorrow.',
    people: 'Devon',
    timing: 'Thu → Mon',
    figure: { title: 'Auth migration', note: 'Q4 doc · Devon' },
    createdDaysAgo: 4,
  },
  {
    key: 'onboarding-metrics-q4',
    title: 'Onboarding metrics for Q4',
    circles: ['leadership', 'design'],
    text: 'Lena has the activation numbers Devon will ask about.',
    people: 'Lena · Devon',
    timing: 'Ask by Thu',
    figure: { title: 'Design review', note: '14:00 today' },
    createdDaysAgo: 3,
  },
  {
    key: 'move-day-wednesday',
    title: 'Move day is a Wednesday',
    circles: ['personal', 'platform'],
    text: '1 Oct collides with the platform release train. Flag it in standup.',
    people: 'You',
    timing: '1 Oct',
    // Personal stands apart in the figure, so this Overlap has nowhere to be written.
    createdDaysAgo: 2,
  },
]

/** A Todo already in the stack that belongs to one Circle, and so is no Overlap. */
const MATCHED: { todo: string; circle: string }[] = [{ todo: 'movers-deposit', circle: 'personal' }]

const PROJECTS: {
  key: string
  name: string
  circle: string
  status: ProjectStatus
  statusNote?: string
  milestone: string
  /** The weekday of this week it falls on, Monday 0, for a milestone the week turns on. */
  milestoneWeekday?: number
  /** Days from today, for one further out than the week. */
  milestoneIn?: number
  /** Where Ryan ties in this week, as frame 1c words it, and when that falls. */
  tieIn?: { text: string; when: string }
}[] = [
  {
    key: 'auth',
    name: 'Auth migration',
    circle: 'platform',
    status: 'on_track',
    milestone: 'Edge sessions live',
    milestoneWeekday: 4,
    tieIn: {
      text: 'You own the spike and the runbook; Priya is blocked on both.',
      when: 'Milestone Fri',
    },
  },
  {
    key: 'onboarding',
    name: 'Onboarding redesign',
    circle: 'platform',
    status: 'at_risk',
    milestone: 'v2 ships',
    milestoneWeekday: 3,
    tieIn: {
      text: 'You are the last reviewer before Design ships v2.',
      when: 'Review today 14:00',
    },
  },
  {
    key: 'q4',
    name: 'Q4 planning',
    circle: 'leadership',
    status: 'behind',
    milestone: 'Doc review',
    // The Monday after this one: the doc is read at the start of next week.
    milestoneWeekday: 7,
    tieIn: { text: 'Section 2 is yours; Devon reads the doc Monday.', when: 'Thu morning held' },
  },
  {
    key: 'move',
    name: 'Apartment move',
    circle: 'personal',
    status: 'on_track',
    milestone: 'Move day',
    milestoneIn: 14,
    tieIn: { text: 'Deposit, then keys with the landlord.', when: 'Fri · 1 Oct' },
  },
  {
    key: 'marathon',
    name: 'Half marathon',
    circle: 'personal',
    status: 'on_track',
    statusNote: 'Week 9 of 12',
    milestone: 'Race',
    milestoneIn: 18,
  },
]

const BRIEF = {
  body: "You've got a lighter morning than usual: two meetings, both after 11. I'd take the Cloudflare session spike first while you're fresh; Priya pinged you about it twice in #platform yesterday. Three items carried over from Tuesday. I moved the August expense report back to the backlog since nobody touched it for a day.",
  bodyShort:
    "Light morning, two meetings after 11. Take the session spike first; Priya's waiting on it. Three items carried over.",
}

/** The Week brief: the state of the union frame 1c opens with. */
const WEEK_BRIEF = {
  body: "You're on track for the auth migration milestone on Friday if the spike lands today. Onboarding is at risk: the design review this afternoon decides whether Sam's PR ships before he's out Friday. The Q4 doc is behind; I've held Thursday morning for it so it's ready for Devon on Monday. Personal side is quiet apart from the movers deposit.",
  bodyShort:
    'Auth lands Friday if the spike does today. Onboarding is at risk and the Q4 doc is behind; Thursday morning is held for it.',
}

export function ryan({ userId, now, timeZone }: SeedInput) {
  const today = wallClock(now, timeZone).day
  const id = (kind: string, key: string) => `${userId}/${kind}/${key}`
  /** A wall-clock time some days before today. */
  const at = (daysAgo: number, time: string) =>
    localTimeToInstant(`${addDays(today, -daysAgo)}T${time}`, timeZone)!
  /**
   * The same, for something the persona says has already happened. The day is
   * laid over whatever moment it is seeded at, so an hour of it can still be to
   * come: nothing is recorded as done, synced or written in the future.
   */
  const past = (daysAgo: number, time: string) => {
    const moment = at(daysAgo, time)
    return moment > now ? now : moment
  }
  const lastRollover = startOfDay(today, timeZone)

  // The week today falls in. Every day of the persona's week hangs off its
  // Monday, so the mockups' week lands on the right weekdays whichever day the
  // persona is seeded on, and today itself is always frame 1a's day.
  const monday = startOfWeek(today)
  const dayOfWeek = (weekday: number) => addDays(monday, weekday)
  const DAY = 24 * 60 * 60 * 1000
  /** How many days back a day of this week is: 0 is today, less than 0 still ahead. */
  const back = (day: string) =>
    Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY)

  const connections: Prisma.ConnectionCreateManyInput[] = (
    [
      ['google', 'connected'],
      ['slack', 'connected'],
      ['linear', 'connected'],
      ['notion', 'reauth'],
    ] as const
  ).map(([provider, status]) => ({
    id: id('connection', provider),
    userId,
    provider,
    externalAccountId: `seed_${provider}`,
    defaultSide: 'work',
    status,
    lastSyncAt: status === 'connected' ? past(0, '08:39') : past(0, '06:12'),
    createdAt: past(60, '09:00'),
  }))

  const circles: Prisma.CircleCreateManyInput[] = CIRCLES.map(
    ({ key, name, side, people, providers }) => ({
      id: id('circle', key),
      userId,
      name,
      side,
      people: people ?? null,
      providers: providers.join(','),
      createdAt: past(60, '09:00'),
    }),
  )

  const projects: Prisma.ProjectCreateManyInput[] = PROJECTS.map((project, index) => ({
    id: id('project', project.key),
    userId,
    circleId: id('circle', project.circle),
    name: project.name,
    status: project.status,
    statusNote: project.statusNote ?? null,
    milestone: project.milestone,
    milestoneDay:
      project.milestoneWeekday === undefined
        ? addDays(today, project.milestoneIn ?? 0)
        : dayOfWeek(project.milestoneWeekday),
    // Started a week apart, oldest first: the order the Week screen lists the tie-ins in.
    createdAt: past(45 - index * 7, '09:00'),
  }))

  // Where Ryan ties in, written for this week the way the Week brief is.
  const tieIns: Prisma.TieInCreateManyInput[] = PROJECTS.flatMap((project) =>
    project.tieIn === undefined
      ? []
      : [
          {
            id: id('tie-in', `${project.key}-${monday}`),
            userId,
            projectId: id('project', project.key),
            week: monday,
            text: project.tieIn.text,
            when: project.tieIn.when,
            createdAt: past(0, '06:00'),
          },
        ],
  )

  const todos: Prisma.TodoCreateManyInput[] = STACK.map((todo, index) => {
    const carried = todo.carried ?? 0
    return {
      id: id('todo', todo.key),
      userId,
      title: todo.title,
      state: 'today',
      projectId: todo.project ? id('project', todo.project) : null,
      estimateMinutes: todo.minutes,
      energy: todo.energy,
      carryCount: carried,
      stackPosition: index + 1,
      stackReason: todo.reason,
      sourceConnectionId: todo.source
        ? id('connection', SOURCE_KINDS[todo.source.kind].provider)
        : null,
      sourceKind: todo.source?.kind ?? null,
      sourceItemId: todo.source?.item ?? null,
      sourceRef: todo.source?.ref ?? null,
      createdAt: past(carried + 1, '10:00'),
      // Carried over means touched the day before; the rest were slotted this morning.
      touchedAt: carried > 0 ? past(1, '16:00') : past(0, '08:05'),
    }
  })
  // Each Overlap's Todo waits in the backlog: Crazy has noticed that it serves
  // two Circles, and the user has not put it in a day yet.
  for (const overlap of OVERLAPS) {
    todos.push({
      id: id('todo', overlap.key),
      userId,
      title: overlap.title,
      state: 'backlog',
      carryCount: 0,
      createdAt: past(overlap.createdDaysAgo, '09:00'),
      touchedAt: past(overlap.createdDaysAgo, '09:00'),
    })
  }
  // The one the last Rollover sent back: nobody touched it for a day.
  todos.push({
    id: id('todo', 'expense-report'),
    userId,
    title: 'August expense report',
    state: 'backlog',
    estimateMinutes: 30,
    energy: 'people_admin',
    carryCount: 0,
    createdAt: past(6, '11:00'),
    touchedAt: past(2, '15:00'),
    sentBackAt: lastRollover,
  })
  // The rest of the week, day by day. Today is the Today persona's, so its own
  // weekday is left out; a day behind us holds work that is done, a day ahead
  // holds work that is placed on it and waits in the backlog until its Rollover
  // brings it into today.
  const weekDays = WEEK.map((entry) => ({ ...entry, day: dayOfWeek(entry.weekday) })).filter(
    (entry) => entry.day !== today,
  )
  for (const { day, work } of weekDays) {
    const away = back(day)
    for (const todo of work) {
      const done = away > 0 ? past(away, todo.doneAt) : null
      todos.push({
        id: id('todo', todo.key),
        userId,
        title: todo.title,
        state: done ? 'done' : 'backlog',
        projectId: todo.project ? id('project', todo.project) : null,
        estimateMinutes: todo.minutes,
        energy: todo.energy,
        carryCount: todo.carried ?? 0,
        createdAt: past(Math.max(away, 0) + (todo.carried ?? 0) + 2, '09:30'),
        // Finished when it was finished; the week ahead was planned last night.
        touchedAt: done ?? past(1, '17:30'),
        doneAt: done,
      })
    }
  }

  const slots: Prisma.SlotCreateManyInput[] = STACK.flatMap((todo) =>
    todo.slots.map((hour) => ({
      id: id('slot', `${todo.key}-${hour}`),
      userId,
      todoId: id('todo', todo.key),
      day: today,
      hour,
      createdAt: past(0, '08:05'),
    })),
  )
  for (const { day, work } of weekDays) {
    const away = back(day)
    for (const todo of work) {
      for (const hour of todo.slots) {
        slots.push({
          id: id('slot', `${todo.key}-${hour}`),
          userId,
          todoId: id('todo', todo.key),
          day,
          hour,
          createdAt: past(Math.max(away, 0) + 1, '17:30'),
        })
      }
    }
  }
  // Tuesday's unfinished work is still placed on Tuesday; it is in today's stack
  // because the Rollover carried it, which is what the day card says of Tuesday.
  const tuesday = dayOfWeek(1)
  if (back(tuesday) > 0) {
    for (const { todo, hour } of CARRIED_FROM_TUESDAY) {
      slots.push({
        id: id('slot', `${todo}-tue-${hour}`),
        userId,
        todoId: id('todo', todo),
        day: tuesday,
        hour,
        createdAt: past(back(tuesday) + 1, '17:30'),
      })
    }
  }

  // Crazy matched these this morning, with the rest of the day's planning. An
  // Overlap belongs to the week Crazy last matched it in, so laying the persona
  // over any weekday — a Monday included — still fills the Circles screen.
  const matchedAt = past(0, '08:05')

  const circleMatches: Prisma.CircleMatchCreateManyInput[] = [
    ...OVERLAPS.flatMap((overlap) =>
      // Matches made at the same moment read in the order of their ids, so the
      // id carries the order the mockup tags them in.
      overlap.circles.map((circle, order) => ({
        id: id('match', `${overlap.key}-${String(order).padStart(2, '0')}-${circle}`),
        userId,
        todoId: id('todo', overlap.key),
        circleId: id('circle', circle),
        createdAt: matchedAt,
      })),
    ),
    ...MATCHED.map((match) => ({
      id: id('match', `${match.todo}-${match.circle}`),
      userId,
      todoId: id('todo', match.todo),
      circleId: id('circle', match.circle),
      createdAt: matchedAt,
    })),
  ]

  const overlapNotes: Prisma.OverlapNoteCreateManyInput[] = OVERLAPS.map((overlap) => ({
    id: id('overlap', overlap.key),
    userId,
    todoId: id('todo', overlap.key),
    text: overlap.text,
    people: overlap.people,
    timing: overlap.timing,
    figureTitle: overlap.figure?.title ?? null,
    figureNote: overlap.figure?.note ?? null,
    // Worded when the week was last planned, with the Brief.
    createdAt: past(0, '06:00'),
  }))

  const briefs: Prisma.BriefCreateManyInput[] = [
    {
      id: id('brief', today),
      userId,
      kind: 'daily',
      day: today,
      ...BRIEF,
      createdAt: past(0, '06:00'),
    },
    {
      // A Week brief is written for its Monday, whichever day it is read on.
      id: id('brief', `week-${monday}`),
      userId,
      kind: 'weekly',
      day: monday,
      ...WEEK_BRIEF,
      createdAt: past(0, '06:00'),
    },
  ]

  // The few words each day's card gives to one thing it holds, beside the
  // figures Crazy computes. A line is kept with the Todo or the meeting it
  // words, so it leaves the card when that thing does.
  const wordDay = (day: string, lines: SeedWeekLine[]): Prisma.WeekDayLineCreateManyInput[] =>
    lines.map((line, position) => ({
      id: id('week-line', `${day}-${position}`),
      userId,
      day,
      position,
      text: line.text,
      todoId: line.todo === undefined ? null : id('todo', line.todo),
      calendarEventId: line.event === undefined ? null : id('event', line.event),
      createdAt: past(0, '06:00'),
    }))

  const weekDayLines: Prisma.WeekDayLineCreateManyInput[] = [
    ...wordDay(today, TODAY_LINES),
    ...weekDays.flatMap(({ day, lines }) => wordDay(day, lines)),
  ]

  // Crazy writes a note for the days still to come, with the Week brief; it does
  // not go back and add one to a day that has been and gone.
  const weekDayNotes: Prisma.WeekDayNoteCreateManyInput[] = weekDays.flatMap(({ day, note }) =>
    note === undefined || back(day) > 0
      ? []
      : [{ id: id('week-note', day), userId, day, text: note, createdAt: past(0, '06:00') }],
  )

  const calendarEvents: Prisma.CalendarEventCreateManyInput[] = EVENTS.map((event) => ({
    id: id('event', event.key),
    userId,
    connectionId: id('connection', 'google'),
    itemId: event.key,
    kind: event.kind,
    title: event.title,
    who: event.who ?? null,
    startsAt: at(0, event.from),
    endsAt: at(0, event.until),
    createdAt: past(7, '09:00'),
  }))
  for (const { day, meetings } of weekDays) {
    const away = back(day)
    for (const event of meetings) {
      calendarEvents.push({
        id: id('event', event.key),
        userId,
        connectionId: id('connection', 'google'),
        itemId: event.key,
        kind: 'meeting',
        title: event.title,
        who: event.who ?? null,
        startsAt: at(away, event.from),
        endsAt: at(away, event.until),
        createdAt: past(7, '09:00'),
      })
    }
  }

  const timelineHours: Prisma.TimelineHourCreateManyInput[] = HOURS.map((hour) => ({
    id: id('hour', `${today}-${hour.hour}`),
    userId,
    day: today,
    hour: hour.hour,
    title: hour.title,
    note: hour.note,
    sourceKind: hour.source,
    // Crazy worded the day it had planned, so each hour's words were written
    // for the Todos it holds. Re-plan the hour and the words step aside.
    writtenFor: JSON.stringify(
      STACK.filter((todo) => todo.slots.includes(hour.hour))
        .map((todo) => id('todo', todo.key))
        .sort(),
    ),
    // Worded when the status was last refreshed, on the hour.
    createdAt: past(0, '08:00'),
  }))

  const signals: Prisma.SignalCreateManyInput[] = MENTIONS.map((mention) => ({
    id: id('signal', mention.key),
    userId,
    kind: 'mention',
    person: mention.person,
    text: mention.text,
    at: past(mention.daysAgo, mention.time),
    connectionId: id('connection', SOURCE_KINDS[mention.source.kind].provider),
    sourceKind: mention.source.kind,
    sourceItemId: mention.source.item,
    sourceRef: mention.source.ref ?? null,
    todoId: mention.addedAs ? id('todo', mention.addedAs) : null,
    createdAt: past(mention.daysAgo, mention.time),
  }))

  return {
    connections,
    circles,
    projects,
    todos,
    circleMatches,
    overlapNotes,
    slots,
    briefs,
    weekDayLines,
    weekDayNotes,
    tieIns,
    calendarEvents,
    timelineHours,
    signals,
  }
}
