import { expect, it } from 'vite-plus/test'
import { carriedLabel, formatEstimate } from './todo'

it('words an estimate in hours and minutes', () => {
  expect(formatEstimate(5)).toBe('5m')
  expect(formatEstimate(45)).toBe('45m')
  expect(formatEstimate(60)).toBe('1h')
  expect(formatEstimate(120)).toBe('2h')
  expect(formatEstimate(90)).toBe('1h 30m')
  expect(formatEstimate(null)).toBeNull()
})

it('says how many days a Todo has been carried over, and nothing for one that has not', () => {
  expect(carriedLabel(0)).toBeNull()
  expect(carriedLabel(1)).toBe('carried 1 day')
  expect(carriedLabel(3)).toBe('carried 3 days')
})
