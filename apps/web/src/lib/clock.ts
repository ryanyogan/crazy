/**
 * The browser's one reading of the clock. It stamps an optimistic update with
 * the moment the user acted: the Coordinator decides the command again at its
 * own moment, and its patch replaces what this guessed. It also times the wait
 * until a moment the server named, where the server's own `now` on the refetch
 * still decides what is shown. Those two, and nothing else.
 * Screens never format against it; they format the moment their loader gave them.
 */
export const browserNow = (): Date => new Date()
