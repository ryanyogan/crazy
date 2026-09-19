import { type ClientWeek, INTERNAL_CODE } from '@crazy/shared'

// The colours a Client's work is drawn in, wherever a line has to say whose it
// is: the rule down a timeline hour, the bar on "This week by Client", the mark
// beside a Todo. They are Industry's accent shades and nothing else, in the
// order frame 2a draws them, and Internal — which is no Client at all — stands
// back in neutral.

/** The accent shades, darkest first, as frame 2a gives them to its three Clients. */
const SHADES = [
  'var(--color-accent-700)',
  'var(--color-accent-400)',
  'var(--color-accent-200)',
] as const

/** What no Client at all is drawn in. */
const INTERNAL_SHADE = 'var(--color-neutral-400)'

/**
 * The colour one Client's work wears. Clients keep the order they were taken
 * on, so a Client's colour is the same on every screen and does not move when
 * a week's hours do; past the shades there are, they begin again.
 */
export function clientShade(clientId: string | null, clients: readonly ClientWeek[]): string {
  if (clientId === null) return INTERNAL_SHADE
  const order = clients.find((each) => each.clientId === clientId)?.order
  return order === undefined || order === null ? INTERNAL_SHADE : SHADES[order % SHADES.length]!
}

/**
 * The same colour, where the Clients come as a plain ordered list rather than
 * as a week's figures: the Time screen's rows and day cards. The order is the
 * list's own, which the read model gives in the order the Clients were taken
 * on, so a Client's colour is the same here as on the Today screen.
 */
export function timeShade(clientId: string | null, clients: readonly { id: string }[]): string {
  if (clientId === null) return INTERNAL_SHADE
  const order = clients.findIndex((each) => each.id === clientId)
  return order === -1 ? INTERNAL_SHADE : SHADES[order % SHADES.length]!
}

/** The three letters that stand for a Client on a line with no room for a name. */
export function clientCode(clientId: string | null, clients: readonly ClientWeek[]): string {
  return clients.find((each) => each.clientId === clientId)?.code ?? INTERNAL_CODE
}
