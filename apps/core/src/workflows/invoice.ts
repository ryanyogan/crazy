import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'

// A shell. Nothing starts this Workflow yet and its run does nothing but say
// it ran.
//
// What will fill it: one Client's invoice cycle — draft on their cadence,
// review, send, paid. It is the plainest case for a Workflow: its steps must
// not repeat (an invoice sent twice is a real mistake), and between draft and
// send it waits on a person, which is days rather than milliseconds (ADR 0002).
// The arithmetic behind a draft is already real and pure (`draftInvoice` in
// `@crazy/shared`); what is missing is the cycle around it and the sending.
//
// What it must never do: write to D1. Each step hands its outcome to
// `coordinatorFor(userId)` as a command, so a drafted or sent invoice reaches
// open tabs as a patch (ADR 0002). It must also never write to a Provider:
// every Provider is read-only and Crazy never changes a Source (ADR 0001) —
// the accounting sync, when it comes, is a decision of its own and not this
// shell's to assume.

export interface InvoiceRun {
  /** Whose invoice this is. Every Workflow here is one user's. */
  userId: string
  /** The Client being billed. */
  clientId: string
  /** The period being billed, as local days: the time is a parameter, never the clock. */
  fromDay: string
  toDay: string
}

export class InvoiceWorkflow extends WorkflowEntrypoint<Env, InvoiceRun> {
  override async run(event: WorkflowEvent<InvoiceRun>, step: WorkflowStep): Promise<void> {
    // A Workflow must call at least one step to be a Workflow. This one is the
    // shape the first real step will take, and it does nothing.
    await step.do('nothing yet', async () => {
      const said = `crazy-invoice: ${event.instanceId} for ${event.payload.userId}, client ${event.payload.clientId}, ${event.payload.fromDay}…${event.payload.toDay} — no invoice is drafted or sent yet (docs/BRIEF.md)`
      console.log(said)
      return said
    })
  }
}
