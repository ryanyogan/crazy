import { expect, it } from 'vite-plus/test'
import { sideOf } from './projects'

// Side is stored only on a Circle (CONTEXT.md, "Side"). Everything else takes
// it from there, and a Todo that has no Circle falls back to the default Side
// of the Connection it arrived through.

it('takes a Side from the Circle, then the arriving Connection, and invents none', () => {
  // A Project has only the first of the two, and the Circle always wins.
  expect(sideOf({ circle: 'work' })).toBe('work')
  expect(sideOf({ circle: 'personal' })).toBe('personal')
  expect(sideOf({ circle: 'personal', connection: 'work' })).toBe('personal')

  // No Circle: the Connection's default Side stands in.
  expect(sideOf({ connection: 'work' })).toBe('work')
  expect(sideOf({ circle: null, connection: 'personal' })).toBe('personal')

  // Neither: it has no Side, rather than a guessed one.
  expect(sideOf({})).toBeNull()
  expect(sideOf({ circle: null, connection: null })).toBeNull()
})
