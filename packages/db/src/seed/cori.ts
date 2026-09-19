import {
  type ClientArrangement,
  type ClientCadence,
  type Energy,
  addDays,
  localTimeToInstant,
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
  },
  {
    // $3,600 for 20h a month; past the retainer an hour is $200, which is ticket 21's to charge.
    key: 'bramble',
    name: 'Bramble',
    code: 'BRA',
    arrangement: 'retainer',
    rateCents: 180_00,
    roundingMinutes: 15,
    paymentTermsDays: 30,
    cadence: 'first_of_month',
    budgetHours: 20,
  },
]

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

const BRIEF = {
  body: "You're 1h 42m into Meridian's synthesis; the timer hasn't moved projects since 09:00, so I'll ask before your 11:30 with Quill. Bramble's retainer hits 20h at about 15:00 today. September invoices go out Friday and Meridian's is ready to review.",
  bodyShort:
    "1h 42m into Meridian's synthesis. Quill at 11:30; Bramble's retainer hits 20h about 15:00.",
}

export function cori(input: SeedInput) {
  const { userId, now, timeZone } = input
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

  const clients: Prisma.ClientCreateManyInput[] = CLIENTS.map(({ key, ...client }) => ({
    id: id('client', key),
    userId,
    ...client,
    createdAt: started,
  }))

  const projects: Prisma.ProjectCreateManyInput[] = PROJECTS.map((project) => ({
    id: id('project', project.key),
    userId,
    name: project.name,
    status: 'on_track',
    clientId: project.client ? id('client', project.client) : null,
    createdAt: started,
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
    return {
      id: id('entry', entry.key),
      userId,
      clientId: client ? id('client', client) : null,
      projectId: entry.project ? id('project', entry.project) : null,
      todoId: entry.until === null ? id('todo', 'synthesis') : null,
      note: entry.note,
      // Work for a Client is billable until she says otherwise; her own never is.
      billable: client !== null,
      startedAt,
      endedAt: entry.until === null ? null : past(day, entry.until),
      createdAt: startedAt,
    }
  })

  // The tools she reads are the first persona's; her billing Providers are ticket 23's.
  const { connections } = ryan(input)

  return {
    connections,
    circles: [],
    clients,
    projects,
    todos,
    circleMatches: [],
    overlapNotes: [],
    slots: [],
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
    calendarEvents: [],
    timelineHours: [],
    signals: [],
    metricSnapshots: [],
    timeEntries,
  } satisfies PersonaRows
}

/** What a persona's seed hands back: every table's rows, parents before children. */
export type PersonaRows = ReturnType<typeof ryan>
