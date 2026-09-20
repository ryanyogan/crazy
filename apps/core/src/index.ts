import { providerPull } from './queue/provider-pull'

export { Coordinator } from './coordinator/Coordinator'

// The shells for what comes later, each declared and bound in wrangler.jsonc
// and each doing nothing but saying it ran. Their division of labour is ADR
// 0002: anything that waits on a Provider or a model runs out here, billed on
// CPU, and hands its writes to the user's Coordinator as commands; the
// Coordinator, billed on wall-clock time while awake, never awaits any of them.
export { BriefWorkflow } from './workflows/brief'
export { InvoiceWorkflow } from './workflows/invoice'
export { ArchiveWorkflow } from './workflows/archive'

export default {
  // No UI and no public routes. The web Worker reaches the Coordinator through
  // its cross-Worker Durable Object binding, and is the one that answers the
  // outside world — Clerk's account-deletion webhook among it
  // (apps/web/src/routes/webhooks.clerk.ts). Inbound Provider webhooks will be
  // routes here, beside the Queue that carries what they say.
  fetch() {
    return new Response('Not found', { status: 404 })
  },
  queue: providerPull,
} satisfies ExportedHandler<Env>
