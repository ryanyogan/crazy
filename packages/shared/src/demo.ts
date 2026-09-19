// With no Clerk keys configured the app runs as this user: the Ryan persona,
// Billing module off.
export const DEMO_USER = {
  id: 'user_demo_ryan',
  name: 'Ryan Yogan',
} as const

/**
 * The sample users the mockups draw, which a seed can reproduce for any user
 * id. Ryan has the Billing module off; Cori, who bills three Clients for her
 * time, has it on.
 */
export const PERSONAS = ['ryan', 'cori'] as const

/** Whether a persona's world has the Billing module on. */
export const PERSONA_BILLING: Record<(typeof PERSONAS)[number], boolean> = {
  ryan: false,
  cori: true,
}
export type Persona = (typeof PERSONAS)[number]
