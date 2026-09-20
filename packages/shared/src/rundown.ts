import { addDays, startOfDay, wallClock } from './clock'
import { type DayEvent, type TimelineHour, DAY_HOURS, meetingCount } from './timeline'
import {
  type EventLinks,
  type SentBackTodo,
  type Signal,
  type Today,
  type TodayView,
  formatHour,
} from './today'
import { type TodayTodo, formatEstimate } from './todo'
import { type ClientWeek, clientTerms, formatTracked } from './timer'

// The rundown: Today read as a page rather than worked as a surface. Every
// chapter's count, its one sentence and the body under it are derived here,
// from the day's rows and the moment handed in — nothing reads a clock, and no
// sentence is stored. The two pieces of generated text a chapter shows, the
// Brief and a meeting's prep note, are rows; there is no third.
//
// The words are the glossary's (CONTEXT.md): Todo, Mention, Promise, Waiting
// on, Carried over, Sent back, Slot, Priority stack, Client.

/** Which chapter: the order they are read in, and the `#hash` each answers to. */
export const CHAPTERS = [
  'catch-up',
  'meetings',
  'whats-left',
  'your-day',
  'clients',
  'later',
] as const
export type ChapterName = (typeof CHAPTERS)[number]

export interface Chapter {
  name: ChapterName
  /** The kicker above the sentence: "CATCH UP". */
  kicker: string
  /** How many things it holds; null where counting them would say nothing. */
  count: number | null
  /** The one true sentence the chapter is read by when it is closed. */
  sentence: string
  /** Whether it holds anything. A chapter that does opens by default; an empty one stays closed. */
  filled: boolean
}

/** A Mention, Promise or Waiting on, as the Catch up chapter lists it. */
export interface CatchUp {
  /** Every Mention of the day, newest first, as frame 1a's card draws them. */
  mentions: Signal[]
  /** Mentions the user has not added as a Todo yet: who is actually waiting. */
  waiting: Signal[]
  /** Mentions already added, which are shown as such rather than hidden. */
  added: Signal[]
  /** Promises made since yesterday's local midnight. */
  promises: Signal[]
  /** Waiting on that came in since yesterday's local midnight. */
  owed: Signal[]
  /** The Todos the last Rollover carried over, by name. */
  carriedOver: TodayTodo[]
  /** The Todos the last Rollover sent back, by name. */
  sentBack: SentBackTodo[]
}

/** One meeting still to come today, with everything the day's rows say about it. */
export interface MeetingPrep {
  event: DayEvent
  /** "11:00", on the user's wall clock. */
  at: string
  /** "30m": how long it runs. */
  length: string
  /** "in 2h 19m", or "now" once it has started. */
  starts: string
  /** Whether it has already begun. */
  under: boolean
  /** Todos whose Source is this event. */
  todos: TodayTodo[]
  /** Signals whose person the event names. */
  signals: Signal[]
  /** The Client the title names and where its week stands; null with the Billing module off. */
  client: ClientWeek | null
  /** What Crazy wrote to prepare for it. No row, no note. */
  prep: { body: string; bodyShort: string } | null
}

/** One block of the day ribbon: a run of hours the day holds one thing across. */
export interface RibbonBlock {
  from: number
  /** Exclusive: 9 and 11 for two hours from 09:00. */
  until: number
  kind: 'meeting' | 'focus' | 'slotted' | 'free'
  /** The few words under the block: the meeting's or the Todo's own, shortened. */
  label: string
  /** What the block is called where it is only read aloud. */
  said: string
  /** How much of the run has tracked time under it, 0 to 1 (Billing on); 0 otherwise. */
  logged: number
}

/** The whole working day on one rule: the timeline said in a line. */
export interface Ribbon {
  from: number
  until: number
  blocks: RibbonBlock[]
  /** Where now falls across the rule, 0 to 1; null before the day's hours begin or after they end. */
  now: number | null
}

/** What the arithmetic of "does it fit" came to. */
export interface Fits {
  /** Minutes the stack's estimates come to. */
  workMinutes: number
  /** How many Todos in the stack carry no estimate. */
  unestimated: number
  /** Minutes between now and the end of the day's hours that no meeting holds. */
  freeMinutes: number
}

export interface Rundown {
  chapters: Chapter[]
  catchUp: CatchUp
  meetings: MeetingPrep[]
  fits: Fits
  ribbon: Ribbon
}

/** What the rundown needs that the day's own rows do not hold. */
export interface RundownExtras {
  /** The Billing module's figures, from the timer query; null with the module off. */
  billing: {
    /** This week Client by Client, exactly as "This week by Client" draws it. */
    week: ClientWeek[]
    /** Time entries in the period that can be billed to nobody until she says whose they were. */
    needsClient: number
  } | null
  /** What was tracked in each hour today, for the ribbon's solid under-layer. */
  logged: readonly { hour: number; seconds: number }[]
}

// ── Words ───────────────────────────────────────────────────────────────────

const WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
] as const

/** A number as the Brief writes it: a word up to ten, digits beyond. */
export function inWords(count: number): string {
  return count >= 0 && count <= 10 ? WORDS[count]! : String(count)
}

const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** "one Todo", "three Todos": a count and the thing it counts. */
function many(count: number, one: string, more = `${one}s`): string {
  return `${inWords(count)} ${count === 1 ? one : more}`
}

/**
 * A list as a sentence says it: "a, b and c". Anything empty is left out, so a
 * clause a day does not have never leaves a comma behind.
 */
function list(parts: (string | null | false)[]): string {
  const said = parts.filter((part): part is string => Boolean(part))
  if (said.length === 0) return ''
  if (said.length === 1) return said[0]!
  return `${said.slice(0, -1).join(', ')} and ${said.at(-1)}`
}

const sentence = (text: string) => (text.endsWith('.') ? upper(text) : `${upper(text)}.`)

/** "2h 19m", or "a minute" for anything under one. */
function inHowLong(minutes: number): string {
  if (minutes <= 0) return 'now'
  return `in ${formatEstimate(minutes) ?? '1m'}`
}

/** The weekday the day before this one was: "Tuesday". */
function dayBefore(day: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(
    new Date(`${addDays(day, -1)}T00:00:00Z`),
  )
}

// ── The day's shape ─────────────────────────────────────────────────────────

/** Minutes into the day, on the user's wall clock. */
function minuteOfDay(now: Date, timeZone: string): number {
  const { hour, minute } = wallClock(now, timeZone)
  return hour * 60 + minute
}

/** The hours the timeline spans, which is what the ribbon draws. */
function span(hours: readonly TimelineHour[]): { from: number; until: number } {
  const first = hours[0]?.hour ?? DAY_HOURS.from
  const last = hours.at(-1)?.hour ?? DAY_HOURS.until - 1
  return { from: first, until: last + 1 }
}

/** The meetings of the day that have not ended yet, earliest first. */
function meetingsLeft(events: readonly DayEvent[], minute: number): DayEvent[] {
  return events
    .filter((event) => event.kind === 'meeting' && event.until > minute)
    .sort((a, b) => a.from - b.from)
}

/**
 * Minutes between now and the end of the day's hours that no meeting holds.
 * Meetings are taken out because Crazy never moves a Provider's calendar: an
 * hour a meeting sits in is not an hour any Todo can be done in.
 */
function freeMinutes(events: readonly DayEvent[], minute: number, until: number): number {
  const ends = until * 60
  if (ends <= minute) return 0
  let free = ends - minute
  // The meetings still ahead, merged, so two that overlap are not counted twice.
  const ahead = meetingsLeft(events, minute)
    .map((event) => ({ from: Math.max(event.from, minute), until: Math.min(event.until, ends) }))
    .filter((each) => each.until > each.from)
    .sort((a, b) => a.from - b.from)
  let reached = minute
  for (const meeting of ahead) {
    const from = Math.max(meeting.from, reached)
    if (meeting.until > from) free -= meeting.until - from
    reached = Math.max(reached, meeting.until)
  }
  return Math.max(0, free)
}

// ── The ribbon ──────────────────────────────────────────────────────────────

/** The few words a block carries: the first clause of the hour's own title. */
function shorten(title: string): string {
  const said = title.replace(/^↳\s*/, '').split(' · ')[0] ?? title
  return said.length > 22 ? `${said.slice(0, 21)}…` : said
}

/**
 * The whole working day on one rule. Runs of hours that hold the same thing
 * become one block — two hours of one spike is one block two hours wide — so
 * the rule reads as the day does rather than as ten equal cells.
 */
export function ribbonOf(
  hours: readonly TimelineHour[],
  now: Date,
  timeZone: string,
  logged: readonly { hour: number; seconds: number }[] = [],
): Ribbon {
  const { from, until } = span(hours)
  const blocks: RibbonBlock[] = []
  for (const hour of hours) {
    const kind = hour.kind
    const label = shorten(hour.title)
    const last = blocks.at(-1)
    const loggedHere = logged.find((each) => each.hour === hour.hour)?.seconds ?? 0
    if (last && last.until === hour.hour && last.kind === kind && last.label === label) {
      last.until = hour.hour + 1
      last.logged += Math.min(3600, loggedHere)
      continue
    }
    blocks.push({
      from: hour.hour,
      until: hour.hour + 1,
      kind,
      label: kind === 'free' ? '' : label,
      said: `${formatHour(hour.hour)} ${hour.title}`,
      logged: Math.min(3600, loggedHere),
    })
  }
  // Seconds were gathered while the runs were being found; now they are shares.
  for (const block of blocks) {
    block.logged = block.logged / ((block.until - block.from) * 3600)
  }

  const minute = minuteOfDay(now, timeZone)
  const width = (until - from) * 60
  const into = minute - from * 60
  return { from, until, blocks, now: into < 0 || into > width ? null : into / width }
}

// ── The chapters ────────────────────────────────────────────────────────────

function catchUpOf(today: Today, view: TodayView, now: Date, timeZone: string): CatchUp {
  const { day } = wallClock(now, timeZone)
  // "Since yesterday" is derived from the moment and the zone: nothing records
  // when the user last looked at the screen, and nothing should.
  const since = startOfDay(addDays(day, -1), timeZone).toISOString()
  const mentions = today.signals.filter((signal) => signal.kind === 'mention')
  const lately = (kind: Signal['kind']) =>
    today.signals.filter((signal) => signal.kind === kind && signal.at >= since)
  return {
    mentions,
    waiting: mentions.filter((signal) => signal.todoId === null),
    added: mentions.filter((signal) => signal.todoId !== null),
    promises: lately('promise'),
    owed: lately('waiting_on'),
    carriedOver: view.stack.filter((todo) => todo.carryCount > 0),
    sentBack: today.sentBack,
  }
}

function catchUpSentence(catchUp: CatchUp, day: string): string {
  const { waiting, promises, owed, carriedOver, sentBack } = catchUp
  const arrived = promises.length + owed.length
  if (waiting.length === 0 && carriedOver.length === 0 && sentBack.length === 0 && arrived === 0) {
    return 'Nobody is waiting on you and nothing carried over.'
  }
  const clauses = [
    waiting.length === 0
      ? 'nobody is waiting on you'
      : `${many(waiting.length, 'person', 'people')} ${waiting.length === 1 ? 'is' : 'are'} waiting on you`,
    carriedOver.length > 0 &&
      `${many(carriedOver.length, 'Todo')} carried over from ${dayBefore(day)}`,
    sentBack.length > 0 &&
      `${inWords(sentBack.length)} ${sentBack.length === 1 ? 'was' : 'were'} sent back`,
  ].filter((clause): clause is string => Boolean(clause))
  const head = sentence(list(clauses))
  // What merely arrived goes in a short second sentence, and only while the
  // first is short enough to carry one: two lines is what a chapter head has,
  // and the chapter lists every Promise and Waiting-on underneath either way.
  if (arrived === 0 || clauses.length > 2) return head
  const came = list([
    promises.length > 0 && many(promises.length, 'promise'),
    owed.length > 0 && many(owed.length, 'answer'),
  ])
  return `${head} ${sentence(`${came} came in since yesterday`)}`
}

function meetingsOf(
  today: Today,
  extras: RundownExtras,
  now: Date,
  timeZone: string,
): MeetingPrep[] {
  const minute = minuteOfDay(now, timeZone)
  const byId = new Map(today.links.map((link): [string, EventLinks] => [link.eventId, link]))
  return meetingsLeft(today.events, minute).map((event): MeetingPrep => {
    const link = byId.get(event.id)
    const client =
      link?.clientId == null
        ? null
        : (extras.billing?.week.find((each) => each.clientId === link.clientId) ?? null)
    return {
      event,
      at: `${String(Math.floor(event.from / 60)).padStart(2, '0')}:${String(event.from % 60).padStart(2, '0')}`,
      length: formatEstimate(event.until - event.from) ?? '',
      starts: inHowLong(event.from - minute),
      under: event.from <= minute,
      todos: (link?.todoIds ?? []).flatMap((id) => {
        const todo = today.todos.find((each) => each.id === id)
        return todo ? [todo] : []
      }),
      signals: (link?.signalIds ?? []).flatMap((id) => {
        const signal = today.signals.find((each) => each.id === id)
        return signal ? [signal] : []
      }),
      client,
      prep: link?.prep ?? null,
    }
  })
}

function meetingsSentence(meetings: readonly MeetingPrep[], today: Today): string {
  if (meetings.length === 0) {
    return meetingCount(today.events) === 0
      ? 'Nothing in the calendar today.'
      : 'No more meetings today.'
  }
  const [first] = meetings
  const opening = first!.under
    ? `${upper(many(meetings.length, 'meeting'))} left today; ${first!.event.title} is under way`
    : `${upper(many(meetings.length, 'meeting'))} left today, the first at ${first!.at} — ${first!.starts}`
  const prepared = meetings.filter((meeting) => meeting.todos.length > 0)
  if (prepared.length === 0) return `${opening}.`
  if (prepared.length === 1) return `${opening}. ${prepared[0]!.event.title} has prep on your list.`
  return `${opening}. ${upper(inWords(prepared.length))} of them have prep on your list.`
}

/**
 * The arithmetic she does in her head: what the stack's estimates come to,
 * against the time left in the day that no meeting holds. A Todo with no
 * estimate is never guessed at — it is counted and said.
 */
export function fitsOf(
  view: TodayView,
  events: readonly DayEvent[],
  now: Date,
  timeZone: string,
): Fits {
  const minute = minuteOfDay(now, timeZone)
  const { until } = span(view.timeline)
  return {
    workMinutes: view.stack.reduce((sum, todo) => sum + (todo.estimateMinutes ?? 0), 0),
    unestimated: view.stack.filter((todo) => todo.estimateMinutes === null).length,
    freeMinutes: freeMinutes(events, minute, until),
  }
}

function leftSentence(fits: Fits, stack: number): string {
  if (stack === 0) return 'Nothing left for today.'
  const { workMinutes, unestimated, freeMinutes: free } = fits
  if (workMinutes === 0) {
    return `${upper(many(stack, 'Todo'))} left, ${unestimated === stack ? 'none with an estimate' : 'nothing estimated'}.`
  }
  const work = `About ${formatEstimate(workMinutes)} of work${
    unestimated > 0 ? ` and ${inWords(unestimated)} with no estimate` : ''
  }`
  const room =
    free === 0
      ? 'no time free before the day ends'
      : `${formatEstimate(free)} free between meetings`
  const over = workMinutes - free
  const verdict = over <= 0 ? 'it fits' : `about ${formatEstimate(over)} more than fits`
  return `${work}, against ${room}: ${verdict}.`
}

function daySentence(
  view: TodayView,
  events: readonly DayEvent[],
  now: Date,
  timeZone: string,
): string {
  const minute = minuteOfDay(now, timeZone)
  const hourNow = Math.floor(minute / 60)
  const ahead = view.timeline.filter((hour) => hour.hour >= hourNow)
  if (ahead.length === 0) return "The day's hours are behind you."
  const meetings = meetingsLeft(events, minute)
  const first = meetings[0]
  const firstHour = first ? Math.floor(first.from / 60) : null

  // What the stretch between now and the first meeting is for: a focus block
  // makes it deep work, a Slot makes it the Todo on it, and neither makes it clear.
  const run = ahead.filter((hour) => firstHour === null || hour.hour < firstHour)
  const opening =
    firstHour === null
      ? run.some((hour) => hour.kind !== 'free')
        ? `${upper(kindOfRun(run))} for the rest of the day`
        : 'Nothing in the calendar for the rest of the day'
      : run.length === 0
        ? `${first!.title} first, at ${formatHour(firstHour)}`
        : `${upper(kindOfRun(run))} until ${formatHour(firstHour)}, then ${many(meetings.length, 'meeting')}`

  // The last clear stretch of the day: where the room to work actually is.
  const clear = lastClearRun(view.timeline, Math.max(hourNow, firstHour ?? hourNow))
  return sentence(clear === null ? opening : `${opening}; ${clear} is free`)
}

function kindOfRun(run: readonly TimelineHour[]): string {
  if (run.some((hour) => hour.kind === 'focus')) return 'deep work'
  if (run.every((hour) => hour.kind === 'slotted')) return 'your own work'
  return 'clear'
}

/** The last unbroken run of hours after `from` that holds nothing at all: "17:00", "15:00–17:00". */
function lastClearRun(hours: readonly TimelineHour[], from: number): string | null {
  const free = hours.filter((hour) => hour.hour > from && hour.kind === 'free')
  const last = free.at(-1)
  if (!last) return null
  let first = last.hour
  while (free.some((hour) => hour.hour === first - 1)) first -= 1
  return first === last.hour
    ? formatHour(first)
    : `${formatHour(first)}–${formatHour(last.hour + 1)}`
}

/**
 * Where the week has gone, in a line: the hours put in since Monday, and the
 * arrangement nearest its edge — a retainer about to run out is the thing
 * worth saying. The money is never recomputed here; the terms are the ones
 * "This week by Client" already draws (`clientTerms`).
 */
function clientsSentence(billing: RundownExtras['billing']): string {
  if (!billing) return ''
  const { week, needsClient } = billing
  const seconds = week.reduce((sum, client) => sum + client.weekSeconds, 0)
  const stray =
    needsClient > 0
      ? ` ${upper(many(needsClient, 'entry', 'entries'))} still ${needsClient === 1 ? 'needs' : 'need'} a Client.`
      : ''
  if (seconds === 0) return `Nothing tracked this week yet.${stray}`
  // The Client whose budget or retainer is nearest its end; failing that, the busiest.
  const budgeted = week
    .filter((client) => client.budgetHours !== null && client.monthSeconds > 0)
    .sort(
      (a, b) => b.monthSeconds / (b.budgetHours! * 3600) - a.monthSeconds / (a.budgetHours! * 3600),
    )
  const notable = budgeted[0] ?? week.find((client) => client.weekSeconds > 0)
  const terms =
    notable && notable.clientId !== null
      ? `; ${notable.name} is on ${lowerTerms(clientTerms(notable))}`
      : ''
  return `${formatTracked(seconds)} so far this week${terms}.${stray}`
}

/** "Retainer · 20h/mo, 2h 10m left" said inside a sentence. */
function lowerTerms(terms: string): string {
  const [kind, rest] = terms.split(' · ')
  return rest ? `a ${kind!.toLowerCase()}, ${rest}` : kind!.toLowerCase()
}

function laterSentence(today: Today): string {
  const { tieIns, milestones, nextMeeting } = today.later
  const tomorrow = nextMeeting && `tomorrow opens with ${nextMeeting.title} at ${nextMeeting.at}`
  if (tieIns.length === 0 && milestones.length === 0) {
    return sentence(tomorrow ?? 'Nothing is tied to you later this week')
  }
  const [milestone] = milestones
  return sentence(
    list([
      milestone &&
        (milestones.length === 1
          ? `${milestone.project}'s milestone falls on ${weekdayOf(milestone.day)}`
          : `${many(milestones.length, 'milestone')} fall this week`),
      tieIns.length > 0 && `you tie into ${many(tieIns.length, 'Project')}`,
      tomorrow,
    ]),
  )
}

function weekdayOf(day: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(
    new Date(`${day}T00:00:00Z`),
  )
}

/**
 * Everything the rundown says, for one day at one moment. Pure: the moment is
 * a parameter, nothing here reads a clock, and every sentence follows from the
 * rows handed in — so a patch that changes a row changes the sentence over it
 * in the same render, and the two can never disagree.
 */
export function viewRundown(
  today: Today,
  view: TodayView,
  extras: RundownExtras,
  now: Date,
  timeZone: string,
): Rundown {
  const catchUp = catchUpOf(today, view, now, timeZone)
  const meetings = meetingsOf(today, extras, now, timeZone)
  const fits = fitsOf(view, today.events, now, timeZone)
  const billing = extras.billing

  const chapters: Chapter[] = [
    {
      name: 'catch-up',
      kicker: 'Catch up',
      count:
        catchUp.waiting.length +
        catchUp.promises.length +
        catchUp.owed.length +
        catchUp.carriedOver.length +
        catchUp.sentBack.length,
      sentence: catchUpSentence(catchUp, today.day),
      filled:
        catchUp.waiting.length +
          catchUp.added.length +
          catchUp.promises.length +
          catchUp.owed.length +
          catchUp.carriedOver.length +
          catchUp.sentBack.length >
        0,
    },
    {
      name: 'meetings',
      kicker: 'Meetings',
      count: meetings.length,
      sentence: meetingsSentence(meetings, today),
      filled: meetings.length > 0,
    },
    {
      name: 'whats-left',
      kicker: "What's left",
      count: view.stack.length,
      sentence: leftSentence(fits, view.stack.length),
      filled: view.stack.length > 0 || view.done.length > 0,
    },
    {
      name: 'your-day',
      kicker: 'Your day',
      count: null,
      sentence: daySentence(view, today.events, now, timeZone),
      filled: view.timeline.length > 0,
    },
    ...(billing
      ? [
          {
            name: 'clients' as const,
            kicker: 'This week by Client',
            count: billing.week.filter((client) => client.weekSeconds > 0).length,
            sentence: clientsSentence(billing),
            filled: billing.week.length > 0,
          },
        ]
      : []),
    {
      name: 'later',
      kicker: 'Later this week',
      count: today.later.tieIns.length + today.later.milestones.length,
      sentence: laterSentence(today),
      filled:
        today.later.tieIns.length + today.later.milestones.length > 0 ||
        today.later.nextMeeting !== null,
    },
  ]

  return {
    chapters,
    catchUp,
    meetings,
    fits,
    ribbon: ribbonOf(view.timeline, now, timeZone, extras.logged),
  }
}
