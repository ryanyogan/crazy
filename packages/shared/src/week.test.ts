import { expect, it } from 'vite-plus/test'
import { isoWeek, startOfWeek, weekDays } from './clock'
import { type Week, type WeekTodo, describeDay, formatHourCount, viewWeek } from './week'

// Frame 1c's week: Monday 15 to Sunday 21 September 2025, read on the Wednesday.
const MONDAY = '2025-09-15'
const TUESDAY = '2025-09-16'
const WEDNESDAY = '2025-09-17'
const THURSDAY = '2025-09-18'

function todo(id: string, fields: Partial<WeekTodo> = {}): WeekTodo {
  return {
    id,
    state: 'backlog',
    estimateMinutes: 60,
    carryCount: 0,
    side: null,
    projectId: null,
    doneDay: null,
    slotDays: [],
    ...fields,
  }
}

function week(fields: Partial<Week> = {}): Week {
  return {
    monday: MONDAY,
    day: WEDNESDAY,
    brief: null,
    todos: [],
    meetings: [],
    lines: [],
    notes: [],
    milestones: [],
    tieIns: [],
    ...fields,
  }
}

it('runs a week from Monday to Sunday, wherever in it the day falls', () => {
  expect(startOfWeek(WEDNESDAY)).toBe(MONDAY)
  expect(startOfWeek(MONDAY)).toBe(MONDAY)
  // Sunday ends the week it is in, it does not start the next one.
  expect(startOfWeek('2025-09-21')).toBe(MONDAY)
  expect(weekDays(MONDAY)).toHaveLength(7)
})

it('numbers weeks as the calendar does, across the turn of a year', () => {
  expect(isoWeek(WEDNESDAY)).toBe(38)
  // Week 1 is the one holding the year's first Thursday.
  expect(isoWeek('2025-12-29')).toBe(1)
  expect(isoWeek('2026-01-01')).toBe(1)
  expect(isoWeek('2021-01-01')).toBe(53)
})

it('heads the week with its number, its span and where today sits in it', () => {
  expect(viewWeek(week()).line).toBe('Week 38 · 15–21 Sep · day 3 of 5')
  expect(viewWeek(week({ day: MONDAY })).line).toBe('Week 38 · 15–21 Sep · day 1 of 5')
  // The weekend is not one of the five working days, so it says so.
  expect(viewWeek(week({ day: '2025-09-20' })).line).toBe('Week 38 · 15–21 Sep · the weekend')
})

it('names both months in a week that changes month', () => {
  const across = week({ monday: '2025-09-29', day: '2025-10-01' })
  expect(viewWeek(across).line).toBe('Week 40 · 29 Sep – 5 Oct · day 3 of 5')
})

it('counts the week in numbers from its Todos, done, planned and carried over', () => {
  const view = viewWeek(
    week({
      todos: [
        todo('finished Monday', { state: 'done', estimateMinutes: 210, doneDay: MONDAY }),
        todo('finished Tuesday', {
          state: 'done',
          estimateMinutes: 180,
          doneDay: TUESDAY,
          carryCount: 1,
        }),
        todo('in today', { state: 'today', estimateMinutes: 120, carryCount: 2 }),
        todo('planned Friday', { estimateMinutes: 30, slotDays: ['2025-09-19'] }),
      ],
    }),
  )

  expect([view.done, view.planned]).toEqual([2, 4])
  // Focus so far is the work the week has absorbed: what is finished, in hours.
  expect(formatHourCount(view.focusHours)).toBe('6.5')
  expect(view.carriedOver).toBe(2)
})

it('plans a Todo in today for today, whether or not anyone gave it an hour', () => {
  const view = viewWeek(
    week({
      todos: [
        todo('typed in just now', { state: 'today' }),
        todo('slotted for Thursday', { slotDays: [THURSDAY] }),
        // A Todo in the backlog with no Slot is on no day of the week.
        todo('somewhere in the backlog'),
      ],
    }),
  )

  const [, , wednesday, thursday] = view.days
  expect(wednesday?.counts.planned).toBe(1)
  expect(thursday?.counts.planned).toBe(1)
  expect(view.planned).toBe(3)
})

it('counts a Todo on one day only, wherever else it has been placed', () => {
  const view = viewWeek(
    week({
      todos: [
        // In today's stack and already placed on Thursday: today is where it is.
        todo('spanning', { state: 'today', slotDays: [WEDNESDAY, THURSDAY] }),
      ],
    }),
  )

  expect(view.days.map((day) => day.counts.planned)).toEqual([0, 0, 1, 0, 0, 0, 0])
})

it('draws each day as counts, all seven to one scale', () => {
  const view = viewWeek(
    week({
      todos: [
        todo('a', { state: 'done', doneDay: MONDAY, estimateMinutes: 90 }),
        todo('b', { state: 'done', doneDay: MONDAY, estimateMinutes: 30 }),
        todo('c', { state: 'today' }),
        todo('d', { state: 'today' }),
        todo('e', { state: 'today' }),
        todo('f', { state: 'today' }),
      ],
      meetings: [
        { id: 'standup', day: MONDAY, minutes: 30 },
        { id: 'planning', day: MONDAY, minutes: 60 },
      ],
    }),
  )

  const [monday, , wednesday] = view.days
  expect(monday?.counts).toEqual({ done: 2, planned: 0, meetings: 2 })
  expect(wednesday?.counts).toEqual({ done: 0, planned: 4, meetings: 0 })
  // Four planned is the week's largest count, so Wednesday's bar is a full one.
  expect(wednesday?.share.planned).toBe(1)
  expect(monday?.share.done).toBe(0.5)
  expect(monday?.hours.done).toBe(2)
  expect(describeDay(monday!)).toBe('2 done, 2h; none planned; 2 meetings, 1.5h')
})

it('captions a day behind us with what it finished, and what it did not', () => {
  const view = viewWeek(
    week({
      todos: [
        todo('monday', { state: 'done', doneDay: MONDAY, estimateMinutes: 210 }),
        todo('tuesday', { state: 'done', doneDay: TUESDAY, estimateMinutes: 60 }),
        // Placed on Tuesday, still open: Tuesday carried it.
        todo('carried on', { state: 'today', slotDays: [TUESDAY] }),
      ],
    }),
  )

  expect(view.days[0]?.caption).toBe('1 done · 3.5h focus')
  expect(view.days[1]?.caption).toBe('1 of 2 · 1 carried')
})

it('captions today, a day ahead, a personal day and the day a milestone falls on', () => {
  const view = viewWeek(
    week({
      todos: [
        todo('today', { state: 'today' }),
        todo('thursday', { slotDays: [THURSDAY], projectId: 'q4', side: 'work' }),
        todo('friday', { slotDays: ['2025-09-19'], projectId: 'auth', side: 'work' }),
        todo('saturday', { slotDays: ['2025-09-20'], projectId: 'marathon', side: 'personal' }),
      ],
      milestones: [{ day: '2025-09-19', projectId: 'auth' }],
      notes: [{ day: THURSDAY, text: 'Q4 held' }],
    }),
  )

  expect(view.days.map((day) => day.caption)).toEqual([
    null,
    null,
    'today · 1 planned',
    '1 planned · Q4 held',
    // A day that carries a Project to its milestone names the milestone.
    'milestone',
    // A day with only personal work says so rather than counting it.
    'personal',
    null,
  ])
})

it("says each thing the day holds in Crazy's words, while the thing is still on it", () => {
  const view = viewWeek(
    week({
      todos: [
        todo('spike', { state: 'today' }),
        todo('sams-pr', { state: 'today', carryCount: 1, slotDays: [TUESDAY] }),
        todo('moved on', { state: 'today' }),
      ],
      meetings: [{ id: 'design-review', day: WEDNESDAY, minutes: 60 }],
      lines: [
        { id: '1', day: TUESDAY, text: "Sam's PR", todoId: 'sams-pr', calendarEventId: null },
        { id: '2', day: WEDNESDAY, text: 'Session spike', todoId: 'spike', calendarEventId: null },
        {
          id: '3',
          day: WEDNESDAY,
          text: 'Design review 14:00',
          todoId: null,
          calendarEventId: 'design-review',
        },
        // Worded for Monday, but the Todo is not on Monday any more.
        { id: '4', day: MONDAY, text: 'Moved on', todoId: 'moved on', calendarEventId: null },
      ],
    }),
  )

  // How long it has been carried comes off the Todo, not out of the words.
  expect(view.days[1]?.lines.map((line) => line.text)).toEqual(["Sam's PR (carried)"])
  expect(view.days[2]?.lines.map((line) => line.text)).toEqual([
    'Session spike',
    'Design review 14:00',
  ])
  expect(view.days[0]?.lines).toEqual([])
})

it('says nothing at all about a day that holds nothing', () => {
  const view = viewWeek(week())
  expect(view.days.every((day) => day.caption === null && day.lines.length === 0)).toBe(true)
  expect(
    view.days.every((day) => day.share.done + day.share.planned + day.share.meetings === 0),
  ).toBe(true)
  expect([view.done, view.planned, view.focusHours, view.carriedOver]).toEqual([0, 0, 0, 0])
})

it('says hours the way the card does', () => {
  expect([formatHourCount(6.5), formatHourCount(6), formatHourCount(0)]).toEqual(['6.5', '6', '0'])
})
