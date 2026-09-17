import { expect, it } from 'vite-plus/test'
import { dayLine, formatHours, greeting, priorityStack, takeOnNow } from './today'
import type { TodayTodo } from './todo'

function todo(id: string, fields: Partial<TodayTodo> = {}): TodayTodo {
  return {
    id,
    title: id,
    state: 'today',
    project: null,
    estimateMinutes: null,
    energy: null,
    carryCount: 0,
    stackPosition: null,
    reason: null,
    source: null,
    slotHours: [],
    createdAt: '2025-09-16T09:00:00.000Z',
    doneAt: null,
    ...fields,
  }
}

const ids = (todos: { id: string }[]) => todos.map(({ id }) => id)

it('lists only `today` Todos in the Priority stack, in the recommended order', () => {
  const stack = priorityStack([
    todo('third', { stackPosition: 3 }),
    todo('someday', { state: 'backlog', stackPosition: 1 }),
    todo('first', { stackPosition: 1 }),
    todo('finished', { state: 'done', stackPosition: 2 }),
    todo('second', { stackPosition: 2 }),
  ])
  expect(ids(stack)).toEqual(['first', 'second', 'third'])
})

it('puts a Todo with no position yet after the placed ones, oldest first', () => {
  const stack = priorityStack([
    todo('jotted later', { createdAt: '2025-09-17T08:00:00.000Z' }),
    todo('jotted earlier', { createdAt: '2025-09-17T07:00:00.000Z' }),
    todo('placed', { stackPosition: 5 }),
  ])
  expect(ids(stack)).toEqual(['placed', 'jotted earlier', 'jotted later'])
})

it('takes the top of the Priority stack as the Take on now, for the hours it is slotted', () => {
  const stack = [todo('spike', { slotHours: [9, 10] }), todo('reply', { slotHours: [12] })]
  expect(takeOnNow(stack, 8)).toEqual({ todo: stack[0], hours: { from: 9, until: 11 } })
})

it('has no Take on now when no `today` Todo remains', () => {
  expect(takeOnNow(priorityStack([todo('finished', { state: 'done' })]), 8)).toBeNull()
})

it('names no hours for a Take on now whose Slots have passed or were never given', () => {
  expect(takeOnNow([todo('spike', { slotHours: [9, 10] })], 14)?.hours).toBeNull()
  expect(takeOnNow([todo('unslotted')], 8)?.hours).toBeNull()
})

it('names what is left of a run of Slots already under way, and stops at a gap', () => {
  expect(takeOnNow([todo('spike', { slotHours: [9, 10, 13] })], 10)?.hours).toEqual({
    from: 10,
    until: 11,
  })
})

it('words the hours for a desktop and for a phone', () => {
  expect(formatHours({ from: 9, until: 11 }, 'long')).toBe('09:00–11:00')
  expect(formatHours({ from: 9, until: 11 }, 'short')).toBe('09–11')
})

it('greets by the time of day', () => {
  expect(greeting(8, 'Ryan')).toBe('Good morning, Ryan.')
  expect(greeting(12, 'Ryan')).toBe('Good afternoon, Ryan.')
  expect(greeting(19, 'Ryan')).toBe('Good evening, Ryan.')
  expect(greeting(8, '')).toBe('Good morning.')
})

it("words the moment as the user's wall clock reads it", () => {
  const now = new Date('2025-09-17T13:41:00.000Z')
  expect(dayLine(now, 'America/Chicago')).toBe('Wednesday · 17 Sep · 08:41')
  // Already Thursday in Auckland.
  expect(dayLine(now, 'Pacific/Auckland')).toBe('Thursday · 18 Sep · 01:41')
})
