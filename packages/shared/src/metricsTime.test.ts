import { expect, it } from 'vite-plus/test'
import {
  type ClientBurn,
  type UnbilledClient,
  burnLine,
  burnUsed,
  minuteOfDay,
  sessionDelta,
  unbilledNote,
  utilisation,
  weekLabel,
  weeksBack,
} from './metricsTime'

const burn = (over: Partial<ClientBurn> = {}): ClientBurn => ({
  clientId: 'c',
  name: 'Meridian Health',
  arrangement: 'project_fee',
  budgetHours: 40,
  monthSeconds: 28 * 3600,
  rateCents: 210_00,
  pace: 0.55,
  daysLeft: 13,
  ...over,
})

it('measures utilisation against the capacity she set, and says nothing without one', () => {
  // Thirty billable hours a week, four weeks, sixty hours done: half of it.
  expect(utilisation(60 * 3600, 30, 4)).toBeCloseTo(0.5, 5)
  // A figure with no capacity behind it is not a figure at all.
  expect(utilisation(60 * 3600, null, 4)).toBe(null)
  expect(utilisation(60 * 3600, 0, 4)).toBe(null)
})

it('says where a Client stands against what they bought and where the month is', () => {
  // 28 of 40 hours is 70% of the budget at 55% of the month: ahead, and it will
  // run out before the month does.
  expect(burnLine(burn(), 'USD')).toBe('15% ahead of pace · 12h 00m left, 13 days to go')
  expect(burnUsed(burn())).toBe('28.0h / 40h')

  // Past the budget, the hours left stop being hours left.
  expect(burnLine(burn({ monthSeconds: 44 * 3600 }), 'USD')).toBe('4h 00m over · 13 days to go')
  // Within a couple of points of the calendar is simply on pace.
  expect(burnLine(burn({ monthSeconds: 22 * 3600, pace: 0.55 }), 'USD')).toContain('on pace')
  // An hourly Client has no cap to run over, so the line says what they owe.
  expect(burnLine(burn({ arrangement: 'hourly', budgetHours: null }), 'USD')).toBe(
    'Hourly · $5,880 so far · 13 days to go',
  )
  expect(burnUsed(burn({ budgetHours: null }))).toBe('28.0h')
  expect(burnLine(burn({ daysLeft: 1 }), 'USD')).toContain('1 day to go')
})

it('says why a Client’s money has not gone out, in that Client’s own terms', () => {
  const client = (over: Partial<UnbilledClient> = {}): UnbilledClient => ({
    clientId: 'c',
    name: 'Meridian Health',
    cents: 588_000,
    seconds: 28 * 3600,
    minutes: 1680,
    status: 'review',
    issuedDay: '2025-09-19',
    arrangement: 'project_fee',
    budgetHours: 40,
    ...over,
  })

  // A weekday while the day is inside the week ahead, a date beyond it.
  expect(unbilledNote(client(), '2025-09-17')).toBe('28.0h · ready to review · out Friday')
  expect(unbilledNote(client({ status: 'draft', issuedDay: '2025-10-01' }), '2025-09-17')).toBe(
    '28.0h · still drafting · out Oct 1',
  )
  expect(unbilledNote(client({ issuedDay: '2025-09-17' }), '2025-09-17')).toBe(
    '28.0h · ready to review · out today',
  )
  // A retainer's fee is owed whatever the hours, so the line is about the hours.
  expect(
    unbilledNote(
      client({ arrangement: 'retainer', budgetHours: 20, seconds: 64_200, status: 'draft' }),
      '2025-09-17',
    ),
  ).toBe('Retainer · 17.8h used · still drafting · out Friday')
  // Nothing drafted yet is the thing she has to be told.
  expect(unbilledNote(client({ status: null, issuedDay: null }), '2025-09-17')).toBe(
    '28.0h · no invoice drafted yet',
  )
})

it('names the weeks the chart reaches back over, and reads a clock for none of it', () => {
  expect(weeksBack('2025-09-15', 8)).toEqual([
    '2025-07-28',
    '2025-08-04',
    '2025-08-11',
    '2025-08-18',
    '2025-08-25',
    '2025-09-01',
    '2025-09-08',
    '2025-09-15',
  ])
  expect(weekLabel('2025-09-15')).toBe('W38')
})

it('says a time of day and how a median moved, or says neither', () => {
  expect(minuteOfDay(8 * 60 + 52)).toBe('08:52')
  expect(minuteOfDay(null)).toBe('—')
  expect(sessionDelta(52 * 60, 43 * 60)).toBe('+9m')
  expect(sessionDelta(43 * 60, 52 * 60)).toBe('−9m')
  expect(sessionDelta(52 * 60, 52 * 60)).toBe('level')
  // Nothing to compare against says nothing rather than zero.
  expect(sessionDelta(52 * 60, null)).toBe(null)
})
