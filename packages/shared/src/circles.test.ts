import { expect, it } from 'vite-plus/test'
import {
  type Circle,
  type Circles,
  type Overlap,
  CIRCLE_SEATS,
  LENS_SEATS,
  overlapMeta,
  peopleLabel,
  providersLabel,
  viewCircles,
} from './circles'

// The Circles screen's rules, with no database: which Circle the figure draws
// where, how it is drawn, which Overlap is written where two of them meet, and
// how they read. Where each seat lands on screen is the screen's own table.

const circle = (id: string, over: Partial<Circle> = {}): Circle => ({
  id,
  name: id,
  side: 'work',
  people: null,
  providers: [],
  ...over,
})

const overlap = (todoId: string, circleIds: string[], over: Partial<Overlap> = {}): Overlap => ({
  todoId,
  title: todoId,
  circleIds,
  text: 'why it serves both',
  people: 'Devon',
  timing: 'Thu',
  figure: { title: todoId, note: 'Devon' },
  ...over,
})

const view = (circles: Circle[], overlaps: Overlap[] = []) =>
  viewCircles({ circles, overlaps } satisfies Circles)

const drawn = (seated: ReturnType<typeof view>['seated']) =>
  seated.map(({ circle, seatIndex, outline }) => [circle.name, seatIndex, outline])

it('gives the work Circles the seats that cross, most people first, and a personal one the seat that stands apart', () => {
  const { seated } = view([
    circle('design', { name: 'Design', people: 5 }),
    circle('personal', { name: 'Personal', side: 'personal' }),
    circle('platform', { name: 'Platform team', people: 12 }),
    circle('leadership', { name: 'Leadership', people: 3 }),
  ])

  expect(drawn(seated)).toEqual([
    ['Platform team', 0, false],
    ['Design', 1, false],
    ['Leadership', 2, false],
    ['Personal', 3, true],
  ])
  expect(CIRCLE_SEATS[3].apart).toBe(true)
})

it('draws a work Circle solid even in the seat that stands apart', () => {
  // Four work Circles and no personal one: the fourth still has to go somewhere.
  const { seated, unseated } = view(
    ['a', 'b', 'c', 'd'].map((id, index) => circle(id, { people: 10 - index })),
  )

  expect(drawn(seated)).toEqual([
    ['a', 0, false],
    ['b', 1, false],
    ['c', 2, false],
    ['d', 3, false],
  ])
  expect(unseated).toEqual([])
})

it('draws a personal Circle as an outline even in a seat inside the cluster', () => {
  const { seated } = view([
    circle('work-1', { people: 9 }),
    circle('work-2', { people: 8 }),
    circle('home', { side: 'personal', people: 7 }),
    circle('club', { side: 'personal', people: 6 }),
  ])

  // The first personal Circle takes the seat that stands apart; the second
  // takes what is left, and is still drawn as an outline.
  expect(drawn(seated)).toEqual([
    ['work-1', 0, false],
    ['work-2', 1, false],
    ['club', 2, true],
    ['home', 3, true],
  ])
})

it('names a Circle the figure has no seat left for rather than dropping it', () => {
  const many = ['a', 'b', 'c', 'd', 'e'].map((id, index) => circle(id, { people: 10 - index }))

  const { seated, unseated } = view(many)

  expect(seated).toHaveLength(CIRCLE_SEATS.length)
  expect(unseated.map((circle) => circle.id)).toEqual(['e'])
})

it('seats two Circles of the same size by name', () => {
  const { seated } = view([
    circle('Zeta', { name: 'Zeta', people: 4 }),
    circle('Alpha', { name: 'Alpha', people: 4 }),
  ])

  expect(seated.map(({ circle }) => circle.name)).toEqual(['Alpha', 'Zeta'])
})

it('writes an Overlap where its two Circles cross, and nowhere when they do not', () => {
  const circles = [
    circle('platform', { people: 12 }),
    circle('design', { people: 5 }),
    circle('leadership', { people: 3 }),
    circle('personal', { side: 'personal' }),
  ]

  const { lenses } = view(circles, [
    overlap('one', ['platform', 'design'], { figure: { title: 'Onboarding v2', note: 'Sam' } }),
    // Personal stands apart from the cluster, so this one meets nothing.
    overlap('two', ['personal', 'platform']),
  ])

  expect(lenses.map(({ todoId, at, title }) => [todoId, at, title])).toEqual([
    ['one', 0, 'Onboarding v2'],
  ])
  expect(LENS_SEATS[0]).toEqual([0, 1])
})

it('puts the Overlap serving the most Circles first, and keeps the rest in the order read', () => {
  const circles = [circle('a'), circle('b'), circle('c')]

  const { overlaps } = view(circles, [
    overlap('older', ['a', 'b']),
    overlap('three', ['a', 'b', 'c']),
    overlap('newer', ['b', 'c']),
  ])

  expect(overlaps.map((each) => each.todoId)).toEqual(['three', 'older', 'newer'])
  expect(overlaps[0]?.circles.map((circle) => circle.id)).toEqual(['a', 'b', 'c'])
})

it('says how many Circles the week holds, in words', () => {
  expect(view([circle('a'), circle('b'), circle('c'), circle('d')]).lede).toBe(
    'Four Circles this week. Overlaps are where a single todo serves two circles; those get scored higher.',
  )
  expect(view([circle('a')]).lede).toMatch(/^One Circle this week\./)
  expect(view([]).lede).toMatch(/^No Circles this week\./)
})

it('words what Crazy counted in a Circle, and says nothing where it counted nothing', () => {
  expect(peopleLabel(12)).toBe('12 people')
  expect(peopleLabel(1)).toBe('1 person')
  expect(peopleLabel(null)).toBeNull()
  expect(providersLabel(['gmail_message', 'calendar_event'])).toBe('Gmail · Cal')
  expect(providersLabel([])).toBeNull()
})

it('says of an Overlap only what Crazy has written about it', () => {
  expect(overlapMeta({ people: 'Lena · Devon', timing: 'Ask by Thu' })).toBe(
    'Lena · Devon · Ask by Thu',
  )
  expect(overlapMeta({ people: null, timing: '1 Oct' })).toBe('1 Oct')
  expect(overlapMeta({ people: null, timing: null })).toBeNull()
})
