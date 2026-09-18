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
  /** Days from the mockups' Wednesday 17 Sep. */
  milestoneIn: number
}[] = [
  {
    key: 'auth',
    name: 'Auth migration',
    circle: 'platform',
    status: 'on_track',
    milestone: 'Edge sessions live',
    milestoneIn: 2,
  },
  {
    key: 'onboarding',
    name: 'Onboarding redesign',
    circle: 'platform',
    status: 'at_risk',
    milestone: 'v2 ships',
    milestoneIn: 1,
  },
  {
    key: 'q4',
    name: 'Q4 planning',
    circle: 'leadership',
    status: 'behind',
    milestone: 'Doc review',
    milestoneIn: 5,
  },
  {
    key: 'move',
    name: 'Apartment move',
    circle: 'personal',
    status: 'on_track',
    milestone: 'Move day',
    milestoneIn: 14,
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

  const projects: Prisma.ProjectCreateManyInput[] = PROJECTS.map((project) => ({
    id: id('project', project.key),
    userId,
    circleId: id('circle', project.circle),
    name: project.name,
    status: project.status,
    statusNote: project.statusNote ?? null,
    milestone: project.milestone,
    milestoneDay: addDays(today, project.milestoneIn),
    createdAt: past(45, '09:00'),
  }))

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
  ]

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
    calendarEvents,
    timelineHours,
    signals,
  }
}
