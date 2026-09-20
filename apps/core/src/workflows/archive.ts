import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'

// A shell. Nothing starts this Workflow yet and its run does nothing but say
// it ran.
//
// What will fill it: moving a user's archived Todos out of D1 and into R2, and
// searching what was moved. `archived` is a Todo state in D1 today and the
// Rollover already puts Todos into it; this is what carries them out when the
// table is no longer the place for them. It is a Workflow because it is many
// rows and many objects in steps that must not half-repeat (ADR 0002), and
// because it is the one job here that may take minutes.
//
// It is also the one job that will want the Attachment bucket in this Worker,
// which is why `ATTACHMENTS` is bound here (`wrangler.jsonc`): a Todo's files
// go where the Todo goes, and the files of a Todo that is deleted for good go
// with it. Everything a user has in the bucket is under `users/<userId>/`
// (`userPrefix` in `@crazy/shared`).
//
// What it must never do: write to D1 itself. Removing the rows it has archived
// is a command handed to `coordinatorFor(userId)`, in the user's own order,
// like every other change (ADR 0002) — and the Coordinator never touches R2, so
// the bytes are this Workflow's half of the bargain and the rows are its.

export interface ArchiveRun {
  /** Whose archive this is. Every Workflow here is one user's. */
  userId: string
  /** Archived before this local day, by the user's own archive period. */
  beforeDay: string
}

export class ArchiveWorkflow extends WorkflowEntrypoint<Env, ArchiveRun> {
  override async run(event: WorkflowEvent<ArchiveRun>, step: WorkflowStep): Promise<void> {
    // A Workflow must call at least one step to be a Workflow. This one is the
    // shape the first real step will take, and it does nothing.
    await step.do('nothing yet', async () => {
      const said = `crazy-archive: ${event.instanceId} for ${event.payload.userId} before ${event.payload.beforeDay} — nothing is moved to R2 yet (docs/BRIEF.md)`
      console.log(said)
      return said
    })
  }
}
