import {
  type ClientArrangement,
  type ClientCadence,
  type DraftEntry,
  type DraftProject,
  type Energy,
  type InvoiceStatus,
  addDays,
  draftInvoice,
  dueDay,
  localTimeToInstant,
  periodOf,
  startOfDay,
  startOfWeek,
  wallClock,
} from '@crazy/shared'
import type { Prisma } from '../generated/prisma/client'
import type { SeedInput } from './index'
import { ryan } from './ryan'

// The second mockup's world (frames 2a–2c, 3a, 3b, 4a): a consultant who bills
// three Clients for her time, with the Billing module on. The mockups' moment
// is a Wednesday at 10:42, 1h 42m into Meridian's research synthesis.

interface ClientSeed {
  key: string
  name: string
  code: string
  arrangement: ClientArrangement
  rateCents: number
  roundingMinutes: number
  paymentTermsDays: number
  cadence: ClientCadence
  budgetHours: number | null
  /** Past a retainer's hours, what an hour is charged at instead. */
  overageRateCents: number | null
  /** Frame 2c's two switches: auto-draft on, send without review off (ticket 23). */
  autoDraft: boolean
  sendWithoutReview: boolean
  /** Where her September invoice has got to (frame 2b's three tags). */
  invoiceStatus: InvoiceStatus
  /** What she and the Client call it; Meridian's is frame 2b's INV-0042. */
  invoiceNumber: string
}

// Frame 2c's per-Client invoice settings, as terms rather than words.
const CLIENTS: ClientSeed[] = [
  {
    key: 'meridian',
    name: 'Meridian Health',
    code: 'MER',
    arrangement: 'project_fee',
    rateCents: 210_00,
    roundingMinutes: 15,
    paymentTermsDays: 30,
    cadence: 'monthly',
    budgetHours: 40,
    overageRateCents: null,
    autoDraft: true,
    sendWithoutReview: false,
    // Frame 2b: "Ready to review", and the draft the second card opens.
    invoiceStatus: 'review',
    invoiceNumber: 'INV-0042',
  },
  {
    key: 'quill',
    name: 'Quill & Co',
    code: 'QUI',
    arrangement: 'hourly',
    rateCents: 190_00,
    roundingMinutes: 6,
    paymentTermsDays: 15,
    cadence: 'biweekly',
    budgetHours: null,
    overageRateCents: null,
    autoDraft: true,
    sendWithoutReview: false,
    invoiceStatus: 'draft',
    invoiceNumber: 'INV-0043',
  },
  {
    // $3,600 for 20h a month, and $200 an hour past it (frame 2c's terms).
    key: 'bramble',
    name: 'Bramble',
    code: 'BRA',
    arrangement: 'retainer',
    rateCents: 180_00,
    roundingMinutes: 15,
    paymentTermsDays: 30,
    cadence: 'first_of_month',
    budgetHours: 20,
    overageRateCents: 200_00,
    autoDraft: true,
    sendWithoutReview: false,
    invoiceStatus: 'draft',
    invoiceNumber: 'INV-0044',
  },
]

/** Everything she bills in is dollars; the mockups quote no other currency. */
const CURRENCY = 'USD'

/** A Project with no Client is her own work: tracked, never billed. */
const PROJECTS: { key: string; name: string; client: string | null }[] = [
  { key: 'discovery', name: 'Discovery research', client: 'meridian' },
  { key: 'workshops', name: 'Stakeholder workshops', client: 'meridian' },
  { key: 'checkout', name: 'Checkout redesign', client: 'quill' },
  { key: 'onboarding', name: 'Onboarding v3', client: 'bramble' },
  { key: 'admin', name: 'Admin', client: null },
]

const STACK: { key: string; title: string; project: string; minutes: number; energy: Energy }[] = [
  {
    key: 'synthesis',
    title: 'Research synthesis · discovery interviews',
    project: 'discovery',
    minutes: 120,
    energy: 'deep_focus',
  },
  {
    key: 'wireframes',
    title: 'Onboarding flow v3 wireframes',
    project: 'onboarding',
    minutes: 120,
    energy: 'deep_focus',
  },
  {
    key: 'writeup',
    title: 'Synthesis writeup for Thursday',
    project: 'checkout',
    minutes: 60,
    energy: 'deep_focus',
  },
  {
    key: 'invoice-draft',
    title: 'Review Meridian invoice draft',
    project: 'admin',
    minutes: 15,
    energy: 'people_admin',
  },
  {
    key: 'untagged',
    title: 'Confirm two untagged entries',
    project: 'admin',
    minutes: 2,
    energy: 'quick_win',
  },
]

interface EntrySeed {
  key: string
  /** How many workdays back it was tracked; 0 is today. */
  workdaysAgo: number
  from: string
  /** Null while it runs: the one Time entry with no end. */
  until: string | null
  project: string | null
  note: string
  /** Who Crazy thinks the hours were for, where the entry names no Client (frame 2b). */
  suggest?: string
}

// Frame 2b's timesheet, then the rest of the month: Meridian at 28.0h, Quill at
// 22.5h and Bramble at 17.8h, which is what frames 2b and 4a bill and burn.
const ENTRIES: EntrySeed[] = [
  {
    key: 'wed-run',
    workdaysAgo: 0,
    from: '09:00',
    until: null,
    project: 'discovery',
    note: 'Research synthesis · interviews 4–7',
  },
  {
    key: 'wed-inbox',
    workdaysAgo: 0,
    from: '08:10',
    until: '08:30',
    project: null,
    note: 'Inbox, proposal tweak',
    suggest: 'quill',
  },
  {
    key: 'tue-wires',
    workdaysAgo: 1,
    from: '15:00',
    until: '17:30',
    project: 'onboarding',
    note: 'Wireframes, states 1–6',
  },
  {
    key: 'tue-call',
    workdaysAgo: 1,
    from: '14:00',
    until: '14:40',
    project: null,
    note: 'Call · no notes',
    suggest: 'quill',
  },
  {
    key: 'tue-interviews',
    workdaysAgo: 1,
    from: '09:00',
    until: '12:00',
    project: 'discovery',
    note: 'Interviews 2–3, notes',
  },
  {
    key: 'mon-review',
    workdaysAgo: 2,
    from: '13:30',
    until: '15:15',
    project: 'checkout',
    note: 'Stakeholder review + follow-ups',
  },
  {
    key: 'mon-interview',
    workdaysAgo: 2,
    from: '09:00',
    until: '13:15',
    project: 'discovery',
    note: 'Interview 1, synthesis setup',
  },
  {
    key: 'w1-workshop-a',
    workdaysAgo: 3,
    from: '09:00',
    until: '12:00',
    project: 'workshops',
    note: 'Stakeholder workshop 2',
  },
  {
    key: 'w1-quill-a',
    workdaysAgo: 3,
    from: '13:00',
    until: '17:15',
    project: 'checkout',
    note: 'Checkout flows, payment step',
  },
  {
    key: 'w1-bramble-a',
    workdaysAgo: 4,
    from: '09:00',
    until: '12:30',
    project: 'onboarding',
    note: 'Onboarding audit',
  },
  {
    key: 'w1-quill-b',
    workdaysAgo: 4,
    from: '13:00',
    until: '17:15',
    project: 'checkout',
    note: 'Checkout flows, cart',
  },
  {
    key: 'w1-research-a',
    workdaysAgo: 5,
    from: '09:00',
    until: '12:30',
    project: 'discovery',
    note: 'Interview guide, recruiting',
  },
  {
    key: 'w1-bramble-b',
    workdaysAgo: 5,
    from: '13:30',
    until: '17:00',
    project: 'onboarding',
    note: 'Wireframes, first pass',
  },
  {
    key: 'w1-workshop-b',
    workdaysAgo: 6,
    from: '09:00',
    until: '12:00',
    project: 'workshops',
    note: 'Stakeholder workshop 1',
  },
  {
    key: 'w1-quill-c',
    workdaysAgo: 6,
    from: '13:00',
    until: '17:15',
    project: 'checkout',
    note: 'Competitive review',
  },
  {
    key: 'w2-research-b',
    workdaysAgo: 7,
    from: '09:00',
    until: '12:30',
    project: 'discovery',
    note: 'Screener and scheduling',
  },
  {
    key: 'w2-bramble-c',
    workdaysAgo: 7,
    from: '13:30',
    until: '17:00',
    project: 'onboarding',
    note: 'Flow map',
  },
  {
    key: 'w2-quill-d',
    workdaysAgo: 8,
    from: '09:00',
    until: '13:15',
    project: 'checkout',
    note: 'Kick-off, analytics review',
  },
  {
    key: 'w2-pm',
    workdaysAgo: 8,
    from: '14:00',
    until: '16:30',
    project: 'discovery',
    note: 'Project management & reporting',
  },
  {
    key: 'w2-research-c',
    workdaysAgo: 9,
    from: '09:00',
    until: '12:30',
    project: 'discovery',
    note: 'Desk research',
  },
  {
    key: 'w2-bramble-d',
    workdaysAgo: 9,
    from: '13:30',
    until: '17:00',
    project: 'onboarding',
    note: 'Kick-off and goals',
  },
  {
    key: 'w2-quill-e',
    workdaysAgo: 10,
    from: '09:00',
    until: '12:45',
    project: 'checkout',
    note: 'Proposal and scoping',
  },
  {
    key: 'w2-bramble-e',
    workdaysAgo: 10,
    from: '14:00',
    until: '15:20',
    project: 'onboarding',
    note: 'Retainer planning call',
  },
]

/*
 * The five weeks before September, which frame 4a's "hours per week by client"
 * reaches back over (eight weeks in all; the three newest are September's, and
 * they are the ones tickets 19–21 pinned). Nothing here falls on or after the
 * 1st of September, so Meridian's 28.0h, Quill's 22.5h and Bramble's 17h 50m
 * are exactly what they were.
 *
 * Workday 13 is the last Friday of August and workday 37 is the Monday eight
 * weeks back; `workdayBack` skips the weekends she does not work.
 */
const EARLIER: [
  workdaysAgo: number,
  project: string,
  from: string,
  until: string,
  note: string,
  todo?: string,
][] = [
  // Week of 25–29 Aug
  [13, 'discovery', '09:00', '12:30', 'Interview notes and coding'],
  [13, 'admin', '13:30', '15:00', 'Invoicing and inbox', 'h-invoices'],
  [14, 'workshops', '09:00', '12:00', 'Workshop prep'],
  [14, 'checkout', '13:00', '17:00', 'Checkout flows, review'],
  [15, 'admin', '08:40', '09:00', 'Audit summary to Bramble', 'h-summary'],
  [15, 'discovery', '09:00', '12:30', 'Desk research'],
  [15, 'onboarding', '13:30', '17:00', 'Onboarding states'],
  [16, 'discovery', '09:00', '13:00', 'Interview 0, pilot', 'h-synth'],
  [16, 'checkout', '14:00', '17:00', 'Payment step'],
  [17, 'workshops', '09:00', '12:00', 'Workshop plan'],
  [17, 'onboarding', '13:00', '16:30', 'Flow review'],
  // Week of 18–22 Aug
  [18, 'admin', '09:00', '11:00', 'Inbox and admin catch-up', 'h-inbox'],
  [19, 'discovery', '09:00', '12:30', 'Screener draft', 'h-flows'],
  [19, 'checkout', '13:30', '16:30', 'Cart edge cases'],
  [20, 'onboarding', '09:00', '12:00', 'Onboarding audit notes', 'h-audit'],
  [20, 'discovery', '13:00', '16:00', 'Recruiting'],
  [21, 'discovery', '09:00', '12:30', 'Interview guide', 'h-guide'],
  [21, 'checkout', '13:30', '17:00', 'Analytics review'],
  [22, 'workshops', '09:30', '12:30', 'Workshop 0'],
  // Week of 11–15 Aug
  [23, 'discovery', '09:00', '12:30', 'Discovery kick-off'],
  [23, 'admin', '13:30', '15:00', 'Admin'],
  [24, 'discovery', '09:00', '12:00', 'Stakeholder map'],
  [24, 'checkout', '13:00', '17:15', 'Competitive review'],
  [25, 'onboarding', '09:00', '12:30', 'Retainer scoping'],
  [25, 'discovery', '13:30', '17:00', 'Research plan'],
  [26, 'discovery', '09:00', '13:00', 'Desk research'],
  [26, 'checkout', '14:00', '17:00', 'Flows, first pass'],
  [27, 'workshops', '09:00', '12:00', 'Workshop scoping'],
  [27, 'onboarding', '13:00', '17:00', 'Onboarding teardown'],
  // Week of 4–8 Aug
  [28, 'discovery', '09:00', '12:00', 'Proposal follow-up'],
  [28, 'admin', '13:00', '14:30', 'Admin and invoicing'],
  [29, 'checkout', '09:00', '12:30', 'Kick-off notes'],
  [29, 'onboarding', '13:30', '17:00', 'Audit plan'],
  [30, 'discovery', '09:00', '12:30', 'Discovery proposal'],
  [30, 'workshops', '13:30', '16:30', 'Workshop outline'],
  [31, 'discovery', '09:00', '12:00', 'Scoping call and notes'],
  [31, 'checkout', '13:00', '16:30', 'Scoping'],
  [32, 'onboarding', '09:00', '12:00', 'Retainer kick-off'],
  [32, 'discovery', '13:00', '16:00', 'Desk research'],
  // Week of 28 Jul – 1 Aug
  [33, 'discovery', '09:00', '12:00', 'Proposal'],
  [33, 'admin', '13:00', '14:00', 'Admin'],
  [34, 'checkout', '09:00', '12:30', 'Intro and scoping'],
  [34, 'onboarding', '13:30', '16:30', 'Intro call and notes'],
  [35, 'discovery', '09:00', '12:30', 'Background reading'],
  [35, 'checkout', '13:30', '17:00', 'Store walkthrough'],
  [36, 'workshops', '09:00', '12:00', 'Workshop idea'],
  [36, 'discovery', '13:00', '16:30', 'Notes and questions'],
  [37, 'discovery', '09:30', '12:30', 'First conversations'],
  [37, 'onboarding', '13:30', '17:00', 'Onboarding walkthrough'],
]

/**
 * The Todos behind some of those earlier spells: the ones that carry both an
 * estimate and a timer, which is what frame 4a's "estimate vs actual" is of.
 * Each is finished, on the day its spell was worked, so nothing here is in her
 * day or her stack.
 */
const EARLIER_TODOS: {
  key: string
  title: string
  project: string
  minutes: number
  energy: Energy
}[] = [
  {
    key: 'h-guide',
    title: 'Write the interview guide',
    project: 'discovery',
    minutes: 120,
    energy: 'deep_focus',
  },
  {
    key: 'h-flows',
    title: 'Draft the screener',
    project: 'discovery',
    minutes: 180,
    energy: 'deep_focus',
  },
  {
    key: 'h-audit',
    title: 'Onboarding audit notes',
    project: 'onboarding',
    minutes: 240,
    energy: 'deep_focus',
  },
  {
    key: 'h-synth',
    title: 'Pilot interview and write-up',
    project: 'discovery',
    minutes: 180,
    energy: 'deep_focus',
  },
  {
    key: 'h-invoices',
    title: 'August invoicing and inbox',
    project: 'admin',
    minutes: 60,
    energy: 'people_admin',
  },
  {
    key: 'h-inbox',
    title: 'Clear the inbox',
    project: 'admin',
    minutes: 90,
    energy: 'people_admin',
  },
  {
    key: 'h-summary',
    title: 'Send Bramble the audit summary',
    project: 'admin',
    minutes: 30,
    energy: 'quick_win',
  },
]

/**
 * What Crazy modelled for the Time tab (frame 4a), and nothing the screen can
 * count for itself: the hours a week she means to bill and the share of her
 * time she means to be billable — a target is a decision, not a measurement —
 * and the two lines it writes where a card has nothing to count.
 */
const MODELLED_TIME: { kind: 'headline' | 'note'; figure: string; value: string }[] = [
  { kind: 'headline', figure: 'time_target_hours', value: '30' },
  { kind: 'headline', figure: 'time_target_billable', value: '0.75' },
  {
    kind: 'note',
    figure: 'when_you_work',
    value:
      'Deep-work peak Tue–Thu 09–12. Fridays after 14:00 are mostly admin; I stop suggesting billable work there.',
  },
  {
    kind: 'note',
    figure: 'estimate_vs_actual',
    value: 'Deep focus runs over more often than not; I pad those estimates now.',
  },
]

/**
 * Her day, hour by hour, as frame 2a draws it: which Todos hold which hours,
 * the one meeting the calendar holds, and the words Crazy wrote for each hour
 * when it planned the day. An hour with no Todo and no meeting is still worded
 * — 08:00 is the spell she tracked to Internal before the day began, 12:00 is
 * lunch — because Crazy plans the whole day and not only the parts with a row.
 */
const DAY: {
  hour: number
  /** The Todo that holds the hour, if one does. */
  todo?: string
  title: string
  note: string | null
}[] = [
  { hour: 8, title: 'Inbox · proposal tweak', note: 'tracked to Internal · project?' },
  {
    hour: 9,
    todo: 'synthesis',
    title: 'Research synthesis · discovery interviews',
    note: 'running',
  },
  { hour: 10, todo: 'synthesis', title: '↳ synthesis continues', note: 'running' },
  { hour: 11, title: 'Quill weekly · 11:30', note: '30m · billable' },
  { hour: 12, title: 'Lunch', note: 'timer paused' },
  {
    hour: 13,
    todo: 'wireframes',
    title: 'Bramble · onboarding flow v3',
    note: 'suggested · retainer hits 20h ~15:00',
  },
  { hour: 14, todo: 'wireframes', title: '↳ Bramble continues', note: 'suggested' },
  {
    hour: 15,
    todo: 'invoice-draft',
    title: 'Review Meridian invoice draft',
    note: '15m · not billable',
  },
  { hour: 16, todo: 'writeup', title: 'Quill · synthesis writeup', note: 'suggested · 1h' },
]

/** The one meeting on her day: Quill's weekly, which the 11:00 hour is drawn around. */
const MEETING = { key: 'quill-weekly', title: 'Quill weekly', from: '11:30', until: '12:00' }

const BRIEF = {
  body: "You're 1h 42m into Meridian's synthesis; the timer hasn't moved projects since 09:00, so I'll ask before your 11:30 with Quill. Bramble's retainer hits 20h at about 15:00 today. September invoices go out Friday and Meridian's is ready to review.",
  bodyShort:
    "1h 42m into Meridian's synthesis. Quill at 11:30; Bramble's retainer hits 20h about 15:00.",
}

export function cori(input: SeedInput) {
  const { userId, now, timeZone } = input
  // Her world has a timer running in it (frame 3a, running). Seeded idle, that
  // one Time entry is given an end at the moment everything is laid over, which
  // is the only way to see the idle bar at a pinned moment.
  const stillRunning = input.timer !== 'idle'
  const today = wallClock(now, timeZone).day
  const id = (kind: string, key: string) => `${userId}/${kind}/${key}`
  /** A wall-clock time on a day, never later than the moment seeded over: nothing is tracked in the future. */
  const past = (day: string, time: string) => {
    const moment = localTimeToInstant(`${day}T${time}`, timeZone)!
    return moment > now ? now : moment
  }
  /** The day `count` workdays before today: she does not track at weekends. */
  const workdayBack = (count: number) => {
    let day = today
    for (let left = count; left > 0;) {
      day = addDays(day, -1)
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
      if (weekday !== 0 && weekday !== 6) left--
    }
    return day
  }
  const started = past(workdayBack(40), '09:00')

  /** A minute apart, so that the order she took them on is a real order. */
  const takenOn = (index: number) => new Date(started.getTime() + index * 60_000)

  const clients: Prisma.ClientCreateManyInput[] = CLIENTS.map(
    ({ key, invoiceStatus: _status, invoiceNumber: _number, ...client }, index) => ({
      id: id('client', key),
      userId,
      ...client,
      createdAt: takenOn(index),
    }),
  )

  const projects: Prisma.ProjectCreateManyInput[] = PROJECTS.map((project, index) => ({
    id: id('project', project.key),
    userId,
    name: project.name,
    status: 'on_track',
    clientId: project.client ? id('client', project.client) : null,
    createdAt: takenOn(index),
  }))

  const todos: Prisma.TodoCreateManyInput[] = STACK.map((todo, index) => ({
    id: id('todo', todo.key),
    userId,
    title: todo.title,
    state: 'today',
    projectId: id('project', todo.project),
    estimateMinutes: todo.minutes,
    energy: todo.energy,
    carryCount: 0,
    stackPosition: index + 1,
    createdAt: past(workdayBack(1), '10:00'),
    touchedAt: past(today, '08:05'),
  }))

  const clientOf = (project: string | null) =>
    PROJECTS.find((each) => each.key === project)?.client ?? null

  const timeEntries: Prisma.TimeEntryCreateManyInput[] = ENTRIES.map((entry) => {
    const day = workdayBack(entry.workdaysAgo)
    const client = clientOf(entry.project)
    const startedAt = past(day, entry.from)
    const runs = entry.until === null
    return {
      id: id('entry', entry.key),
      userId,
      clientId: client ? id('client', client) : null,
      projectId: entry.project ? id('project', entry.project) : null,
      todoId: runs ? id('todo', 'synthesis') : null,
      note: entry.note,
      // Work for a Client is billable until she says otherwise; her own never is.
      billable: client !== null,
      startedAt,
      endedAt: entry.until === null ? (stillRunning ? null : now) : past(day, entry.until),
      // Frame 2b flags the two spells she tracked to Internal and says it
      // thinks both were Quill's; one tap on the Time screen confirms it.
      suggestedClientId: entry.suggest ? id('client', entry.suggest) : null,
      suggestedProjectId: null,
      createdAt: startedAt,
    }
  })

  // The five weeks before September, which frame 4a's eight-week chart reaches
  // back over. Every one of them falls before the 1st, so September's hours —
  // and so frames 2a, 2b and 3a — are exactly what they were.
  for (const [workdaysAgo, project, from, until, note, todo] of EARLIER) {
    const day = workdayBack(workdaysAgo)
    const client = clientOf(project)
    const startedAt = past(day, from)
    timeEntries.push({
      id: id('entry', `h-${workdaysAgo}-${from.replace(':', '')}`),
      userId,
      clientId: client ? id('client', client) : null,
      projectId: id('project', project),
      todoId: todo ? id('todo', todo) : null,
      note,
      billable: client !== null,
      startedAt,
      endedAt: past(day, until),
      suggestedClientId: null,
      suggestedProjectId: null,
      createdAt: startedAt,
    })
  }

  // The Todos behind the spells that carry both an estimate and a timer, each
  // finished on the day it was worked. None of them is in her day or her stack.
  for (const todo of EARLIER_TODOS) {
    const spell = EARLIER.find((each) => each[5] === todo.key)
    if (spell === undefined) continue
    const day = workdayBack(spell[0])
    const finished = past(day, spell[3])
    todos.push({
      id: id('todo', todo.key),
      userId,
      title: todo.title,
      state: 'done',
      projectId: id('project', todo.project),
      estimateMinutes: todo.minutes,
      energy: todo.energy,
      carryCount: 0,
      stackPosition: null,
      createdAt: past(addDays(day, -2), '09:00'),
      touchedAt: finished,
      doneAt: finished,
    })
  }

  /*
   * Her invoices, one per Client per month she worked, exactly as
   * `draftInvoice` builds them from the Time entries above. Nothing here is a
   * typed-in figure: the seed runs the same arithmetic the app runs, so the
   * mockups' $5,880 is either what her timesheet comes to or it is wrong, and a
   * test says which.
   *
   * This month's are where frame 2b leaves them — one waiting to be checked and
   * two still being put together. Every earlier month has been billed and paid,
   * which is what makes "unbilled" on the Metrics screen mean this month's
   * money and nothing older.
   *
   * When one goes out is the cadence's: for this month the monthly and the
   * bi-weekly Clients go on this week's Friday, which is what her Brief says
   * ("September invoices go out Friday"), and the retainer on the first of next
   * month. An earlier month's went out the day after it ended.
   */
  const month = periodOf('month', today)
  const friday = addDays(startOfWeek(today), 4)
  const firstOfNextMonth = addDays(month.to, 1)

  const draftProjects: DraftProject[] = PROJECTS.map((project) => ({
    id: id('project', project.key),
    name: project.name,
    // No Project of hers is charged at its own rate; the Client's stands.
    rateCents: null,
  }))

  const invoices: Prisma.InvoiceCreateManyInput[] = []
  const invoiceLines: Prisma.InvoiceLineCreateManyInput[] = []

  /** The months she tracked anything in, oldest first. */
  const months = [
    ...new Set(
      timeEntries.map((entry) => wallClock(entry.startedAt as Date, timeZone).day.slice(0, 7)),
    ),
  ].sort()
  const earlierMonths = months.filter((each) => each < today.slice(0, 7))
  // The numbers count up to this month's, which frame 2b prints as INV-0042.
  let number = 42 - earlierMonths.length * CLIENTS.length

  for (const each of months) {
    const period = periodOf('month', `${each}-01`)
    const current = each === today.slice(0, 7)
    const periodFrom = startOfDay(period.from, timeZone)
    const periodTo = startOfDay(addDays(period.to, 1), timeZone)

    CLIENTS.forEach((client, index) => {
      const clientId = id('client', client.key)
      const entries: DraftEntry[] = timeEntries
        .filter((entry) => entry.clientId === clientId)
        .map((entry) => ({
          id: entry.id as string,
          projectId: (entry.projectId as string | null) ?? null,
          billable: entry.billable as boolean,
          startedAt: (entry.startedAt as Date).toISOString(),
          endedAt: (entry.endedAt as Date | null)?.toISOString() ?? null,
        }))
      const terms = {
        arrangement: client.arrangement,
        rateCents: client.rateCents,
        overageRateCents: client.overageRateCents,
        roundingMinutes: client.roundingMinutes,
        paymentTermsDays: client.paymentTermsDays,
        budgetHours: client.budgetHours,
        currency: CURRENCY,
      }
      const draft = draftInvoice({
        entries,
        projects: draftProjects,
        terms,
        from: periodFrom,
        to: periodTo,
        now,
      })
      // A month a Client did nothing in is a month they are not billed for; a
      // retainer is owed its fee, but only for a month she worked at all.
      if (draft.lines.length === 0 || draft.seconds === 0) {
        if (!current) number += 1
        return
      }

      const issuedDay = current
        ? client.cadence === 'first_of_month'
          ? firstOfNextMonth
          : friday
        : addDays(period.to, 1)
      const invoiceId = id('invoice', `${each}-${client.key}`)
      invoices.push({
        id: invoiceId,
        userId,
        clientId,
        fromDay: period.from,
        toDay: period.to,
        status: current ? client.invoiceStatus : 'paid',
        number: current ? client.invoiceNumber : `INV-${String(number).padStart(4, '0')}`,
        issuedDay,
        dueDay: dueDay(issuedDay, client.paymentTermsDays),
        ...terms,
        totalCents: draft.totalCents,
        seconds: draft.seconds,
        createdAt: takenOn(index),
      })
      if (!current) number += 1
      for (const line of draft.lines) {
        invoiceLines.push({
          id: `${invoiceId}/line/${line.position}`,
          userId,
          invoiceId,
          description: line.description,
          projectId: line.projectId,
          seconds: line.seconds,
          minutes: line.minutes,
          rateCents: line.rateCents,
          amountCents: line.amountCents,
          position: line.position,
        })
      }
    })
  }

  // The tools she reads are the first persona's; her billing Providers are ticket 23's.
  const { connections } = ryan(input)

  const slots: Prisma.SlotCreateManyInput[] = DAY.filter((hour) => hour.todo !== undefined).map(
    (hour) => ({
      id: id('slot', `${hour.todo}-${hour.hour}`),
      userId,
      todoId: id('todo', hour.todo!),
      day: today,
      hour: hour.hour,
      createdAt: past(today, '08:05'),
    }),
  )

  const calendarEvents: Prisma.CalendarEventCreateManyInput[] = [
    {
      id: id('event', MEETING.key),
      userId,
      connectionId: id('connection', 'google'),
      itemId: MEETING.key,
      kind: 'meeting',
      title: MEETING.title,
      who: null,
      startsAt: localTimeToInstant(`${today}T${MEETING.from}`, timeZone)!,
      endsAt: localTimeToInstant(`${today}T${MEETING.until}`, timeZone)!,
      createdAt: past(workdayBack(4), '09:00'),
    },
  ]

  /*
   * What Crazy modelled for the Metrics screen's Time tab, written this morning
   * with the Brief and for today, so a day it has not looked shows no modelled
   * figure. Written once at the thirty-day range and read there whatever range
   * is chosen: a target and a line of commentary are not functions of how far
   * back the screen looks, the way the thirty-day strip is not (ticket 14).
   */
  const metricSnapshots: Prisma.MetricSnapshotCreateManyInput[] = MODELLED_TIME.map((row) => ({
    id: id('metric', `30d-${row.kind}-${row.figure}`),
    userId,
    range: '30d',
    day: today,
    kind: row.kind,
    figure: row.figure,
    position: 0,
    label: null,
    value: row.value,
    note: null,
    createdAt: past(today, '06:00'),
  }))

  const timelineHours: Prisma.TimelineHourCreateManyInput[] = DAY.map((hour) => ({
    id: id('hour', `${today}-${hour.hour}`),
    userId,
    day: today,
    hour: hour.hour,
    title: hour.title,
    note: hour.note,
    sourceKind: hour.hour === 11 ? 'calendar_event' : null,
    // Crazy worded the day it had planned, so each hour's words were written
    // for the Todos it holds. Re-plan the hour and the words step aside.
    writtenFor: JSON.stringify(hour.todo ? [id('todo', hour.todo)] : []),
    createdAt: past(today, '08:00'),
  }))

  return {
    connections,
    circles: [],
    clients,
    projects,
    todos,
    circleMatches: [],
    overlapNotes: [],
    slots,
    briefs: [
      {
        id: id('brief', today),
        userId,
        kind: 'daily',
        day: today,
        ...BRIEF,
        createdAt: past(today, '06:00'),
      },
    ],
    weekDayLines: [],
    weekDayNotes: [],
    tieIns: [],
    calendarEvents,
    timelineHours,
    signals: [],
    metricSnapshots,
    timeEntries,
    invoices,
    invoiceLines,
  } satisfies PersonaRows
}

/** What a persona's seed hands back: every table's rows, parents before children. */
export type PersonaRows = ReturnType<typeof ryan>
