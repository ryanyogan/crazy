import { describe, expect, it } from 'vite-plus/test'
import { moreDestinations, shellDestinations, tabBarDestinations } from './destinations'

const labels = (list: { label: string }[]) => list.map((d) => d.label)

describe('the Shell with the Billing module off', () => {
  it('shows the six destinations and nothing about billing', () => {
    expect(labels(shellDestinations(false))).toEqual([
      'Today',
      'Week',
      'Projects',
      'Circles',
      'Metrics',
      'Integrations',
    ])
  })

  it('puts Today, Week and Projects on the phone tab bar', () => {
    expect(labels(tabBarDestinations(false))).toEqual(['Today', 'Week', 'Projects'])
  })
})

describe('the Shell with the Billing module on', () => {
  it('adds Time and Invoices', () => {
    const shown = labels(shellDestinations(true))
    expect(shown).toContain('Time')
    expect(shown).toContain('Invoices')
    expect(shown).toHaveLength(8)
  })

  it('puts Today, Time and Invoices on the phone tab bar', () => {
    expect(labels(tabBarDestinations(true))).toEqual(['Today', 'Time', 'Invoices'])
  })
})

describe.each([false, true])('on a phone (Billing module on: %s)', (billing) => {
  it('reaches every destination from the tab bar or the More screen, once', () => {
    const reachable = [...tabBarDestinations(billing), ...moreDestinations(billing)]
    expect(labels(reachable).sort()).toEqual(labels(shellDestinations(billing)).sort())
  })
})
