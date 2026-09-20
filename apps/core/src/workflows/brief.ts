import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'

// A shell. Nothing starts this Workflow yet and its run does nothing but say
// it ran.
//
// What will fill it: writing a user's Brief and ordering their Priority stack
// with a reason per Todo (CONTEXT.md, "Brief"). It is a Workflow rather than a
// Queue message because it is several steps that must not repeat — read the
// day, ask the model, write — and because an LLM call is slow and may need
// retrying a step at a time (ADR 0002). The Coordinator's own schedule fires
// the trigger, because it is the one place that knows the user's Brief time,
// and then it goes back to sleep: it never awaits this.
//
// What it must never do: write to D1. What it decides is handed to
// `coordinatorFor(userId)` as commands, which is the one write path, so the
// Brief reaches open tabs as a patch like any other change (ADR 0002). Its
// model calls go through the AI Gateway binding (`apps/core/src/ai.ts`), never
// straight to a provider.

export interface BriefRun {
  /** Whose day this is. Every Workflow here is one user's. */
  userId: string
  /** The user's local day, "2025-09-17", never a moment: the time is a parameter. */
  day: string
}

export class BriefWorkflow extends WorkflowEntrypoint<Env, BriefRun> {
  override async run(event: WorkflowEvent<BriefRun>, step: WorkflowStep): Promise<void> {
    // A Workflow must call at least one step to be a Workflow. This one is the
    // shape the first real step will take, and it does nothing.
    await step.do('nothing yet', async () => {
      const said = `crazy-brief: ${event.instanceId} for ${event.payload.userId} on ${event.payload.day} — no Brief is generated yet (docs/BRIEF.md)`
      console.log(said)
      return said
    })
  }
}
