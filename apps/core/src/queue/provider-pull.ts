// A shell. Nothing sends to this Queue yet and this consumer does nothing but
// say what arrived.
//
// What will fill it: pulling a user's items from a Provider — the short,
// idempotent, high-volume jobs, and inbound Provider webhooks — so that the
// Coordinator never waits on the outside world (ADR 0002). A run will take the
// Connection's token from Clerk at the moment of use (ADR 0001; Clerk refreshes
// only when asked, so a token is never cached between runs), read from the
// Provider, and hand what it found to `coordinatorFor(userId)` as commands.
//
// What it must never do: write to D1. Every write goes through the user's
// Coordinator, which decides it, orders it and broadcasts the patch (ADR 0002).
// Nor may it call back into the Coordinator and wait on a Provider in the same
// breath — the Coordinator bills wall-clock time while it is awake, and this
// Worker is billed on CPU, which is the whole reason this Queue exists.

/**
 * The Provider-pull Queue's consumer: it logs each message and acks it.
 *
 * Acking here, rather than letting the batch ack itself, is deliberate: when
 * this has a body, a message that could not be handled must be `retry()`ed
 * message by message, not by throwing the whole batch away.
 */
export function providerPull(batch: MessageBatch<unknown>): void {
  for (const message of batch.messages) {
    console.log(
      `crazy-provider-pull: ${message.id}, attempt ${message.attempts}, ${JSON.stringify(message.body)} — nothing pulls from a Provider yet (docs/BRIEF.md)`,
    )
    message.ack()
  }
}
