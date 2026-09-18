import { expect, it } from 'vite-plus/test'
import {
  type DayEvent,
  type HourWording,
  formatAge,
  meetingCount,
  meetingHolds,
  timeline,
} from './timeline'
import type { TodayTodo } from './todo'

type Slotted = Parameters<typeof timeline>[0][number]

function todo(title: string, slotHours: number[], fields: Partial<TodayTodo> = {}): Slotted {
  return {
    id: title,
    title,
    slotHours,
    estimateMinutes: null,
    energy: null,
    carryCount: 0,
    source: null,
    ...fields,
  }
}

function event(kind: DayEvent['kind'], title: string, from: string, minutes: number): DayEvent {
  const [hour, minute] = from.split(':').map(Number)
  const start = hour! * 60 + minute!
  return { id: title, kind, title, who: null, from: start, until: start + minutes }
}

const at = (hours: ReturnType<typeof timeline>, hour: number) =>
  hours.find((each) => each.hour === hour)!

it('shows the working day hour by hour, free when nothing holds an hour', () => {
  const hours = timeline([], [], [])
  expect(hours.map(({ hour }) => hour)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
  expect(hours.every(({ kind }) => kind === 'free')).toBe(true)
  expect(at(hours, 8)).toMatchObject({ title: 'Free', note: null, source: null })
})

it('widens to hold a Slot or a meeting outside the working day', () => {
  const hours = timeline(
    [todo('Morning run', [6])],
    [event('meeting', 'Call with Tokyo', '19:30', 45)],
    [],
  )
  expect(hours[0]!.hour).toBe(6)
  expect(hours.at(-1)!.hour).toBe(20)
})

it('draws a meeting over a focus block, and a focus block over Slots alone', () => {
  const hours = timeline(
    [todo('Spike', [9, 10]), todo('Reply to Priya', [12])],
    [event('focus', 'Focus', '09:00', 120), event('meeting', 'Standup', '10:30', 30)],
    [],
  )
  expect(at(hours, 9).kind).toBe('focus')
  expect(at(hours, 10).kind).toBe('meeting')
  expect(at(hours, 12).kind).toBe('slotted')
  expect(at(hours, 13).kind).toBe('free')
})

it('counts a meeting only in the hours it takes up', () => {
  const hours = timeline([], [event('meeting', 'Design review', '14:00', 60)], [])
  expect(at(hours, 14).kind).toBe('meeting')
  expect(at(hours, 15).kind).toBe('free')
})

it('words a slotted Todo by its title, energy and estimate, and where it came from', () => {
  const hours = timeline(
    [
      todo('Spike', [9, 10], {
        estimateMinutes: 120,
        energy: 'deep_focus',
        source: {
          connectionId: 'linear-work',
          itemId: 'HAL-212',
          kind: 'linear_issue',
          ref: 'HAL-212',
          url: null,
        },
      }),
    ],
    [],
    [],
  )
  expect(at(hours, 9)).toMatchObject({
    title: 'Spike',
    note: 'deep focus · 2h',
    source: 'linear_issue',
  })
  expect(at(hours, 10).title).toBe('↳ Spike')
})

it('says a slotted Todo was carried over rather than the energy it takes', () => {
  const hours = timeline(
    [todo("Review Sam's PR", [13], { estimateMinutes: 45, energy: 'deep_focus', carryCount: 1 })],
    [],
    [],
  )
  expect(at(hours, 13).note).toBe('carried 1 day · 45m')
})

it('words an hour that holds several Todos together', () => {
  const hours = timeline(
    [
      todo('Reply to Priya', [12], { estimateMinutes: 15, energy: 'quick_win' }),
      todo('Book dentist', [12], { estimateMinutes: 5, energy: 'quick_win' }),
    ],
    [],
    [],
  )
  expect(at(hours, 12)).toMatchObject({
    title: 'Reply to Priya · Book dentist',
    note: 'quick wins · 20m',
  })
})

it('words a meeting by its length and who it is with, and says when it starts off the hour', () => {
  const standup = { ...event('meeting', 'Platform standup', '11:00', 30), who: '12 people' }
  const hours = timeline(
    [todo('Prep notes', [16], { estimateMinutes: 20 })],
    [standup, event('meeting', '1:1 with Devon', '16:30', 30)],
    [],
  )
  expect(at(hours, 11)).toMatchObject({
    title: 'Platform standup',
    note: '30m · 12 people',
    source: 'calendar_event',
  })
  expect(at(hours, 16)).toMatchObject({
    title: 'Prep notes · 1:1 with Devon 16:30',
    note: '20m + 30m',
  })
})

/** Crazy's words for an hour, written for the Todos it held at the time. */
const worded = (hour: number, title: string, writtenFor: string[]): HourWording => ({
  hour,
  title,
  note: 'deep focus',
  source: 'linear_issue',
  writtenFor,
})

it("uses Crazy's own wording of an hour where it has written one, without changing how it is drawn", () => {
  const wording = [worded(10, '↳ spike continues', ['Spike'])]
  const hours = timeline([todo('Spike', [9, 10])], [event('focus', 'Focus', '09:00', 120)], wording)
  expect(at(hours, 10)).toEqual({
    hour: 10,
    kind: 'focus',
    title: '↳ spike continues',
    note: 'deep focus',
    source: 'linear_issue',
  })
  expect(at(hours, 9).title).toBe('Spike')
})

it('words an hour itself once it no longer holds what Crazy planned for it', () => {
  const wording = [worded(15, 'Draft Q4 priorities · section 2', ['Q4'])]

  // The hour Crazy planned, and then the same hour with another Todo on it.
  expect(at(timeline([todo('Q4', [15])], [], wording), 15).title).toBe(
    'Draft Q4 priorities · section 2',
  )
  expect(at(timeline([todo('Book dentist', [15])], [], wording), 15)).toMatchObject({
    title: 'Book dentist',
    source: null,
  })
  // Nothing left on it at all: the hour reads free, not as the plan that was.
  expect(at(timeline([], [], wording), 15)).toMatchObject({ kind: 'free', title: 'Free' })
  // And put back the way Crazy planned it, the words are there again: nothing
  // the user does throws generated text away.
  expect(at(timeline([todo('Q4', [15])], [], wording), 15).title).toBe(
    'Draft Q4 priorities · section 2',
  )
})

it('keeps the words of an hour worded for nothing until something is slotted on it', () => {
  const wording = [{ ...worded(8, 'Brief · inbox skim', []), note: 'free', source: null }]

  expect(at(timeline([], [], wording), 8).title).toBe('Brief · inbox skim')
  expect(at(timeline([todo('Book dentist', [8])], [], wording), 8).title).toBe('Book dentist')
})

it('takes Crazy at its word only when the hour holds every Todo it was written for', () => {
  const wording = [worded(12, 'Reply to Priya · book dentist', ['Priya', 'Dentist'])]
  const both = [todo('Priya', [12]), todo('Dentist', [12])]

  expect(at(timeline(both, [], wording), 12).title).toBe('Reply to Priya · book dentist')
  expect(at(timeline([both[0]!], [], wording), 12).title).toBe('Priya')
})

// ── The hours meetings leave no room in ───────────────────────────────────────

it('holds an hour two meetings fill between them, and leaves one with a gap in it', () => {
  const halves = [event('meeting', 'Standup', '08:00', 30), event('meeting', '1:1', '08:30', 30)]
  expect(meetingHolds(halves, 8)).toBe(true)

  // Ten minutes between them is ten minutes the user can still plan into.
  const gap = [event('meeting', 'Standup', '08:00', 25), event('meeting', '1:1', '08:35', 25)]
  expect(meetingHolds(gap, 8)).toBe(false)
})

it('holds an hour a meeting fills on its own, or with one that overlaps it', () => {
  expect(meetingHolds([event('meeting', 'Design review', '14:00', 60)], 14)).toBe(true)
  expect(meetingHolds([event('meeting', 'All hands', '13:30', 120)], 14)).toBe(true)

  const overlapping = [
    event('meeting', 'Standup', '09:00', 40),
    event('meeting', 'Handover', '09:20', 40),
  ]
  expect(meetingHolds(overlapping, 9)).toBe(true)
})

it('leaves an hour a meeting only part fills, and one a focus block fills', () => {
  expect(meetingHolds([event('meeting', 'Standup', '11:00', 30)], 11)).toBe(false)
  expect(meetingHolds([event('meeting', '1:1 with Devon', '16:30', 30)], 16)).toBe(false)
  expect(meetingHolds([event('meeting', 'Design review', '14:00', 60)], 15)).toBe(false)
  // A focus block is the user's own hour, however long it runs.
  expect(meetingHolds([event('focus', 'Focus', '09:00', 120)], 9)).toBe(false)
  expect(meetingHolds([], 9)).toBe(false)
})

it('counts meetings, which focus blocks are not', () => {
  expect(
    meetingCount([event('meeting', 'Standup', '11:00', 30), event('focus', 'Focus', '09:00', 120)]),
  ).toBe(1)
})

it('words how long ago a Mention was made', () => {
  const now = new Date('2025-09-17T13:41:00.000Z')
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000)
  expect(formatAge(ago(0), now)).toBe('0m')
  expect(formatAge(ago(59), now)).toBe('59m')
  expect(formatAge(ago(17 * 60 + 20), now)).toBe('17h')
  expect(formatAge(ago(25 * 60), now)).toBe('1d')
  expect(formatAge(ago(49 * 60), now)).toBe('2d')
})
