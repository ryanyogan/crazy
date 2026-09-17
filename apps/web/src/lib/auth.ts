/**
 * Clerk is on when a publishable key is configured. Without one the app runs
 * as the demo user (the Ryan persona) so it can be worked on offline.
 */
export const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
