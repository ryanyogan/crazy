/**
 * The browser's one reading of the clock. It stamps an optimistic update with
 * the moment the user acted, and nothing else: the Coordinator decides the
 * command again at its own moment, and its patch replaces what this guessed.
 * Screens never format against it; they format the moment their loader gave them.
 */
export const browserNow = (): Date => new Date()
