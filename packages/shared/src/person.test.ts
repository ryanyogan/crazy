import { expect, it } from 'vite-plus/test'
import { initials } from './person'

it('takes initials from the first and last name', () => {
  expect(initials('Mara Okafor')).toBe('MO')
  expect(initials('  ryan   james yogan ')).toBe('RY')
})

it('uses one letter for a single name and none for an empty one', () => {
  expect(initials('Cori')).toBe('C')
  expect(initials('')).toBe('')
})
