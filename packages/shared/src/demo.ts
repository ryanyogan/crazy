// With no Clerk keys configured the app runs as this user: the Ryan persona,
// Billing module off.
export const DEMO_USER = {
  id: 'user_demo_ryan',
  name: 'Ryan Yogan',
} as const

/**
 * The sample users the mockups draw, which a seed can reproduce for any user
 * id. Ryan has the Billing module off. (Cori, with it on, joins in ticket 16.)
 */
export const PERSONAS = ['ryan'] as const
export type Persona = (typeof PERSONAS)[number]
