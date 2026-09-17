/** The current time is always a parameter. This is the one place it is read. */
export type Clock = () => Date

export const systemClock: Clock = () => new Date()
