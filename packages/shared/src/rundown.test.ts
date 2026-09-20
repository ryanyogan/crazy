import { expect, it } from 'vite-plus/test'
import { type ChapterName, viewRundown } from './rundown'
import type { DayEvent } from './timeline'
import { type EventLinks, type Signal, type Today, viewToday } from './today'
import type { ClientWeek } from './timer'
import type { TodayTodo } from './todo'

// Frame 1a's day: Wednesday 17 Sep 2025 on Ryan's wall clock, at 08:41.
const timeZone = 'America/Chicago'
const DAY = '2025-09-17'
const at = (local: string) => new Date(`2025-09-17T${local}:00.000-05:00`)
const now = at('08:41')

function todo(id: string, fields: Partial<TodayTodo> = {}): TodayTodo {
  return {
    id,
    title: id,
    state: 'today',
    project: null,
    projectId: null,
    clientId: null,
    clientName: null,
    estimateMinutes: null,
    energy: null,
    carryCount: 0,
    stackPosition: null,
    reason: null,
    source: null,
    slotHours: [],
    createdAt: '2025-09-16T09:00:00.000Z',
    touchedAt: '2025-09-16T09:00:00.000Z',
    snoozedUntil: null,
    startedAt: null,
    swappedOnDay: null,
    doneAt: null,
    ...fields,
  }
}

function signal(id: string, fields: Partial<Signal> = {}): Signal {
  return {
    id,
    kind: 'mention',
    who: id,
    text: 'said something',
    at: '2025-09-16T20:00:00.000Z',
    source: { connectionId: 'c', itemId: id, kind: 'slack_message', ref: null, url: null },
    todoId: null,
    ...fields,
  }
}

/** A meeting from `from` to `until`, in minutes into the day. */
function meeting(
  id: string,
  from: number,
  until: number,
  fields: Partial<DayEvent> = {},
): DayEvent {
  return { id, kind: 'meeting', title: id, who: null, from, until, ...fields }
}

function day(fields: Partial<Today> = {}): Today {
  return {
    day: DAY,
    brief: null,
    todos: [],
    events: [],
    hours: [],
    signals: [],
    sentBack: [],
    links: [],
    later: { tieIns: [], milestones: [], nextMeeting: null },
    ...fields,
  }
}

function client(fields: Partial<ClientWeek> = {}): ClientWeek {
  return {
    clientId: 'quill',
    name: 'Quill & Co',
    code: 'QUI',
    order: 0,
    weekSeconds: 0,
    monthSeconds: 0,
    arrangement: 'hourly',
    rateCents: 190_00,
    budgetHours: null,
    ...fields,
  }
}

/** The rundown as the screen derives it: the day, what it makes of it, and the moment. */
function read(
  today: Today,
  extras: Parameters<typeof viewRundown>[2] = { billing: null, logged: [] },
  moment = now,
) {
  return viewRundown(today, viewToday(today, moment, timeZone), extras, moment, timeZone)
}

const said = (today: Today, name: ChapterName, extras?: Parameters<typeof viewRundown>[2]) =>
  read(today, extras).chapters.find((chapter) => chapter.name === name)!

// ── Catch up ────────────────────────────────────────────────────────────────

it('says plainly that nothing arrived and nothing carried over', () => {
  const chapter = said(day(), 'catch-up')
  expect(chapter.sentence).toBe('Nobody is waiting on you and nothing carried over.')
  expect(chapter.count).toBe(0)
  expect(chapter.filled).toBe(false)
})

it('counts the people waiting, what carried over and what was sent back, in words', () => {
  const chapter = said(
    day({
      signals: [signal('Priya'), signal('Devon'), signal('Sam')],
      todos: [
        todo('spike', { carryCount: 1, stackPosition: 1 }),
        todo('q4', { carryCount: 2, stackPosition: 2 }),
        todo('deposit', { carryCount: 1, stackPosition: 3 }),
      ],
      sentBack: [{ id: 'expenses', title: 'August expense report' }],
    }),
    'catch-up',
  )
  expect(chapter.sentence).toBe(
    'Three people are waiting on you, three Todos carried over from Tuesday and one was sent back.',
  )
  expect(chapter.count).toBe(7)
  expect(chapter.filled).toBe(true)
})

it('says one person, one Todo and one sent back in the singular', () => {
  expect(
    said(
      day({
        signals: [signal('Priya')],
        todos: [todo('spike', { carryCount: 1, stackPosition: 1 })],
        sentBack: [{ id: 'expenses', title: 'August expense report' }],
      }),
      'catch-up',
    ).sentence,
  ).toBe('One person is waiting on you, one Todo carried over from Tuesday and one was sent back.')
})

it('does not count a Mention already added as a Todo among the people waiting', () => {
  const rundown = read(day({ signals: [signal('Priya', { todoId: 'reply' }), signal('Devon')] }))
  expect(rundown.catchUp.waiting.map((each) => each.who)).toEqual(['Devon'])
  expect(rundown.catchUp.added.map((each) => each.who)).toEqual(['Priya'])
  expect(rundown.chapters[0]!.sentence).toBe('One person is waiting on you.')
})

it('counts the Promises and Waiting-on that came in since yesterday, and no older ones', () => {
  const rundown = read(
    day({
      signals: [
        signal('Priya', { kind: 'promise', at: '2025-09-16T14:00:00.000Z' }),
        signal('Design', { kind: 'promise', at: '2025-09-10T14:00:00.000Z' }),
        signal('Sam', { kind: 'waiting_on', at: '2025-09-17T11:00:00.000Z' }),
      ],
    }),
  )
  expect(rundown.catchUp.promises.map((each) => each.who)).toEqual(['Priya'])
  expect(rundown.catchUp.owed.map((each) => each.who)).toEqual(['Sam'])
  expect(rundown.chapters[0]!.sentence).toBe(
    'Nobody is waiting on you. One promise and one answer came in since yesterday.',
  )
})

// ── Meetings ────────────────────────────────────────────────────────────────

it('says there is nothing in the calendar when the day holds no meeting', () => {
  expect(said(day(), 'meetings').sentence).toBe('Nothing in the calendar today.')
})

it('counts the meetings still to come and says how long until the first', () => {
  const today = day({
    events: [meeting('standup', 11 * 60, 11 * 60 + 30), meeting('1:1', 990, 1020)],
  })
  const chapter = said(today, 'meetings')
  expect(chapter.count).toBe(2)
  expect(chapter.sentence).toBe('Two meetings left today, the first at 11:00 — in 2h 19m.')
})

it('drops a meeting that is over, and says so when none are left', () => {
  const today = day({ events: [meeting('standup', 7 * 60, 8 * 60)] })
  const chapter = said(today, 'meetings')
  expect(chapter.count).toBe(0)
  expect(chapter.sentence).toBe('No more meetings today.')
  expect(chapter.filled).toBe(false)
})

it('says a meeting already under way is under way rather than how long until it', () => {
  const today = day({ events: [meeting('standup', 8 * 60 + 30, 9 * 60)] })
  expect(said(today, 'meetings').sentence).toBe('One meeting left today; standup is under way.')
  expect(read(today).meetings[0]!.under).toBe(true)
})

it('names the meeting that has prep on the list, and links the Todo by its Source', () => {
  const today = day({
    events: [meeting('1:1 with Devon', 990, 1020)],
    todos: [todo('prep', { title: 'Prep 1:1 notes for Devon', stackPosition: 1 })],
    links: [
      { eventId: '1:1 with Devon', todoIds: ['prep'], signalIds: [], clientId: null, prep: null },
    ],
  })
  expect(said(today, 'meetings').sentence).toBe(
    'One meeting left today, the first at 16:30 — in 7h 49m. 1:1 with Devon has prep on your list.',
  )
  expect(read(today).meetings[0]!.todos.map((each) => each.title)).toEqual([
    'Prep 1:1 notes for Devon',
  ])
})

it('shows a prep note only where one was written, and never a placeholder', () => {
  const links: EventLinks[] = [
    { eventId: 'quill', todoIds: [], signalIds: [], clientId: 'quill', prep: null },
  ]
  const today = day({ events: [meeting('quill', 690, 720)], links })
  expect(read(today).meetings[0]!.prep).toBeNull()

  const written = day({
    events: [meeting('quill', 690, 720)],
    links: [
      { ...links[0]!, prep: { body: 'Switch the timer first.', bodyShort: 'Switch first.' } },
    ],
  })
  expect(read(written).meetings[0]!.prep?.bodyShort).toBe('Switch first.')
})

it('names the Client of a meeting only with the Billing module on', () => {
  const today = day({
    events: [meeting('Quill weekly', 690, 720)],
    links: [{ eventId: 'Quill weekly', todoIds: [], signalIds: [], clientId: 'quill', prep: null }],
  })
  expect(read(today).meetings[0]!.client).toBeNull()

  const billing = read(today, {
    billing: { week: [client({ weekSeconds: 6300 })], needsClient: 0 },
    logged: [],
  })
  expect(billing.meetings[0]!.client?.name).toBe('Quill & Co')
  expect(billing.meetings[0]!.client?.weekSeconds).toBe(6300)
})

// ── What's left ─────────────────────────────────────────────────────────────

it('says nothing is left when the stack is empty', () => {
  const chapter = said(day(), 'whats-left')
  expect(chapter.sentence).toBe('Nothing left for today.')
  expect(chapter.count).toBe(0)
})

it('does the arithmetic and says it fits', () => {
  const today = day({
    todos: [
      todo('spike', { stackPosition: 1, estimateMinutes: 120 }),
      todo('reply', { stackPosition: 2, estimateMinutes: 15 }),
    ],
    events: [meeting('standup', 11 * 60, 11 * 60 + 30)],
  })
  const chapter = said(today, 'whats-left')
  // 08:41 to 18:00 is 9h 19m, less the 30m meeting: 8h 49m.
  expect(chapter.sentence).toBe(
    'About 2h 15m of work, against 8h 49m free between meetings: it fits.',
  )
  expect(read(today).fits).toEqual({ workMinutes: 135, unestimated: 0, freeMinutes: 529 })
})

it('says how much more than fits when the work outruns the day', () => {
  const today = day({
    todos: [
      todo('one', { stackPosition: 1, estimateMinutes: 600 }),
      todo('two', { stackPosition: 2, estimateMinutes: 60 }),
    ],
  })
  // 08:41 to 18:00 is 9h 19m free, against 11h of work.
  expect(said(today, 'whats-left').sentence).toBe(
    'About 11h of work, against 9h 19m free between meetings: about 1h 41m more than fits.',
  )
})

it('counts the Todos with no estimate rather than guessing at them', () => {
  const today = day({
    todos: [
      todo('spike', { stackPosition: 1, estimateMinutes: 120 }),
      todo('call', { stackPosition: 2 }),
      todo('read', { stackPosition: 3 }),
    ],
  })
  expect(said(today, 'whats-left').sentence).toBe(
    'About 2h of work and two with no estimate, against 9h 19m free between meetings: it fits.',
  )
})

it('says only the count when nothing in the stack is estimated', () => {
  const today = day({
    todos: [todo('call', { stackPosition: 1 }), todo('read', { stackPosition: 2 })],
  })
  expect(said(today, 'whats-left').sentence).toBe('Two Todos left, none with an estimate.')
})

it('leaves a snoozed Todo out of the arithmetic, as it is out of the stack', () => {
  const today = day({
    todos: [
      todo('spike', { stackPosition: 1, estimateMinutes: 120 }),
      todo('later', {
        stackPosition: 2,
        estimateMinutes: 60,
        snoozedUntil: '2025-09-17T20:00:00.000Z',
      }),
    ],
  })
  expect(read(today).fits.workMinutes).toBe(120)
})

// ── Your day ────────────────────────────────────────────────────────────────

it('says the shape of the day: the run to the first meeting, then the meetings', () => {
  const today = day({
    events: [
      { id: 'focus', kind: 'focus', title: 'Focus', who: null, from: 540, until: 660 },
      meeting('standup', 660, 690),
      meeting('review', 840, 900),
    ],
    todos: [todo('spike', { stackPosition: 1, slotHours: [9, 10] })],
  })
  expect(said(today, 'your-day').sentence).toBe(
    'Deep work until 11:00, then two meetings; 15:00–18:00 is free.',
  )
})

it('says the day is clear when the calendar holds nothing more', () => {
  expect(said(day(), 'your-day').sentence).toBe(
    'Nothing in the calendar for the rest of the day; 09:00–18:00 is free.',
  )
})

it("says the day's hours are behind you once they are", () => {
  expect(said(day(), 'your-day', undefined).name).toBe('your-day')
  const late = read(day(), { billing: null, logged: [] }, at('19:30'))
  expect(late.chapters.find((each) => each.name === 'your-day')!.sentence).toBe(
    "The day's hours are behind you.",
  )
})

// ── This week by Client, and Later this week ────────────────────────────────

it('draws no This week by Client chapter with the Billing module off', () => {
  expect(read(day()).chapters.map((each) => each.name)).toEqual([
    'catch-up',
    'meetings',
    'whats-left',
    'your-day',
    'later',
  ])
})

it('says the week in hours and the arrangement nearest its edge, with the Billing module on', () => {
  const rundown = read(day(), {
    billing: {
      week: [
        client({
          clientId: 'meridian',
          name: 'Meridian Health',
          weekSeconds: 32220,
          monthSeconds: 100620,
          arrangement: 'project_fee',
          budgetHours: 40,
        }),
        client({
          clientId: 'bramble',
          name: 'Bramble',
          weekSeconds: 9000,
          monthSeconds: 64200,
          arrangement: 'retainer',
          budgetHours: 20,
        }),
        client({ weekSeconds: 6300 }),
        client({
          clientId: null,
          name: 'Internal',
          code: 'INT',
          order: null,
          arrangement: null,
          rateCents: null,
          weekSeconds: 3600,
        }),
      ],
      needsClient: 1,
    },
    logged: [],
  })
  const chapter = rundown.chapters.find((each) => each.name === 'clients')!
  expect(chapter.count).toBe(4)
  expect(chapter.sentence).toBe(
    '14h 12m so far this week; Bramble is on a retainer, 20h/mo, 2h 10m left. One entry still needs a Client.',
  )
})

it('says when nothing has been tracked this week', () => {
  const rundown = read(day(), { billing: { week: [client()], needsClient: 0 }, logged: [] })
  expect(rundown.chapters.find((each) => each.name === 'clients')!.sentence).toBe(
    'Nothing tracked this week yet.',
  )
})

it('says what the week is leading to, and what tomorrow opens with', () => {
  const today = day({
    later: {
      tieIns: [
        { project: 'Auth migration', text: 'You own the spike', when: 'Milestone Fri' },
        { project: 'Q4 planning', text: 'Section 2 is yours', when: null },
      ],
      milestones: [
        { project: 'Auth migration', milestone: 'Edge sessions live', day: '2025-09-19' },
      ],
      nextMeeting: { title: 'Platform standup', who: '12 people', day: '2025-09-18', at: '09:30' },
    },
  })
  const chapter = said(today, 'later')
  expect(chapter.count).toBe(3)
  expect(chapter.sentence).toBe(
    "Auth migration's milestone falls on Friday, you tie into two Projects and tomorrow opens with Platform standup at 09:30.",
  )
})

it('says plainly when nothing later in the week is tied to you', () => {
  const chapter = said(day(), 'later')
  expect(chapter.sentence).toBe('Nothing is tied to you later this week.')
  expect(chapter.filled).toBe(false)
})

// ── The ribbon ──────────────────────────────────────────────────────────────

it("draws the day in the timeline's own vocabulary, an hour at a time", () => {
  const today = day({
    events: [
      { id: 'focus', kind: 'focus', title: 'Focus', who: null, from: 540, until: 660 },
      meeting('Platform standup', 660, 690),
    ],
    todos: [todo('spike', { title: 'Finish the spike', stackPosition: 1, slotHours: [9, 10] })],
  })
  const { ribbon } = read(today)
  expect(ribbon.from).toBe(8)
  expect(ribbon.until).toBe(18)
  expect(ribbon.blocks.map((block) => [block.from, block.until, block.kind])).toEqual([
    [8, 9, 'free'],
    // The two hours the one Todo is slotted across run into one block.
    [9, 11, 'focus'],
    [11, 12, 'meeting'],
    [12, 13, 'free'],
    [13, 14, 'free'],
    [14, 15, 'free'],
    [15, 16, 'free'],
    [16, 17, 'free'],
    [17, 18, 'free'],
  ])
  expect(ribbon.blocks[2]!.label).toBe('Platform standup')
  // A free hour carries no words: the rule stays clean where the day is empty.
  expect(ribbon.blocks[0]!.label).toBe('')
})

it('runs hours that hold the same thing into one block', () => {
  const today = day({
    hours: [
      { hour: 9, title: 'Deep work', note: null, source: null, writtenFor: [] },
      { hour: 10, title: 'Deep work', note: null, source: null, writtenFor: [] },
    ],
    events: [{ id: 'focus', kind: 'focus', title: 'Focus', who: null, from: 540, until: 660 }],
  })
  const block = read(today).ribbon.blocks.find((each) => each.from === 9)!
  expect([block.from, block.until, block.label]).toEqual([9, 11, 'Deep work'])
})

it('puts now where the wall clock says, and nowhere at all outside the day', () => {
  // 08:41 is 41 minutes into a ten-hour rule.
  expect(read(day()).ribbon.now).toBeCloseTo(41 / 600, 6)
  expect(read(day(), { billing: null, logged: [] }, at('07:00')).ribbon.now).toBeNull()
  expect(read(day(), { billing: null, logged: [] }, at('19:00')).ribbon.now).toBeNull()
})

it('draws what was tracked as a share of the block it happened in', () => {
  const rundown = read(day(), {
    billing: { week: [], needsClient: 0 },
    logged: [
      { hour: 8, seconds: 1200 },
      { hour: 9, seconds: 3600 },
    ],
  })
  expect(rundown.ribbon.blocks[0]!.logged).toBeCloseTo(1 / 3, 6)
  expect(rundown.ribbon.blocks[1]!.logged).toBe(1)
  expect(rundown.ribbon.blocks[2]!.logged).toBe(0)
})
