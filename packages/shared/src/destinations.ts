// The Shell's destinations. Which ones a user sees depends on whether the
// Billing module is on; nothing else about the Shell varies.

export type DestinationId =
  | 'today'
  | 'week'
  | 'projects'
  | 'time'
  | 'invoices'
  | 'circles'
  | 'metrics'
  | 'integrations'

export interface Destination {
  id: DestinationId
  to: '/' | `/${Exclude<DestinationId, 'today'>}`
  label: string
}

const D = {
  today: { id: 'today', to: '/', label: 'Today' },
  week: { id: 'week', to: '/week', label: 'Week' },
  projects: { id: 'projects', to: '/projects', label: 'Projects' },
  time: { id: 'time', to: '/time', label: 'Time' },
  invoices: { id: 'invoices', to: '/invoices', label: 'Invoices' },
  circles: { id: 'circles', to: '/circles', label: 'Circles' },
  metrics: { id: 'metrics', to: '/metrics', label: 'Metrics' },
  integrations: { id: 'integrations', to: '/integrations', label: 'Integrations' },
} as const satisfies Record<DestinationId, Destination>

/** Every destination, in the order the desktop Shell lists them. */
export function shellDestinations(billing: boolean): Destination[] {
  return billing
    ? [D.today, D.week, D.projects, D.time, D.invoices, D.circles, D.metrics, D.integrations]
    : [D.today, D.week, D.projects, D.circles, D.metrics, D.integrations]
}

/** The three destinations on the phone tab bar; More is always the fourth tab. */
export function tabBarDestinations(billing: boolean): Destination[] {
  return billing ? [D.today, D.time, D.invoices] : [D.today, D.week, D.projects]
}

/** What the More screen lists: every destination the tab bar leaves out. */
export function moreDestinations(billing: boolean): Destination[] {
  const onBar = new Set(tabBarDestinations(billing).map((d) => d.id))
  return shellDestinations(billing).filter((d) => !onBar.has(d.id))
}

/** Destinations that exist only with the Billing module on. */
export const BILLING_DESTINATIONS: ReadonlySet<DestinationId> = new Set(['time', 'invoices'])
